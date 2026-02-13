import { GasPrice, SigningStargateClient } from '@cosmjs/stargate';
import { getAkashTypeRegistry } from '@akashnetwork/akashjs/build/stargate/index.js';
import { DirectSecp256k1HdWallet, DirectSecp256k1Wallet, Registry } from '@cosmjs/proto-signing';
import { SERVER_CONFIG } from '../config.js';

export async function loadWalletAndClient() {
  let wallet: DirectSecp256k1HdWallet | DirectSecp256k1Wallet;
  
  if (SERVER_CONFIG.mnemonic) {
    wallet = await DirectSecp256k1HdWallet.fromMnemonic(SERVER_CONFIG.mnemonic, {
      prefix: 'akash',
    });
  } else if (SERVER_CONFIG.privateKey) {
    const privateKeyBytes = Uint8Array.from(Buffer.from(SERVER_CONFIG.privateKey, 'hex'));
    wallet = await DirectSecp256k1Wallet.fromKey(privateKeyBytes, 'akash');
  } else {
    throw new Error('Either AKASH_MNEMONIC or AKASH_PRIVATE_KEY must be provided');
  }

  const registry = getAkashTypeRegistry();

  const client = await SigningStargateClient.connectWithSigner(SERVER_CONFIG.rpcEndpoint, wallet, {
    registry: new Registry(registry),
    gasPrice: GasPrice.fromString('0.025uakt'),
  });

  return {
    wallet,
    client,
  };
}
