import type { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import type { CertificatePem } from '@akashnetwork/chain-sdk';
import { loadWalletAndClient, loadCertificate, loadCertificateFromDisk } from './utils/index.js';
import { SERVER_CONFIG } from './config.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  GetAccountAddrTool,
  GetBidsTool,
  GetSDLsTool,
  GetSDLTool,
  SendManifestTool,
  CreateLeaseTool,
  GetServicesTool,
  CreateDeploymentTool,
  UpdateDeploymentTool,
  AddFundsTool,
  GetBalancesTool,
  CloseDeploymentTool,
  GetDeploymentTool,
  RevokeCertificateTool,
  RevokeAllCertificatesTool,
  RegenerateCertificateTool,
  GetLogsTool,
  ExecCommandTool,
} from './tools/index.js';
import type { ToolContext, ChainNodeSDK, StargateTxClient } from './types/index.js';

class AkashMCP extends McpServer {
  private wallet: DirectSecp256k1HdWallet | null = null;
  private client: StargateTxClient | null = null;
  private certificate: CertificatePem | null = null;
  private chainSDK: ChainNodeSDK | null = null;

  constructor() {
    super({
      name: SERVER_CONFIG.name,
      version: SERVER_CONFIG.version,
    });
  }

  private async getToolContext(): Promise<ToolContext> {
    if (!this.isInitialized()) {
      throw new Error('MCP server not initialized');
    }

    // Always read certificate fresh from disk to ensure we have the latest
    const accounts = await this.wallet!.getAccounts();
    const freshCert = loadCertificateFromDisk(accounts[0].address);
    if (freshCert) {
      this.certificate = freshCert;
    }

    return {
      client: this.client!,
      wallet: this.wallet!,
      certificate: this.certificate!,
      chainSDK: this.chainSDK!,
      reloadCertificate: this.reloadCertificate.bind(this),
    };
  }

  public async reloadCertificate(): Promise<CertificatePem> {
    if (!this.wallet || !this.client || !this.chainSDK) {
      throw new Error('Cannot reload certificate: server not initialized');
    }
    this.certificate = await loadCertificate(this.wallet, this.client, this.chainSDK);
    return this.certificate;
  }

  public getClient(): StargateTxClient {
    if (!this.client) {
      throw new Error('Client not initialized');
    }
    return this.client;
  }

  public async initialize() {
    try {
      const { wallet, client, chainSDK } = await loadWalletAndClient();
      this.wallet = wallet;
      this.client = client;
      this.chainSDK = chainSDK;
      this.certificate = await loadCertificate(wallet, client, chainSDK);
    } catch (error) {
      console.error('Failed to initialize MCP server:', error);
      throw error;
    }
  }

  public registerTools() {
    this.tool(
      GetAccountAddrTool.name,
      GetAccountAddrTool.description,
      GetAccountAddrTool.parameters.shape,
      async (args, extra) => GetAccountAddrTool.handler(args, await this.getToolContext())
    );

    this.tool(
      GetBidsTool.name,
      GetBidsTool.description,
      GetBidsTool.parameters.shape,
      async (args, extra) => GetBidsTool.handler(args, await this.getToolContext())
    );

    this.tool(
      CreateDeploymentTool.name,
      CreateDeploymentTool.description,
      CreateDeploymentTool.parameters.shape,
      async (args, extra) => CreateDeploymentTool.handler(args, await this.getToolContext())
    );

    this.tool(
      GetSDLsTool.name,
      GetSDLsTool.description,
      GetSDLsTool.parameters.shape,
      async (args, extra) => GetSDLsTool.handler(args, await this.getToolContext())
    );

    this.tool(
      GetSDLTool.name,
      GetSDLTool.description,
      GetSDLTool.parameters.shape,
      async (args, extra) => GetSDLTool.handler(args, await this.getToolContext())
    );

    this.tool(
      SendManifestTool.name,
      SendManifestTool.description,
      SendManifestTool.parameters.shape,
      async (args, extra) => SendManifestTool.handler(args, await this.getToolContext())
    );

    this.tool(
      CreateLeaseTool.name,
      CreateLeaseTool.description,
      CreateLeaseTool.parameters.shape,
      async (args, extra) => CreateLeaseTool.handler(args, await this.getToolContext())
    );

    this.tool(
      GetServicesTool.name,
      GetServicesTool.description,
      GetServicesTool.parameters.shape,
      async (args, extra) => GetServicesTool.handler(args, await this.getToolContext())
    );

    this.tool(
      UpdateDeploymentTool.name,
      UpdateDeploymentTool.description,
      UpdateDeploymentTool.parameters.shape,
      async (args, extra) => UpdateDeploymentTool.handler(args, await this.getToolContext())
    );

    this.tool(
      AddFundsTool.name,
      AddFundsTool.description,
      AddFundsTool.parameters.shape,
      async (args, extra) => AddFundsTool.handler(args, await this.getToolContext())
    );

    this.tool(
      GetBalancesTool.name,
      GetBalancesTool.description,
      GetBalancesTool.parameters.shape,
      async (args, extra) => GetBalancesTool.handler(args, await this.getToolContext())
    );

    this.tool(
      CloseDeploymentTool.name,
      CloseDeploymentTool.description,
      CloseDeploymentTool.parameters.shape,
      async (args, extra) => CloseDeploymentTool.handler(args, await this.getToolContext())
    );

    this.tool(
      GetDeploymentTool.name,
      GetDeploymentTool.description,
      GetDeploymentTool.parameters.shape,
      async (args, extra) => GetDeploymentTool.handler(args, await this.getToolContext())
    );

    this.tool(
      RevokeCertificateTool.name,
      RevokeCertificateTool.description,
      RevokeCertificateTool.parameters.shape,
      async (args, extra) => RevokeCertificateTool.handler(args, await this.getToolContext())
    );

    this.tool(
      RevokeAllCertificatesTool.name,
      RevokeAllCertificatesTool.description,
      RevokeAllCertificatesTool.parameters.shape,
      async (args, extra) => RevokeAllCertificatesTool.handler(args, await this.getToolContext())
    );

    this.tool(
      RegenerateCertificateTool.name,
      RegenerateCertificateTool.description,
      RegenerateCertificateTool.parameters.shape,
      async (args, extra) => RegenerateCertificateTool.handler(args, await this.getToolContext())
    );

    this.tool(
      GetLogsTool.name,
      GetLogsTool.description,
      GetLogsTool.parameters.shape,
      async (args, extra) => GetLogsTool.handler(args, await this.getToolContext())
    );

    this.tool(
      ExecCommandTool.name,
      ExecCommandTool.description,
      ExecCommandTool.parameters.shape,
      async (args, extra) => ExecCommandTool.handler(args, await this.getToolContext())
    );
  }
  public isInitialized(): boolean {
    return this.wallet !== null && this.client !== null && this.certificate !== null && this.chainSDK !== null;
  }
}

export default AkashMCP;
