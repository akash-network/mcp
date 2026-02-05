import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import https from 'https';
import WebSocket from 'ws';
import { createOutput } from '../utils/create-output.js';
import type { ClientRequestArgs } from 'http';

const parameters = z.object({
  owner: z.string().min(1),
  dseq: z.number().min(1),
  gseq: z.number().min(1),
  oseq: z.number().min(1),
  provider: z.string().min(1),
  service: z.string().optional().describe('Optional service name to filter logs (e.g., "infisical", "postgres"). If not provided, returns logs from all services.'),
  tail: z.number().optional().default(100).describe('Number of lines to return from the end of the logs'),
});

interface LeaseID {
  owner: string;
  dseq: number;
  gseq: number;
  oseq: number;
  provider: string;
}

interface ServiceLogMessage {
  Name: string;
  Message: string;
}

export const GetLogsTool: ToolDefinition<typeof parameters> = {
  name: 'get-logs',
  description:
    'Get container logs for a deployment. Uses WebSocket connection to provider. Useful for debugging deployment issues.',
  parameters,
  handler: async (params: z.infer<typeof parameters>, context: ToolContext) => {
    const { certificate, chainSDK } = context;

    try {
      // Query provider using chain SDK (v1beta4 API)
      const providerRes = await chainSDK.akash.provider.v1beta4.getProvider({
        owner: params.provider,
      });

      if (providerRes.provider === undefined) {
        throw new Error(`Could not find provider ${params.provider}`);
      }

      const providerInfo = providerRes.provider;

      // Query lease logs via WebSocket
      const logs = await queryLeaseLogs(
        {
          owner: params.owner,
          dseq: params.dseq,
          gseq: params.gseq,
          oseq: params.oseq,
          provider: params.provider,
        },
        providerInfo.hostUri,
        certificate,
        params.service,
        params.tail || 100
      );

      return createOutput(logs);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return createOutput(`Error getting logs: ${errorMessage}`);
    }
  },
};

async function queryLeaseLogs(
  leaseId: LeaseID,
  providerUri: string,
  certificate: any,
  service: string | undefined,
  tail: number
): Promise<string> {
  const uri = new URL(providerUri);

  // Build the WebSocket URL with query params
  // Path: /lease/{dseq}/{gseq}/{oseq}/logs
  let logsPath = `/lease/${leaseId.dseq}/${leaseId.gseq}/${leaseId.oseq}/logs?follow=false&tail=${tail}`;
  if (service) {
    logsPath += `&services=${encodeURIComponent(service)}`;
  }

  const wsUrl = `wss://${uri.hostname}:${uri.port || 8443}${logsPath}`;

  return new Promise<string>((resolve, reject) => {
    const logLines: string[] = [];
    let resolved = false;

    // Create HTTPS agent with mTLS credentials
    const agent = new https.Agent({
      cert: certificate.cert,
      key: certificate.privateKey,
      rejectUnauthorized: false,
      // Use 'localhost' as SNI to trigger mTLS mode on the provider
      servername: 'localhost',
    });

    // Create WebSocket with mTLS via agent
    const ws = new WebSocket(wsUrl, {
      agent,
      headers: {
        'Host': 'localhost',
      },
    } as ClientRequestArgs);

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        if (logLines.length > 0) {
          resolve(logLines.join('\n'));
        } else {
          resolve('No logs received (timeout)');
        }
      }
    }, 10000); // 10 second timeout

    ws.on('open', () => {
      // Connection established, waiting for logs
    });

    ws.on('message', (data: Buffer) => {
      try {
        const message = JSON.parse(data.toString()) as ServiceLogMessage;
        if (message.Name && message.Message) {
          logLines.push(`[${message.Name}] ${message.Message}`);
        } else {
          // Raw message
          logLines.push(data.toString());
        }
      } catch {
        // Not JSON, add as raw line
        logLines.push(data.toString());
      }
    });

    ws.on('close', (code, reason) => {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        if (logLines.length > 0) {
          resolve(logLines.join('\n'));
        } else if (code === 4000) {
          resolve('Error: Internal server error from provider');
        } else if (code === 4001) {
          resolve('Error: Lease not found');
        } else {
          resolve(`No logs available (connection closed with code ${code})`);
        }
      }
    });

    ws.on('error', (error) => {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        reject(new Error(`WebSocket error: ${error.message}`));
      }
    });
  });
}
