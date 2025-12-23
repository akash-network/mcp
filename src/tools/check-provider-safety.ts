import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { createOutput } from '../utils/index.js';

/**
 * Provider safety checking for AlternateFutures deployments.
 *
 * Services routed through the SSL proxy must NOT be deployed on the
 * same provider as the proxy to avoid NAT hairpin issues.
 *
 * The proxy cannot reach services on its own provider's public ingress.
 */

// Current proxy provider - UPDATE THIS WHEN PROXY MOVES
// Source of truth: admin/infrastructure/deployments.ts
const PROXY_PROVIDER = 'akash18ga02jzaq8cw52anyhzkwta5wygufgu6zsz6xc';
const PROXY_PROVIDER_NAME = 'Europlots';

// Known providers with metadata
const KNOWN_PROVIDERS: Record<string, { name: string; notes?: string }> = {
  'akash18ga02jzaq8cw52anyhzkwta5wygufgu6zsz6xc': {
    name: 'Europlots',
    notes: 'Currently hosting SSL proxy - BLOCKED for services routing through proxy',
  },
  'akash1aaul837r7en7hpk9wv2svg8u78fdq0t2j2e82z': {
    name: 'DigitalFrontier',
    notes: 'IP pool exhausted as of 2025-12-23',
  },
  'akash1f6gmtjpx4r8qda9nxjwq26fp5mcjyqmaq5m6j7': {
    name: 'Subangle (GPU)',
    notes: 'GPU provider',
  },
};

const parameters = z.object({
  provider: z.string().min(1).describe('Provider address to check'),
  serviceType: z
    .enum(['proxy', 'backend', 'standalone'])
    .default('backend')
    .describe(
      'Type of service: "proxy" (the SSL proxy itself), "backend" (routes through proxy), "standalone" (direct access)'
    ),
});

export const CheckProviderSafetyTool: ToolDefinition<typeof parameters> = {
  name: 'check-provider-safety',
  description: `Check if a provider is safe to use for a deployment.

Services that route through the SSL proxy (type: "backend") must NOT be deployed
on the same provider as the proxy to avoid NAT hairpin issues.

Returns:
- safe: boolean - Whether the provider can be used
- reason: string - Explanation if not safe
- providerInfo: object - Known info about the provider

Current proxy provider: ${PROXY_PROVIDER_NAME} (${PROXY_PROVIDER})`,
  parameters,
  handler: async (params: z.infer<typeof parameters>, _context: ToolContext) => {
    const { provider, serviceType } = params;
    const providerInfo = KNOWN_PROVIDERS[provider];

    // The proxy itself can be on any provider
    if (serviceType === 'proxy') {
      return createOutput({
        safe: true,
        provider,
        providerName: providerInfo?.name || 'Unknown',
        reason: 'Proxy can be deployed on any provider with IP leases',
      });
    }

    // Standalone services don't route through proxy
    if (serviceType === 'standalone') {
      return createOutput({
        safe: true,
        provider,
        providerName: providerInfo?.name || 'Unknown',
        reason: 'Standalone services do not route through the proxy',
      });
    }

    // Backend services must avoid proxy's provider
    if (provider === PROXY_PROVIDER) {
      return createOutput({
        safe: false,
        provider,
        providerName: providerInfo?.name || 'Unknown',
        reason: `NAT HAIRPIN ISSUE: Provider ${providerInfo?.name || provider} is hosting the SSL proxy. ` +
          `Services routed through the proxy cannot be deployed here - ` +
          `the proxy cannot reach its own provider's public ingress from within the provider's network.`,
        blockedProvider: PROXY_PROVIDER,
        blockedProviderName: PROXY_PROVIDER_NAME,
      });
    }

    return createOutput({
      safe: true,
      provider,
      providerName: providerInfo?.name || 'Unknown',
      providerNotes: providerInfo?.notes,
      reason: 'Provider is different from proxy provider - safe for backend services',
    });
  },
};

// Export helper functions for use by other tools
export function isProviderBlocked(provider: string, serviceType: 'proxy' | 'backend' | 'standalone'): boolean {
  if (serviceType === 'proxy' || serviceType === 'standalone') {
    return false;
  }
  return provider === PROXY_PROVIDER;
}

export function getBlockedProviders(): string[] {
  return [PROXY_PROVIDER];
}

export function filterBidProviders(providers: string[], serviceType: 'proxy' | 'backend' | 'standalone'): string[] {
  if (serviceType === 'proxy' || serviceType === 'standalone') {
    return providers;
  }
  return providers.filter((p) => p !== PROXY_PROVIDER);
}

export { PROXY_PROVIDER, PROXY_PROVIDER_NAME, KNOWN_PROVIDERS };
