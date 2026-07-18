import { describe, expect, it } from 'vitest';
import { getManifestVersion, parseSDL, serializeManifest } from '../../src/utils/parse-sdl.js';

const sdl = `
version: "2.0"
services:
  postgres:
    image: postgres:16-alpine
    expose:
      - port: 5432
        as: 5432
        to:
          - global: false
profiles:
  compute:
    postgres:
      resources:
        cpu:
          units: 0.1
        memory:
          size: 128Mi
        storage:
          size: 256Mi
  placement:
    smoke:
      pricing:
        postgres:
          denom: uakt
          amount: 10000
deployment:
  postgres:
    smoke:
      profile: postgres
      count: 1
`;

describe('parseSDL', () => {
  it('generates chain groups, provider manifest JSON, and a stable manifest hash', async () => {
    const parsed = parseSDL(sdl);

    expect(parsed.groupSpecs).toHaveLength(1);
    expect(parsed.groups[0].services[0]).toMatchObject({
      name: 'postgres',
      image: 'postgres:16-alpine',
    });
    expect(JSON.parse(serializeManifest(parsed))[0].services[0].name).toBe('postgres');
    expect(await getManifestVersion(parsed)).toHaveLength(32);
  });

  it('rejects incomplete SDL', () => {
    expect(() => parseSDL('version: "2.0"')).toThrow('Invalid SDL');
  });
});
