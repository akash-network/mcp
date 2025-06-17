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
      const balances = await context.client.getAllBalances(params.address);
      return createOutput(balances);
    } catch (error: any) {
      return createOutput({ error: error.message || 'Failed to fetch balances' });
    }
  },
};
