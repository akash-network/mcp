import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { createOutput } from '../utils/create-output.js';

const parameters = z.object({
  address: z.string().min(1, 'Akash account address is required'),
});

export const GetBalancesTool: ToolDefinition<typeof parameters> = {
  name: 'get-akash-balances',
  description: 'Get the AKT (uakt) and other balances for a given Akash account address.',
  parameters,
  handler: async (params: z.infer<typeof parameters>, context: ToolContext) => {
    try {
      // Query balances using chain SDK
      const balances = await context.chainSDK.cosmos.bank.v1beta1.getAllBalances({
        address: params.address,
      });
      return createOutput(balances.balances);
    } catch (error: any) {
      return createOutput({ error: error.message || 'Failed to fetch balances' });
    }
  },
};
