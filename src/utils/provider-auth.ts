import {
  JwtTokenManager,
  type JwtTokenAccessScope,
  type LeasePermission,
} from '@akashnetwork/chain-sdk';
import type { AkashWallet } from '../types/index.js';

const PROVIDER_TOKEN_TTL_SECONDS = 15 * 60;

export interface ProviderLeaseScope {
  provider: string;
  dseq: number;
  gseq: number;
  oseq: number;
  services?: string[];
}

export async function createProviderToken(
  wallet: AkashWallet,
  scope: JwtTokenAccessScope,
  lease: ProviderLeaseScope,
  now = Math.floor(Date.now() / 1000)
): Promise<string> {
  const [account] = await wallet.getAccounts();

  let permission: LeasePermission;
  if (lease.services?.length) {
    permission = {
      provider: lease.provider,
      access: 'granular',
      deployments: [
        {
          dseq: lease.dseq,
          gseq: lease.gseq,
          oseq: lease.oseq,
          scope: [scope],
          services: lease.services,
        },
      ],
    };
  } else {
    permission = {
      provider: lease.provider,
      access: 'scoped',
      scope: [scope],
    };
  }

  return new JwtTokenManager(wallet).generateToken({
    version: 'v1',
    iss: account.address,
    iat: now,
    nbf: now,
    exp: now + PROVIDER_TOKEN_TTL_SECONDS,
    leases: {
      access: 'granular',
      permissions: [permission],
    },
  });
}

export function createProviderUrl(
  providerUri: string,
  path: string,
  transport: 'https' | 'websocket' = 'https'
): URL {
  const providerUrl = new URL(providerUri);

  if (providerUrl.protocol !== 'https:') {
    throw new Error(
      `Provider URI must use HTTPS so its identity can be verified: ${providerUrl.origin}`
    );
  }

  if (providerUrl.username || providerUrl.password) {
    throw new Error('Provider URI must not contain embedded credentials');
  }

  const requestUrl = new URL(path, providerUrl.origin);
  if (transport === 'websocket') {
    requestUrl.protocol = 'wss:';
  }

  return requestUrl;
}

export function createProviderHeaders(
  token: string,
  additionalHeaders: Record<string, string | number> = {}
): Record<string, string | number> {
  return {
    ...additionalHeaders,
    Authorization: `Bearer ${token}`,
  };
}
