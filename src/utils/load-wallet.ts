import { DirectSecp256k1HdWallet, DirectSecp256k1Wallet } from '@cosmjs/proto-signing';
import { createStargateClient, createChainNodeSDK } from '@akashnetwork/chain-sdk';
import { SERVER_CONFIG, resolveWalletCredential, validateMnemonic, validatePrivateKey } from '../config.js';
import type { AkashWallet, ChainNodeSDK, StargateTxClient } from '../types/index.js';

interface WalletAndClient {
  wallet: AkashWallet;
  client: StargateTxClient;
  chainSDK: ChainNodeSDK;
}

export async function loadWalletAndClient(): Promise<WalletAndClient> {
  const credential = resolveWalletCredential();
  let wallet: AkashWallet;
  if (credential.type === 'mnemonic') {
    const mnemonic = validateMnemonic(credential.value);
    wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
      prefix: 'akash',
    });
  } else {
    const privateKey = validatePrivateKey(credential.value);
    const privateKeyBytes = Uint8Array.from(Buffer.from(privateKey, 'hex'));
    wallet = await DirectSecp256k1Wallet.fromKey(privateKeyBytes, 'akash');
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
