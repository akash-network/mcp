import {
  QueryLeaseRequest,
  QueryClientImpl as QueryMarketClient,
} from '@akashnetwork/akash-api/akash/market/v1beta4';
import { getRpc } from '@akashnetwork/akashjs/build/rpc/index.js';
import { SERVER_CONFIG } from '../config.js';

export async function queryLease(
  owner: string,
  dseq: number,
  gseq: number,
  oseq: number,
  provider: string
) {
  const rpc = await getRpc(SERVER_CONFIG.rpcEndpoint);
  const marketClient = new QueryMarketClient(rpc);

  const request = QueryLeaseRequest.fromPartial({
    id: {
      owner,
      dseq,
      gseq,
      oseq,
      provider,
    },
  });

  const lease = await marketClient.Lease(request);

  return lease;
}
