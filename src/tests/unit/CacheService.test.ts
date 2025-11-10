import Redis from "ioredis";
import { CacheService } from "../../services/CacheService";
import { TokenData } from "../../types";


jest.mock('ioredis');

describe('CacheService', () => {
  let cacheService: CacheService;
  let mockRedis: jest.Mocked<Redis>;

  beforeEach(() => {
    mockRedis = {
      setex: jest.fn().mockResolvedValue('OK'),
      get: jest.fn().mockResolvedValue(null),
      del: jest.fn().mockResolvedValue(1),
      quit: jest.fn().mockResolvedValue('OK'),
      on: jest.fn(),
      pipeline: jest.fn().mockReturnValue({
        setex: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([])
      }),
      status: 'ready'
    } as any;

    (Redis as jest.MockedClass<typeof Redis>).mockImplementation(() => mockRedis);
    
    cacheService = new CacheService();
  });

  afterEach(async () => {
    await cacheService.disconnect();
  });

  describe('setTokens', () => {
    it('should cache tokens with new field structure', async () => {
      const tokens: TokenData[] = [
        {
          token_address: 'addr1',
          token_name: 'Test Token',
          token_ticker: 'TEST',
          price: 1.0,
          priceChange1h: 5,
          priceChange6h: 8,
          priceChange24h: 10,
          priceChangePercentage24h: 10,
          marketCap: 1000,
          marketCapChange24h: 50,
          marketCapChangePercentage24h: 5,
          volume24h: 500,
          circulatingSupply: 1000000,
          totalSupply: 2000000,
          liquidity: 200,
          high_24h: 1.2,
          low_24h: 0.8,
          transaction_count: 100,
          ath: 2.0,
          athChangePercentage: 100,
          athDate: '2024-01-01',
          atl: 0.5,
          atlChangePercentage: 100,
          atlDate: '2023-01-01',
          roi: null,
          dex: 'Raydium',
          dexUrl: 'https://raydium.io',
          image: 'image.jpg',
          rank: 1,
          source: ['dexscreener'],
          lastUpdated: new Date().toISOString(),
          is_merged: false
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
    it('should return cached tokens with new structure', async () => {
      const tokens: TokenData[] = [
        {
          token_address: 'addr1',
          token_name: 'Test Token',
          token_ticker: 'TEST',
          price: 1.0,
          priceChange1h: 5,
          priceChange6h: 8,
          priceChange24h: 10,
          priceChangePercentage24h: 10,
          marketCap: 1000,
          marketCapChange24h: 50,
          marketCapChangePercentage24h: 5,
          volume24h: 500,
          circulatingSupply: 1000000,
          totalSupply: 2000000,
          liquidity: 200,
          high_24h: 1.2,
          low_24h: 0.8,
          transaction_count: 100,
          ath: 2.0,
          athChangePercentage: 100,
          athDate: '2024-01-01',
          atl: 0.5,
          atlChangePercentage: 100,
          atlDate: '2023-01-01',
          roi: null,
          dex: 'Raydium',
          dexUrl: 'https://raydium.io',
          image: 'image.jpg',
          rank: 1,
          source: ['dexscreener'],
          lastUpdated: new Date().toISOString(),
          is_merged: false
        }
      ];
      
      mockRedis.get.mockResolvedValue(JSON.stringify(tokens));

      const result = await cacheService.getTokens();

      expect(result).toEqual(tokens);
      expect(mockRedis.get).toHaveBeenCalledWith('tokens:all');
    });
  });
});