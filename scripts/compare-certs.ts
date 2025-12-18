#!/usr/bin/env npx tsx
/**
 * Compare local certificate with on-chain certificate
 */

import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { createStargateClient, createChainNodeSDK } from '@akashnetwork/chain-sdk';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import * as crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC_ENDPOINT = 'https://rpc.akashnet.net:443';
const GRPC_ENDPOINT = 'https://akash-grpc.publicnode.com:443';

async function main() {
  const mnemonic = process.env.AKASH_MNEMONIC;
  if (!mnemonic) {
    console.error('AKASH_MNEMONIC not set');
    process.exit(1);
  }

  console.log('=== Certificate Comparison ===\n');

  // Create wallet
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(mnemonic, { prefix: 'akash' });
  const accounts = await wallet.getAccounts();
  const address = accounts[0].address;
  console.log('Address:', address);

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

  // Load local certificate
  const certPath = path.resolve(__dirname, '../dist/utils/certificates', `${address}.json`);
  const localCert = JSON.parse(fs.readFileSync(certPath, 'utf8'));
  console.log('\n=== Local Certificate ===');
  console.log('Path:', certPath);
  console.log('Cert length:', localCert.cert.length);
  console.log('Cert hash:', crypto.createHash('sha256').update(localCert.cert).digest('hex').substring(0, 16));

  // Query on-chain certificates
  console.log('\n=== On-Chain Certificates ===');
  const certsResponse = await chainSDK.akash.cert.v1.getCertificates({
    filter: { owner: address, serial: '', state: 'valid' },
    pagination: undefined,
  });

  const certs = certsResponse.certificates || [];
  console.log(`Found ${certs.length} valid cert(s)`);

  for (const cert of certs) {
    console.log('\n--- Certificate ---');
    console.log('Serial:', cert.serial);
    console.log('Keys:', Object.keys(cert));
    console.log('cert field type:', typeof cert.cert);
    console.log('cert field:', cert.cert);

    // Check certificate field structure
    if (cert.certificate) {
      console.log('certificate field found');
      console.log('certificate.cert type:', typeof (cert.certificate as any).cert);
      const certData = (cert.certificate as any).cert;
      if (certData) {
        let onChainCert: string;
        if (certData instanceof Uint8Array) {
          onChainCert = new TextDecoder().decode(certData);
        } else if (typeof certData === 'string') {
          onChainCert = certData;
        } else {
          console.log('Unknown cert format:', certData);
          continue;
        }
        console.log('On-chain cert length:', onChainCert.length);
        console.log('On-chain cert hash:', crypto.createHash('sha256').update(onChainCert).digest('hex').substring(0, 16));
        console.log('Content match:', localCert.cert === onChainCert);
      }
    }
  }

  // Try raw query
  console.log('\n=== Raw Certificate Query ===');
  console.log('Full response:', JSON.stringify(certsResponse, (key, value) => {
    if (value instanceof Uint8Array) {
      return `Uint8Array(${value.length}): ${new TextDecoder().decode(value).substring(0, 50)}...`;
    }
    return value;
  }, 2).substring(0, 2000));
}

main().catch(console.error);
