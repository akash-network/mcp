import { describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import AkashMCP from '../src/AkashMCP.js';
import {
  AddFundsTool,
  CloseDeploymentTool,
  CreateDeploymentTool,
  CreateLeaseTool,
  ExecCommandTool,
  RegenerateCertificateTool,
  RevokeAllCertificatesTool,
  RevokeCertificateTool,
  SendManifestTool,
  UpdateDeploymentTool,
} from '../src/tools/index.js';

const stateChangingTools = [
  AddFundsTool,
  CloseDeploymentTool,
  CreateDeploymentTool,
  CreateLeaseTool,
  ExecCommandTool,
  RegenerateCertificateTool,
  RevokeAllCertificatesTool,
  RevokeCertificateTool,
  SendManifestTool,
  UpdateDeploymentTool,
];

describe('state-changing tool safety', () => {
  it('requires an explicit true confirmation for every state-changing tool', () => {
    for (const tool of stateChangingTools) {
      expect(tool.parameters.shape.confirm.safeParse(true).success).toBe(true);
      expect(tool.parameters.shape.confirm.safeParse(false).success).toBe(false);
    }
  });

  it('advertises destructive and read-only MCP annotations', async () => {
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const server = new AkashMCP();
    const client = new Client({ name: 'tool-safety-test', version: '1.0.0' });
    server.registerTools();

    try {
      await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
      const { tools } = await client.listTools();

      for (const tool of stateChangingTools) {
        expect(tools.find((listedTool) => listedTool.name === tool.name)?.annotations).toMatchObject({
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: false,
          openWorldHint: true,
        });
      }

      expect(tools.find((tool) => tool.name === 'get-akash-account-addr')?.annotations).toMatchObject({
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      });
    } finally {
      await client.close();
      await server.close();
    }
  });
});
