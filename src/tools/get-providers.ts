import { z } from 'zod/v3';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { createOutput } from '../utils/index.js';

const parameters = z.object({
  limit: z.number().int().positive().max(1000).optional(),
  offset: z.number().int().nonnegative().optional(),
  countTotal: z.boolean().optional(),
});

// PageResponse carries a Uint8Array cursor and a Long total, neither of which
// survives JSON.stringify in a form a caller can use, so both are normalized
// before they reach createOutput.
function serializePagination(pagination: unknown) {
  if (!pagination || typeof pagination !== 'object') {
    return undefined;
  }

  const { nextKey, total } = pagination as { nextKey?: Uint8Array; total?: unknown };

  return {
    nextKey: nextKey && nextKey.length > 0 ? Buffer.from(nextKey).toString('base64') : null,
    total: total === undefined || total === null ? null : String(total),
  };
}

export const GetProvidersTool: ToolDefinition<typeof parameters> = {
  name: 'get-providers',
  description:
    'List providers on the Akash Network, with their host URI, attributes and contact info. Supports pagination via limit and offset. Should be used to discover which providers are available before creating a deployment. Multiple calls might be needed to fetch all providers.',
  parameters,
  handler: async (params: z.infer<typeof parameters>, context: ToolContext) => {
    const { limit, offset, countTotal } = params;
    const { chainSDK } = context;

    try {
      // Query providers using chain SDK (v1beta4 API)
      const providersResponse = await chainSDK.akash.provider.v1beta4.getProviders({
        pagination: {
          limit: limit === undefined ? undefined : BigInt(limit),
          offset: offset === undefined ? undefined : BigInt(offset),
          countTotal: countTotal ?? false,
        },
      });

      const providers = providersResponse.providers.map((provider) => ({
        owner: provider.owner,
        hostUri: provider.hostUri,
        attributes: provider.attributes,
        info: provider.info,
      }));

      if (providers.length === 0) {
        return createOutput('No providers found.');
      }

      return createOutput({
        providers: providers,
        pagination: serializePagination(providersResponse.pagination),
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('Error getting providers:', error);
      return createOutput({
        error: errorMessage || 'Unknown error getting providers',
      });
    }
  },
};
