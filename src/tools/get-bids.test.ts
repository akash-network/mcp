import { describe, it, expect, vi } from 'vitest';
import { GetBidsTool } from './get-bids.js';
import type { ToolContext } from '../types/index.js';

describe('GetBidsTool', () => {
  describe('metadata', () => {
    it('should have correct name', () => {
      expect(GetBidsTool.name).toBe('get-bids');
    });

    it('should have a description', () => {
      expect(GetBidsTool.description).toBeDefined();
      expect(GetBidsTool.description).toContain('bids');
    });
  });

  describe('parameter validation', () => {
    it('should accept valid parameters', () => {
      const result = GetBidsTool.parameters.safeParse({
        dseq: 12345,
        owner: 'akash1abc123',
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing dseq', () => {
      const result = GetBidsTool.parameters.safeParse({
        owner: 'akash1abc123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing owner', () => {
      const result = GetBidsTool.parameters.safeParse({
        dseq: 12345,
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-positive dseq', () => {
      const result = GetBidsTool.parameters.safeParse({
        dseq: 0,
        owner: 'akash1abc123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative dseq', () => {
      const result = GetBidsTool.parameters.safeParse({
        dseq: -1,
        owner: 'akash1abc123',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty owner string', () => {
      const result = GetBidsTool.parameters.safeParse({
        dseq: 12345,
        owner: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject non-integer dseq', () => {
      const result = GetBidsTool.parameters.safeParse({
        dseq: 123.45,
        owner: 'akash1abc123',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('handler', () => {
    it('should return bids when found', async () => {
      // Use regular numbers instead of BigInt to avoid JSON serialization issues
      const mockBids = [
        {
          bid: {
            id: { owner: 'akash1abc', dseq: 12345, gseq: 1, oseq: 1, provider: 'akash1provider', bseq: 0 },
            state: 1, // BidState.open
            price: { denom: 'uakt', amount: '1000' },
            createdAt: 1234567890,
          },
        },
      ];

      const mockContext = {
        chainSDK: {
          akash: {
            market: {
              v1beta5: {
                getBids: vi.fn().mockResolvedValue({ bids: mockBids }),
              },
            },
          },
        },
      } as unknown as ToolContext;

      const result = await GetBidsTool.handler(
        { dseq: 12345, owner: 'akash1abc' },
        mockContext
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(Array.isArray(parsed)).toBe(true);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toHaveProperty('bidId');
      expect(parsed[0]).toHaveProperty('state');
      expect(parsed[0]).toHaveProperty('price');
    });

    it('should return message when no bids found', async () => {
      const mockContext = {
        chainSDK: {
          akash: {
            market: {
              v1beta5: {
                getBids: vi.fn().mockResolvedValue({ bids: [] }),
              },
            },
          },
        },
      } as unknown as ToolContext;

      const result = await GetBidsTool.handler(
        { dseq: 12345, owner: 'akash1abc' },
        mockContext
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toContain('No bids found');
    });

    it('should handle errors gracefully', async () => {
      const mockContext = {
        chainSDK: {
          akash: {
            market: {
              v1beta5: {
                getBids: vi.fn().mockRejectedValue(new Error('Network error')),
              },
            },
          },
        },
      } as unknown as ToolContext;

      const result = await GetBidsTool.handler(
        { dseq: 12345, owner: 'akash1abc' },
        mockContext
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveProperty('error');
      expect(parsed.error).toContain('Network error');
    });
  });
});
