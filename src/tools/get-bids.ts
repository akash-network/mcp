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

      // Enrich bids with provider information
      const bidsWithProviderInfo = await Promise.all(
        bidsResponse.bids.map(async (bidResponse) => {
          const providerId = bidResponse.bid?.id?.provider;
          let providerInfo = null;

          if (providerId) {
            try {
              const providerRes = await chainSDK.akash.provider.v1beta4.getProvider({
                owner: providerId,
              });

              providerInfo = {
                hostUri: providerRes.provider?.hostUri,
                attributes: providerRes.provider?.attributes,
                info: providerRes.provider?.info,
              };
            } catch (error) {
              console.error(`Error fetching provider ${providerId}:`, error);
              providerInfo = { error: 'Could not fetch provider details' };
            }
          }

          return {
            bidId: bidResponse.bid?.id,
            state: bidResponse.bid?.state,
            price: bidResponse.bid?.price,
            createdAt: bidResponse.bid?.createdAt,
            provider: providerInfo,
          };
        })
      );

      if (bidsWithProviderInfo.length > 0) {
        return createOutput(bidsWithProviderInfo);
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
