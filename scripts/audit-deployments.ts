import { loadWalletAndClient } from '../src/utils/load-wallet.js';

interface DeploymentInfo {
  name: string;
  dseq: number;
  description: string;
}

const KNOWN_DEPLOYMENTS: DeploymentInfo[] = [
  {
    name: 'Infisical',
    dseq: 24645907,
    description: 'secrets.alternatefutures.ai',
  },
  {
    name: 'Infrastructure Proxy',
    dseq: 24650196,
    description: 'Pingap TLS proxy at 77.76.13.214',
  },
];

const LOW_BALANCE_THRESHOLD_UAKT = 1_000_000; // 1 AKT
const TOP_UP_AMOUNT_UAKT = '5000000'; // 5 AKT

async function main() {
  console.log('=== Akash Deployment Audit ===\n');

  try {
    // Initialize wallet and client
    console.log('Initializing Akash wallet and client...');
    const { wallet, chainSDK } = await loadWalletAndClient();
    const accounts = await wallet.getAccounts();
    const address = accounts[0].address;

    console.log(`Account Address: ${address}\n`);

    // Get account balances
    console.log('Fetching account balances...');
    const balances = await chainSDK.cosmos.bank.v1beta1.getAllBalances({
      address,
    });

    console.log('Account Balances:');
    balances.balances.forEach((balance: any) => {
      const amount = balance.amount;
      if (balance.denom === 'uakt') {
        const aktAmount = (parseInt(amount) / 1_000_000).toFixed(6);
        console.log(`  ${balance.denom}: ${amount} (${aktAmount} AKT)`);
      } else {
        console.log(`  ${balance.denom}: ${amount}`);
      }
    });
    console.log();

    // Audit each known deployment
    const deploymentResults = [];
    let activeCount = 0;
    let lowFundsCount = 0;
    let closedCount = 0;
    const deploymentsToTopUp = [];

    for (const deploymentInfo of KNOWN_DEPLOYMENTS) {
      console.log(`--- ${deploymentInfo.name} (${deploymentInfo.description}) ---`);
      console.log(`DSEQ: ${deploymentInfo.dseq}`);

      try {
        // Get deployment details
        const deploymentRes = await chainSDK.akash.deployment.v1beta4.getDeployment({
          id: {
            owner: address,
            dseq: BigInt(deploymentInfo.dseq),
          },
        });

        if (!deploymentRes.deployment) {
          console.log(`Status: NOT FOUND or CLOSED`);
          closedCount++;
          deploymentResults.push({
            ...deploymentInfo,
            status: 'closed',
            escrowBalance: 0,
          });
          console.log();
          continue;
        }

        const deployment = deploymentRes.deployment;
        const escrowAccount = deploymentRes.escrowAccount;
        const state = deployment.state;

        // Map state number to string
        const stateMap: Record<number, string> = {
          0: 'INVALID',
          1: 'ACTIVE',
          2: 'CLOSED',
        };
        const stateStr = stateMap[state] || `UNKNOWN(${state})`;

        console.log(`Status: ${stateStr}`);

        if (state === 1) {
          // ACTIVE
          activeCount++;

          // Check escrow balance
          if (escrowAccount && escrowAccount.balance) {
            const escrowBalance = parseInt(escrowAccount.balance.amount);
            const escrowBalanceAKT = (escrowBalance / 1_000_000).toFixed(6);
            console.log(`Escrow Balance: ${escrowBalance} uakt (${escrowBalanceAKT} AKT)`);

            if (escrowBalance < LOW_BALANCE_THRESHOLD_UAKT) {
              console.log(`⚠️  LOW BALANCE - Below ${LOW_BALANCE_THRESHOLD_UAKT / 1_000_000} AKT threshold!`);
              lowFundsCount++;
              deploymentsToTopUp.push(deploymentInfo);
            } else {
              console.log('✓ Balance OK');
            }

            deploymentResults.push({
              ...deploymentInfo,
              status: 'active',
              escrowBalance,
              escrowBalanceAKT,
            });
          } else {
            console.log('Escrow Balance: No escrow account found');
            deploymentResults.push({
              ...deploymentInfo,
              status: 'active',
              escrowBalance: 0,
            });
          }
        } else {
          closedCount++;
          deploymentResults.push({
            ...deploymentInfo,
            status: 'closed',
            escrowBalance: 0,
          });
        }
      } catch (error: any) {
        console.log(`Error: ${error.message}`);
        deploymentResults.push({
          ...deploymentInfo,
          status: 'error',
          error: error.message,
        });
      }

      console.log();
    }

    // Top up deployments if needed
    if (deploymentsToTopUp.length > 0) {
      console.log('\n=== Topping Up Low Balance Deployments ===\n');

      for (const deployment of deploymentsToTopUp) {
        console.log(`Topping up ${deployment.name} (DSEQ: ${deployment.dseq})...`);
        console.log(`Adding ${TOP_UP_AMOUNT_UAKT} uakt (5 AKT) to escrow...`);

        try {
          const result = await chainSDK.akash.escrow.v1.accountDeposit({
            signer: address,
            id: {
              scope: 1, // deployment scope
              xid: `${address}/${deployment.dseq}`,
            },
            deposit: {
              amount: { denom: 'uakt', amount: TOP_UP_AMOUNT_UAKT },
              sources: [1], // Source.balance = 1
            },
          });

          console.log(`✓ Successfully topped up ${deployment.name}`);
          console.log(`Transaction: ${JSON.stringify(result, null, 2)}`);
        } catch (error: any) {
          console.log(`✗ Failed to top up ${deployment.name}: ${error.message}`);
        }

        console.log();
      }
    }

    // Final summary
    console.log('\n=== Audit Summary ===\n');
    console.log(`Total Known Deployments: ${KNOWN_DEPLOYMENTS.length}`);
    console.log(`Active Deployments: ${activeCount}`);
    console.log(`Closed/Not Found Deployments: ${closedCount}`);
    console.log(`Deployments with Low Funds: ${lowFundsCount}`);
    console.log(`Deployments Topped Up: ${deploymentsToTopUp.length}`);
    console.log();

    console.log('Deployment Details:');
    deploymentResults.forEach((result) => {
      console.log(`  - ${result.name}: ${result.status}`);
      if (result.status === 'active' && result.escrowBalanceAKT) {
        console.log(`    Escrow: ${result.escrowBalanceAKT} AKT`);
      }
      if (result.status === 'error') {
        console.log(`    Error: ${result.error}`);
      }
    });

    console.log('\n=== Audit Complete ===');
  } catch (error) {
    console.error('Fatal error during audit:', error);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
