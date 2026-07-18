import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveWalletCredential } from '../src/config.js';

const temporaryPaths: string[] = [];

afterEach(() => {
  for (const temporaryPath of temporaryPaths.splice(0)) {
    fs.rmSync(temporaryPath, { force: true, recursive: true });
  }
});

function createSecretFile(value: string): string {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'akash-mcp-')), 'secret');
  fs.writeFileSync(filePath, value, { mode: 0o600 });
  temporaryPaths.push(path.dirname(filePath));
  return filePath;
}

describe('resolveWalletCredential', () => {
  it('uses a direct mnemonic environment variable', () => {
    const credential = resolveWalletCredential({
      AKASH_MNEMONIC: 'test test test test test test test test test test test junk',
    });

    expect(credential).toEqual({
      type: 'mnemonic',
      value: 'test test test test test test test test test test test junk',
    });
  });

  it('reads and trims a file-backed private key', () => {
    const secretPath = createSecretFile(`  ${'a'.repeat(64)}\n`);

    const credential = resolveWalletCredential({ AKASH_PRIVATE_KEY_FILE: secretPath });

    expect(credential).toEqual({ type: 'privateKey', value: 'a'.repeat(64) });
  });

  it('rejects ambiguous credential configuration', () => {
    expect(() =>
      resolveWalletCredential({
        AKASH_MNEMONIC: 'test test test test test test test test test test test junk',
        AKASH_PRIVATE_KEY: 'a'.repeat(64),
      })
    ).toThrow('Multiple wallet credential sources are configured');
  });

  it('rejects a missing credential', () => {
    expect(() => resolveWalletCredential({})).toThrow('Configure exactly one');
  });
});
