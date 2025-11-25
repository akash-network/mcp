import type { ChainNodeSDK } from '../types/index.js';

// Using explicit any to avoid complex type inference issues with chain-sdk
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function queryLeases(chainSDK: ChainNodeSDK, owner: string, dseq: number, provider: string): Promise<any> {
  // Query leases using chain SDK (v1beta5 API)
  const leases = await chainSDK.akash.market.v1beta5.getLeases({
    filters: {
      owner,
      dseq: BigInt(dseq),
      provider,
    },
  });

  return leases;
}
