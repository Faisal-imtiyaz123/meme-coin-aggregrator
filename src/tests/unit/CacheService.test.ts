// tests/unit/CacheService.test.ts
import { CacheService } from '../../src/services/CacheService';
import Redis from 'ioredis';

jest.mock('ioredis');

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedis = {
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK')
    } as any;

    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis);
    
    cacheService = new CacheService();
  });

  describe('setTokens', () => {
    it('should cache tokens successfully', async () => {
      const tokens = [
        {
          token_address: 'addr1',
          token_name: 'Test Token',
          token_ticker: 'TEST',
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

      await cacheService.setTokens(tokens);

      expect(mockRedis.setex).toHaveBeenCalledWith(
        'tokens:all',
        30,
        JSON.stringify(tokens)
      );
    });
  });

  describe('getTokens', () => {
    it('should return cached tokens', async () => {
      const tokens = [{ token_address: 'addr1', token_name: 'Test' }];
      mockRedis.get.mockResolvedValue(JSON.stringify(tokens));

      const result = await cacheService.getTokens();

      expect(result).toEqual(tokens);
      expect(mockRedis.get).toHaveBeenCalledWith('tokens:all');
    });

    it('should return null when cache is empty', async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await cacheService.getTokens();

      expect(result).toBeNull();
    });
  });
});