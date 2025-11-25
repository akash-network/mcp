import { describe, it, expect, vi } from 'vitest';
import { CreateLeaseTool } from './create-lease.js';
import type { ToolContext } from '../types/index.js';

describe('CreateLeaseTool', () => {
  describe('metadata', () => {
    it('should have correct name', () => {
      expect(CreateLeaseTool.name).toBe('create-lease');
    });

    it('should have a description mentioning bid', () => {
      expect(CreateLeaseTool.description).toContain('bid');
    });
  });

  describe('parameter validation', () => {
    const validParams = {
      owner: 'akash1abc123',
      dseq: 12345,
      gseq: 1,
      oseq: 1,
      provider: 'akash1provider',
    };

    it('should accept valid parameters', () => {
      const result = CreateLeaseTool.parameters.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should reject missing owner', () => {
      const { owner, ...params } = validParams;
      const result = CreateLeaseTool.parameters.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('should reject missing dseq', () => {
      const { dseq, ...params } = validParams;
      const result = CreateLeaseTool.parameters.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('should reject missing gseq', () => {
      const { gseq, ...params } = validParams;
      const result = CreateLeaseTool.parameters.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('should reject missing oseq', () => {
      const { oseq, ...params } = validParams;
      const result = CreateLeaseTool.parameters.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('should reject missing provider', () => {
      const { provider, ...params } = validParams;
      const result = CreateLeaseTool.parameters.safeParse(params);
      expect(result.success).toBe(false);
    });

    it('should reject dseq less than 1', () => {
      const result = CreateLeaseTool.parameters.safeParse({
        ...validParams,
        dseq: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty owner', () => {
      const result = CreateLeaseTool.parameters.safeParse({
        ...validParams,
        owner: '',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty provider', () => {
      const result = CreateLeaseTool.parameters.safeParse({
        ...validParams,
        provider: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('handler', () => {
    it('should create lease successfully', async () => {
      const mockResult = { hash: 'abc123', code: 0 };
      const mockContext = {
        chainSDK: {
          akash: {
            market: {
              v1beta5: {
                createLease: vi.fn().mockResolvedValue(mockResult),
              },
            },
          },
        },
      } as unknown as ToolContext;

      const result = await CreateLeaseTool.handler(
        {
          owner: 'akash1abc',
          dseq: 12345,
          gseq: 1,
          oseq: 1,
          provider: 'akash1provider',
        },
        mockContext
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.result).toEqual(mockResult);

      // Verify the correct parameters were passed
      expect(mockContext.chainSDK.akash.market.v1beta5.createLease).toHaveBeenCalledWith({
        bidId: {
          owner: 'akash1abc',
          dseq: BigInt(12345),
          gseq: 1,
          oseq: 1,
          provider: 'akash1provider',
          bseq: 0,
        },
      });
    });

    it('should handle errors gracefully', async () => {
      const mockContext = {
        chainSDK: {
          akash: {
            market: {
              v1beta5: {
                createLease: vi.fn().mockRejectedValue(new Error('Lease creation failed')),
              },
            },
          },
        },
      } as unknown as ToolContext;

      const result = await CreateLeaseTool.handler(
        {
          owner: 'akash1abc',
          dseq: 12345,
          gseq: 1,
          oseq: 1,
          provider: 'akash1provider',
        },
        mockContext
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveProperty('error');
      expect(parsed.error).toContain('Lease creation failed');
    });
  });
});
