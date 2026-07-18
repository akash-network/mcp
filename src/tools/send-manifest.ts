import { z } from 'zod/v3';
import type {
  ToolDefinition,
  ToolContext,
  CustomLease,
  CustomLeaseID,
  AkashWallet,
} from '../types/index.js';
import { SDL } from '@akashnetwork/chain-sdk';
import { createOutput } from '../utils/create-output.js';
import type { ChainNodeSDK } from '../types/index.js';
import https from 'https';
import {
  createProviderHeaders,
  createProviderToken,
  createProviderUrl,
} from '../utils/provider-auth.js';

const parameters = z.object({
  sdl: z.string().min(1),
  owner: z.string().min(1),
  dseq: z.number().min(1),
  gseq: z.number().min(1),
  oseq: z.number().min(1),
  provider: z.string().min(1),
});

export const SendManifestTool: ToolDefinition<typeof parameters> = {
  name: 'send-manifest',
  description:
    'Send a manifest to a provider using the provided SDL, owner, dseq, gseq, oseq and provider.',
  parameters,
  handler: async (params: z.infer<typeof parameters>, context: ToolContext) => {
    const { wallet, chainSDK } = context;

    // Parse SDL using chain-sdk
    const sdl = SDL.fromString(params.sdl, 'beta3');

    // Create lease object with our custom type
    const lease: CustomLeaseID = {
      owner: params.owner,
      dseq: params.dseq,
      gseq: params.gseq,
      oseq: params.oseq,
      provider: params.provider,
    };

    try {
      await sendManifest(sdl, { id: lease }, wallet, chainSDK);
      return createOutput('Manifest sent successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return createOutput(`Error sending manifest: ${errorMessage}`);
    }
  },
};

export async function sendManifest(
  sdl: SDL,
  lease: CustomLease,
  wallet: AkashWallet,
  chainSDK?: ChainNodeSDK
) {
  const { dseq, gseq, oseq, provider } = lease.id;

  if (!chainSDK) {
    throw new Error('ChainSDK is required to send manifest');
  }

  // Query provider using chain SDK (v1beta4 API)
  const providerRes = await chainSDK.akash.provider.v1beta4.getProvider({
    owner: provider,
  });

  if (providerRes.provider === undefined) {
    throw new Error(`Could not find provider ${provider}`);
  }

  const providerInfo = providerRes.provider;
  const manifest = sdl.manifestSortedJSON();
  const services = sdl
    .manifest()
    .flatMap((group) =>
      'services' in group
        ? group.services.map((service) => service.name)
        : group.Services.map((service) => service.Name)
    );
  const token = await createProviderToken(wallet, 'send-manifest', {
    provider,
    dseq,
    gseq,
    oseq,
    services,
  });
  const url = createProviderUrl(providerInfo.hostUri, `/deployment/${dseq}/manifest`);

  return await new Promise<void>((resolve, reject) => {
    const req = https.request(
      url,
      {
        method: 'PUT',
        headers: createProviderHeaders(token, {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Content-Length': Buffer.byteLength(manifest),
        }),
      },
      (res) => {
        res.on('error', reject);

        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk.toString();
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(
              new Error(`Could not send manifest: ${res.statusCode} - ${responseBody}`)
            );
          }
          resolve();
        });
      }
    );

    req.on('error', reject);
    req.write(manifest);
    req.end();
  });
}
