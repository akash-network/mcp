import { describe, expect, it } from 'vitest';
import { certificateCreationError } from '../../src/utils/load-certificate.js';

describe('certificateCreationError', () => {
  it('explains how to recover when the wallet is not funded on-chain', () => {
    const error = certificateCreationError(
      'akash1test',
      new Error('Account \'akash1test\' does not exist on chain.')
    );

    expect(error.message).toContain('Fund the account with AKT');
    expect(error.message).toContain('akash1test');
  });

  it('preserves other certificate creation failures', () => {
    const error = certificateCreationError('akash1test', new Error('RPC unavailable'));

    expect(error.message).toBe('Could not create certificate: RPC unavailable');
  });
});
