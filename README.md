<div align="left">
  
  <a href="https://akash.network/" target="_blank">
    <img src="https://raw.githubusercontent.com/cosmos/chain-registry/master/akash/images/akt.png" alt="Akash logo" title="Akash Network" align="left" height="40" />
  </a>
  
  # Akash MCP Server
  
  **Akash MCP Server** is a TypeScript implementation of a Model Context Protocol (MCP) server for interacting with the Akash Network.

[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![X (formerly Twitter) Follow](https://img.shields.io/twitter/follow/akashnet_)](https://x.com/akashnet_ 'Follow Akash Network on X')
[![Discord](https://img.shields.io/badge/discord-join-7289DA.svg?logo=discord&longCache=true&style=flat)](https://discord.gg/akash 'Join Akash Discord')

</div>

## Note

This project is still under development and not all tools are available. We are working on adding more tools and improving the server.
We are open to contributions! See [CONTRIBUTING.md](CONTRIBUTING.md) for more details.

## Overview

This server provides a bridge between AI agents and the Akash Network, allowing AI models to deploy applications, create leases, manage deployments, and interact with other Akash services directly through typed tools. It implements the Model Context Protocol, making it compatible with various AI platforms and tools.

## Features

- **Wallet and Client Management**: Handles Akash wallet authentication and client initialization
- **Certificate Management**: Manages Akash certificates
- **Tools for Akash Interaction**:
  - Account address retrieval
  - Deployment creation, querying, updating, and termination
  - SDL (Stack Definition Language) operations
  - Bid management
  - Lease creation
  - Manifest deployment

## Prerequisites

- Node.js (v18 or later)
- An Akash wallet (mnemonic required for interaction with Akash Network)
- Basic knowledge of Akash Network

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/akash-network/mcp.git
   cd mcp
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the project:

   ```bash
   npm run build
   ```

## Usage with Claude Desktop or Cursor

Add the following to your `claude_desktop_config.json` or `.cursor/mcp.json`. See [here](https://modelcontextprotocol.io/quickstart/user) for more details.

Make sure to replace `<path to dist/index.js>` with the path to the `dist/index.js` file you built.

```json
{
  "mcpServers": {
    "Akash": {
      "command": "node",
      "args": ["<path to dist/index.js>"],
      "env": {
        "AKASH_MNEMONIC": "<your mnemonic here>",
        "AKASH_RPC_URL": "https://rpc.akashnet.net:443" // optional, defaults to https://rpc.akashnet.net:443
      }
    }
  }
}
```

## Usage

### Development Mode

Run the server with the MCP inspector for development:

```bash
npm run dev
```

For watch mode during development:

```bash
npm run dev:watch
```

### Using the Server with AI Models

The server exposes a standard MCP interface that can be used by AI models to interact with the Akash Network. It uses the stdio transport by default, making it compatible with most MCP clients.

## Available Tools

The server provides the following tools for AI agents:

- **GetAccountAddrTool**: Retrieve your Akash account address
- **GetBalancesTool**: Get the AKT (uakt) and other balances for a given Akash account address
- **GetBidsTool**: Get bids for deployments
- **CreateDeploymentTool**: Create a new deployment on Akash Network
- **GetDeploymentTool**: Get deployment details including status, groups, and escrow account
- **CloseDeploymentTool**: Close/terminate a deployment on Akash Network
- **AddFundsTool**: Deposit additional AKT (uakt) into a deployment escrow account
- **GetSDLsTool**: Get a list of available SDLs (from awesome-akash repository)
- **GetSDLTool**: Get a specific SDL by name
- **SendManifestTool**: Send a manifest to a provider
- **CreateLeaseTool**: Create a lease with a provider
- **GetServicesTool**: Get information about active services
- **UpdateDeploymentTool**: Update a deployment on Akash Network

### GetBalancesTool

**Description:**

Get the AKT (uakt) and other balances for a given Akash account address.

**Input Schema:**

```json
{
  "address": "akash1..." // Akash account address (string, required)
}
```

**Example Usage:**

Request:

```json
{
  "address": "akash1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
}
```

Response:

```json
[
  {
    "denom": "uakt",
    "amount": "123456789"
  }
  // ...other tokens if present
]
```

### AddFundsTool

**Description:**

Deposit additional AKT (uakt) into a deployment escrow account.

**Input Schema:**

```json
{
  "address": "akash1...", // Akash account address (string, required)
  "dseq": 123456,          // Deployment sequence number (integer, required)
  "amount": "1000000"     // Amount to add in uakt (string, required)
}
```

**Example Usage:**

Request:

```json
{
  "address": "akash1xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
  "dseq": 123456,
  "amount": "1000000"
}
```

Response:

```json
"...transaction raw log or error message..."
```

### GetDeploymentTool

**Description:**

Get deployment details from Akash Network including status, groups, and escrow account.

**Input Schema:**

```json
{
  "dseq": 123456  // Deployment sequence number (integer, required)
}
```

**Example Usage:**

Request:

```json
{
  "dseq": 123456
}
```

Response:

```json
{
  "deployment": {
    "deploymentId": { "owner": "akash1...", "dseq": "123456" },
    "state": "active",
    "version": "...",
    "createdAt": "..."
  },
  "groups": [...],
  "escrowAccount": {
    "balance": { "denom": "uakt", "amount": "..." },
    "state": "open",
    // ...other escrow details
  }
}
```

### CloseDeploymentTool

**Description:**

Close a deployment on Akash Network. This terminates the deployment, closes associated leases, and refunds remaining escrow funds.

**Input Schema:**

```json
{
  "dseq": 123456  // Deployment sequence number (integer, required)
}
```

**Example Usage:**

Request:

```json
{
  "dseq": 123456
}
```

Response:

```json
"...transaction raw log confirming deployment closure..."
```

## Development

### Linting and Formatting

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format
```

## License

See [LICENSE](LICENSE)

## Acknowledgements

- [Akash Network](https://akash.network/)
- [Model Context Protocol](https://github.com/modelcontextprotocol/typescript-sdk)
- [awesome-akash](https://github.com/akash-network/awesome-akash) (included as a submodule)
