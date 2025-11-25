import { describe, it, expect, vi } from 'vitest';
import { GetBalancesTool } from './get-balances.js';
import type { ToolContext } from '../types/index.js';

describe('GetBalancesTool', () => {
  describe('metadata', () => {
    it('should have correct name', () => {
      expect(GetBalancesTool.name).toBe('get-akash-balances');
    });

    it('should have a description mentioning AKT', () => {
      expect(GetBalancesTool.description).toContain('AKT');
    });
  });

  describe('parameter validation', () => {
    it('should accept valid address', () => {
      const result = GetBalancesTool.parameters.safeParse({
        address: 'akash1degudmhf24auhfnqtn99mkja3xt7clt9um77tn',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing address', () => {
      const result = GetBalancesTool.parameters.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject empty address', () => {
      const result = GetBalancesTool.parameters.safeParse({
        address: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('handler', () => {
    it('should return balances from chain SDK', async () => {
      const mockBalances = [
        { denom: 'uakt', amount: '1000000' },
        { denom: 'ibc/abc123', amount: '500000' },
      ];

      const mockContext = {
        chainSDK: {
          cosmos: {
            bank: {
              v1beta1: {
                getAllBalances: vi.fn().mockResolvedValue({ balances: mockBalances }),
              },
            },
          },
        },
      } as unknown as ToolContext;

      const result = await GetBalancesTool.handler(
        { address: 'akash1abc' },
        mockContext
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual(mockBalances);
      expect(mockContext.chainSDK.cosmos.bank.v1beta1.getAllBalances).toHaveBeenCalledWith({
        address: 'akash1abc',
      });
    });

    it('should handle errors gracefully', async () => {
      const mockContext = {
        chainSDK: {
          cosmos: {
            bank: {
              v1beta1: {
                getAllBalances: vi.fn().mockRejectedValue(new Error('RPC error')),
              },
            },
          },
        },
      } as unknown as ToolContext;

      const result = await GetBalancesTool.handler(
        { address: 'akash1abc' },
        mockContext
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveProperty('error');
      expect(parsed.error).toContain('RPC error');
    });

    it('should return empty array when no balances', async () => {
      const mockContext = {
        chainSDK: {
          cosmos: {
            bank: {
              v1beta1: {
                getAllBalances: vi.fn().mockResolvedValue({ balances: [] }),
              },
            },
          },
        },
      } as unknown as ToolContext;

      const result = await GetBalancesTool.handler(
        { address: 'akash1abc' },
        mockContext
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toEqual([]);
    });
  });
});
