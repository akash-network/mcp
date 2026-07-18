import fs from 'node:fs';

export const SERVER_CONFIG = {
  name: 'Akash-MCP-Server',
  version: '1.0.0',
  port: process.env.PORT || 3000,
  environment: process.env.NODE_ENV || 'development',
  rpcEndpoint: process.env.RPC_ENDPOINT || 'https://rpc.akashnet.net:443',
  grpcEndpoint: process.env.GRPC_ENDPOINT || 'https://akash-grpc.publicnode.com:443',
  mnemonic: process.env.AKASH_MNEMONIC || '',
  privateKey: process.env.AKASH_PRIVATE_KEY || '',
} as const;

export type ServerConfig = typeof SERVER_CONFIG;

export type WalletCredential =
  | { type: 'mnemonic'; value: string }
  | { type: 'privateKey'; value: string };

type Environment = Record<string, string | undefined>;

interface CredentialSource {
  type: WalletCredential['type'];
  environmentVariable: string;
  value?: string;
  file?: boolean;
}

function readSecretFile(environmentVariable: string, filePath: string): string {
  try {
    const value = fs.readFileSync(filePath, 'utf8').trim();
    if (!value) {
      throw new Error(`${environmentVariable} points to an empty file`);
    }
    return value;
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('points to an empty file')) {
      throw error;
    }
    throw new Error(`Unable to read the secret file configured by ${environmentVariable}`);
  }
}

/**
 * Resolves exactly one wallet credential. File-backed values are intended for
 * secret-manager mounts and keep wallet material out of MCP configuration.
 */
export function resolveWalletCredential(environment: Environment = process.env): WalletCredential {
  const credentialSources: CredentialSource[] = [
    { type: 'mnemonic' as const, environmentVariable: 'AKASH_MNEMONIC', value: environment.AKASH_MNEMONIC },
    { type: 'mnemonic' as const, environmentVariable: 'AKASH_MNEMONIC_FILE', value: environment.AKASH_MNEMONIC_FILE, file: true },
    { type: 'privateKey' as const, environmentVariable: 'AKASH_PRIVATE_KEY', value: environment.AKASH_PRIVATE_KEY },
    { type: 'privateKey' as const, environmentVariable: 'AKASH_PRIVATE_KEY_FILE', value: environment.AKASH_PRIVATE_KEY_FILE, file: true },
  ];
  const sources = credentialSources.filter(
    (source): source is CredentialSource & { value: string } => Boolean(source.value?.trim())
  );

  if (sources.length === 0) {
    throw new Error(
      'Configure exactly one of AKASH_MNEMONIC, AKASH_MNEMONIC_FILE, AKASH_PRIVATE_KEY, or AKASH_PRIVATE_KEY_FILE.'
    );
  }

  if (sources.length > 1) {
    throw new Error(
      'Multiple wallet credential sources are configured. Set exactly one of AKASH_MNEMONIC, AKASH_MNEMONIC_FILE, AKASH_PRIVATE_KEY, or AKASH_PRIVATE_KEY_FILE.'
    );
  }

  const source = sources[0];
  const sourceValue = source.value.trim();
  const value = source.file
    ? readSecretFile(source.environmentVariable, sourceValue)
    : sourceValue;

  return { type: source.type, value };
}

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
