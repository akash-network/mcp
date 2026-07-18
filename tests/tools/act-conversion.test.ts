import { describe, expect, it, vi } from 'vitest';
import { BurnActTool, GetActConversionStatusTool, MintActTool } from '../../src/tools/act-conversion.js';
import type { ToolContext } from '../../src/types/index.js';

function createContext(options?: {
  balances?: Array<{ denom: string; amount: string }>;
  mintsAllowed?: boolean;
  refundsAllowed?: boolean;
}) {
  const status = {
    status: 1,
    collateralRatio: '2.0',
    warnThreshold: '1.5',
    haltThreshold: '1.2',
    mintsAllowed: options?.mintsAllowed ?? true,
    refundsAllowed: options?.refundsAllowed ?? true,
  };
  return {
    wallet: {
      getAccounts: vi.fn().mockResolvedValue([{ address: 'akash1owner' }]),
    },
    chainSDK: {
      cosmos: {
        bank: {
          v1beta1: {
            getAllBalances: vi.fn().mockResolvedValue({ balances: options?.balances ?? [] }),
          },
        },
      },
      akash: {
        bme: {
          v1: {
            getParams: vi.fn().mockResolvedValue({
              params: {
                mintSpreadBps: 25,
                minMint: [{ denom: 'uact', amount: '10000000' }],
              },
            }),
            getStatus: vi.fn().mockResolvedValue(status),
            mintACT: vi.fn().mockResolvedValue({
              id: {
                denom: 'uakt',
                toDenom: 'uact',
                source: 'akash1owner',
                height: 12n,
                sequence: 3n,
              },
              status: 1,
            }),
            burnACT: vi.fn().mockResolvedValue({
              id: {
                denom: 'uact',
                toDenom: 'uakt',
                source: 'akash1owner',
                height: 13n,
                sequence: 1n,
              },
              status: 1,
            }),
          },
        },
        oracle: {
          v2: {
            getAggregatedPrice: vi.fn().mockResolvedValue({
              aggregatedPrice: {
                denom: 'akt',
                twap: '1.0',
                timestamp: new Date('2026-07-18T00:00:00.000Z'),
              },
              priceHealth: { isHealthy: true },
            }),
          },
        },
      },
    },
  } as unknown as ToolContext;
}

describe('ACT conversion tools', () => {
  it('uses positive integer strings so Cosmos coin amounts remain exact', () => {
    expect(MintActTool.parameters.safeParse({ amount: '1000000' }).success).toBe(true);
    expect(MintActTool.parameters.safeParse({ amount: 1000000 }).success).toBe(false);
    expect(MintActTool.parameters.safeParse({ amount: '0' }).success).toBe(false);
    expect(BurnActTool.parameters.safeParse({ amount: '-1' }).success).toBe(false);
  });

  it('reports BME circuit-breaker status', async () => {
    const context = createContext();
    const result = await GetActConversionStatusTool.handler({}, context);
    expect(JSON.parse(result.content[0].text)).toMatchObject({
      status: { mintsAllowed: true, refundsAllowed: true },
      mint: { minimumUact: '10000000', estimatedMinimumUakt: '10025063' },
    });
  });

  it('mints ACT only to the signing account', async () => {
    const context = createContext({ balances: [{ denom: 'uakt', amount: '20000000' }] });
    const result = await MintActTool.handler({ amount: '11000000' }, context);

    expect(JSON.parse(result.content[0].text)).toMatchObject({
      success: true,
      burned: { denom: 'uakt', amount: '11000000' },
      conversion: { recordId: { height: '12', sequence: '3' } },
    });
    expect(context.chainSDK.akash.bme.v1.mintACT).toHaveBeenCalledWith({
      owner: 'akash1owner',
      to: 'akash1owner',
      coinsToBurn: { denom: 'uakt', amount: '11000000' },
    });
  });

  it('fails closed when ACT minting is disabled', async () => {
    const context = createContext({ mintsAllowed: false });
    const result = await MintActTool.handler({ amount: '11000000' }, context);
    expect(JSON.parse(result.content[0].text).error).toContain('disabled');
    expect(context.chainSDK.akash.bme.v1.mintACT).not.toHaveBeenCalled();
  });

  it('burns ACT back to AKT only from the signing account', async () => {
    const context = createContext({ balances: [{ denom: 'uact', amount: '700000' }] });
    const result = await BurnActTool.handler({ amount: '500000' }, context);

    expect(JSON.parse(result.content[0].text)).toMatchObject({
      success: true,
      burned: { denom: 'uact', amount: '500000' },
    });
    expect(context.chainSDK.akash.bme.v1.burnACT).toHaveBeenCalledWith({
      owner: 'akash1owner',
      to: 'akash1owner',
      coinsToBurn: { denom: 'uact', amount: '500000' },
    });
  });

  it('rejects conversions larger than the available balance', async () => {
    const context = createContext({ balances: [{ denom: 'uakt', amount: '10000000' }] });
    const result = await MintActTool.handler({ amount: '11000000' }, context);
    expect(JSON.parse(result.content[0].text).error).toContain('Insufficient uakt balance');
    expect(context.chainSDK.akash.bme.v1.mintACT).not.toHaveBeenCalled();
  });

  it('rejects guaranteed below-minimum mints before paying a transaction fee', async () => {
    const context = createContext({ balances: [{ denom: 'uakt', amount: '20000000' }] });
    const result = await MintActTool.handler({ amount: '1000000' }, context);
    expect(JSON.parse(result.content[0].text).error).toContain('below the chain minimum');
    expect(context.chainSDK.akash.bme.v1.mintACT).not.toHaveBeenCalled();
  });
});
