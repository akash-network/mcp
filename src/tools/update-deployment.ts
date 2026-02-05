import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { SDL } from '@akashnetwork/chain-sdk';
import { createOutput } from '../utils/create-output.js';
import { sendManifest } from './send-manifest.js';
import { queryLeases } from '../utils/query-leases.js';

const parameters = z.object({
  rawSDL: z.string().min(1),
  provider: z.string().min(1),
  dseq: z.number().min(1),
});

export const UpdateDeploymentTool: ToolDefinition<typeof parameters> = {
  name: 'update-deployment',
  description:
    'Update a deployment on Akash Network using the provided SDL (Service Definition Language) string. This tool also sends the manifest to the provider.' +
    'The dseq is the deployment sequence number.' +
    'The provider is the provider of the lease.',
  parameters,
  handler: async (params: z.infer<typeof parameters>, context: ToolContext) => {
    const { rawSDL, provider } = params;
    const { wallet, chainSDK, certificate } = context;

    try {
      // Parse SDL directly from the string using chain-sdk
      const sdl = SDL.fromString(rawSDL, 'beta3');
      const accounts = await wallet.getAccounts();

      if (!accounts || accounts.length === 0) {
        return createOutput({ error: 'No accounts found in wallet' });
      }

      const leases = await queryLeases(chainSDK, accounts[0].address, params.dseq, provider);

      if (leases.leases.length === 0) {
        return createOutput({ error: 'No leases found for deployment' });
      }

      const lease = leases.leases[0];

      // Update deployment using chain SDK (v1beta4 API)
      const result = await chainSDK.akash.deployment.v1beta4.updateDeployment({
        id: {
          owner: accounts[0].address,
          dseq: BigInt(params.dseq),
        },
        hash: await sdl.manifestVersion(),
      });

      const leaseId = {
        id: {
          owner: lease.lease?.id?.owner ?? '',
          dseq: Number(lease.lease?.id?.dseq ?? 0),
          gseq: lease.lease?.id?.gseq ?? 0,
          oseq: lease.lease?.id?.oseq ?? 0,
          provider: lease.lease?.id?.provider ?? '',
        },
      };

      // Send manifest to provider
      await sendManifest(sdl, leaseId, certificate, chainSDK);

      return createOutput({
        success: true,
        result: result,
      });
    } catch (error: any) {
      console.error('Error updating deployment:', error);
      return createOutput({
        error: error.message || 'Unknown error updating deployment',
      });
    }
  },
};
