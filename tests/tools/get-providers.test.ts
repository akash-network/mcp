import { describe, it, expect, vi } from 'vitest';
import { GetProvidersTool } from '../../src/tools/get-providers.js';
import type { ToolContext } from '../../src/types/index.js';

function mockContext(getProviders: unknown): ToolContext {
  return {
    chainSDK: {
      akash: {
        provider: {
          v1beta4: {
            getProviders,
          },
        },
      },
    },
  } as unknown as ToolContext;
}

const sampleProvider = {
  owner: 'akash1provider',
  hostUri: 'https://provider.example.com:8443',
  attributes: [{ key: 'region', value: 'us-west' }],
  info: { email: 'ops@example.com', website: 'https://example.com' },
};

describe('GetProvidersTool', () => {
  describe('metadata', () => {
    it('should have correct name', () => {
      expect(GetProvidersTool.name).toBe('get-providers');
    });

    it('should have a description', () => {
      expect(GetProvidersTool.description).toBeDefined();
      expect(GetProvidersTool.description).toContain('providers');
    });
  });

  describe('parameter validation', () => {
    it('should accept empty parameters', () => {
      const result = GetProvidersTool.parameters.safeParse({});
      expect(result.success).toBe(true);
    });

    it('should accept limit and offset', () => {
      const result = GetProvidersTool.parameters.safeParse({ limit: 50, offset: 100 });
      expect(result.success).toBe(true);
    });

    it('should accept offset of zero', () => {
      const result = GetProvidersTool.parameters.safeParse({ offset: 0 });
      expect(result.success).toBe(true);
    });

    it('should reject non-positive limit', () => {
      const result = GetProvidersTool.parameters.safeParse({ limit: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject limit above the maximum', () => {
      const result = GetProvidersTool.parameters.safeParse({ limit: 1001 });
      expect(result.success).toBe(false);
    });

    it('should reject negative offset', () => {
      const result = GetProvidersTool.parameters.safeParse({ offset: -1 });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer limit', () => {
      const result = GetProvidersTool.parameters.safeParse({ limit: 12.5 });
      expect(result.success).toBe(false);
    });
  });

  describe('handler', () => {
    it('should return providers when found', async () => {
      const getProviders = vi.fn().mockResolvedValue({
        providers: [sampleProvider],
        pagination: undefined,
      });

      const result = await GetProvidersTool.handler({}, mockContext(getProviders));

      const parsed = JSON.parse(result.content[0].text);
      expect(Array.isArray(parsed.providers)).toBe(true);
      expect(parsed.providers).toHaveLength(1);
      expect(parsed.providers[0]).toHaveProperty('owner', 'akash1provider');
      expect(parsed.providers[0]).toHaveProperty('hostUri');
      expect(parsed.providers[0]).toHaveProperty('attributes');
    });

    it('should forward limit and offset as pagination', async () => {
      const getProviders = vi.fn().mockResolvedValue({ providers: [sampleProvider] });

      await GetProvidersTool.handler({ limit: 25, offset: 50 }, mockContext(getProviders));

      expect(getProviders).toHaveBeenCalledWith({
        pagination: { limit: BigInt(25), offset: BigInt(50), countTotal: false },
      });
    });

    it('should omit limit and offset when not supplied', async () => {
      const getProviders = vi.fn().mockResolvedValue({ providers: [sampleProvider] });

      await GetProvidersTool.handler({}, mockContext(getProviders));

      expect(getProviders).toHaveBeenCalledWith({
        pagination: { limit: undefined, offset: undefined, countTotal: false },
      });
    });

    it('should serialize the pagination cursor and total', async () => {
      const getProviders = vi.fn().mockResolvedValue({
        providers: [sampleProvider],
        pagination: { nextKey: new Uint8Array([1, 2, 3]), total: BigInt(42) },
      });

      const result = await GetProvidersTool.handler({}, mockContext(getProviders));

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.pagination.nextKey).toBe(Buffer.from([1, 2, 3]).toString('base64'));
      expect(parsed.pagination.total).toBe('42');
    });

    it('should report a null cursor when the last page is reached', async () => {
      const getProviders = vi.fn().mockResolvedValue({
        providers: [sampleProvider],
        pagination: { nextKey: new Uint8Array([]), total: BigInt(1) },
      });

      const result = await GetProvidersTool.handler({}, mockContext(getProviders));

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.pagination.nextKey).toBeNull();
    });

    it('should return message when no providers found', async () => {
      const getProviders = vi.fn().mockResolvedValue({ providers: [] });

      const result = await GetProvidersTool.handler({}, mockContext(getProviders));

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toContain('No providers found');
    });

    it('should handle errors gracefully', async () => {
      const getProviders = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await GetProvidersTool.handler({}, mockContext(getProviders));

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveProperty('error');
      expect(parsed.error).toContain('Network error');
    });
  });
});
