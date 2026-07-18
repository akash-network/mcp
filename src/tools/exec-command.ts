import { z } from 'zod/v3';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import WebSocket from 'ws';
import { createOutput } from '../utils/create-output.js';
import {
  createProviderHeaders,
  createProviderToken,
  createProviderUrl,
} from '../utils/provider-auth.js';

const parameters = z.object({
  owner: z.string().min(1),
  dseq: z.number().min(1),
  gseq: z.number().min(1),
  oseq: z.number().min(1),
  provider: z.string().min(1),
  service: z.string().min(1).describe('Service name to execute the command in'),
  command: z
    .string()
    .min(1)
    .describe('Shell command to execute (e.g., "ls -la", "cat /etc/pingap/certs/origin.crt")'),
  stdin: z.boolean().optional().default(false).describe('Enable stdin for interactive commands'),
  tty: z.boolean().optional().default(true).describe('Allocate a pseudo-TTY'),
});

interface LeaseID {
  owner: string;
  dseq: number;
  gseq: number;
  oseq: number;
  provider: string;
}

interface ShellMessage {
  type: 'stdout' | 'stderr' | 'result' | 'error';
  data?: string;
  exitCode?: number;
}

export const ExecCommandTool: ToolDefinition<typeof parameters> = {
  name: 'exec-command',
  description:
    'Execute a shell command in a running deployment container. Similar to "kubectl exec" or "docker exec". Useful for debugging, checking files, restarting services, or making quick config changes without redeploying.',
  parameters,
  handler: async (params: z.infer<typeof parameters>, context: ToolContext) => {
    const { wallet, chainSDK } = context;

    try {
      // Query provider using chain SDK (v1beta4 API)
      const providerRes = await chainSDK.akash.provider.v1beta4.getProvider({
        owner: params.provider,
      });

      if (providerRes.provider === undefined) {
        throw new Error(`Could not find provider ${params.provider}`);
      }

      const providerInfo = providerRes.provider;

      // Execute command via WebSocket
      const output = await executeCommand(
        {
          owner: params.owner,
          dseq: params.dseq,
          gseq: params.gseq,
          oseq: params.oseq,
          provider: params.provider,
        },
        providerInfo.hostUri,
        await createProviderToken(wallet, 'shell', {
          provider: params.provider,
          dseq: params.dseq,
          gseq: params.gseq,
          oseq: params.oseq,
          services: [params.service],
        }),
        params.command,
        params.service,
        params.stdin ?? false,
        params.tty ?? true
      );

      return createOutput(output);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return createOutput(`Error executing command: ${errorMessage}`);
    }
  },
};

async function executeCommand(
  leaseId: LeaseID,
  providerUri: string,
  token: string,
  command: string,
  service: string,
  stdin: boolean,
  tty: boolean
): Promise<string> {
  // Build the WebSocket URL with query params
  // Path: /lease/{dseq}/{gseq}/{oseq}/shell
  // JWT-authenticated provider shell endpoints use indexed command parameters.
  let shellPath = `/lease/${leaseId.dseq}/${leaseId.gseq}/${leaseId.oseq}/shell`;

  // Build query string
  const queryParams = new URLSearchParams();

  // Add stdin and tty flags
  queryParams.set('stdin', stdin ? '1' : '0');
  queryParams.set('tty', tty ? '1' : '0');
  queryParams.set('podIndex', '0');

  // Add command as shell -c "command"
  queryParams.set('cmd0', 'sh');
  queryParams.set('cmd1', '-c');
  queryParams.set('cmd2', command);

  queryParams.set('service', service);

  shellPath += '?' + queryParams.toString();

  const wsUrl = createProviderUrl(providerUri, shellPath, 'websocket');

  return new Promise<string>((resolve, reject) => {
    const outputLines: string[] = [];
    let resolved = false;
    let exitCode: number | undefined;

    const ws = new WebSocket(wsUrl, {
      headers: createProviderHeaders(token),
    });

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        ws.close();
        if (outputLines.length > 0) {
          resolve(outputLines.join(''));
        } else {
          resolve('Command timed out (30s)');
        }
      }
    }, 30000); // 30 second timeout for commands

    ws.on('open', () => {
      // Connection established, command will execute
    });

    ws.on('message', (data: Buffer) => {
      try {
        // Provider may send JSON messages or raw output
        const text = data.toString();

        // Try to parse as JSON (some providers send structured output)
        try {
          const message = JSON.parse(text) as ShellMessage;
          if (message.type === 'stdout' || message.type === 'stderr') {
            if (message.data) {
              outputLines.push(message.data);
            }
          } else if (message.type === 'result') {
            exitCode = message.exitCode;
          } else if (message.type === 'error') {
            outputLines.push(`Error: ${message.data || 'Unknown error'}`);
          }
        } catch {
          // Not JSON - just raw output from the shell
          // The first byte might be a stream identifier (1=stdout, 2=stderr)
          if (data.length > 0) {
            const streamId = data[0];
            if (streamId === 1 || streamId === 2) {
              // Strip the stream identifier byte
              outputLines.push(data.subarray(1).toString());
            } else {
              outputLines.push(text);
            }
          }
        }
      } catch {
        outputLines.push(data.toString());
      }
    });

    ws.on('close', (code: number, reason: Buffer) => {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        let result = outputLines.join('');

        // Add exit code info if available
        if (exitCode !== undefined) {
          result += `\n[Exit code: ${exitCode}]`;
        }

        if (result.trim().length > 0) {
          resolve(result);
        } else if (code === 4000) {
          resolve('Error: Internal server error from provider');
        } else if (code === 4001) {
          resolve('Error: Lease not found');
        } else if (code === 4002) {
          resolve(
            'Error: Service not found. Specify the service name with the "service" parameter.'
          );
        } else {
          resolve(`Command completed (connection closed with code ${code})`);
        }
      }
    });

    ws.on('error', (error: Error) => {
      clearTimeout(timeout);
      if (!resolved) {
        resolved = true;
        reject(new Error(`WebSocket error: ${error.message}`));
      }
    });
  });
}
