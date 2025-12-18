# Akash MCP Scripts

This directory contains utility scripts for managing Akash deployments.

## Available Scripts

### audit-deployments.ts

Comprehensive audit script that checks all known Akash deployments and ensures they are properly funded.

**Features:**
- Retrieves account address and balances
- Checks status of all known deployments
- Identifies deployments with low escrow balances
- Automatically tops up deployments that are running low on funds
- Generates detailed audit report

**Usage:**

```bash
# With Infisical (recommended)
export INFISICAL_API_URL="https://secrets.alternatefutures.ai/api"
infisical run --env=prod --path="/akash" -- npx tsx scripts/audit-deployments.ts

# With environment variable
export AKASH_MNEMONIC="your 24 word mnemonic"
npx tsx scripts/audit-deployments.ts
```

**Configuration:**
- Low balance threshold: 1 AKT (1,000,000 uakt)
- Top-up amount: 5 AKT (5,000,000 uakt)

**Deployments Checked:**
1. Infisical (DSEQ: 24645907) - secrets.alternatefutures.ai
2. Infrastructure Proxy (DSEQ: 24650196) - Pingap TLS proxy

**Output:**
- Account address and balances
- Status of each deployment (active/closed)
- Escrow balance for active deployments
- Transaction details for any top-ups
- Summary report

## Adding New Deployments

To add a new deployment to the audit:

1. Open `scripts/audit-deployments.ts`
2. Add an entry to the `KNOWN_DEPLOYMENTS` array:

```typescript
{
  name: 'Your Deployment Name',
  dseq: 12345678,
  description: 'Brief description of what this deployment does',
}
```

3. Run the audit script to verify the new deployment is checked

## Requirements

- Node.js 22+
- TypeScript
- Akash mnemonic (24-word seed phrase)
- Access to Infisical (optional but recommended)

## Security Notes

- **Never commit your mnemonic to version control**
- Use Infisical for secure secret management
- Review all transaction outputs before confirming changes
- Keep audit reports secure as they contain deployment details

## Troubleshooting

### "Invalid mnemonic format" error
- Ensure your mnemonic is exactly 24 words separated by spaces
- Verify there are no leading/trailing spaces
- Check that AKASH_MNEMONIC environment variable is set correctly

### "Deployment not found" error
- Verify the DSEQ is correct
- Check that the deployment is owned by the current account
- Deployment may have been closed

### Connection errors
- Verify RPC/gRPC endpoints are accessible
- Check network connectivity
- Ensure firewall isn't blocking connections to Akash network

## Future Improvements

Potential enhancements for this script:
- [ ] Discover all deployments automatically (not just known ones)
- [ ] Configurable top-up amounts per deployment
- [ ] Email/Slack notifications when funds are low
- [ ] Dry-run mode to preview changes without executing
- [ ] Export audit results to CSV/JSON
- [ ] Schedule regular audits via cron
- [ ] Integration with monitoring/alerting systems
