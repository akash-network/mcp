import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { SDL } from '@akashnetwork/chain-sdk';
import { createOutput } from '../utils/create-output.js';

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
    'Minimum deposit amount is 500000 uakt.',
  parameters,
  handler: async (params: z.infer<typeof parameters>, context: ToolContext) => {
    const { rawSDL } = params;
    const { wallet, chainSDK } = context;

    try {
      // Parse SDL directly from the string using chain-sdk
      const sdl = SDL.fromString(rawSDL, 'beta3');

      const accounts = await wallet.getAccounts();
      if (!accounts || accounts.length === 0) {
        return createOutput({ error: 'No accounts found in wallet' });
      }

      // Get block height for deployment sequence number
      const statusResponse = await chainSDK.cosmos.base.tendermint.v1beta1.getLatestBlock({});
      const blockHeight = Number(statusResponse.block?.header?.height || 0);

      // Get groups from SDL
      const groups = sdl.groups();

      // Get manifest hash
      const hash = await sdl.manifestVersion();

      // Create deployment using chain SDK (v1beta4 API)
      const result = await chainSDK.akash.deployment.v1beta4.createDeployment({
        id: {
          owner: accounts[0].address,
          dseq: BigInt(blockHeight),
        },
        groups: groups,
        hash: hash,
        deposit: {
          amount: {
            denom: params.currency,
            amount: params.deposit.toString(),
          },
          sources: [1], // Source.balance = 1
        },
      });

      return createOutput({
        success: true,
        dseq: blockHeight,
        owner: accounts[0].address,
        result: result,
      });
    } catch (error: any) {
      console.error('Error creating deployment:', error);
      return createOutput({
        error: error.message || 'Unknown error creating deployment',
      });
    }
  },
};
