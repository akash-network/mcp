import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { createOutput } from '../utils/create-output.js';
import { getTypeUrl } from '@akashnetwork/akashjs/build/stargate/index.js';
import { MsgDepositDeployment } from '@akashnetwork/akash-api/akash/deployment/v1beta3';
import { QueryClientImpl, QueryDeploymentRequest } from '@akashnetwork/akash-api/akash/deployment/v1beta3';
import { getRpc } from '@akashnetwork/akashjs/build/rpc/index.js';
import { SERVER_CONFIG } from '../config.js';

const parameters = z.object({
  address: z.string().min(1, 'Akash account address is required'),
  dseq: z.number().int().positive(),
  amount: z.string().min(1, 'Amount of uakt to add is required'),
});

export const AddFundsTool: ToolDefinition<typeof parameters> = {
  name: 'add-funds',
  description: 'Deposit additional AKT (uakt) into a deployment escrow account.',
  parameters,
  handler: async (params, context) => {
    const { address, dseq, amount } = params;
    try {
      // 1. Validate deployment exists
      const rpc = await getRpc(SERVER_CONFIG.rpcEndpoint);
      const deploymentClient = new QueryClientImpl(rpc);
      const queryReq = QueryDeploymentRequest.fromPartial({
        id: { owner: address, dseq },
      });
      const deploymentRes = await deploymentClient.Deployment(queryReq);
      if (!deploymentRes.deployment) {
        return createOutput({ error: `Deployment with owner ${address} and dseq ${dseq} not found.` });
      }

      // 2. Prepare MsgDepositDeployment
      const depositMsg = MsgDepositDeployment.fromPartial({
        id: { owner: address, dseq },
        amount: { denom: 'uakt', amount: amount.toString() },
        depositor: address,
      });
      const msg = {
        typeUrl: getTypeUrl(MsgDepositDeployment),
        value: depositMsg,
      };

      // 3. Sign and broadcast
      const tx = await context.client.signAndBroadcast(address, [msg], 'auto');
      return createOutput(tx.rawLog);
    } catch (error: any) {
      return createOutput({ error: error.message || 'Failed to add funds to deployment.' });
    }
  },
}; 