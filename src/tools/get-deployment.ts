import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { createOutput } from '../utils/create-output.js';

const parameters = z.object({
  dseq: z.number().min(1),
});

export const GetDeploymentTool: ToolDefinition<typeof parameters> = {
  name: 'get-deployment',
  description:
    'Get deployment details from Akash Network including status, groups, and escrow account. ' +
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

      // Query deployment using chain SDK (v1beta4 API)
      const deploymentRes = await chainSDK.akash.deployment.v1beta4.getDeployment({
        id: {
          owner: accounts[0].address,
          dseq: BigInt(dseq),
        },
      });

      if (!deploymentRes.deployment) {
        return createOutput({ error: `Deployment ${dseq} not found for owner ${accounts[0].address}` });
      }

      return createOutput({
        deployment: deploymentRes.deployment,
        groups: deploymentRes.groups,
        escrowAccount: deploymentRes.escrowAccount,
      });
    } catch (error: any) {
      console.error('Error getting deployment:', error);
      return createOutput({
        error: error.message || 'Unknown error getting deployment',
      });
    }
  },
};
