import { z } from 'zod';
import type { ToolDefinition, ToolContext, CustomLease, CustomLeaseID } from '../types/index.js';
import { SDL, type CertificatePem } from '@akashnetwork/chain-sdk';
import { createOutput } from '../utils/create-output.js';
import type { ChainNodeSDK } from '../types/index.js';
import https from 'https';

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
    const { certificate, chainSDK } = context;

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
      await sendManifest(sdl, { id: lease }, certificate, chainSDK);
      return createOutput('Manifest sent successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return createOutput(`Error sending manifest: ${errorMessage}`);
    }
  },
};

export async function sendManifest(sdl: SDL, lease: CustomLease, certificate: CertificatePem, chainSDK?: ChainNodeSDK) {
  if (!lease.id) {
    throw new Error('Lease ID is undefined');
  }

  const { dseq, gseq, oseq, provider, owner } = lease.id;

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
  const path = `/deployment/${dseq}/manifest`;

  const uri = new URL(providerInfo.hostUri);

  // Create HTTPS agent with mTLS credentials
  // IMPORTANT: Use a custom servername that doesn't match the provider's hostname
  // This triggers mTLS mode on the provider (vs Let's Encrypt mode when SNI matches)
  const agent = new https.Agent({
    cert: certificate.cert,
    key: certificate.privateKey,
    rejectUnauthorized: false,
    // Use 'localhost' as SNI to trigger mTLS mode on the provider
    servername: 'localhost',
  });

  return await new Promise<void>((resolve, reject) => {
    const req = https.request(
      {
        hostname: uri.hostname,
        port: uri.port,
        path: path,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          'Content-Length': Buffer.byteLength(manifest),
        },
        agent: agent,
      },
      (res) => {
        res.on('error', reject);

        let responseBody = '';
        res.on('data', (chunk) => {
          responseBody += chunk.toString();
        });

        res.on('end', () => {
          if (res.statusCode !== 200) {
            return reject(new Error(`Could not send manifest: ${res.statusCode} - ${responseBody}`));
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
