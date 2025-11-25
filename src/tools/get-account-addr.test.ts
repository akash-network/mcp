import { describe, it, expect, vi } from 'vitest';
import { GetAccountAddrTool } from './get-account-addr.js';
import type { ToolContext } from '../types/index.js';

describe('GetAccountAddrTool', () => {
  describe('metadata', () => {
    it('should have correct name', () => {
      expect(GetAccountAddrTool.name).toBe('get-akash-account-addr');
    });

    it('should have a description', () => {
      expect(GetAccountAddrTool.description).toBeDefined();
      expect(GetAccountAddrTool.description.length).toBeGreaterThan(0);
    });

    it('should have empty parameters schema', () => {
      const result = GetAccountAddrTool.parameters.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe('handler', () => {
    it('should return the account address from wallet', async () => {
      const mockAddress = 'akash1degudmhf24auhfnqtn99mkja3xt7clt9um77tn';
      const mockContext = {
        wallet: {
          getAccounts: vi.fn().mockResolvedValue([{ address: mockAddress }]),
        },
      } as unknown as ToolContext;

      const result = await GetAccountAddrTool.handler({}, mockContext);

      expect(result.content[0].text).toBe(JSON.stringify(mockAddress));
      expect(mockContext.wallet.getAccounts).toHaveBeenCalledOnce();
    });

    it('should return "Account not found" when address is empty', async () => {
      const mockContext = {
        wallet: {
          getAccounts: vi.fn().mockResolvedValue([{ address: '' }]),
        },
      } as unknown as ToolContext;

      const result = await GetAccountAddrTool.handler({}, mockContext);

      expect(result.content[0].text).toBe(JSON.stringify('Account not found'));
    });
  });
});
