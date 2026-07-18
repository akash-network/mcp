import { Secp256k1HdWallet, Secp256k1Wallet } from '@cosmjs/amino';
import { createStargateClient, createChainNodeSDK } from '@akashnetwork/chain-sdk';
import { SERVER_CONFIG, validateMnemonic, validatePrivateKey } from '../config.js';
import type { AkashWallet, ChainNodeSDK, StargateTxClient } from '../types/index.js';

interface WalletAndClient {
  wallet: AkashWallet;
  client: StargateTxClient;
  chainSDK: ChainNodeSDK;
}

export async function loadWalletAndClient(): Promise<WalletAndClient> {
  // Mnemonic takes priority over private key when both are provided.
  let wallet: AkashWallet;
  if (SERVER_CONFIG.mnemonic) {
    const mnemonic = validateMnemonic(SERVER_CONFIG.mnemonic);
    wallet = await Secp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: 'akash',
    });
  } else if (SERVER_CONFIG.privateKey) {
    const privateKey = validatePrivateKey(SERVER_CONFIG.privateKey);
    const privateKeyBytes = Uint8Array.from(Buffer.from(privateKey, 'hex'));
    wallet = await Secp256k1Wallet.fromKey(privateKeyBytes, 'akash');
  } else {
    throw new Error(
      'Either AKASH_MNEMONIC or AKASH_PRIVATE_KEY environment variable must be provided.'
    );
  }

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
    client: stargateClient,
    chainSDK,
  };
}
