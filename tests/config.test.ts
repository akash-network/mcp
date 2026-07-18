import { afterEach, describe, expect, it, vi } from 'vitest';

const originalAkashRpcUrl = process.env.AKASH_RPC_URL;
const originalRpcEndpoint = process.env.RPC_ENDPOINT;

function restoreEnv(name: string, value: string | undefined): void {
  if (value === undefined) {
    delete process.env[name];
  } else {
    process.env[name] = value;
  }
}

async function loadRpcEndpoint(): Promise<string> {
  vi.resetModules();
  const { SERVER_CONFIG } = await import('../src/config.js');
  return SERVER_CONFIG.rpcEndpoint;
}

describe('SERVER_CONFIG rpcEndpoint', () => {
  afterEach(() => {
    restoreEnv('AKASH_RPC_URL', originalAkashRpcUrl);
    restoreEnv('RPC_ENDPOINT', originalRpcEndpoint);
    vi.resetModules();
  });

  it('uses the documented AKASH_RPC_URL environment variable', async () => {
    process.env.AKASH_RPC_URL = 'https://akash-rpc.example.com:443';
    delete process.env.RPC_ENDPOINT;

    await expect(loadRpcEndpoint()).resolves.toBe('https://akash-rpc.example.com:443');
  });

  it('prefers AKASH_RPC_URL when both variables are set', async () => {
    process.env.AKASH_RPC_URL = 'https://akash-rpc.example.com:443';
    process.env.RPC_ENDPOINT = 'https://legacy-rpc.example.com:443';

    await expect(loadRpcEndpoint()).resolves.toBe('https://akash-rpc.example.com:443');
  });

  it('supports RPC_ENDPOINT for backward compatibility', async () => {
    delete process.env.AKASH_RPC_URL;
    process.env.RPC_ENDPOINT = 'https://legacy-rpc.example.com:443';

    await expect(loadRpcEndpoint()).resolves.toBe('https://legacy-rpc.example.com:443');
  });

  it('uses the default endpoint when neither variable is set', async () => {
    delete process.env.AKASH_RPC_URL;
    delete process.env.RPC_ENDPOINT;

    await expect(loadRpcEndpoint()).resolves.toBe('https://rpc.akashnet.net:443');
  });
});
