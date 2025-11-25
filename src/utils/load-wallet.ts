import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { createStargateClient, createChainNodeSDK } from '@akashnetwork/chain-sdk';
import { SERVER_CONFIG } from '../config.js';
import type { ChainNodeSDK, StargateTxClient } from '../types/index.js';

interface WalletAndClient {
  wallet: DirectSecp256k1HdWallet;
  client: StargateTxClient;
  chainSDK: ChainNodeSDK;
}

export async function loadWalletAndClient(): Promise<WalletAndClient> {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(SERVER_CONFIG.mnemonic, {
    prefix: 'akash',
  });

  // Create the stargate client using chain-sdk (includes proper type registry)
  const stargateClient = createStargateClient({
    baseUrl: SERVER_CONFIG.rpcEndpoint,
    signer: wallet,
    defaultGasPrice: '0.025uakt',
  });

  // Create the chain SDK for queries and transactions
  // Note: gRPC endpoint is typically on port 9090 for Cosmos chains
  const grpcEndpoint = SERVER_CONFIG.rpcEndpoint.replace(':443', ':9090').replace('https://', 'http://');
  const chainSDK = createChainNodeSDK({
    query: {
      baseUrl: grpcEndpoint,
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
