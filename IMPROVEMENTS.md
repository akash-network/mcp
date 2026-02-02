# Akash MCP Improvements

## Enhanced Context Fields (2026-02-02)

### Summary

Enhanced the `get-deployment` and `get-bids` tools to return additional context fields that align with what's displayed in the Akash Console. This provides better visibility into deployments, resources, and provider capabilities.

### Changes Implemented

#### get-deployment Tool

Now includes:

1. **Resource Totals** - Calculated across all groups:
   - CPU (millicores)
   - Memory (bytes)
   - Storage (bytes)
   - GPU (units)

2. **Lease Information**:
   - Full lease details with pricing
   - Provider information for each lease:
     - `hostUri` - Provider endpoint
     - `attributes` - Provider attributes (region, features, etc.)
     - `info` - Provider metadata

3. **Timeline Information**:
   - `createdHeight` - Block height when deployment was created
   - Useful for tracking deployment history

4. **Enhanced Escrow Account**:
   - Complete escrow account details including balances, transfers, and deposits

#### get-bids Tool

Now includes:

- **Provider Information** for each bid:
  - `hostUri` - Provider endpoint URL
  - `attributes` - Provider attributes (capabilities, region, etc.)
  - `info` - Provider metadata

This helps users make more informed decisions when selecting which bid to accept.

### Implementation Details

- Added `calculateResourceTotals()` helper function to aggregate resources across deployment groups
- Enhanced both tools to make parallel provider queries for better performance
- Maintains backward compatibility - all existing fields still returned
- Proper error handling when provider details cannot be fetched

### Files Modified

- `src/tools/get-deployment.ts` - Enhanced deployment details with resources, leases, and provider info
- `src/tools/get-bids.ts` - Added provider information to bid responses

### Testing

- ✅ TypeScript compilation successful
- ✅ Code built without errors
- ⏳ Runtime testing pending MCP server restart

### Background

This addresses the requirement to "fix this in our fork of the akash mcp so that whatever fields are missing that would give more context that is displayed on the akash console are actually filled out."

The implementation was based on analysis of the Akash Console source code to identify which fields provide the most useful context for deployment management.

### Commit

Implemented in commit 84dce33

### Future Enhancements

Potential additional improvements:

1. Add `closedHeight` field for closed deployments
2. Include deployment events/audit trail
3. Add calculated cost metrics based on lease pricing and duration
4. Provider reputation/uptime statistics (if available from chain)
