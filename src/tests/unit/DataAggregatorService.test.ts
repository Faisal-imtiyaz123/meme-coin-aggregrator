// tests/unit/DataAggregatorService.test.ts
import { DataAggregatorService } from '../../src/services/DataAggregatorService';
import { APIRateLimiter } from '../../src/utils/rateLimiter';

jest.mock('axios');
const axios = require('axios');

describe('DataAggregatorService', () => {
  let service: DataAggregatorService;

  beforeEach(() => {
    service = new DataAggregatorService();
    jest.clearAllMocks();
  });

  describe('mergeTokens', () => {
    it('should merge tokens from different sources', () => {
      const tokens1 = [
        {
          token_address: 'addr1',
          token_name: 'Token1',
          token_ticker: 'T1',
          price_sol: 1.0,
          market_cap_sol: 1000,
          volume_sol: 500,
          liquidity_sol: 200,
          transaction_count: 100,
          price_1hr_change: 10,
          protocol: 'Raydium',
          source: 'dexscreener',
          last_updated: Date.now()
        }
      ];

      const tokens2 = [
        {
          token_address: 'addr1',
          token_name: 'Token1',
          token_ticker: 'T1',
          price_sol: 1.1,
          market_cap_sol: 1100,
          volume_sol: 600,
          liquidity_sol: 300,
          transaction_count: 120,
          price_1hr_change: 12,
          protocol: 'Raydium',
          source: 'geckoterminal',
          last_updated: Date.now()
        }
      ];

      const merged = service.mergeTokens([tokens1, tokens2]);
      
      expect(merged).toHaveLength(1);
      expect(merged[0].liquidity_sol).toBe(300); // Should take higher liquidity
      expect(merged[0].source).toContain('dexscreener');
      expect(merged[0].source).toContain('geckoterminal');
    });

    it('should handle empty token arrays', () => {
      const merged = service.mergeTokens([[], []]);
      expect(merged).toHaveLength(0);
    });
  });
});