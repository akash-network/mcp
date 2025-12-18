#!/usr/bin/env npx tsx
/**
 * Fix certificate by normalizing line endings and re-broadcasting
 */

import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import { createStargateClient, createChainNodeSDK, CertificateManager } from '@akashnetwork/chain-sdk';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const RPC_ENDPOINT = 'https://rpc.akashnet.net:443';
const GRPC_ENDPOINT = 'https://akash-grpc.publicnode.com:443';

function pemToUint8Array(pem: string): Uint8Array {
  return new TextEncoder().encode(pem);
}

function normalizeLineEndings(pem: string): string {
  return pem.replace(/\r\n/g, '\n');
}

async function main() {
  const mnemonic = process.env.AKASH_MNEMONIC;
  if (!mnemonic) {
    console.error('AKASH_MNEMONIC not set');
    process.exit(1);
  }

  console.log('=== Certificate Fix Script ===\n');

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

  // Step 1: Revoke all existing certificates
  console.log('\n1. Revoking all existing certificates...');
  try {
    const certsResponse = await chainSDK.akash.cert.v1.getCertificates({
      filter: { owner: address, serial: '', state: 'valid' },
      pagination: undefined,
    });

    const certs = certsResponse.certificates || [];
    console.log(`   Found ${certs.length} valid cert(s)`);

    for (const cert of certs) {
      if (cert.serial) {
        console.log(`   Revoking serial: ${cert.serial}`);
        await chainSDK.akash.cert.v1.revokeCertificate({
          id: { owner: address, serial: cert.serial },
        });
      }
    }
  } catch (e: any) {
    console.log(`   Error revoking: ${e.message}`);
  }

  // Step 2: Delete local certificate
  console.log('\n2. Deleting local certificate...');
  const certPath = path.resolve(__dirname, '../dist/utils/certificates', `${address}.json`);
  if (fs.existsSync(certPath)) {
    fs.unlinkSync(certPath);
    console.log('   Deleted:', certPath);
  } else {
    console.log('   No local cert found');
  }

  // Step 3: Generate new certificate
  console.log('\n3. Generating new certificate...');
  const certMgr = new CertificateManager();
  const newCert = await certMgr.generatePEM(address);

  // Step 4: Normalize line endings to \n
  console.log('\n4. Normalizing line endings...');
  const normalizedCert = {
    cert: normalizeLineEndings(newCert.cert),
    publicKey: normalizeLineEndings(newCert.publicKey),
    privateKey: normalizeLineEndings(newCert.privateKey),
  };

  console.log('   Original cert has \\r\\n:', newCert.cert.includes('\r\n'));
  console.log('   Normalized cert has \\r\\n:', normalizedCert.cert.includes('\r\n'));

  // Step 5: Broadcast to chain with normalized line endings
  console.log('\n5. Broadcasting certificate to chain...');
  try {
    await chainSDK.akash.cert.v1.createCertificate({
      owner: address,
      cert: pemToUint8Array(normalizedCert.cert),
      pubkey: pemToUint8Array(normalizedCert.publicKey),
    });
    console.log('   Certificate broadcast successfully!');
  } catch (e: any) {
    console.error('   Error broadcasting:', e.message);
    process.exit(1);
  }

  // Step 6: Save locally with normalized line endings
  console.log('\n6. Saving certificate locally...');
  const certDir = path.dirname(certPath);
  if (!fs.existsSync(certDir)) {
    fs.mkdirSync(certDir, { recursive: true });
  }
  fs.writeFileSync(certPath, JSON.stringify(normalizedCert));
  console.log('   Saved to:', certPath);

  // Step 7: Verify
  console.log('\n7. Verifying...');
  const certsResponse = await chainSDK.akash.cert.v1.getCertificates({
    filter: { owner: address, serial: '', state: 'valid' },
    pagination: undefined,
  });

  const validCerts = certsResponse.certificates || [];
  console.log(`   Found ${validCerts.length} valid cert(s) on chain`);

  for (const cert of validCerts) {
    console.log(`   - Serial: ${cert.serial}`);
  }

  console.log('\n✅ Certificate fixed! Try sending manifest now.');
}

main().catch(console.error);
