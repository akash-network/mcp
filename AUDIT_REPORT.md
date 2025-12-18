# Akash Deployment Audit Report

**Date:** December 16, 2025
**Status:** Partial - Requires Credentials

## Summary

I have created an automated audit script to check all Akash deployments for the AlternateFutures account, but I was unable to execute it due to missing Akash credentials. This report documents what was done and provides instructions for completing the audit.

## Known Deployments

Based on the audit request, the following deployments should be checked:

1. **Infisical**
   - DSEQ: 24645907
   - Description: secrets.alternatefutures.ai
   - Purpose: Self-hosted secrets management

2. **Infrastructure Proxy**
   - DSEQ: 24650196
   - Description: Pingap TLS proxy at 77.76.13.214
   - Purpose: TLS termination and routing

## What Was Done

### 1. Created Audit Script

I created a standalone TypeScript audit script at:
```
/Users/wonderwomancode/Projects/alternatefutures/akash-mcp/scripts/audit-deployments.ts
```

This script:
- Gets the Akash account address
- Fetches account balances
- Checks each known deployment's status
- Retrieves escrow balances for active deployments
- Identifies deployments with low funds (< 1 AKT)
- Automatically tops up low-balance deployments with 5 AKT
- Generates a comprehensive audit report

### 2. Credential Storage Investigation

The AKASH_MNEMONIC is stored in Infisical at:
- **Path:** `/akash`
- **Key:** `AKASH_MNEMONIC`
- **Instance:** https://secrets.alternatefutures.ai

## How to Complete the Audit

### Option 1: Using Infisical (Recommended)

1. **Login to Infisical:**
   ```bash
   export INFISICAL_API_URL="https://secrets.alternatefutures.ai/api"
   infisical login
   ```

2. **Run the audit with Infisical:**
   ```bash
   cd /Users/wonderwomancode/Projects/alternatefutures/akash-mcp
   export INFISICAL_API_URL="https://secrets.alternatefutures.ai/api"
   infisical run --env=prod --path="/akash" -- npx tsx scripts/audit-deployments.ts
   ```

### Option 2: Using Environment Variable

1. **Get the mnemonic from Infisical web UI:**
   - Visit: https://secrets.alternatefutures.ai
   - Navigate to project: AlternateFutures
   - Go to path: /akash
   - Copy the value of AKASH_MNEMONIC

2. **Run the audit:**
   ```bash
   cd /Users/wonderwomancode/Projects/alternatefutures/akash-mcp
   export AKASH_MNEMONIC="your 24 word mnemonic here"
   npx tsx scripts/audit-deployments.ts
   ```

### Option 3: Using a Service Token

1. **Create a service token in Infisical:**
   - Go to: https://secrets.alternatefutures.ai
   - Create a service token with access to /akash path

2. **Run with the token:**
   ```bash
   cd /Users/wonderwomancode/Projects/alternatefutures/akash-mcp
   export INFISICAL_TOKEN="your-service-token"
   export INFISICAL_API_URL="https://secrets.alternatefutures.ai/api"
   infisical run --env=prod --path="/akash" -- npx tsx scripts/audit-deployments.ts
   ```

## What the Audit Will Check

1. **Account Information:**
   - Current account address
   - Total AKT balance
   - Other token balances

2. **For Each Deployment:**
   - Deployment status (active/closed)
   - Current escrow balance
   - Whether it needs funding

3. **Automatic Actions:**
   - Top up any deployment with < 1 AKT remaining
   - Add 5 AKT to the escrow account
   - Report transaction details

4. **Final Report:**
   - Total number of active deployments
   - Number of deployments that were topped up
   - List of any closed or orphaned deployments
   - Current account balance

## Audit Thresholds

- **Low Balance Threshold:** 1 AKT (1,000,000 uakt)
- **Top-Up Amount:** 5 AKT (5,000,000 uakt)

## Script Location

The audit script is located at:
```
/Users/wonderwomancode/Projects/alternatefutures/akash-mcp/scripts/audit-deployments.ts
```

## Next Steps

1. Choose one of the three options above to run the audit
2. Review the output to see deployment status
3. Verify that any low-balance deployments were topped up successfully
4. Save the audit output for your records

## Notes

- The script will NOT close any deployments - it only audits and adds funds if needed
- All transactions will be logged to the console
- The script uses the same Akash SDK that powers the MCP server
- Escrow balances are checked using the v1beta4 deployment API

## Security Considerations

- Never commit the mnemonic to version control
- Use Infisical service tokens when possible instead of exposing the raw mnemonic
- Review all transactions before confirming (the script shows details before execution)
- Keep the audit output secure as it may contain sensitive deployment information
