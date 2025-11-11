import { Request, Response } from 'express';
import { TokenController } from '../../controllers/TokenController';
import { CacheService } from '../../services/CacheService';
import { DataAggregatorService } from '../../services/DataAggregatorService';
import { TokenData } from '../../types';
import { logger } from '../../utils/logger';


// Mock logger
jest.mock('../../src/utils/logger');

describe('TokenController', () => {
  let tokenController: TokenController;
  let cacheService: jest.Mocked<CacheService>;
  let dataAggregator: jest.Mocked<DataAggregatorService>;
  let req: Partial<Request>;
  let res: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  const mockTokens: TokenData[] = [
  {
    token_address: "tether",
    token_name: "Tether",
    token_ticker: "USDT",
    price: 1,
    priceChange1h: 0,
    priceChange6h: 0,
    priceChange24h: 0.00018665,
    priceChangePercentage24h: 0.01867,
    marketCap: 183559330177,
    marketCapChange24h: 95543074,
    marketCapChangePercentage24h: 0.05208,
    volume24h: 122034364954,
    circulatingSupply: 183497848870.6547,
    totalSupply: 188964784658.0562,
    liquidity: 0,
    high_24h: 1,
    low_24h: 0.999226,
    transaction_count: 0,
    ath: 1.32,
    athChangePercentage: -24.43039,
    athDate: "2018-07-24T00:00:00.000Z",
    atl: 0.572521,
    atlChangePercentage: 74.64127,
    atlDate: "2015-03-02T00:00:00.000Z",
    roi: null,
    dex: "Various",
    dexUrl: "",
    image: "https://coin-images.coingecko.com/coins/images/325/large/Tether.png?1696501661",
    rank: 3,
    source: ["coingecko"],
    lastUpdated: "2025-11-11T15:16:22.736Z",
    is_merged: false
  }
];


  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    
    cacheService = {
      getTokens: jest.fn(),
      setTokens: jest.fn(),
      getToken: jest.fn(),
      disconnect: jest.fn()
    } as any;

    dataAggregator = {
      getAllTokens: jest.fn(),
      getTokenByAddress: jest.fn()
    } as any;

    tokenController = new TokenController(cacheService, dataAggregator);

    req = {
      query: {},
      params: {}
    };

    res = {
      status: mockStatus,
      json: mockJson
    };

    jest.clearAllMocks();
  });

  describe('getTokens', () => {
    it('should return tokens from cache with default pagination', async () => {
      cacheService.getTokens.mockResolvedValue(mockTokens);

      await tokenController.getTokens(req as Request, res as Response);

      expect(cacheService.getTokens).toHaveBeenCalled();
      expect(mockJson).toHaveBeenCalledWith({
        tokens: mockTokens.slice(0, 20),
        next_cursor: '20',
        has_more: true,
        total_count: 3,
        timestamp: expect.any(Number)
      });
    });

    it('should fetch fresh data when cache is empty', async () => {
      cacheService.getTokens.mockResolvedValue(null);
      dataAggregator.getAllTokens.mockResolvedValue(mockTokens);

      await tokenController.getTokens(req as Request, res as Response);

      expect(dataAggregator.getAllTokens).toHaveBeenCalled();
      expect(cacheService.setTokens).toHaveBeenCalledWith(mockTokens);
      expect(logger.info).toHaveBeenCalledWith('Cache miss, fetching fresh data');
    });

    it('should apply liquidity filter correctly', async () => {
      cacheService.getTokens.mockResolvedValue(mockTokens);
      req.query = { min_liquidity: '400000' };

      await tokenController.getTokens(req as Request, res as Response);

      const response = mockJson.mock.calls[0][0];
      expect(response.tokens).toHaveLength(2);
      expect(response.tokens.map((t: TokenData) => t.token_address)).toEqual(['0x123', '0x789']);
    });

    it('should apply volume filter correctly', async () => {
      cacheService.getTokens.mockResolvedValue(mockTokens);
      req.query = { min_volume: '1500000' };

      await tokenController.getTokens(req as Request, res as Response);

      const response = mockJson.mock.calls[0][0];
      expect(response.tokens).toHaveLength(1);
      expect(response.tokens[0].token_address).toBe('0x456');
    });

    it('should apply protocol filter correctly', async () => {
      cacheService.getTokens.mockResolvedValue(mockTokens);
      req.query = { protocol: 'uniswap' };

      await tokenController.getTokens(req as Request, res as Response);

      const response = mockJson.mock.calls[0][0];
      expect(response.tokens).toHaveLength(1);
      expect(response.tokens[0].dex).toBe('uniswap');
    });

    it('should apply sorting by volume descending by default', async () => {
      cacheService.getTokens.mockResolvedValue(mockTokens);

      await tokenController.getTokens(req as Request, res as Response);

      const response = mockJson.mock.calls[0][0];
      expect(response.tokens[0].token_address).toBe('0x456'); // Highest volume
      expect(response.tokens[1].token_address).toBe('0x123');
      expect(response.tokens[2].token_address).toBe('0x789');
    });

    it('should apply custom sorting by market cap ascending', async () => {
      cacheService.getTokens.mockResolvedValue(mockTokens);
      req.query = { sort_by: 'market_cap', sort_order: 'asc' };

      await tokenController.getTokens(req as Request, res as Response);

      const response = mockJson.mock.calls[0][0];
      expect(response.tokens[0].token_address).toBe('0x456'); // Lowest market cap
      expect(response.tokens[1].token_address).toBe('0x123');
      expect(response.tokens[2].token_address).toBe('0x789');
    });

    it('should apply 1h price change filter', async () => {
      cacheService.getTokens.mockResolvedValue(mockTokens);
      req.query = { time_period: '1h' };

      await tokenController.getTokens(req as Request, res as Response);

      const response = mockJson.mock.calls[0][0];
      expect(response.tokens).toHaveLength(3); // All have priceChange1h
    });

    it('should handle pagination with cursor', async () => {
      cacheService.getTokens.mockResolvedValue(mockTokens);
      req.query = { limit: '2', cursor: '0' };

      await tokenController.getTokens(req as Request, res as Response);

      const response = mockJson.mock.calls[0][0];
      expect(response.tokens).toHaveLength(2);
      expect(response.next_cursor).toBe('2');
      expect(response.has_more).toBe(true);
    });

    it('should respect maximum limit of 100', async () => {
      cacheService.getTokens.mockResolvedValue(mockTokens);
      req.query = { limit: '150' };

      await tokenController.getTokens(req as Request, res as Response);

      const response = mockJson.mock.calls[0][0];
      expect(response.tokens).toHaveLength(3); // All tokens returned
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Database error');
      cacheService.getTokens.mockRejectedValue(error);

      await tokenController.getTokens(req as Request, res as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Failed to fetch tokens',
        details: 'Database error'
      });
      expect(logger.error).toHaveBeenCalledWith('Error in getTokens:', error);
    });
  });

  describe('getTokenByAddress', () => {
    it('should return token by address from cache', async () => {
      const token = mockTokens[0];
      cacheService.getToken.mockResolvedValue(token);
      req.params = { address: '0x123' };

      await tokenController.getTokenByAddress(req as Request, res as Response);

      expect(cacheService.getToken).toHaveBeenCalledWith('0x123');
      expect(mockJson).toHaveBeenCalledWith(token);
    });

    it('should find token in cached tokens list when not in individual cache', async () => {
      cacheService.getToken.mockResolvedValue(null);
      cacheService.getTokens.mockResolvedValue(mockTokens);
      req.params = { address: '0x123' };

      await tokenController.getTokenByAddress(req as Request, res as Response);

      expect(mockJson).toHaveBeenCalledWith(mockTokens[0]);
    });

    it('should return 400 when address is missing', async () => {
      req.params = { address: '' };

      await tokenController.getTokenByAddress(req as Request, res as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Token address is required' });
    });

    it('should return 404 when token not found', async () => {
      cacheService.getToken.mockResolvedValue(null);
      cacheService.getTokens.mockResolvedValue(null);
      req.params = { address: '0x999' };

      await tokenController.getTokenByAddress(req as Request, res as Response);

      expect(mockStatus).toHaveBeenCalledWith(404);
      expect(mockJson).toHaveBeenCalledWith({ error: 'Token not found' });
    });

    it('should handle case-insensitive address matching', async () => {
      cacheService.getToken.mockResolvedValue(null);
      cacheService.getTokens.mockResolvedValue(mockTokens);
      req.params = { address: '0X123' }; // Uppercase

      await tokenController.getTokenByAddress(req as Request, res as Response);

      expect(mockJson).toHaveBeenCalledWith(mockTokens[0]);
    });

    it('should handle errors gracefully', async () => {
      const error = new Error('Cache error');
      cacheService.getToken.mockRejectedValue(error);
      req.params = { address: '0x123' };

      await tokenController.getTokenByAddress(req as Request, res as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Failed to fetch token',
        details: 'Cache error'
      });
      expect(logger.error).toHaveBeenCalledWith('Error in getTokenByAddress:', error);
    });
  });

  describe('applyFilters', () => {
    it('should filter by minimum liquidity', () => {
      const filters = { min_liquidity: 400000 };
      const result:TokenData[] = (tokenController as any).applyFilters(mockTokens, filters);
      
      expect(result).toHaveLength(2);
      expect(result.every(token => (token.liquidity || 0) >= 400000)).toBe(true);
    });

    it('should filter by minimum volume', () => {
      const filters = { min_volume: 1500000 };
      const result = (tokenController as any).applyFilters(mockTokens, filters);
      
      expect(result).toHaveLength(1);
      expect(result[0].volume24h).toBe(2000000);
    });

    it('should filter by protocol', () => {
      const filters = { protocol: 'pancakeswap' };
      const result = (tokenController as any).applyFilters(mockTokens, filters);
      
      expect(result).toHaveLength(1);
      expect(result[0].dex).toBe('pancakeswap');
    });

    it('should sort by market cap descending', () => {
      const filters = { sort_by: 'market_cap', sort_order: 'desc' };
      const result = (tokenController as any).applyFilters(mockTokens, filters);
      
      expect(result[0].marketCap).toBe(20000000); // Highest market cap first
      expect(result[2].marketCap).toBe(5000000); // Lowest market cap last
    });

    it('should sort by transaction count ascending', () => {
      const filters = { sort_by: 'transaction_count', sort_order: 'asc' };
      const result = (tokenController as any).applyFilters(mockTokens, filters);
      
      expect(result[0].transaction_count).toBe(1000); // Lowest transaction count first
      expect(result[2].transaction_count).toBe(2000); // Highest transaction count last
    });
  });

  describe('paginateTokens', () => {
    it('should paginate tokens with default values', () => {
      const filters = {};
      const result = (tokenController as any).paginateTokens(mockTokens, filters);
      
      expect(result.tokens).toHaveLength(3);
      expect(result.next_cursor).toBeUndefined();
      expect(result.has_more).toBe(false);
      expect(result.total_count).toBe(3);
    });

    it('should paginate with custom limit', () => {
      const filters = { limit: 2 };
      const result = (tokenController as any).paginateTokens(mockTokens, filters);
      
      expect(result.tokens).toHaveLength(2);
      expect(result.next_cursor).toBe('2');
      expect(result.has_more).toBe(true);
    });

    it('should paginate with cursor', () => {
      const filters = { limit: 2, cursor: '1' };
      const result = (tokenController as any).paginateTokens(mockTokens, filters);
      
      expect(result.tokens).toHaveLength(2);
      expect(result.tokens[0].token_address).toBe('0x456');
      expect(result.next_cursor).toBe('3');
      expect(result.has_more).toBe(false);
    });
  });
});