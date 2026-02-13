import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import * as cert from '@akashnetwork/akashjs/build/certificates/index.js';
import { certificateManager } from '@akashnetwork/akashjs/build/certificates/certificate-manager/index.js';
import type { DirectSecp256k1HdWallet, DirectSecp256k1Wallet } from '@cosmjs/proto-signing';
import type { SigningStargateClient } from '@cosmjs/stargate';
import type { CertificatePem } from '@akashnetwork/akashjs/build/certificates/certificate-manager/CertificateManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export async function loadCertificate(
  wallet: DirectSecp256k1HdWallet | DirectSecp256k1Wallet,
  client: SigningStargateClient
): Promise<CertificatePem> {
  const accounts = await wallet.getAccounts();
  const certificatesDir = path.resolve(__dirname, './certificates');

  // Ensure certificates directory exists
  if (!fs.existsSync(certificatesDir)) {
    fs.mkdirSync(certificatesDir, { recursive: true });
  }

  const certificatePath = path.resolve(certificatesDir, `${accounts[0].address}.json`);

  // check to see if we can load the certificate
  if (fs.existsSync(certificatePath)) {
    return JSON.parse(fs.readFileSync(certificatePath, 'utf8'));
  }

  // if not, create a new one
  const certificate = certificateManager.generatePEM(accounts[0].address);
  const result = await cert.broadcastCertificate(certificate, accounts[0].address, client);

  if (result.code === 0) {
    // save the certificate
    fs.writeFileSync(certificatePath, JSON.stringify(certificate));
    return certificate;
  }

  throw new Error(`Could not create certificate: ${result.rawLog} `);
}
