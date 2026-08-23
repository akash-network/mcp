import { z } from 'zod/v3';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { createOutput } from '../utils/index.js';

const parameters = z.object({
  owner: z.string().min(1),
});

export const GetProviderTool: ToolDefinition<typeof parameters> = {
  name: 'get-provider',
  description:
    'Get details for a single provider by its owner address, including the host URI, attributes and contact info. Should be used to inspect a provider before accepting one of its bids or sending it a manifest.',
  parameters,
  handler: async (params: z.infer<typeof parameters>, context: ToolContext) => {
    const { owner } = params;
    const { chainSDK } = context;

    try {
      // Query the provider using chain SDK (v1beta4 API)
      const providerResponse = await chainSDK.akash.provider.v1beta4.getProvider({
        owner: owner,
      });

      const provider = providerResponse.provider;

      if (!provider) {
        return createOutput('No provider found for owner ' + owner + '.');
      }

      return createOutput({
        owner: provider.owner,
        hostUri: provider.hostUri,
        attributes: provider.attributes,
        info: provider.info,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error getting provider:', error);
      return createOutput({
        error: errorMessage || 'Unknown error getting provider',
      });
    }
  },
};
