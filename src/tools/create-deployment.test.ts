import { describe, it, expect, vi } from 'vitest';
import { CreateDeploymentTool } from './create-deployment.js';
import type { ToolContext } from '../types/index.js';

describe('CreateDeploymentTool', () => {
  describe('metadata', () => {
    it('should have correct name', () => {
      expect(CreateDeploymentTool.name).toBe('create-deployment');
    });

    it('should have a description mentioning SDL and deposit', () => {
      expect(CreateDeploymentTool.description).toContain('SDL');
      expect(CreateDeploymentTool.description).toContain('deposit');
    });
  });

  describe('parameter validation', () => {
    const validParams = {
      rawSDL: 'version: "2.0"\nservices:\n  web:\n    image: nginx',
      deposit: 500000,
      currency: 'uakt',
    };

    it('should accept valid parameters', () => {
      const result = CreateDeploymentTool.parameters.safeParse(validParams);
      expect(result.success).toBe(true);
    });

    it('should reject missing rawSDL', () => {
      const result = CreateDeploymentTool.parameters.safeParse({
        deposit: 500000,
        currency: 'uakt',
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty rawSDL', () => {
      const result = CreateDeploymentTool.parameters.safeParse({
        rawSDL: '',
        deposit: 500000,
        currency: 'uakt',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing deposit', () => {
      const result = CreateDeploymentTool.parameters.safeParse({
        rawSDL: 'version: "2.0"',
        currency: 'uakt',
      });
      expect(result.success).toBe(false);
    });

    it('should reject deposit less than 1', () => {
      const result = CreateDeploymentTool.parameters.safeParse({
        rawSDL: 'version: "2.0"',
        deposit: 0,
        currency: 'uakt',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing currency', () => {
      const result = CreateDeploymentTool.parameters.safeParse({
        rawSDL: 'version: "2.0"',
        deposit: 500000,
      });
      expect(result.success).toBe(false);
    });

    it('should reject empty currency', () => {
      const result = CreateDeploymentTool.parameters.safeParse({
        rawSDL: 'version: "2.0"',
        deposit: 500000,
        currency: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('handler', () => {
    it('should handle SDL parsing errors gracefully', async () => {
      const mockContext = {
        wallet: {
          getAccounts: vi.fn().mockResolvedValue([{ address: 'akash1abc' }]),
        },
        chainSDK: {},
      } as unknown as ToolContext;

      // Invalid SDL will throw during parsing
      const result = await CreateDeploymentTool.handler(
        { rawSDL: 'invalid yaml: {{{{', deposit: 500000, currency: 'uakt' },
        mockContext
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveProperty('error');
    });

    it('should handle incomplete SDL gracefully', async () => {
      const mockContext = {
        wallet: {
          getAccounts: vi.fn().mockResolvedValue([{ address: 'akash1abc' }]),
        },
        chainSDK: {},
      } as unknown as ToolContext;

      // Incomplete SDL (missing services) will throw during parsing
      const result = await CreateDeploymentTool.handler(
        { rawSDL: 'version: "2.0"', deposit: 500000, currency: 'uakt' },
        mockContext
      );

      const parsed = JSON.parse(result.content[0].text);
      expect(parsed).toHaveProperty('error');
    });
  });
});
