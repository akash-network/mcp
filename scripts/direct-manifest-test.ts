#!/usr/bin/env npx tsx
/**
 * Direct manifest send test - bypasses MCP to test certificate
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

const mongoPassword = process.env.MONGO_INITDB_ROOT_PASSWORD;
const infisicalEncryptionKey = process.env.INFISICAL_ENCRYPTION_KEY;
const infisicalJwtSecret = process.env.INFISICAL_JWT_SECRET;

if (!mongoPassword || !infisicalEncryptionKey || !infisicalJwtSecret) {
  console.error('Missing required env vars: MONGO_INITDB_ROOT_PASSWORD, INFISICAL_ENCRYPTION_KEY, INFISICAL_JWT_SECRET');
  process.exit(1);
}

const SDL_CONTENT = `---
version: "2.0"

services:
  mongo:
    image: mongo:7
    env:
      - MONGO_INITDB_ROOT_USERNAME=admin
      - MONGO_INITDB_ROOT_PASSWORD=${mongoPassword}
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
      - ENCRYPTION_KEY=${infisicalEncryptionKey}
      - JWT_SIGNUP_SECRET=${infisicalJwtSecret}
      - JWT_REFRESH_SECRET=${infisicalJwtSecret}
      - JWT_AUTH_SECRET=${infisicalJwtSecret}
      - JWT_SERVICE_SECRET=${infisicalJwtSecret}
      - MONGO_URL=mongodb://admin:${mongoPassword}@mongo:27017/infisical?authSource=admin
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

async function main() {
  const mnemonic = process.env.AKASH_MNEMONIC;
  if (!mnemonic) {
    console.error('AKASH_MNEMONIC not set');
    process.exit(1);
  }

  const dseq = parseInt(process.env.DSEQ || '24344829');
  const provider = process.env.PROVIDER || 'akash1gq42nhp64xrkxlawvchfguuq0wpdx68rkzfnw6';

  console.log('=== Direct Manifest Send Test ===\n');
  console.log('DSEQ:', dseq);
  console.log('Provider:', provider);

  // Create wallet
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: 'akash' });
  const accounts = await wallet.getAccounts();
  const address = accounts[0].address;
  console.log('Owner:', address);

  // Load certificate
  const certPath = path.resolve(__dirname, '../dist/utils/certificates', `${address}.json`);
  console.log('Cert path:', certPath);

  if (!fs.existsSync(certPath)) {
    console.error('Certificate not found!');
    process.exit(1);
  }

  const certData = JSON.parse(fs.readFileSync(certPath, 'utf8'));
  console.log('Certificate loaded');
  console.log('Cert length:', certData.cert.length);
  console.log('Key length:', certData.privateKey.length);

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

  // Get provider info
  console.log('\nQuerying provider info...');
  const providerRes = await chainSDK.akash.provider.v1beta4.getProvider({ owner: provider });

  if (!providerRes.provider) {
    console.error('Provider not found!');
    process.exit(1);
  }

  const hostUri = providerRes.provider.hostUri;
  console.log('Provider URI:', hostUri);

  // Parse SDL and get manifest
  const sdl = SDL.fromString(SDL_CONTENT, 'beta3');
  const manifest = sdl.manifestSortedJSON();
  console.log('Manifest length:', manifest.length);

  // Create HTTPS agent with certificate
  const agent = new https.Agent({
    cert: certData.cert,
    key: certData.privateKey,
    rejectUnauthorized: false,
  });

  // Make request
  const uri = new URL(hostUri);
  const requestPath = `/deployment/${dseq}/manifest`;

  console.log('\nSending manifest to:', `${hostUri}${requestPath}`);
  console.log('Hostname:', uri.hostname);
  console.log('Port:', uri.port);

  return new Promise<void>((resolve, reject) => {
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
        console.log('\n=== Response ===');
        console.log('Status:', res.statusCode);
        console.log('Headers:', JSON.stringify(res.headers, null, 2));

        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log('Body:', data || '(empty)');
          if (res.statusCode === 200) {
            console.log('\n✅ SUCCESS!');
          } else {
            console.log('\n❌ FAILED');
          }
          resolve();
        });
      }
    );

    req.on('error', (err) => {
      console.error('Request error:', err);
      reject(err);
    });

    req.write(manifest);
    req.end();
  });
}

main().catch(console.error);
