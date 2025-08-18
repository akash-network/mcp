import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { MsgCloseDeployment } from '@akashnetwork/akash-api/akash/deployment/v1beta3';
import { createOutput } from '../utils/create-output.js';
import { getTypeUrl } from '@akashnetwork/akashjs/build/stargate/index.js';

const parameters = z.object({
  dseq: z.number().min(1),
});

export const CloseDeploymentTool: ToolDefinition<typeof parameters> = {
  name: 'close-deployment',
  description:
    'Close a deployment on Akash Network. ' +
    'The dseq is the deployment sequence number.',
  parameters,
  handler: async (params: z.infer<typeof parameters>, context: ToolContext) => {
    const { dseq } = params;
    const { wallet, client } = context;

    try {
      const accounts = await wallet.getAccounts();

      if (!accounts || accounts.length === 0) {
        return createOutput({ error: 'No accounts found in wallet' });
      }

      const msg = {
        typeUrl: getTypeUrl(MsgCloseDeployment),
        value: MsgCloseDeployment.fromPartial({
          id: {
            owner: accounts[0].address,
            dseq: dseq,
          },
        }),
      };

      const tx = await client.signAndBroadcast(accounts[0].address, [msg], 'auto');

      return createOutput(tx.rawLog);
    } catch (error: any) {
      console.error('Error closing deployment:', error);
      return createOutput({
        error: error.message || 'Unknown error closing deployment',
      });
    }
  },
};