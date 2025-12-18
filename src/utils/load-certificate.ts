import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CertificateManager, type CertificatePem } from '@akashnetwork/chain-sdk';
import type { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';
import type { ChainNodeSDK, StargateTxClient } from '../types/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to convert PEM string to Uint8Array
function pemToUint8Array(pem: string): Uint8Array {
  return new TextEncoder().encode(pem);
}

// Get the certificates directory path
export function getCertificatesDir(): string {
  return path.resolve(__dirname, './certificates');
}

// Get the certificate path for a specific address
export function getCertificatePath(address: string): string {
  return path.resolve(getCertificatesDir(), `${address}.json`);
}

// Normalize PEM line endings to Unix-style (\n)
function normalizePem(pem: string): string {
  return pem.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
}

// Load certificate directly from disk (no caching)
export function loadCertificateFromDisk(address: string): CertificatePem | null {
  const certificatePath = getCertificatePath(address);
  if (fs.existsSync(certificatePath)) {
    const cert = JSON.parse(fs.readFileSync(certificatePath, 'utf8')) as CertificatePem;
    // Normalize line endings for all PEM fields
    return {
      cert: normalizePem(cert.cert),
      publicKey: normalizePem(cert.publicKey),
      privateKey: normalizePem(cert.privateKey),
    };
  }
  return null;
}

export async function loadCertificate(
  wallet: DirectSecp256k1HdWallet,
  client: StargateTxClient,
  chainSDK?: ChainNodeSDK
): Promise<CertificatePem> {
  const accounts = await wallet.getAccounts();
  const certificatesDir = getCertificatesDir();

  // Ensure certificates directory exists
  if (!fs.existsSync(certificatesDir)) {
    fs.mkdirSync(certificatesDir, { recursive: true });
  }

  const certificatePath = path.resolve(certificatesDir, `${accounts[0].address}.json`);

  // check to see if we can load the certificate
  if (fs.existsSync(certificatePath)) {
    // Normalize line endings for mTLS compatibility
    const cert = JSON.parse(fs.readFileSync(certificatePath, 'utf8')) as CertificatePem;
    return {
      cert: normalizePem(cert.cert),
      publicKey: normalizePem(cert.publicKey),
      privateKey: normalizePem(cert.privateKey),
    };
  }

  // if not, create a new one
  const certManager = new CertificateManager();
  const certificate = await certManager.generatePEM(accounts[0].address);

  // Broadcast certificate using chain SDK if available
  if (chainSDK) {
    try {
      await chainSDK.akash.cert.v1.createCertificate({
        owner: accounts[0].address,
        cert: pemToUint8Array(certificate.cert),
        pubkey: pemToUint8Array(certificate.publicKey),
      });
      // save the certificate
      fs.writeFileSync(certificatePath, JSON.stringify(certificate));
      return certificate;
    } catch (error: any) {
      // Check if certificate already exists on chain
      if (error.message?.includes('certificate already exists')) {
        fs.writeFileSync(certificatePath, JSON.stringify(certificate));
        return certificate;
      }
      throw new Error(`Could not create certificate: ${error.message}`);
    }
  }

  // Fallback: Just save locally without broadcasting (for when chainSDK is not ready)
  fs.writeFileSync(certificatePath, JSON.stringify(certificate));
  return certificate;
}
