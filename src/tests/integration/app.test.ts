// tests/integration/api.test.ts
import request from 'supertest';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import express from 'express';
import { CacheService } from '../../src/services/CacheService';
import { DataAggregatorService } from '../../src/services/DataAggregatorService';
import { TokenController } from '../../src/controllers/TokenController';

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
  });

  afterAll(async () => {
    await cacheService.disconnect();
    server.close();
  });

  describe('GET /api/tokens', () => {
    it('should return paginated tokens', async () => {
      const response = await request(app)
        .get('/api/tokens')
        .expect(200);

      expect(response.body).toHaveProperty('tokens');
      expect(response.body).toHaveProperty('has_more');
      expect(response.body).toHaveProperty('total_count');
      expect(Array.isArray(response.body.tokens)).toBe(true);
    });

    it('should filter tokens by liquidity', async () => {
      const response = await request(app)
        .get('/api/tokens?min_liquidity=1000')
        .expect(200);

      // Assuming some tokens meet the criteria
      expect(response.body.tokens.every((token: any) => 
        token.liquidity_sol >= 1000
      )).toBe(true);
    });
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      app.get('/health', (req, res) => {
        res.json({ status: 'healthy', timestamp: Date.now() });
      });

      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('healthy');
    });
  });
});