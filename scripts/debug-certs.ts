#!/usr/bin/env npx tsx
/**
 * Debug script to query on-chain certificates
 */

import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { createStargateClient, createChainNodeSDK } from '@akashnetwork/chain-sdk';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC_ENDPOINT = process.env.RPC_ENDPOINT || 'https://rpc.akashnet.net:443';
const GRPC_ENDPOINT = process.env.GRPC_ENDPOINT || 'https://akash-grpc.publicnode.com:443';

async function main() {
  const mnemonic = process.env.AKASH_MNEMONIC;
  if (!mnemonic) {
    console.error('AKASH_MNEMONIC environment variable not set');
    process.exit(1);
  }

  // Create wallet
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
    prefix: 'akash',
  });

  const accounts = await wallet.getAccounts();
  const address = accounts[0].address;
  console.log('Address:', address);

  // Create stargate client
  const stargateClient = createStargateClient({
    baseUrl: RPC_ENDPOINT,
    signer: wallet,
    defaultGasPrice: '0.025uakt',
  });

  // Create chain SDK
  const chainSDK = createChainNodeSDK({
    query: {
      baseUrl: GRPC_ENDPOINT,
    },
    tx: {
      signer: stargateClient,
    },
  });

  // Query certificates
  console.log('\n=== Querying On-Chain Certificates ===\n');

  try {
    const certsResponse = await chainSDK.akash.cert.v1.getCertificates({
      filter: {
        owner: address,
        serial: '',
        state: 'valid',
      },
      pagination: undefined,
    });

    const certificates = certsResponse.certificates || [];
    console.log(`Found ${certificates.length} valid certificate(s) on-chain:\n`);

    for (const cert of certificates) {
      console.log('Serial:', cert.serial);
      console.log('State:', cert.state);
      console.log('---');
    }

    if (certificates.length === 0) {
      console.log('No valid certificates found on-chain!');
      console.log('This means the certificate was not properly broadcast.');
    }
  } catch (error) {
    console.error('Error querying certificates:', error);
  }

  // Check local certificate
  console.log('\n=== Local Certificate ===\n');
  const certPath = path.resolve(__dirname, '../dist/utils/certificates', `${address}.json`);

  if (fs.existsSync(certPath)) {
    const localCert = JSON.parse(fs.readFileSync(certPath, 'utf8'));
    console.log('Local certificate exists at:', certPath);
    console.log('Certificate PEM preview:', localCert.cert.substring(0, 100) + '...');
  } else {
    console.log('No local certificate found at:', certPath);
  }
}

main().catch(console.error);
