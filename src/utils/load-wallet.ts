import { Secp256k1HdWallet, Secp256k1Wallet } from '@cosmjs/amino';
import { DirectSecp256k1HdWallet, DirectSecp256k1Wallet } from '@cosmjs/proto-signing';
import { createStargateClient, createChainNodeSDK } from '@akashnetwork/chain-sdk';
import { SERVER_CONFIG, validateMnemonic, validatePrivateKey } from '../config.js';
import type {
  AkashJwtSigner,
  AkashWallet,
  ChainNodeSDK,
  StargateTxClient,
} from '../types/index.js';

interface WalletAndClient {
  wallet: AkashWallet;
  jwtSigner: AkashJwtSigner;
  client: StargateTxClient;
  chainSDK: ChainNodeSDK;
}

interface WalletCredentials {
  mnemonic?: string;
  privateKey?: string;
}

export async function createWalletSigners(
  credentials: WalletCredentials
): Promise<{ wallet: AkashWallet; jwtSigner: AkashJwtSigner }> {
  // Mnemonic takes priority over private key when both are provided.
  if (credentials.mnemonic) {
    const mnemonic = validateMnemonic(credentials.mnemonic);
    const [wallet, jwtSigner] = await Promise.all([
      DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: 'akash' }),
      Secp256k1HdWallet.fromMnemonic(mnemonic, { prefix: 'akash' }),
    ]);
    return { wallet, jwtSigner };
  }

  if (credentials.privateKey) {
    const privateKey = validatePrivateKey(credentials.privateKey);
    const privateKeyBytes = Uint8Array.from(Buffer.from(privateKey, 'hex'));
    const [wallet, jwtSigner] = await Promise.all([
      DirectSecp256k1Wallet.fromKey(privateKeyBytes, 'akash'),
      Secp256k1Wallet.fromKey(privateKeyBytes, 'akash'),
    ]);
    return { wallet, jwtSigner };
  }

  throw new Error(
    'Either AKASH_MNEMONIC or AKASH_PRIVATE_KEY environment variable must be provided.'
  );
}

export async function loadWalletAndClient(): Promise<WalletAndClient> {
  const { wallet, jwtSigner } = await createWalletSigners({
    mnemonic: SERVER_CONFIG.mnemonic,
    privateKey: SERVER_CONFIG.privateKey,
  });

  // Create the stargate client using chain-sdk (includes proper type registry)
  const stargateClient = createStargateClient({
    baseUrl: SERVER_CONFIG.rpcEndpoint,
    signer: wallet,
    defaultGasPrice: '0.025uakt',
    gasMultiplier: 2.0, // Increased from default 1.3 to handle deployment updates
  });

  // Create the chain SDK for queries and transactions
  // Use configured gRPC endpoint (public Akash gRPC endpoints use TLS on port 443)
  const chainSDK = createChainNodeSDK({
    query: {
      baseUrl: SERVER_CONFIG.grpcEndpoint,
    },
    tx: {
      signer: stargateClient,
    },
  });

  return {
    wallet,
    jwtSigner,
    client: stargateClient,
    chainSDK,
  };
}
