import type { CertificatePem } from '@akashnetwork/chain-sdk';
import { loadWalletAndClient, loadCertificate, loadCertificateFromDisk } from './utils/index.js';
import { SERVER_CONFIG } from './config.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolAnnotations } from '@modelcontextprotocol/sdk/types.js';
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
import type { ToolContext, AkashWallet, ChainNodeSDK, StargateTxClient } from './types/index.js';

const STATE_CHANGING_TOOLS = new Set([
  'add-funds',
  'close-deployment',
  'create-deployment',
  'create-lease',
  'exec-command',
  'regenerate-certificate',
  'revoke-all-certificates',
  'revoke-certificate',
  'send-manifest',
  'update-deployment',
]);

const LOCAL_READ_ONLY_TOOLS = new Set([
  'get-akash-account-addr',
  'get-sdl-template',
  'get-sdl-templates',
]);

function getToolAnnotations(name: string): ToolAnnotations {
  if (STATE_CHANGING_TOOLS.has(name)) {
    return {
      readOnlyHint: false,
      destructiveHint: true,
      idempotentHint: false,
      openWorldHint: true,
    };
  }

  return {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: !LOCAL_READ_ONLY_TOOLS.has(name),
  };
}

class AkashMCP extends McpServer {
  private wallet: AkashWallet | null = null;
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
    } else if (!this.certificate) {
      throw new Error(
        'No certificate available. The on-disk certificate is missing and no in-memory ' +
        'certificate exists. Run regenerate-certificate to create a new one.'
      );
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
    this.certificate = await loadCertificate(this.wallet, this.chainSDK);
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
      this.certificate = await loadCertificate(wallet, chainSDK);
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
      getToolAnnotations(GetAccountAddrTool.name),
      async (args) => GetAccountAddrTool.handler(args, await this.getToolContext())
    );

    this.tool(
      GetBidsTool.name,
      GetBidsTool.description,
      GetBidsTool.parameters.shape,
      getToolAnnotations(GetBidsTool.name),
      async (args) => GetBidsTool.handler(args, await this.getToolContext())
    );

    this.tool(
      CreateDeploymentTool.name,
      CreateDeploymentTool.description,
      CreateDeploymentTool.parameters.shape,
      getToolAnnotations(CreateDeploymentTool.name),
      async (args) => CreateDeploymentTool.handler(args, await this.getToolContext())
    );

    this.tool(
      GetSDLsTool.name,
      GetSDLsTool.description,
      GetSDLsTool.parameters.shape,
      getToolAnnotations(GetSDLsTool.name),
      async (args) => GetSDLsTool.handler(args, await this.getToolContext())
    );

    this.tool(
      GetSDLTool.name,
      GetSDLTool.description,
      GetSDLTool.parameters.shape,
      getToolAnnotations(GetSDLTool.name),
      async (args) => GetSDLTool.handler(args, await this.getToolContext())
    );

    this.tool(
      SendManifestTool.name,
      SendManifestTool.description,
      SendManifestTool.parameters.shape,
      getToolAnnotations(SendManifestTool.name),
      async (args) => SendManifestTool.handler(args, await this.getToolContext())
    );

    this.tool(
      CreateLeaseTool.name,
      CreateLeaseTool.description,
      CreateLeaseTool.parameters.shape,
      getToolAnnotations(CreateLeaseTool.name),
      async (args) => CreateLeaseTool.handler(args, await this.getToolContext())
    );

    this.tool(
      GetServicesTool.name,
      GetServicesTool.description,
      GetServicesTool.parameters.shape,
      getToolAnnotations(GetServicesTool.name),
      async (args) => GetServicesTool.handler(args, await this.getToolContext())
    );

    this.tool(
      UpdateDeploymentTool.name,
      UpdateDeploymentTool.description,
      UpdateDeploymentTool.parameters.shape,
      getToolAnnotations(UpdateDeploymentTool.name),
      async (args) => UpdateDeploymentTool.handler(args, await this.getToolContext())
    );

    this.tool(
      AddFundsTool.name,
      AddFundsTool.description,
      AddFundsTool.parameters.shape,
      getToolAnnotations(AddFundsTool.name),
      async (args) => AddFundsTool.handler(args, await this.getToolContext())
    );

    this.tool(
      GetBalancesTool.name,
      GetBalancesTool.description,
      GetBalancesTool.parameters.shape,
      getToolAnnotations(GetBalancesTool.name),
      async (args) => GetBalancesTool.handler(args, await this.getToolContext())
    );

    this.tool(
      CloseDeploymentTool.name,
      CloseDeploymentTool.description,
      CloseDeploymentTool.parameters.shape,
      getToolAnnotations(CloseDeploymentTool.name),
      async (args) => CloseDeploymentTool.handler(args, await this.getToolContext())
    );

    this.tool(
      GetDeploymentTool.name,
      GetDeploymentTool.description,
      GetDeploymentTool.parameters.shape,
      getToolAnnotations(GetDeploymentTool.name),
      async (args) => GetDeploymentTool.handler(args, await this.getToolContext())
    );

    this.tool(
      RevokeCertificateTool.name,
      RevokeCertificateTool.description,
      RevokeCertificateTool.parameters.shape,
      getToolAnnotations(RevokeCertificateTool.name),
      async (args) => RevokeCertificateTool.handler(args, await this.getToolContext())
    );

    this.tool(
      RevokeAllCertificatesTool.name,
      RevokeAllCertificatesTool.description,
      RevokeAllCertificatesTool.parameters.shape,
      getToolAnnotations(RevokeAllCertificatesTool.name),
      async (args) => RevokeAllCertificatesTool.handler(args, await this.getToolContext())
    );

    this.tool(
      RegenerateCertificateTool.name,
      RegenerateCertificateTool.description,
      RegenerateCertificateTool.parameters.shape,
      getToolAnnotations(RegenerateCertificateTool.name),
      async (args) => RegenerateCertificateTool.handler(args, await this.getToolContext())
    );

    this.tool(
      GetLogsTool.name,
      GetLogsTool.description,
      GetLogsTool.parameters.shape,
      getToolAnnotations(GetLogsTool.name),
      async (args) => GetLogsTool.handler(args, await this.getToolContext())
    );

    this.tool(
      ExecCommandTool.name,
      ExecCommandTool.description,
      ExecCommandTool.parameters.shape,
      getToolAnnotations(ExecCommandTool.name),
      async (args) => ExecCommandTool.handler(args, await this.getToolContext())
    );

  }
  public isInitialized(): boolean {
    return this.wallet !== null && this.client !== null && this.certificate !== null && this.chainSDK !== null;
  }
}

export default AkashMCP;
