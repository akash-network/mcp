import { z } from 'zod';
import type { ToolDefinition, ToolContext, CustomLease, CustomLeaseID } from '../types/index.js';
import { SDL } from '@akashnetwork/akashjs/build/sdl/SDL/SDL.js';
import { getRpc } from '@akashnetwork/akashjs/build/rpc/index.js';
import { createOutput } from '../utils/create-output.js';
import https from 'https';
import { SERVER_CONFIG } from '../config.js';
import {
  QueryClientImpl as QueryProviderClient,
  QueryProviderRequest,
} from '@akashnetwork/akash-api/akash/provider/v1beta3';
import type { CertificatePem } from '@akashnetwork/akashjs/build/certificates/certificate-manager/CertificateManager.js';

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
    const { wallet, certificate } = context;

    // Parse SDL
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
      await sendManifest(sdl, { id: lease }, certificate);
      return createOutput('Manifest sent successfully');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return createOutput(`Error sending manifest: ${errorMessage}`);
    }
  },
};

export async function sendManifest(sdl: SDL, lease: CustomLease, certificate: CertificatePem) {
  if (!lease.id) {
    throw new Error('Lease ID is undefined');
  }

  const { dseq, provider } = lease.id;
  const rpc = await getRpc(SERVER_CONFIG.rpcEndpoint);

  const client = new QueryProviderClient(rpc);
  const request = QueryProviderRequest.fromPartial({
    owner: provider,
  });

  const tx = await client.Provider(request);

  if (tx.provider === undefined) {
    throw new Error(`Could not find provider ${provider}`);
  }

  const providerInfo = tx.provider;
  const manifest = sdl.manifestSortedJSON();
  const path = `/deployment/${dseq}/manifest`;

  const uri = new URL(providerInfo.hostUri);
  const agent = new https.Agent({
    cert: certificate.cert,
    key: certificate.privateKey,
    rejectUnauthorized: false,
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
          'Content-Length': manifest.length,
        },
        agent: agent,
      },
      (res) => {
        res.on('error', reject);

        res.on('data', (chunk) => {
          // Helpful for debugging
          //console.warn("Response:", chunk.toString());
        });

        if (res.statusCode !== 200) {
          return reject(`Could not send manifest: ${res.statusCode}`);
        }

        resolve();
      }
    );

    req.on('error', reject);
    req.write(manifest);
    req.end();
  });
}
