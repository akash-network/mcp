import {
  QueryLeaseRequest,
  QueryLeasesRequest,
  QueryClientImpl as QueryMarketClient,
} from '@akashnetwork/akash-api/akash/market/v1beta4';
import { getRpc } from '@akashnetwork/akashjs/build/rpc/index.js';
import { SERVER_CONFIG } from '../config.js';

export async function queryLeases(owner: string, dseq: number, provider: string) {
  const rpc = await getRpc(SERVER_CONFIG.rpcEndpoint);
  const marketClient = new QueryMarketClient(rpc);

  const request = QueryLeasesRequest.fromPartial({
    filters: {
      owner,
      dseq,
      provider,
    },
  });

  const leases = await marketClient.Leases(request);

  return leases;
}
