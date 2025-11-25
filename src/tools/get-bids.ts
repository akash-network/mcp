import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { createOutput } from '../utils/index.js';

const parameters = z.object({
  dseq: z.number().int().positive(),
  owner: z.string().min(1),
});

export const GetBidsTool: ToolDefinition<typeof parameters> = {
  name: 'get-bids',
  description:
    'Get bids for a deployment with the given dseq number, owner. Should be used to get bids for a deployment that is currently being bid on. Multiple calls to this tool might be needed to fetch all bids.',
  parameters,
  handler: async (params: z.infer<typeof parameters>, context: ToolContext) => {
    const { dseq, owner } = params;
    const { chainSDK } = context;

    try {
      // Query bids using chain SDK (v1beta5 API)
      const bidsResponse = await chainSDK.akash.market.v1beta5.getBids({
        filters: {
          owner: owner,
          dseq: BigInt(dseq),
        },
      });

      const bids = bidsResponse.bids.map((bidResponse) => {
        return {
          bidId: bidResponse.bid?.id,
          state: bidResponse.bid?.state,
          price: bidResponse.bid?.price,
          createdAt: bidResponse.bid?.createdAt,
        };
      });

      if (bids.length > 0) {
        return createOutput(bids);
      } else {
        return createOutput('No bids found for deployment ' + dseq + '.');
      }
    } catch (error: any) {
      console.error('Error getting bids:', error);
      return createOutput({
        error: error.message || 'Unknown error getting bids',
      });
    }
  },
};
