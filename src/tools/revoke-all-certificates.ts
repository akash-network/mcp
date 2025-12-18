import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { createOutput } from '../utils/create-output.js';

const parameters = z.object({});

export const RevokeAllCertificatesTool: ToolDefinition<typeof parameters> = {
  name: 'revoke-all-certificates',
  description:
    'Revoke ALL certificates on Akash Network for this account. ' +
    'Use this to clean up old certificates when getting 401 errors.',
  parameters,
  handler: async (_params: z.infer<typeof parameters>, context: ToolContext) => {
    const { wallet, chainSDK } = context;

    try {
      const accounts = await wallet.getAccounts();

      if (!accounts || accounts.length === 0) {
        return createOutput({ error: 'No accounts found in wallet' });
      }

      const owner = accounts[0].address;

      // Query all certificates for this owner
      const certsResponse = await chainSDK.akash.cert.v1.getCertificates({
        filter: {
          owner: owner,
          serial: '',
          state: 'valid',
        },
        pagination: undefined,
      });

      const certificates = certsResponse.certificates || [];

      if (certificates.length === 0) {
        return createOutput({
          success: true,
          message: 'No certificates found to revoke',
          revoked: 0,
        });
      }

      const revokedSerials: string[] = [];
      const errors: string[] = [];

      // Revoke each certificate
      for (const cert of certificates) {
        const serial = cert.serial;
        if (!serial) continue;

        try {
          await chainSDK.akash.cert.v1.revokeCertificate({
            id: {
              owner: owner,
              serial: serial,
            },
          });
          revokedSerials.push(serial);
        } catch (error: any) {
          errors.push(`Serial ${serial}: ${error.message}`);
        }
      }

      return createOutput({
        success: true,
        message: `Revoked ${revokedSerials.length} of ${certificates.length} certificates`,
        revoked: revokedSerials.length,
        total: certificates.length,
        revokedSerials: revokedSerials,
        errors: errors.length > 0 ? errors : undefined,
      });
    } catch (error: any) {
      console.error('Error revoking certificates:', error);
      return createOutput({
        error: error.message || 'Unknown error revoking certificates',
      });
    }
  },
};
