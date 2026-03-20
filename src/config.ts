export const SERVER_CONFIG = {
  name: 'Akash-MCP-Server',
  version: '1.0.0',
  port: process.env.PORT || 3000,
  environment: process.env.NODE_ENV || 'development',
  rpcEndpoint: process.env.RPC_ENDPOINT || 'https://rpc.akashnet.net:443',
  grpcEndpoint: process.env.GRPC_ENDPOINT || 'https://akash-grpc.publicnode.com:443',
  mnemonic: process.env.AKASH_MNEMONIC || '',
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
