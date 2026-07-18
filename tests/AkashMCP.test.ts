import { beforeEach, describe, expect, it, vi } from 'vitest';

const loadWalletAndClient = vi.fn();
const loadCertificate = vi.fn();
const loadCertificateFromDisk = vi.fn();

vi.mock('../src/utils/index.js', () => ({
  loadWalletAndClient,
  loadCertificate,
  loadCertificateFromDisk,
}));

describe('AkashMCP initialization', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadWalletAndClient.mockResolvedValue({
      wallet: { getAccounts: vi.fn().mockResolvedValue([{ address: 'akash1test' }]) },
      client: {},
      chainSDK: {},
    });
  });

  it('starts without creating a certificate', async () => {
    const { default: AkashMCP } = await import('../src/AkashMCP.js');
    const server = new AkashMCP();

    await server.initialize();

    expect(server.isInitialized()).toBe(true);
    expect(loadCertificate).not.toHaveBeenCalled();
  });
});
