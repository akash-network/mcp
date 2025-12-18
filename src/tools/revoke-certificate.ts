import { z } from 'zod';
import type { ToolDefinition, ToolContext } from '../types/index.js';
import { createOutput } from '../utils/create-output.js';

const parameters = z.object({
  serial: z.string().min(1).describe('The certificate serial number to revoke'),
});

export const RevokeCertificateTool: ToolDefinition<typeof parameters> = {
  name: 'revoke-certificate',
  description:
    'Revoke a certificate on Akash Network. ' +
    'The serial is the certificate serial number to revoke.',
  parameters,
  handler: async (params: z.infer<typeof parameters>, context: ToolContext) => {
    const { serial } = params;
    const { wallet, chainSDK } = context;

    try {
      const accounts = await wallet.getAccounts();

      if (!accounts || accounts.length === 0) {
        return createOutput({ error: 'No accounts found in wallet' });
      }

      // Revoke certificate using chain SDK
      const result = await chainSDK.akash.cert.v1.revokeCertificate({
        id: {
          owner: accounts[0].address,
          serial: serial,
        },
      });

      return createOutput({
        success: true,
        serial: serial,
        result: result,
      });
    } catch (error: any) {
      console.error('Error revoking certificate:', error);
      return createOutput({
        error: error.message || 'Unknown error revoking certificate',
      });
    }
  },
};
