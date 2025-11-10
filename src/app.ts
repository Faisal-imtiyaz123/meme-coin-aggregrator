// src/app.ts
import express from 'express';
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';

import { DataAggregatorService } from './services/DataAggregatorService';
import { CacheService } from './services/CacheService';
import { WebSocketService } from './services/WebSocketService';
import { TokenController } from './controllers/TokenController';
import { config } from './config';
import { logger } from './utils/logger';
import { TokenData } from './types';

class MemeCoinAggregator {
  private app: express.Application;
  private server: any;
  private io: SocketIOServer;
  private dataAggregator: DataAggregatorService;
  private cacheService: CacheService;
  private websocketService: WebSocketService;
  private tokenController: TokenController;
  private updateInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.io = new SocketIOServer(this.server, {
      cors: {
        origin: "*",
        methods: ["GET", "POST"]
      },
      pingInterval: config.websocket.pingInterval,
      pingTimeout: config.websocket.pingTimeout
    });

    this.cacheService = new CacheService();
    this.dataAggregator = new DataAggregatorService();
    this.websocketService = new WebSocketService(this.io, this.cacheService);
    this.tokenController = new TokenController(this.cacheService, this.dataAggregator);

    this.setupMiddleware();
    this.setupRoutes();
    this.startBackgroundJobs();
  }

  private setupMiddleware(): void {
    // Security middleware
    this.app.use(helmet());
    this.app.use(cors());
    
    // Compression middleware
    this.app.use(compression());
    
    // JSON parsing
    this.app.use(express.json({ limit: '10mb' }));
    
    // Rate limiting
    const limiter = rateLimit({
      windowMs: 1 * 60 * 1000, // 1 minute
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many requests from this IP, please try again later.'
    });
    this.app.use(limiter);
    
    // Logging middleware
    this.app.use((req, res, next) => {
      logger.info(`${req.method} ${req.path} - IP: ${req.ip}`);
      next();
    });
  }

  private setupRoutes(): void {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({ 
        status: 'healthy', 
        timestamp: Date.now(),
        connected_clients: this.websocketService.getConnectedClientsCount(),
        environment: config.server.env
      });
    });

    // API routes
    this.app.get('/api/tokens', this.tokenController.getTokens.bind(this.tokenController));
    this.app.get('/api/tokens/:address', this.tokenController.getTokenByAddress.bind(this.tokenController));
    this.app.get('/api/stats', this.tokenController.getStats.bind(this.tokenController));
    
    // 404 handler
    this.app.use('*', (req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });
    
    // Error handler
    this.app.use((error: any, req: any, res: any, next: any) => {
      logger.error('Unhandled error:', error);
      res.status(500).json({ error: 'Internal server error' });
    });
  }

  private async updateTokenData(): Promise<void> {
    try {
      logger.info('Starting token data update...');
      
      const startTime = Date.now();
      const freshTokens = await this.dataAggregator.getAllTokens();
      const endTime = Date.now();
      
      logger.info(`Token data update completed in ${endTime - startTime}ms`);
      
      // Cache the fresh data
      await this.cacheService.setTokens(freshTokens);
      
      // Broadcast updates via WebSocket
      this.websocketService.broadcastTokenUpdate(freshTokens);
      
      // Check for significant changes
      await this.detectSignificantChanges(freshTokens);
      
    } catch (error) {
      logger.error('Error updating token data:', error);
    }
  }

  private async detectSignificantChanges(freshTokens: TokenData[]): Promise<void> {
    try {
      const cachedTokens = await this.cacheService.getTokens();
      if (!cachedTokens) return;

      const cachedMap = new Map(cachedTokens.map(token => [token.token_address, token]));
      
      for (const freshToken of freshTokens) {
        const cachedToken = cachedMap.get(freshToken.token_address);
        if (cachedToken) {
          // Check for price changes
          if (Math.abs(freshToken.price_sol - cachedToken.price_sol) / cachedToken.price_sol > 0.05) {
            this.websocketService.broadcastPriceChange(freshToken, cachedToken.price_sol);
          }
          
          // Check for volume spikes
          if (freshToken.volume_sol > cachedToken.volume_sol * 2) {
            this.websocketService.broadcastVolumeSpike(freshToken);
          }
        }
      }
    } catch (error) {
      logger.error('Error detecting significant changes:', error);
    }
  }

  private startBackgroundJobs(): void {
    // Initial data load
    setTimeout(() => this.updateTokenData(), 1000);
    
    // Periodic updates
    this.updateInterval = setInterval(
      () => this.updateTokenData(),
      config.aggregation.updateInterval
    );
    
    logger.info('Background jobs started');
  }

  public async start(): Promise<void> {
    const port = config.server.port;
    
    this.server.listen(port, () => {
      logger.info(`🚀 Meme Coin Aggregator running on port ${port}`);
      logger.info(`📊 API available at http://localhost:${port}/api`);
      logger.info(`🔌 WebSocket available at ws://localhost:${port}`);
      logger.info(`❤️  Health check at http://localhost:${port}/health`);
    });
  }

  public async stop(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    await this.cacheService.disconnect();
    this.server.close();
    
    logger.info('Meme Coin Aggregator stopped');
  }
}

// Start the application
const aggregator = new MemeCoinAggregator();
aggregator.start().catch(error => {
  logger.error('Failed to start application:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  await aggregator.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  await aggregator.stop();
  process.exit(0);
});

export default MemeCoinAggregator;