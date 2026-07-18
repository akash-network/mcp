import { z } from 'zod/v3';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { createOutput } from '../utils/create-output.js';
import { getManifestVersion, parseSDL } from '../utils/parse-sdl.js';

const parameters = z.object({
  rawSDL: z.string().min(1),
  deposit: z.number().min(1),
  currency: z.string().min(1),
});

export const CreateDeploymentTool: ToolDefinition<typeof parameters> = {
  name: 'create-deployment',
  description:
    'Create a new deployment on Akash Network using the provided SDL (Service Definition Language) string, deposit amount and currency.' +
    'The deposit amount is the amount of tokens to deposit into the deployment.' +
    'Current Akash mainnet deployment escrow uses ACT (uact); check current chain parameters for the minimum deposit.',
  parameters,
  handler: async (params: z.infer<typeof parameters>, context: ToolContext) => {
    const { rawSDL } = params;
    const { wallet, chainSDK } = context;

    try {
      const sdl = parseSDL(rawSDL);

      const accounts = await wallet.getAccounts();
      if (!accounts || accounts.length === 0) {
        return createOutput({ error: 'No accounts found in wallet' });
      }

      // Get block height for deployment sequence number
      const statusResponse = await chainSDK.cosmos.base.tendermint.v1beta1.getLatestBlock({});
      const blockHeight = Number(statusResponse.block?.header?.height || 0);

      // Get groups from SDL
      const hash = await getManifestVersion(sdl);

      // Create deployment using chain SDK (v1beta4 API)
      const result = await chainSDK.akash.deployment.v1beta4.createDeployment({
        id: {
          owner: accounts[0].address,
          dseq: BigInt(blockHeight),
        },
        groups: sdl.groupSpecs,
        hash: hash,
        deposit: {
          amount: {
            denom: params.currency,
            amount: params.deposit.toString(),
          },
          sources: [1], // Source.balance = 1
        },
        reclamation: sdl.reclamation,
      });

      return createOutput({
        success: true,
        dseq: blockHeight,
        owner: accounts[0].address,
        result: result,
      });
    } catch (error: unknown) {
      console.error('Error creating deployment:', error);
      return createOutput({
        error: error instanceof Error ? error.message : String(error) || 'Unknown error creating deployment',
      });
    }
  },
};
