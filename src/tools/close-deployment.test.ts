import { describe, it, expect, vi } from 'vitest';
import { CloseDeploymentTool } from './close-deployment.js';
import type { ToolContext } from '../types/index.js';

describe('CloseDeploymentTool', () => {
  describe('metadata', () => {
    it('should have correct name', () => {
      expect(CloseDeploymentTool.name).toBe('close-deployment');
    });

    it('should have a description mentioning dseq', () => {
      expect(CloseDeploymentTool.description).toContain('dseq');
    });
  });

  describe('parameter validation', () => {
    it('should accept valid dseq', () => {
      const result = CloseDeploymentTool.parameters.safeParse({
        dseq: 12345,
      });
      expect(result.success).toBe(true);
    });

    it('should reject missing dseq', () => {
      const result = CloseDeploymentTool.parameters.safeParse({});
      expect(result.success).toBe(false);
    });

    it('should reject dseq less than 1', () => {
      const result = CloseDeploymentTool.parameters.safeParse({
        dseq: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject negative dseq', () => {
      const result = CloseDeploymentTool.parameters.safeParse({
        dseq: -1,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('handler', () => {
    it('should close deployment successfully', async () => {
      const mockResult = { hash: 'abc123', code: 0 };
      const mockContext = {
        wallet: {
          getAccounts: vi.fn().mockResolvedValue([{ address: 'akash1owner' }]),
        },
        chainSDK: {
          akash: {
            deployment: {
              v1beta4: {
                closeDeployment: vi.fn().mockResolvedValue(mockResult),
              },
            },
          },
        },
      } as unknown as ToolContext;

      const result = await CloseDeploymentTool.handler(
        { dseq: 12345 },
        mockContext
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.success).toBe(true);
      expect(parsed.result).toEqual(mockResult);

      // Verify correct parameters
      expect(mockContext.chainSDK.akash.deployment.v1beta4.closeDeployment).toHaveBeenCalledWith({
        id: {
          owner: 'akash1owner',
          dseq: BigInt(12345),
        },
      });
    });

    it('should return error when no accounts in wallet', async () => {
      const mockContext = {
        wallet: {
          getAccounts: vi.fn().mockResolvedValue([]),
        },
        chainSDK: {},
      } as unknown as ToolContext;

      const result = await CloseDeploymentTool.handler(
        { dseq: 12345 },
        mockContext
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed.error).toContain('No accounts found');
    });

    it('should handle chain SDK errors gracefully', async () => {
      const mockContext = {
        wallet: {
          getAccounts: vi.fn().mockResolvedValue([{ address: 'akash1owner' }]),
        },
        chainSDK: {
          akash: {
            deployment: {
              v1beta4: {
                closeDeployment: vi.fn().mockRejectedValue(new Error('Deployment not found')),
              },
            },
          },
        },
      } as unknown as ToolContext;

      const result = await CloseDeploymentTool.handler(
        { dseq: 12345 },
        mockContext
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveProperty('error');
      expect(parsed.error).toContain('Deployment not found');
    });
  });
});
