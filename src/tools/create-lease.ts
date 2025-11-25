import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { createOutput } from '../utils/create-output.js';

const parameters = z.object({
  owner: z.string().min(1),
  dseq: z.number().min(1),
  gseq: z.number().min(1),
  oseq: z.number().min(1),
  provider: z.string().min(1),
});

export const CreateLeaseTool: ToolDefinition<typeof parameters> = {
  name: 'create-lease',
  description:
    'Create a lease on Akash Network using the provided owner, dseq, gseq, oseq and provider from a bid.',
  parameters,
  handler: async (params: z.infer<typeof parameters>, context: ToolContext) => {
    const { chainSDK } = context;

    try {
      // Create lease using chain SDK (v1beta5 API)
      const result = await chainSDK.akash.market.v1beta5.createLease({
        bidId: {
          owner: params.owner,
          dseq: BigInt(params.dseq),
          gseq: params.gseq,
          oseq: params.oseq,
          provider: params.provider,
          bseq: 0, // Default bid sequence
        },
      });

      return createOutput({
        success: true,
        result: result,
      });
    } catch (error: any) {
      console.error('Error creating lease:', error);
      return createOutput({
        error: error.message || 'Unknown error creating lease',
      });
    }
  },
};
