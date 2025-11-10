
import { Request, Response } from 'express';
import { TokenController } from '../../controllers/TokenController';
import { CacheService } from '../../services/CacheService';
import { DataAggregatorService } from '../../services/DataAggregatorService';
import { TokenData } from '../../types';

describe('TokenController', () => {
  let tokenController: TokenController;
  let mockCacheService: jest.Mocked<CacheService>;
  let mockDataAggregator: jest.Mocked<DataAggregatorService>;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    mockCacheService = {
      getTokens: jest.fn(),
      getToken: jest.fn(),
      setTokens: jest.fn(),
      setKey: jest.fn(),
      getKey: jest.fn(),
      delKey: jest.fn(),
      disconnect: jest.fn(),
      getCacheInfo: jest.fn()
    } as any;

    mockDataAggregator = {
      getAllTokens: jest.fn(),
      fetchFromDexScreener: jest.fn(),
      fetchFromCoinGecko: jest.fn(),
      fetchFromJupiter: jest.fn(),
      mergeTokens: jest.fn()
    } as any;

    tokenController = new TokenController(mockCacheService, mockDataAggregator);

    mockResponse = {
      json: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn()
    };
  });

  describe('getTokens', () => {
    it('should return tokens with new field structure', async () => {
      const mockTokens: TokenData[] = [
        {
          token_address: 'addr1',
          token_name: 'Token1',
          token_ticker: 'T1',
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
          image: 'image1.jpg',
          rank: 1,
          source: ['dexscreener'],
          lastUpdated: new Date().toISOString(),
          is_merged: false
        }
      ];

      mockCacheService.getTokens.mockResolvedValue(mockTokens);
      mockRequest = {
        query: {
          limit: '10',
          sort_by: 'volume',
          sort_order: 'desc'
        }
      };

      await tokenController.getTokens(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalled();
      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.tokens[0].volume24h).toBe(500);
      expect(response.tokens[0].price).toBe(1.0);
      expect(response.tokens[0].marketCap).toBe(1000);
    });

    it('should filter by liquidity with new field name', async () => {
      const mockTokens: TokenData[] = [
        {
          token_address: 'addr1',
          token_name: 'Token1',
          token_ticker: 'T1',
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
          image: 'image1.jpg',
          rank: 1,
          source: ['dexscreener'],
          lastUpdated: new Date().toISOString(),
          is_merged: false
        },
        {
          token_address: 'addr2',
          token_name: 'Token2',
          token_ticker: 'T2',
          price: 2.0,
          priceChange1h: 3,
          priceChange6h: 6,
          priceChange24h: 8,
          priceChangePercentage24h: 8,
          marketCap: 2000,
          marketCapChange24h: 100,
          marketCapChangePercentage24h: 5,
          volume24h: 300,
          circulatingSupply: 2000000,
          totalSupply: 3000000,
          liquidity: 50,
          high_24h: 2.2,
          low_24h: 1.8,
          transaction_count: 50,
          ath: 3.0,
          athChangePercentage: 50,
          athDate: '2024-01-01',
          atl: 1.0,
          atlChangePercentage: 100,
          atlDate: '2023-01-01',
          roi: null,
          dex: 'Orca',
          dexUrl: 'https://orca.so',
          image: 'image2.jpg',
          rank: 2,
          source: ['coingecko'],
          lastUpdated: new Date().toISOString(),
          is_merged: false
        }
      ];

      mockCacheService.getTokens.mockResolvedValue(mockTokens);
      mockRequest = {
        query: {
          min_liquidity: '100'
        }
      };

      await tokenController.getTokens(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalled();
      const response = (mockResponse.json as jest.Mock).mock.calls[0][0];
      expect(response.tokens).toHaveLength(1);
      expect(response.tokens[0].liquidity).toBe(200);
    });
  });

  describe('getStats', () => {
    it('should calculate stats with new field names', async () => {
      const mockTokens: TokenData[] = [
        {
          token_address: 'addr1',
          token_name: 'Token1',
          token_ticker: 'T1',
          price: 1.0,
          priceChange1h: 10,
          priceChange6h: 15,
          priceChange24h: 20,
          priceChangePercentage24h: 20,
          marketCap: 1000,
          marketCapChange24h: 100,
          marketCapChangePercentage24h: 10,
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
          image: 'image1.jpg',
          rank: 1,
          source: ['dexscreener'],
          lastUpdated: new Date().toISOString(),
          is_merged: false
        },
        {
          token_address: 'addr2',
          token_name: 'Token2',
          token_ticker: 'T2',
          price: 2.0,
          priceChange1h: -5,
          priceChange6h: -10,
          priceChange24h: -15,
          priceChangePercentage24h: -15,
          marketCap: 2000,
          marketCapChange24h: 200,
          marketCapChangePercentage24h: 10,
          volume24h: 1000,
          circulatingSupply: 2000000,
          totalSupply: 3000000,
          liquidity: 400,
          high_24h: 2.2,
          low_24h: 1.8,
          transaction_count: 200,
          ath: 3.0,
          athChangePercentage: 50,
          athDate: '2024-01-01',
          atl: 1.0,
          atlChangePercentage: 100,
          atlDate: '2023-01-01',
          roi: null,
          dex: 'Orca',
          dexUrl: 'https://orca.so',
          image: 'image2.jpg',
          rank: 2,
          source: ['coingecko'],
          lastUpdated: new Date().toISOString(),
          is_merged: false
        }
      ];

      mockCacheService.getTokens.mockResolvedValue(mockTokens);

      await tokenController.getStats(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.json).toHaveBeenCalled();
      const stats = (mockResponse.json as jest.Mock).mock.calls[0][0];
      
      expect(stats.total_tokens).toBe(2);
      expect(stats.total_volume_24h).toBe(1500); // 500 + 1000
      expect(stats.total_liquidity).toBe(600); // 200 + 400
      expect(stats.total_market_cap).toBe(3000); // 1000 + 2000
      expect(stats.average_price_change_1h).toBe(2.5); // (10 + -5) / 2
      expect(stats.top_gainer_1h.token_address).toBe('addr1');
      expect(stats.top_loser_1h.token_address).toBe('addr2');
      expect(stats.highest_volume.token_address).toBe('addr2');
      expect(stats.highest_market_cap.token_address).toBe('addr2');
    });
  });
});