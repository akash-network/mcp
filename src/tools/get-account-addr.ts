import { z } from 'zod/v3';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { createOutput } from '../utils/create-output.js';

export const GetAccountAddrTool: ToolDefinition<z.ZodObject<{}>> = {
  name: 'get-akash-account-addr',
  description: 'Get the address of the Akash account',
  parameters: z.object({}),
  handler: async (params: {}, context: ToolContext) => {
    const wallet = context.wallet;
    const account = (await wallet.getAccounts())[0];
    return createOutput(account.address || 'Account not found');
  },
};
