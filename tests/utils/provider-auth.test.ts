import { Secp256k1HdWallet } from '@cosmjs/amino';
import { JwtTokenManager } from '@akashnetwork/chain-sdk';
import { describe, expect, it } from 'vitest';
import {
  createProviderHeaders,
  createProviderToken,
  createProviderUrl,
} from '../../src/utils/provider-auth.js';

const TEST_MNEMONIC = 'test test test test test test test test test test test junk';

describe('provider authentication', () => {
  it('creates a short-lived token limited to the exact lease and operation', async () => {
    const wallet = await Secp256k1HdWallet.fromMnemonic(TEST_MNEMONIC, {
      prefix: 'akash',
    });
    const [account] = await wallet.getAccounts();
    const now = Math.floor(Date.now() / 1000);

    const token = await createProviderToken(
      wallet,
      'status',
      {
        provider: account.address,
        dseq: 123,
        gseq: 1,
        oseq: 1,
        services: ['web'],
      },
      now
    );
    const payload = new JwtTokenManager(wallet).decodeToken(token);

    expect(payload.iat).toBe(now);
    expect(payload.nbf).toBe(now);
    expect(payload.exp).toBe(now + 15 * 60);
    expect(payload.leases).toEqual({
      access: 'granular',
      permissions: [
        {
          provider: account.address,
          access: 'granular',
          deployments: [
            {
              dseq: 123,
              gseq: 1,
              oseq: 1,
              services: ['web'],
              scope: ['status'],
            },
          ],
        },
      ],
    });
  });

  it('uses provider-scoped access when an operation targets all services', async () => {
    const wallet = await Secp256k1HdWallet.fromMnemonic(TEST_MNEMONIC, {
      prefix: 'akash',
    });
    const [account] = await wallet.getAccounts();
    const now = Math.floor(Date.now() / 1000);

    const token = await createProviderToken(
      wallet,
      'status',
      {
        provider: account.address,
        dseq: 123,
        gseq: 1,
        oseq: 1,
      },
      now
    );
    const payload = new JwtTokenManager(wallet).decodeToken(token);

    expect(payload.leases).toEqual({
      access: 'granular',
      permissions: [
        {
          provider: account.address,
          access: 'scoped',
          scope: ['status'],
        },
      ],
    });
  });

  it('preserves the provider identity for verified HTTPS and WSS requests', () => {
    const httpsUrl = createProviderUrl('https://provider.example.com:8443', '/lease/1/1/1/status');
    const websocketUrl = createProviderUrl(
      'https://provider.example.com:8443',
      '/lease/1/1/1/logs?follow=false',
      'websocket'
    );

    expect(httpsUrl.toString()).toBe('https://provider.example.com:8443/lease/1/1/1/status');
    expect(websocketUrl.toString()).toBe(
      'wss://provider.example.com:8443/lease/1/1/1/logs?follow=false'
    );
  });

  it('rejects provider endpoints that cannot use normal TLS verification', () => {
    expect(() => createProviderUrl('http://provider.example.com:8080', '/status')).toThrow(
      /must use HTTPS/
    );
    expect(() => createProviderUrl('https://user:pass@provider.example.com', '/status')).toThrow(
      /must not contain embedded credentials/
    );
  });

  it('uses bearer authentication without overriding the Host header', () => {
    const headers = createProviderHeaders('signed-token', {
      Accept: 'application/json',
    });

    expect(headers).toEqual({
      Authorization: 'Bearer signed-token',
      Accept: 'application/json',
    });
    expect(headers).not.toHaveProperty('Host');
  });
});
