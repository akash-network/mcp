import { isOfflineDirectSigner } from '@cosmjs/proto-signing';
import { describe, expect, it } from 'vitest';
import { createWalletSigners } from '../../src/utils/load-wallet.js';

const TEST_MNEMONIC = 'test test test test test test test test test test test junk';

describe('createWalletSigners', () => {
  it('creates matching direct and Amino signers from a mnemonic', async () => {
    const { wallet, jwtSigner } = await createWalletSigners({
      mnemonic: TEST_MNEMONIC,
    });
    const [chainAccount] = await wallet.getAccounts();
    const [jwtAccount] = await jwtSigner.getAccounts();

    expect(isOfflineDirectSigner(wallet)).toBe(true);
    expect('signAmino' in jwtSigner).toBe(true);
    expect(chainAccount.address).toBe(jwtAccount.address);
  });

  it('creates matching direct and Amino signers from a private key', async () => {
    const { wallet, jwtSigner } = await createWalletSigners({
      privateKey: '01'.repeat(32),
    });
    const [chainAccount] = await wallet.getAccounts();
    const [jwtAccount] = await jwtSigner.getAccounts();

    expect(isOfflineDirectSigner(wallet)).toBe(true);
    expect('signAmino' in jwtSigner).toBe(true);
    expect(chainAccount.address).toBe(jwtAccount.address);
  });
});
