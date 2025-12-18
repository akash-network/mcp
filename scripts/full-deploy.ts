#!/usr/bin/env npx tsx
/**
 * Full deployment script using correct certificate
 */

import https from 'https';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { createStargateClient, createChainNodeSDK, SDL } from '@akashnetwork/chain-sdk';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC_ENDPOINT = 'https://rpc.akashnet.net:443';
const GRPC_ENDPOINT = 'https://akash-grpc.publicnode.com:443';

const SDL_CONTENT = `---
version: "2.0"

services:
  mongo:
    image: mongo:7
    env:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=fd88a9fe393bdddeed336a7f35289796
    expose:
      - port: 27017
        as: 27017
        to:
          - service: infisical
    params:
      storage:
        data:
          mount: /data/db
          readOnly: false

  infisical:
    image: infisical/infisical:latest
    env:
      - ENCRYPTION_KEY=2931120f0296358e9aaf6fe4929f5ad8
      - JWT_SIGNUP_SECRET=36bbae0d102b24a76a93f3e90feaa2b1c38ba4eb7d8c2a95966904b6c4722ffe
      - JWT_REFRESH_SECRET=36bbae0d102b24a76a93f3e90feaa2b1c38ba4eb7d8c2a95966904b6c4722ffe
      - JWT_AUTH_SECRET=36bbae0d102b24a76a93f3e90feaa2b1c38ba4eb7d8c2a95966904b6c4722ffe
      - JWT_SERVICE_SECRET=36bbae0d102b24a76a93f3e90feaa2b1c38ba4eb7d8c2a95966904b6c4722ffe
      - MONGO_URL=mongodb://admin:fd88a9fe393bdddeed336a7f35289796@mongo:27017/infisical?authSource=admin
      - SITE_URL=https://secrets.alternatefutures.ai
      - HTTPS_ENABLED=false
      - TELEMETRY_ENABLED=false
    expose:
      - port: 8080
        as: 80
        to:
          - global: true
        accept:
          - secrets.alternatefutures.ai
    depends_on:
      - mongo

profiles:
  compute:
    mongo:
      resources:
        cpu:
          units: 1.0
        memory:
          size: 2Gi
        storage:
          - name: data
            size: 20Gi

    infisical:
      resources:
        cpu:
          units: 1.0
        memory:
          size: 1Gi
        storage:
          size: 512Mi

  placement:
    dcloud:
      signedBy:
        anyOf:
          - "akash1365yvmc4s7awdyj3n2sav7xfx76adc6dnmlx63"
      attributes:
        host: akash
      pricing:
        mongo:
          denom: uakt
          amount: 25
        infisical:
          denom: uakt
          amount: 20

deployment:
  mongo:
    dcloud:
      profile: mongo
      count: 1

  infisical:
    dcloud:
      profile: infisical
      count: 1
`;

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  const mnemonic = process.env.AKASH_MNEMONIC;
  if (!mnemonic) {
    console.error('AKASH_MNEMONIC not set');
    process.exit(1);
  }

  console.log('=== Full Deployment Script ===\n');

  // Create wallet
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: 'akash' });
  const accounts = await wallet.getAccounts();
  const address = accounts[0].address;
  console.log('Owner:', address);

  // Load certificate
  const certPath = path.resolve(__dirname, '../dist/utils/certificates', `${address}.json`);
  if (!fs.existsSync(certPath)) {
    console.error('Certificate not found! Run fix-certificate.ts first.');
    process.exit(1);
  }
  const certData = JSON.parse(fs.readFileSync(certPath, 'utf8'));
  console.log('Certificate loaded');

  // Create chain SDK
  const stargateClient = createStargateClient({
    baseUrl: RPC_ENDPOINT,
    signer: wallet,
    defaultGasPrice: '0.025uakt',
  });

  const chainSDK = createChainNodeSDK({
    query: { baseUrl: GRPC_ENDPOINT },
    tx: { signer: stargateClient },
  });

  // Parse SDL
  const sdl = SDL.fromString(SDL_CONTENT, 'beta3');

  // Step 1: Create deployment
  console.log('\n1. Creating deployment...');
  const deployResult = await chainSDK.akash.deployment.v1.createDeployment({
    sdl: sdl,
    depositor: address,
    deposit: { denom: 'uakt', amount: '5000000' },
  });

  // Extract dseq from result
  const dseq = (deployResult as any).dseq?.low || (deployResult as any).dseq;
  console.log('   Deployment created with dseq:', dseq);

  // Step 2: Wait for bids
  console.log('\n2. Waiting for bids...');
  await sleep(10000);  // Wait 10 seconds for bids

  const bidsResponse = await chainSDK.akash.market.v1beta5.getBids({
    filters: {
      owner: address,
      dseq: { low: dseq, high: 0, unsigned: true },
      gseq: 0,
      oseq: 0,
      provider: '',
      state: 'open',
    },
    pagination: undefined,
  });

  const bids = bidsResponse.bids || [];
  console.log(`   Found ${bids.length} bid(s)`);

  if (bids.length === 0) {
    console.error('No bids received!');
    process.exit(1);
  }

  // Select first bid
  const selectedBid = bids[0];
  const provider = selectedBid.bid?.bidId?.provider || '';
  console.log('   Selected provider:', provider);

  // Step 3: Create lease
  console.log('\n3. Creating lease...');
  await chainSDK.akash.market.v1.createLease({
    bidId: {
      owner: address,
      dseq: { low: dseq, high: 0, unsigned: true },
      gseq: 1,
      oseq: 1,
      provider: provider,
    },
  });
  console.log('   Lease created');

  // Step 4: Send manifest
  console.log('\n4. Sending manifest...');

  // Get provider info
  const providerRes = await chainSDK.akash.provider.v1beta4.getProvider({ owner: provider });
  const hostUri = providerRes.provider?.hostUri || '';
  console.log('   Provider URI:', hostUri);

  const manifest = sdl.manifestSortedJSON();
  const uri = new URL(hostUri);
  const requestPath = `/deployment/${dseq}/manifest`;

  const agent = new https.Agent({
    cert: certData.cert,
    key: certData.privateKey,
    rejectUnauthorized: false,
  });

  const result = await new Promise<{ status: number; body: string }>((resolve, reject) => {
    const req = https.request(
      {
        hostname: uri.hostname,
        port: uri.port,
        path: requestPath,
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Content-Length': manifest.length,
        },
        agent: agent,
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({ status: res.statusCode || 0, body: data });
        });
      }
    );

    req.on('error', reject);
    req.write(manifest);
    req.end();
  });

  console.log('   Response status:', result.status);
  console.log('   Response body:', result.body);

  if (result.status === 200) {
    console.log('\n✅ Manifest sent successfully!');

    // Step 5: Get services
    console.log('\n5. Getting services...');
    await sleep(5000);

    // Query lease status to get URIs (simplified)
    console.log('   Deployment DSEQ:', dseq);
    console.log('   Provider:', provider);
  } else {
    console.log('\n❌ Manifest send failed');
  }
}

main().catch(console.error);
