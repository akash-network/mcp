import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { createOutput } from '../utils/create-output.js';
import { getRpc } from '@akashnetwork/akashjs/build/rpc/index.js';
import { SERVER_CONFIG } from '../config.js';
import { QueryClientImpl, QueryDeploymentRequest } from '@akashnetwork/akash-api/akash/deployment/v1beta3';

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
    const { wallet } = context;

    try {
      const accounts = await wallet.getAccounts();
      if (!accounts || accounts.length === 0) {
        return createOutput({ error: 'No accounts found in wallet' });
      }

      const rpc = await getRpc(SERVER_CONFIG.rpcEndpoint);
      const deploymentClient = new QueryClientImpl(rpc);
      const queryReq = QueryDeploymentRequest.fromPartial({
        id: { owner: accounts[0].address, dseq },
      });
      const deploymentRes = await deploymentClient.Deployment(queryReq);
      
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