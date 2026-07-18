export const SERVER_CONFIG = {
  name: 'Akash-MCP-Server',
  version: '1.0.0',
  port: process.env.PORT || 3000,
  environment: process.env.NODE_ENV || 'development',
  rpcEndpoint:
    process.env.AKASH_RPC_URL ??
    process.env.RPC_ENDPOINT ??
    'https://rpc.akashnet.net:443',
  grpcEndpoint: process.env.GRPC_ENDPOINT || 'https://akash-grpc.publicnode.com:443',
  mnemonic: process.env.AKASH_MNEMONIC || '',
  privateKey: process.env.AKASH_PRIVATE_KEY || '',
} as const;

export type ServerConfig = typeof SERVER_CONFIG;

/** Validate mnemonic before wallet creation. Call at startup, not at import. */
export function validateMnemonic(mnemonic: string): string {
  if (!mnemonic || mnemonic.trim().length === 0) {
    throw new Error(
      'AKASH_MNEMONIC environment variable is required. ' +
      'Set it to your 12 or 24 word BIP-39 mnemonic.'
    );
  }

  const words = mnemonic.trim().split(/\s+/);
  if (words.length !== 12 && words.length !== 24) {
    throw new Error(
      `AKASH_MNEMONIC must be 12 or 24 words, got ${words.length}.`
    );
  }

  return mnemonic.trim();
}

/** Validate a hex-encoded private key before wallet creation. Call at startup, not at import. */
export function validatePrivateKey(privateKey: string): string {
  const key = privateKey.trim().replace(/^0x/i, '');

  if (key.length === 0) {
    throw new Error(
      'AKASH_PRIVATE_KEY environment variable is required. ' +
      'Set it to your 64-character hex-encoded private key (32 bytes).'
    );
  }

  if (!/^[0-9a-fA-F]{64}$/.test(key)) {
    throw new Error(
      'AKASH_PRIVATE_KEY must be a 64-character hex string (32 bytes).'
    );
  }

  return key;
}
