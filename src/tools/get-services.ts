import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import https from 'https';
import { createOutput } from '../utils/create-output.js';

const parameters = z.object({
  owner: z.string().min(1),
  dseq: z.number().min(1),
  gseq: z.number().min(1),
  oseq: z.number().min(1),
  provider: z.string().min(1),
});

// Custom interfaces for our implementation
interface LeaseID {
  owner: string;
  dseq: number;
  gseq: number;
  oseq: number;
  provider: string;
}

interface CustomLease {
  id: LeaseID;
}

export const GetServicesTool: ToolDefinition<typeof parameters> = {
  name: 'get-services',
  description:
    'Get the services and their URIs for a lease on Akash Network using the provided owner, dseq, gseq, oseq and provider.',
  parameters,
  handler: async (params: z.infer<typeof parameters>, context: ToolContext) => {
    const { certificate, chainSDK } = context;

    // Create lease object with our custom type
    const lease: CustomLease = {
      id: {
        owner: params.owner,
        dseq: params.dseq,
        gseq: params.gseq,
        oseq: params.oseq,
        provider: params.provider,
      },
    };

    try {
      // Query provider using chain SDK (v1beta4 API)
      const providerRes = await chainSDK.akash.provider.v1beta4.getProvider({
        owner: params.provider,
      });

      if (providerRes.provider === undefined) {
        throw new Error(`Could not find provider ${params.provider}`);
      }

      const providerInfo = providerRes.provider;

      // Query lease status
      const leaseStatus = await queryLeaseStatus(lease, providerInfo.hostUri, certificate);

      return createOutput(leaseStatus);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return createOutput(`Error getting services: ${errorMessage}`);
    }
  },
};

async function queryLeaseStatus(lease: CustomLease, providerUri: string, certificate: any) {
  const id = lease.id;

  if (id === undefined) {
    throw new Error('Lease ID is undefined');
  }

  const leasePath = `/lease/${id.dseq}/${id.gseq}/${id.oseq}/status`;

  const agent = new https.Agent({
    cert: certificate.cert,
    key: certificate.privateKey,
    rejectUnauthorized: false,
    // Use 'localhost' as SNI to trigger mTLS mode on the provider
    servername: 'localhost',
  });

  const uri = new URL(providerUri);

  return await new Promise<{ services: Record<string, { uris: string[] }> }>((resolve, reject) => {
    const req = https.request(
      {
        hostname: uri.hostname,
        port: uri.port,
        path: leasePath,
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        agent: agent,
      },
      (res) => {
        if (res.statusCode !== 200) {
          return reject(`Could not query lease status: ${res.statusCode}`);
        }

        let data = '';

        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => resolve(JSON.parse(data)));
      }
    );

    req.on('error', reject);
    req.end();
  });
}
