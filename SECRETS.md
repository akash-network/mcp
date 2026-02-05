# Environment Variables & Secrets

This document lists all environment variables required for `akash-mcp`.

## Infisical Path

```
/production/akash/
```

## Required Variables

### Akash Wallet

| Variable | Description | Example |
|----------|-------------|---------|
| `AKASH_MNEMONIC` | 24-word wallet mnemonic phrase | `word1 word2 ... word24` |

## Optional Variables

### Network Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `AKASH_NET` | Network to use | `mainnet` |
| `AKASH_NODE` | RPC node URL | `https://rpc.akashnet.net:443` |
| `AKASH_CHAIN_ID` | Chain identifier | `akashnet-2` |

### Gas Configuration

| Variable | Description | Default |
|----------|-------------|---------|
| `AKASH_GAS` | Gas limit | `auto` |
| `AKASH_GAS_ADJUSTMENT` | Gas adjustment multiplier | `1.5` |
| `AKASH_GAS_PRICES` | Gas price | `0.025uakt` |

## Example .env

```env
# Wallet (CRITICAL - keep secure!)
AKASH_MNEMONIC=word1 word2 word3 word4 word5 word6 word7 word8 word9 word10 word11 word12 word13 word14 word15 word16 word17 word18 word19 word20 word21 word22 word23 word24

# Network (optional - defaults to mainnet)
AKASH_NET=mainnet
AKASH_NODE=https://rpc.akashnet.net:443
AKASH_CHAIN_ID=akashnet-2

# Gas (optional - uses auto)
AKASH_GAS=auto
AKASH_GAS_ADJUSTMENT=1.5
AKASH_GAS_PRICES=0.025uakt
```

## MCP Server Usage

The MCP server exposes these tools:
- `create-deployment` - Deploy SDL to Akash
- `get-bids` - Fetch provider bids
- `create-lease` - Accept a bid
- `send-manifest` - Send deployment manifest
- `get-services` - Get service URIs
- `update-deployment` - Update existing deployment
- `close-deployment` - Close and refund deployment
- `get-logs` - Fetch container logs
- `add-funds` - Add AKT to deployment escrow

## Priority Order for Setup

1. **Critical** (MCP won't function without):
   - `AKASH_MNEMONIC`

2. **Optional** (use defaults):
   - Network configuration
   - Gas settings

## Security Notes

- **NEVER** commit the mnemonic to version control
- The mnemonic provides FULL control over the wallet
- Use a dedicated deployment wallet with limited funds
- Consider using a hardware wallet for production
- Regularly rotate the deployment wallet

## Wallet Funding

The wallet must have AKT tokens for:
- Deployment deposits (minimum 0.5 AKT = 500000 uakt)
- Transaction gas fees
- Lease payments to providers

Current wallet address can be retrieved via the `get-akash-account-addr` MCP tool.
