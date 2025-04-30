import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { MsgCreateDeployment } from '@akashnetwork/akash-api/akash/deployment/v1beta3';
import { SDL } from '@akashnetwork/akashjs/build/sdl/SDL/SDL.js';
import { createOutput } from '../utils/create-output.js';
import { getTypeUrl } from '@akashnetwork/akashjs/build/stargate/index.js';

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
    const { wallet, client } = context;

    try {
      // Parse SDL directly from the string
      const sdl = SDL.fromString(rawSDL, 'beta3');

      const blockheight = await client.getHeight();
      const groups = sdl.groups();
      const accounts = await wallet.getAccounts();

      if (!accounts || accounts.length === 0) {
        return createOutput({ error: 'No accounts found in wallet' });
      }

      const deployment = {
        id: {
          owner: accounts[0].address,
          dseq: blockheight,
        },
        groups: groups,
        deposit: {
          denom: params.currency,
          amount: params.deposit.toString(),
        },
        version: await sdl.manifestVersion(),
        depositor: accounts[0].address,
      };

      const msg = {
        typeUrl: getTypeUrl(MsgCreateDeployment),
        value: MsgCreateDeployment.fromPartial(deployment),
      };

      const tx = await client.signAndBroadcast(accounts[0].address, [msg], 'auto');

      return createOutput(tx.rawLog);
    } catch (error: any) {
      console.error('Error creating deployment:', error);
      return createOutput({
        error: error.message || 'Unknown error creating deployment',
      });
    }
  },
};
