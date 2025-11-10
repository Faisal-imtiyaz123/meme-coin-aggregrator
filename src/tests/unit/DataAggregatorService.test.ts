import { DataAggregatorService } from "../../services/DataAggregatorService";
import { TokenData } from "../../types";

jest.mock('axios');
const axios = require('axios');

describe('DataAggregatorService', () => {
  let service: DataAggregatorService;

  beforeEach(() => {
    service = new DataAggregatorService();
    jest.clearAllMocks();
  });

  describe('mergeTokens', () => {
    it('should merge tokens from different sources with new field names', () => {
      const tokens1: TokenData[] = [
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

      const tokens2: TokenData[] = [
        {
          token_address: 'addr1',
          token_name: 'Token1',
          token_ticker: 'T1',
          price: 1.1,
          priceChange1h: 6,
          priceChange6h: 9,
          priceChange24h: 12,
          priceChangePercentage24h: 12,
          marketCap: 1100,
          marketCapChange24h: 60,
          marketCapChangePercentage24h: 6,
          volume24h: 600,
          circulatingSupply: 1100000,
          totalSupply: 2100000,
          liquidity: 300,
          high_24h: 1.3,
          low_24h: 0.9,
          transaction_count: 120,
          ath: 2.1,
          athChangePercentage: 110,
          athDate: '2024-01-02',
          atl: 0.6,
          atlChangePercentage: 110,
          atlDate: '2023-01-02',
          roi: 2,
          dex: 'Orca',
          dexUrl: 'https://orca.so',
          image: 'image2.jpg',
          rank: 2,
          source: ['coingecko'],
          lastUpdated: new Date().toISOString(),
          is_merged: false
        }
      ];

      const merged = service.mergeTokens([tokens1, tokens2]);
      
      expect(merged).toHaveLength(1);
      expect(merged[0].liquidity).toBe(300); // Should take higher liquidity
      expect(merged[0].volume24h).toBe(1100); // Combined volume
      expect(merged[0].source).toContain('dexscreener');
      expect(merged[0].source).toContain('coingecko');
      expect(merged[0].is_merged).toBe(true);
    });

    it('should handle empty token arrays', () => {
      const merged = service.mergeTokens([[], []]);
      expect(merged).toHaveLength(0);
    });

    it('should prefer DexScreener for DEX data and CoinGecko for market data', () => {
      const dexToken: TokenData = {
        token_address: 'addr1',
        token_name: 'Test Token',
        token_ticker: 'TEST',
        price: 1.0,
        priceChange1h: 5,
        priceChange6h: 8,
        priceChange24h: 10,
        priceChangePercentage24h: 0, // DexScreener doesn't provide percentage
        marketCap: 1000,
        marketCapChange24h: 0,
        marketCapChangePercentage24h: 0,
        volume24h: 500,
        circulatingSupply: 0,
        totalSupply: 0,
        liquidity: 200,
        high_24h: 0,
        low_24h: 0,
        transaction_count: 100,
        ath: 0,
        athChangePercentage: 0,
        athDate: '',
        atl: 0,
        atlChangePercentage: 0,
        atlDate: '',
        roi: null,
        dex: 'Raydium',
        dexUrl: 'https://raydium.io',
        image: '',
        rank: null,
        source: ['dexscreener'],
        lastUpdated: new Date().toISOString(),
        is_merged: false
      };

      const cgToken: TokenData = {
        token_address: 'addr1',
        token_name: 'Test Token',
        token_ticker: 'TEST',
        price: 1.1,
        priceChange1h: 0,
        priceChange6h: 0,
        priceChange24h: 12,
        priceChangePercentage24h: 12,
        marketCap: 1100,
        marketCapChange24h: 60,
        marketCapChangePercentage24h: 6,
        volume24h: 600,
        circulatingSupply: 1000000,
        totalSupply: 2000000,
        liquidity: 0,
        high_24h: 1.3,
        low_24h: 0.9,
        transaction_count: 0,
        ath: 2.0,
        athChangePercentage: 100,
        athDate: '2024-01-01',
        atl: 0.5,
        atlChangePercentage: 100,
        atlDate: '2023-01-01',
        roi:2,
        dex: 'Various',
        dexUrl: '',
        image: 'image.jpg',
        rank: 1,
        source: ['coingecko'],
        lastUpdated: new Date().toISOString(),
        is_merged: false
      };

      const merged = service.mergeTokens([[dexToken], [cgToken]]);
      
      expect(merged[0].price).toBe(1.0); // Prefer DexScreener price
      expect(merged[0].priceChangePercentage24h).toBe(12); // Prefer CoinGecko percentage
      expect(merged[0].circulatingSupply).toBe(1000000); // From CoinGecko
      expect(merged[0].transaction_count).toBe(100); // From DexScreener
    });
  });
});