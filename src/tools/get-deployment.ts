import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { createOutput } from '../utils/create-output.js';

const parameters = z.object({
  dseq: z.number().min(1),
});

export const GetDeploymentTool: ToolDefinition<typeof parameters> = {
  name: 'get-deployment',
  description:
    'Get deployment details from Akash Network including status, groups, escrow account, leases, and provider info. ' +
    'The dseq is the deployment sequence number.',
  parameters,
  handler: async (params: z.infer<typeof parameters>, context: ToolContext) => {
    const { dseq } = params;
    const { wallet, chainSDK } = context;

    try {
      const accounts = await wallet.getAccounts();
      if (!accounts || accounts.length === 0) {
        return createOutput({ error: 'No accounts found in wallet' });
      }

      const owner = accounts[0].address;

      // Query deployment using chain SDK (v1beta4 API)
      const deploymentRes = await chainSDK.akash.deployment.v1beta4.getDeployment({
        id: {
          owner,
          dseq: BigInt(dseq),
        },
      });

      if (!deploymentRes.deployment) {
        return createOutput({ error: `Deployment ${dseq} not found for owner ${owner}` });
      }

      // Calculate resource totals from groups
      const resources = calculateResourceTotals(deploymentRes.groups || []);

      // Query leases for this deployment
      let leases: any[] = [];
      let providers: any[] = [];

      try {
        const leasesRes = await chainSDK.akash.market.v1beta5.getLeases({
          filters: {
            owner,
            dseq: BigInt(dseq),
          },
        });

        leases = leasesRes.leases || [];

        // Get provider details for each lease
        const providerPromises = leases.map(async (lease: any) => {
          try {
            const providerRes = await chainSDK.akash.provider.v1beta4.getProvider({
              owner: lease.lease?.id?.provider,
            });
            return {
              address: lease.lease?.id?.provider,
              hostUri: providerRes.provider?.hostUri,
              attributes: providerRes.provider?.attributes,
              info: providerRes.provider?.info,
            };
          } catch (error) {
            return {
              address: lease.lease?.id?.provider,
              error: 'Could not fetch provider details',
            };
          }
        });

        providers = await Promise.all(providerPromises);
      } catch (error) {
        // Leases query may fail if deployment is not leased yet
        console.error('Error querying leases:', error);
      }

      return createOutput({
        deployment: {
          ...deploymentRes.deployment,
          // Include height information for timeline tracking
          createdHeight: deploymentRes.deployment.createdAt,
        },
        groups: deploymentRes.groups,
        escrowAccount: deploymentRes.escrowAccount,
        resources,
        leases: leases.map((lease: any, index: number) => ({
          ...lease.lease,
          price: lease.lease?.price,
          provider: providers[index],
        })),
      });
    } catch (error: any) {
      console.error('Error getting deployment:', error);
      return createOutput({
        error: error.message || 'Unknown error getting deployment',
      });
    }
  },
};

// Helper function to calculate resource totals across all groups
function calculateResourceTotals(groups: any[]): {
  cpu: { units: string; total: number };
  memory: { units: string; total: number };
  storage: { units: string; total: number };
  gpu: { units: string; total: number };
} {
  let totalCpu = 0;
  let totalMemory = 0;
  let totalStorage = 0;
  let totalGpu = 0;

  for (const group of groups) {
    const count = Number(group.state?.count || 0);

    if (group.spec?.resources) {
      const cpu = Number(group.spec.resources.cpu?.units?.val || 0);
      const memory = Number(group.spec.resources.memory?.quantity?.val || 0);
      const gpu = Number(group.spec.resources.gpu?.units?.val || 0);

      totalCpu += cpu * count;
      totalMemory += memory * count;
      totalGpu += gpu * count;

      // Sum storage from all volumes
      if (group.spec.resources.storage) {
        for (const storage of group.spec.resources.storage) {
          const storageVal = Number(storage?.quantity?.val || 0);
          totalStorage += storageVal * count;
        }
      }
    }
  }

  return {
    cpu: {
      units: 'millicores',
      total: totalCpu,
    },
    memory: {
      units: 'bytes',
      total: totalMemory,
    },
    storage: {
      units: 'bytes',
      total: totalStorage,
    },
    gpu: {
      units: 'units',
      total: totalGpu,
    },
  };
}
