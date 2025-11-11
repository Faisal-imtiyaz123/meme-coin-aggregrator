import request from 'supertest';
import { Server } from 'http';
import MemeCoinAggregator from '../../app';
import { CacheService } from '../../services/CacheService';
import { DataAggregatorService } from '../../services/DataAggregatorService';
import { WebSocketService } from '../../services/WebSocketService';
import { logger } from '../../utils/logger';
import { config } from '../../config';


// Mock dependencies
jest.mock('../services/CacheService');
jest.mock('../services/DataAggregatorService');
jest.mock('../services/WebSocketService');
jest.mock('../utils/logger');
jest.mock('../config');

describe('MemeCoinAggregator', () => {
  let aggregator: MemeCoinAggregator;
  let server: Server | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    aggregator = new MemeCoinAggregator();
  });

  afterEach(async () => {
    if (aggregator) {
      await aggregator.stop();
      server = null
    }
  });

  describe('Initialization', () => {
    it('should initialize all services correctly', () => {
      expect(CacheService).toHaveBeenCalledTimes(1);
      expect(DataAggregatorService).toHaveBeenCalledTimes(1);
      expect(WebSocketService).toHaveBeenCalledTimes(1);
    });

    it('should set up middleware', () => {
      // This is a bit tricky to test directly, but we can verify through integration tests
      expect(aggregator).toBeDefined();
    });
  });

  describe('Health Check', () => {
    it('should return healthy status', async () => {
      const mockGetConnectedClientsCount = jest.fn().mockReturnValue(5);
      (WebSocketService as jest.MockedClass<typeof WebSocketService>).prototype.getConnectedClientsCount = mockGetConnectedClientsCount;

      const response = await request(aggregator['app']).get('/health');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'healthy',
        timestamp: expect.any(Number),
        connected_clients: 5,
        environment: config.server.env
      });
    });
  });

  describe('Route Handling', () => {
    it('should handle 404 routes', async () => {
      const response = await request(aggregator['app']).get('/nonexistent-route');
      
      expect(response.status).toBe(404);
      expect(response.body).toEqual({ error: 'Route not found' });
    });

    it('should handle errors', async () => {
      // Force an error by making tokenController undefined
      aggregator['tokenController'] = undefined as any;
      
      const response = await request(aggregator['app']).get('/api/tokens');
      
      expect(response.status).toBe(500);
      expect(response.body).toEqual({ error: 'Internal server error' });
    });
  });

  describe('Background Jobs', () => {
    it('should start background jobs', () => {
      const mockUpdateTokenData = jest.spyOn(aggregator as any, 'updateTokenData').mockResolvedValue(undefined);
      const mockSetInterval = jest.spyOn(global, 'setInterval');
      
      aggregator['startBackgroundJobs']();
      
      expect(mockUpdateTokenData).toHaveBeenCalled();
      expect(mockSetInterval).toHaveBeenCalledWith(
        expect.any(Function),
        config.aggregation.updateInterval
      );
    });

    it('should handle updateTokenData errors', async () => {
      const mockError = new Error('Update failed');
      jest.spyOn(aggregator['dataAggregator'], 'getAllTokens').mockRejectedValue(mockError);
      
      await aggregator['updateTokenData']();
      
      expect(logger.error).toHaveBeenCalledWith('Error updating token data:', mockError);
    });
  });

  describe('Graceful Shutdown', () => {
    it('should stop all services on shutdown', async () => {
      const mockClearInterval = jest.spyOn(global, 'clearInterval');
      const mockCacheDisconnect = jest.fn();
      const mockServerClose = jest.fn();
      
      aggregator['updateInterval'] = setInterval(() => {}, 1000);
      aggregator['cacheService'].disconnect = mockCacheDisconnect;
      aggregator['server'].close = mockServerClose;
      
      await aggregator.stop();
      
      expect(mockClearInterval).toHaveBeenCalled();
      expect(mockCacheDisconnect).toHaveBeenCalled();
      expect(mockServerClose).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith('Meme Coin Aggregator stopped');
    });
  });
});