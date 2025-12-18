import { createChainNodeSDK } from '@akashnetwork/chain-sdk';

async function main() {
  const sdk = createChainNodeSDK({
    query: { baseUrl: 'https://akash-grpc.publicnode.com:443' },
  });

  const res = await sdk.akash.provider.v1beta4.getProvider({
    owner: 'akash1r2yz5fzkk9gt0r3mk9u2c29q5mmtef050cryak',
  });

  console.log('Provider URI:', res.provider?.hostUri);
}

main();
