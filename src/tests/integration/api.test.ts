// tests/integration/api.test.ts
import request from 'supertest';
import { createServer } from 'http';
import express from 'express';
import { CacheService } from '../../services/CacheService';
import { DataAggregatorService } from '../../services/DataAggregatorService';
import { TokenController } from '../../controllers/TokenController';
import { TokenData } from '../../types';

describe('API Integration Tests', () => {
  let app: express.Application;
  let server: any;
  let cacheService: CacheService;
  let dataAggregator: DataAggregatorService;

  beforeAll(async () => {
    app = express();
    server = createServer(app);
    
    cacheService = new CacheService();
    dataAggregator = new DataAggregatorService();
    
    const tokenController = new TokenController(cacheService, dataAggregator);
    
    app.use(express.json());
    app.get('/api/tokens', (req, res) => tokenController.getTokens(req, res));
    app.get('/api/tokens/:address', (req, res) => tokenController.getTokenByAddress(req, res));
    app.get('/api/stats', (req, res) => tokenController.getStats(req, res));
    app.get('/api/tokens/search', (req, res) => tokenController.searchTokens(req, res));
  });

  afterAll(async () => {
    await cacheService.disconnect();
    server.close();
  });

  describe('GET /api/tokens', () => {
    it('should return paginated tokens with new structure', async () => {
      // Mock some tokens in cache
      const mockTokens: TokenData[] = [
        {
          token_address: 'solana',
          token_name: 'Solana',
          token_ticker: 'SOL',
          price: 20.0,
          priceChange1h: 1.5,
          priceChange6h: 3.2,
          priceChange24h: 5.8,
          priceChangePercentage24h: 5.8,
          marketCap: 80000000000,
          marketCapChange24h: 4000000000,
          marketCapChangePercentage24h: 5,
          volume24h: 2000000000,
          circulatingSupply: 400000000,
          totalSupply: 500000000,
          liquidity: 500000000,
          high_24h: 21.0,
          low_24h: 19.5,
          transaction_count: 100000,
          ath: 250.0,
          athChangePercentage: -92,
          athDate: '2021-11-06',
          atl: 0.5,
          atlChangePercentage: 3900,
          atlDate: '2020-05-11',
          roi: null,
          dex: 'Various',
          dexUrl: '',
          image: 'solana.jpg',
          rank: 5,
          source: ['coingecko'],
          lastUpdated: new Date().toISOString(),
          is_merged: false
        }
      ];

      // Mock the cache service to return our test data
      jest.spyOn(cacheService, 'getTokens').mockResolvedValue(mockTokens);

      const response = await request(app)
        .get('/api/tokens')
        .expect(200);

      expect(response.body).toHaveProperty('tokens');
      expect(response.body).toHaveProperty('has_more');
      expect(response.body).toHaveProperty('total_count');
      expect(Array.isArray(response.body.tokens)).toBe(true);
      expect(response.body.tokens[0]).toHaveProperty('price');
      expect(response.body.tokens[0]).toHaveProperty('volume24h');
      expect(response.body.tokens[0]).toHaveProperty('marketCap');
      expect(response.body.tokens[0]).toHaveProperty('liquidity');
    });

    it('should filter tokens by volume with new field name', async () => {
      const mockTokens: TokenData[] = [
        {
          token_address: 'token1',
          token_name: 'High Volume Token',
          token_ticker: 'HVT',
          price: 1.0,
          priceChange1h: 5,
          priceChange6h: 8,
          priceChange24h: 10,
          priceChangePercentage24h: 10,
          marketCap: 1000000,
          marketCapChange24h: 50000,
          marketCapChangePercentage24h: 5,
          volume24h: 500000,
          circulatingSupply: 1000000,
          totalSupply: 2000000,
          liquidity: 200000,
          high_24h: 1.2,
          low_24h: 0.8,
          transaction_count: 1000,
          ath: 2.0,
          athChangePercentage: 100,
          athDate: '2024-01-01',
          atl: 0.5,
          atlChangePercentage: 100,
          atlDate: '2023-01-01',
          roi: null,
          dex: 'Raydium',
          dexUrl: 'https://raydium.io',
          image: 'hvt.jpg',
          rank: 100,
          source: ['dexscreener'],
          lastUpdated: new Date().toISOString(),
          is_merged: false
        },
        {
          token_address: 'token2',
          token_name: 'Low Volume Token',
          token_ticker: 'LVT',
          price: 0.5,
          priceChange1h: 2,
          priceChange6h: 4,
          priceChange24h: 6,
          priceChangePercentage24h: 6,
          marketCap: 500000,
          marketCapChange24h: 25000,
          marketCapChangePercentage24h: 5,
          volume24h: 50000,
          circulatingSupply: 1000000,
          totalSupply: 2000000,
          liquidity: 50000,
          high_24h: 0.6,
          low_24h: 0.4,
          transaction_count: 500,
          ath: 1.0,
          athChangePercentage: 100,
          athDate: '2024-01-01',
          atl: 0.2,
          atlChangePercentage: 150,
          atlDate: '2023-01-01',
          roi: null,
          dex: 'Orca',
          dexUrl: 'https://orca.so',
          image: 'lvt.jpg',
          rank: 200,
          source: ['dexscreener'],
          lastUpdated: new Date().toISOString(),
          is_merged: false
        }
      ];

      jest.spyOn(cacheService, 'getTokens').mockResolvedValue(mockTokens);

      const response = await request(app)
        .get('/api/tokens?min_volume=100000')
        .expect(200);

      expect(response.body.tokens).toHaveLength(1);
      expect(response.body.tokens[0].token_ticker).toBe('HVT');
      expect(response.body.tokens[0].volume24h).toBeGreaterThanOrEqual(100000);
    });
  });
});