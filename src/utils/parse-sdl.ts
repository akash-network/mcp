import {
  generateManifest,
  generateManifestVersion,
  manifestToSortedJSON,
  type SDLInput,
} from '@akashnetwork/chain-sdk';
import { load } from 'js-yaml';

export type ParsedSDL = Extract<ReturnType<typeof generateManifest>, { ok: true }>['value'];

export function parseSDL(rawSDL: string): ParsedSDL {
  const input = load(rawSDL) as SDLInput;
  const result = generateManifest(input);

  if (!result.ok) {
    throw new Error(`Invalid SDL: ${JSON.stringify(result.value)}`);
  }

  return result.value;
}

export function serializeManifest(sdl: ParsedSDL): string {
  return manifestToSortedJSON(sdl.groups);
}

export function getManifestVersion(sdl: ParsedSDL): Promise<Uint8Array> {
  return generateManifestVersion(sdl.groups);
}
