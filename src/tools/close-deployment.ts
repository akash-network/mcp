import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { createOutput } from '../utils/create-output.js';

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
    const { wallet, chainSDK } = context;

    try {
      const accounts = await wallet.getAccounts();

      if (!accounts || accounts.length === 0) {
        return createOutput({ error: 'No accounts found in wallet' });
      }

      // Close deployment using chain SDK (v1beta4 API)
      const result = await chainSDK.akash.deployment.v1beta4.closeDeployment({
        id: {
          owner: accounts[0].address,
          dseq: BigInt(dseq),
        },
      });

      return createOutput({
        success: true,
        result: result,
      });
    } catch (error: any) {
      console.error('Error closing deployment:', error);
      return createOutput({
        error: error.message || 'Unknown error closing deployment',
      });
    }
  },
};
