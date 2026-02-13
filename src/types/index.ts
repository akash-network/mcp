import type { z } from 'zod';
import type { SigningStargateClient } from '@cosmjs/stargate';
import type { DirectSecp256k1HdWallet, DirectSecp256k1Wallet } from '@cosmjs/proto-signing';
import type { ReadResourceCallback } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { CertificatePem } from '@akashnetwork/akashjs/build/certificates/certificate-manager/CertificateManager.js';

// Tool related types
export interface ToolContext {
  client: SigningStargateClient;
  wallet: DirectSecp256k1HdWallet | DirectSecp256k1Wallet;
  certificate: CertificatePem;
}

export interface ToolDefinition<P extends z.ZodType> {
  name: string;
  description: string;
  parameters: P;
  handler: (params: z.infer<P>, context: ToolContext) => Promise<any>;
}

export interface ResourceDefinition {
  name: string;
  uri: string;
  readCallback: ReadResourceCallback;
}

export interface CustomLease {
  id: CustomLeaseID;
}

export interface CustomLeaseID {
  owner: string;
  dseq: number;
  gseq: number;
  oseq: number;
  provider: string;
}

// Configuration types
export interface ServerConfiguration {
  port: number;
  apiKey?: string;
  environment: 'development' | 'production' | 'test';
}
