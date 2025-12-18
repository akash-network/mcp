import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CertificateManager } from '@akashnetwork/chain-sdk';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { createOutput } from '../utils/create-output.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper to convert PEM string to Uint8Array
function pemToUint8Array(pem: string): Uint8Array {
  return new TextEncoder().encode(pem);
}

const parameters = z.object({});

export const RegenerateCertificateTool: ToolDefinition<typeof parameters> = {
  name: 'regenerate-certificate',
  description:
    'Regenerate the Akash certificate. Use this when getting 401 errors on manifest send. ' +
    'This will revoke all existing certificates, delete the local certificate, create a new one, ' +
    'and broadcast it to the chain. The new certificate will be used for all subsequent operations.',
  parameters,
  handler: async (_params: z.infer<typeof parameters>, context: ToolContext) => {
    const { wallet, chainSDK, reloadCertificate } = context;

    try {
      const accounts = await wallet.getAccounts();

      if (!accounts || accounts.length === 0) {
        return createOutput({ error: 'No accounts found in wallet' });
      }

      const address = accounts[0].address;
      const certificatesDir = path.resolve(__dirname, '../utils/certificates');
      const certificatePath = path.resolve(certificatesDir, `${address}.json`);

      // Step 1: Revoke ALL existing valid certificates on-chain first
      // This is critical - we must clear old certs before creating a new one
      let revokedCount = 0;
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
        for (const cert of certificates) {
          const serial = cert.serial;
          if (!serial) continue;

          try {
            await chainSDK.akash.cert.v1.revokeCertificate({
              id: {
                owner: address,
                serial: serial,
              },
            });
            revokedCount++;
          } catch (revokeError: any) {
            // Continue even if revoke fails for one cert
            console.warn(`Failed to revoke cert ${serial}: ${revokeError.message}`);
          }
        }
      } catch (queryError: any) {
        console.warn(`Failed to query existing certs: ${queryError.message}`);
        // Continue anyway - we'll try to create a new cert
      }

      // Step 2: Delete local certificate file if it exists
      if (fs.existsSync(certificatePath)) {
        fs.unlinkSync(certificatePath);
      }

      // Step 3: Generate new certificate
      const certManager = new CertificateManager();
      const newCertificate = await certManager.generatePEM(address);
      // Use certificate exactly as generated - don't normalize line endings

      // Step 4: Broadcast to chain - this MUST succeed for the cert to work
      try {
        await chainSDK.akash.cert.v1.createCertificate({
          owner: address,
          cert: pemToUint8Array(newCertificate.cert),
          pubkey: pemToUint8Array(newCertificate.publicKey),
        });
      } catch (error: any) {
        // Don't silently ignore "already exists" - this means our cert wasn't created!
        return createOutput({
          error: `Failed to broadcast certificate: ${error.message}. ` +
            `Try running revoke-all-certificates first, then regenerate again.`,
        });
      }

      // Step 5: Save new certificate locally (only after successful broadcast)
      if (!fs.existsSync(certificatesDir)) {
        fs.mkdirSync(certificatesDir, { recursive: true });
      }
      fs.writeFileSync(certificatePath, JSON.stringify(newCertificate));

      // Step 6: Reload certificate in memory if callback is available
      if (reloadCertificate) {
        await reloadCertificate();
      }

      return createOutput({
        success: true,
        message: `Certificate regenerated successfully. Revoked ${revokedCount} old certificate(s). ` +
          `You can now retry sending the manifest.`,
        address: address,
        certPath: certificatePath,
        revokedCount: revokedCount,
      });
    } catch (error: any) {
      console.error('Error regenerating certificate:', error);
      return createOutput({
        error: error.message || 'Unknown error regenerating certificate',
      });
    }
  },
};
