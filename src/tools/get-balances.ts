import { z } from 'zod/v3';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { createOutput } from '../utils/create-output.js';

const parameters = z.object({
  address: z
    .string()
    .min(1, 'Akash account address cannot be empty')
    .optional()
    .describe('Akash account address. Omit to query the configured wallet.'),
});

export const GetBalancesTool: ToolDefinition<typeof parameters> = {
  name: 'get-akash-balances',
  description:
    'Get the AKT (uakt) and other balances for an Akash account. Defaults to the configured wallet.',
  parameters,
  handler: async (params: z.infer<typeof parameters>, context: ToolContext) => {
    try {
      let address = params.address;
      if (!address) {
        const accounts = await context.wallet.getAccounts();
        address = accounts[0]?.address;
        if (!address) {
          return createOutput({ error: 'No accounts found in wallet' });
        }
      }

      // Query balances using chain SDK
      const balances = await context.chainSDK.cosmos.bank.v1beta1.getAllBalances({
        address,
      });
      return createOutput(balances.balances);
    } catch (error: unknown) {
      return createOutput({ error: error instanceof Error ? error.message : String(error) || 'Failed to fetch balances' });
    }
  },
};
