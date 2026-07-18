import { z } from 'zod/v3';
import type { ChainNodeSDK, ToolContext, ToolDefinition } from '../types/index.js';
import { createOutput } from '../utils/create-output.js';

const amountSchema = z
  .string()
  .regex(/^[1-9]\d*$/, 'Amount must be a positive integer in the smallest denomination');

const conversionParameters = z.object({
  amount: amountSchema,
});

const noParameters = z.object({});
const PRICE_SCALE = 1_000_000_000_000_000_000n;

function decimalToScaledInteger(value: string): bigint {
  const [whole = '0', fraction = ''] = value.split('.');
  const normalizedFraction = fraction.slice(0, 18).padEnd(18, '0');
  return BigInt(whole) * PRICE_SCALE + BigInt(normalizedFraction);
}

function divideRoundingUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator - 1n) / denominator;
}

async function getMintPreflight(chainSDK: ChainNodeSDK, amount?: string) {
  const [status, paramsResponse, oracleResponse] = await Promise.all([
    chainSDK.akash.bme.v1.getStatus({}),
    chainSDK.akash.bme.v1.getParams({}),
    chainSDK.akash.oracle.v2.getAggregatedPrice({ denom: 'akt' }),
  ]);
  const params = paramsResponse.params;
  const oracle = oracleResponse.aggregatedPrice;
  const oracleHealth = oracleResponse.priceHealth;

  if (!params || !oracle || !oracleHealth) {
    throw new Error('Akash did not return complete BME parameters and oracle data');
  }

  const minimumUact = params.minMint.find((coin) => coin.denom === 'uact')?.amount ?? '0';
  const price = decimalToScaledInteger(oracle.twap);
  const spreadMultiplier = BigInt(10_000 - params.mintSpreadBps);
  const conversionDivisor = PRICE_SCALE * 10_000n;
  const minimumUakt = divideRoundingUp(
    BigInt(minimumUact) * conversionDivisor,
    price * spreadMultiplier
  );
  const estimatedUact = amount
    ? (BigInt(amount) * price * spreadMultiplier) / conversionDivisor
    : undefined;

  return {
    status,
    oracleHealth,
    mint: {
      oracleDenom: oracle.denom,
      oracleTwap: oracle.twap,
      oracleTimestamp: oracle.timestamp?.toISOString(),
      mintSpreadBps: params.mintSpreadBps,
      minimumUact,
      estimatedMinimumUakt: minimumUakt.toString(),
      estimatedUact: estimatedUact?.toString(),
    },
  };
}

async function getAccount(context: ToolContext): Promise<string> {
  const accounts = await context.wallet.getAccounts();
  if (!accounts.length) {
    throw new Error('No accounts found in wallet');
  }
  return accounts[0].address;
}

async function getBalance(chainSDK: ChainNodeSDK, address: string, denom: string): Promise<string> {
  const response = await chainSDK.cosmos.bank.v1beta1.getAllBalances({ address });
  return response.balances.find((coin) => coin.denom === denom)?.amount ?? '0';
}

function serializeConversionResult(result: {
  id?: {
    denom: string;
    toDenom: string;
    source: string;
    height: bigint;
    sequence: bigint;
  };
  status: number;
}) {
  return {
    status: result.status,
    recordId: result.id
      ? {
        ...result.id,
        height: result.id.height.toString(),
        sequence: result.id.sequence.toString(),
      }
      : undefined,
  };
}

export const GetActConversionStatusTool: ToolDefinition<typeof noParameters> = {
  name: 'get-act-conversion-status',
  description:
    'Check whether the Akash BME module currently permits AKT-to-ACT mints and ACT-to-AKT refunds, ' +
    'and return the current oracle-based minimum mint estimate.',
  parameters: noParameters,
  handler: async (_params, context) => {
    try {
      return createOutput(await getMintPreflight(context.chainSDK));
    } catch (error: unknown) {
      return createOutput({
        error: error instanceof Error ? error.message : String(error) || 'Failed to query BME status',
      });
    }
  },
};

export const MintActTool: ToolDefinition<typeof conversionParameters> = {
  name: 'mint-act',
  description:
    'Convert AKT to ACT for Akash deployment escrow by burning the specified uakt amount. ' +
    'The ACT output depends on current oracle prices and the BME mint spread. 1 AKT is 1000000 uakt.',
  parameters: conversionParameters,
  handler: async ({ amount }, context) => {
    try {
      const owner = await getAccount(context);
      const preflight = await getMintPreflight(context.chainSDK, amount);
      if (!preflight.status.mintsAllowed) {
        return createOutput({
          error: 'ACT minting is currently disabled by the BME circuit breaker',
          preflight,
        });
      }
      if (!preflight.oracleHealth.isHealthy) {
        return createOutput({ error: 'The AKT oracle price is currently unhealthy', preflight });
      }
      if (BigInt(preflight.mint.estimatedUact ?? '0') < BigInt(preflight.mint.minimumUact)) {
        return createOutput({
          error:
            `This conversion is estimated to mint ${preflight.mint.estimatedUact} uact, below ` +
            `the chain minimum of ${preflight.mint.minimumUact} uact. Use at least ` +
            `${preflight.mint.estimatedMinimumUakt} uakt at the current oracle price.`,
          preflight,
        });
      }

      const available = await getBalance(context.chainSDK, owner, 'uakt');
      if (BigInt(available) < BigInt(amount)) {
        return createOutput({
          error: `Insufficient uakt balance: requested ${amount}, available ${available}`,
        });
      }

      const result = await context.chainSDK.akash.bme.v1.mintACT({
        owner,
        to: owner,
        coinsToBurn: { denom: 'uakt', amount },
      });

      return createOutput({
        success: true,
        burned: { denom: 'uakt', amount },
        preflight,
        conversion: serializeConversionResult(result),
      });
    } catch (error: unknown) {
      return createOutput({
        error: error instanceof Error ? error.message : String(error) || 'Failed to mint ACT',
      });
    }
  },
};

export const BurnActTool: ToolDefinition<typeof conversionParameters> = {
  name: 'burn-act',
  description:
    'Convert unused ACT back to AKT by burning the specified uact amount. ' +
    'The AKT output depends on current oracle prices and BME accounting. 1 ACT is 1000000 uact.',
  parameters: conversionParameters,
  handler: async ({ amount }, context) => {
    try {
      const owner = await getAccount(context);
      const status = await context.chainSDK.akash.bme.v1.getStatus({});
      if (!status.refundsAllowed) {
        return createOutput({ error: 'ACT refunds are currently disabled by the BME circuit breaker', status });
      }

      const available = await getBalance(context.chainSDK, owner, 'uact');
      if (BigInt(available) < BigInt(amount)) {
        return createOutput({
          error: `Insufficient uact balance: requested ${amount}, available ${available}`,
        });
      }

      const result = await context.chainSDK.akash.bme.v1.burnACT({
        owner,
        to: owner,
        coinsToBurn: { denom: 'uact', amount },
      });

      return createOutput({
        success: true,
        burned: { denom: 'uact', amount },
        conversion: serializeConversionResult(result),
      });
    } catch (error: unknown) {
      return createOutput({
        error: error instanceof Error ? error.message : String(error) || 'Failed to burn ACT',
      });
    }
  },
};
