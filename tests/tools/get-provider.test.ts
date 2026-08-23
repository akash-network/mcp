import { describe, it, expect, vi } from 'vitest';
import { GetProviderTool } from '../../src/tools/get-provider.js';
import type { ToolContext } from '../../src/types/index.js';

function mockContext(getProvider: unknown): ToolContext {
  return {
    chainSDK: {
      akash: {
        provider: {
          v1beta4: {
            getProvider,
          },
        },
      },
    },
  } as unknown as ToolContext;
}

describe('GetProviderTool', () => {
  describe('metadata', () => {
    it('should have correct name', () => {
      expect(GetProviderTool.name).toBe('get-provider');
    });

    it('should have a description', () => {
      expect(GetProviderTool.description).toBeDefined();
      expect(GetProviderTool.description).toContain('provider');
    });
  });

  describe('parameter validation', () => {
    it('should accept valid parameters', () => {
      const result = GetProviderTool.parameters.safeParse({
        owner: 'akash1provider',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing owner', () => {
      const result = GetProviderTool.parameters.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject empty owner string', () => {
      const result = GetProviderTool.parameters.safeParse({ owner: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('handler', () => {
    it('should return provider details when found', async () => {
      const getProvider = vi.fn().mockResolvedValue({
        provider: {
          owner: 'akash1provider',
          hostUri: 'https://provider.example.com:8443',
          attributes: [{ key: 'region', value: 'us-west' }],
          info: { email: 'ops@example.com', website: 'https://example.com' },
        },
      });

      const result = await GetProviderTool.handler(
        { owner: 'akash1provider' },
        mockContext(getProvider)
      );

      expect(getProvider).toHaveBeenCalledWith({ owner: 'akash1provider' });

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveProperty('owner', 'akash1provider');
      expect(parsed).toHaveProperty('hostUri', 'https://provider.example.com:8443');
      expect(parsed.attributes).toHaveLength(1);
      expect(parsed.info).toHaveProperty('email', 'ops@example.com');
    });

    it('should return message when provider is not found', async () => {
      const getProvider = vi.fn().mockResolvedValue({ provider: undefined });

      const result = await GetProviderTool.handler(
        { owner: 'akash1missing' },
        mockContext(getProvider)
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toContain('No provider found');
    });

    it('should handle errors gracefully', async () => {
      const getProvider = vi.fn().mockRejectedValue(new Error('Network error'));

      const result = await GetProviderTool.handler(
        { owner: 'akash1provider' },
        mockContext(getProvider)
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveProperty('error');
      expect(parsed.error).toContain('Network error');
    });
  });
});
