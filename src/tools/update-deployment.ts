import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { MsgUpdateDeployment } from '@akashnetwork/akash-api/akash/deployment/v1beta3';
import { SDL } from '@akashnetwork/akashjs/build/sdl/SDL/SDL.js';
import { createOutput } from '../utils/create-output.js';
import { getTypeUrl } from '@akashnetwork/akashjs/build/stargate/index.js';
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
    const { wallet, client, certificate } = context;

    try {
      // Parse SDL directly from the string
      const sdl = SDL.fromString(rawSDL, 'beta3');
      const accounts = await wallet.getAccounts();

      if (!accounts || accounts.length === 0) {
        return createOutput({ error: 'No accounts found in wallet' });
      }

      const leases = await queryLeases(accounts[0].address, params.dseq, provider);

      if (leases.leases.length === 0) {
        return createOutput({ error: 'No leases found for deployment' });
      }

      const lease = leases.leases[0];

      const msg = {
        typeUrl: getTypeUrl(MsgUpdateDeployment),
        value: MsgUpdateDeployment.fromPartial({
          id: {
            owner: accounts[0].address,
            dseq: params.dseq,
          },
          version: await sdl.manifestVersion(),
        }),
      };

      const tx = await client.signAndBroadcast(accounts[0].address, [msg], 'auto');

      const leaseId = {
        id: {
          owner: lease.lease?.leaseId?.owner ?? '',
          dseq: lease.lease?.leaseId?.dseq.toNumber() ?? 0,
          gseq: lease.lease?.leaseId?.gseq ?? 0,
          oseq: lease.lease?.leaseId?.oseq ?? 0,
          provider: lease.lease?.leaseId?.provider ?? '',
        },
      };

      // Send manifest to provider
      await sendManifest(sdl, leaseId, certificate);

      return createOutput(tx.rawLog);
    } catch (error: any) {
      console.error('Error updating deployment:', error);
      return createOutput({
        error: error.message || 'Unknown error updating deployment',
      });
    }
  },
};
