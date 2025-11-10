// src/services/WebSocketService.ts
import { Server as SocketIOServer } from 'socket.io';
import { TokenData, WebSocketMessage } from '../types';
import { CacheService } from './CacheService';
import { logger } from '../utils/logger';

export class WebSocketService {
  private io: SocketIOServer;
  private cacheService: CacheService;
  private connectedClients: Map<string, any> = new Map();

  constructor(io: SocketIOServer, cacheService: CacheService) {
    this.io = io;
    this.cacheService = cacheService;
    this.setupSocketHandlers();
  }

  private setupSocketHandlers(): void {
    this.io.on('connection', (socket) => {
      logger.info(`Client connected: ${socket.id}`);
      this.connectedClients.set(socket.id, {
        id: socket.id,
        connectedAt: Date.now(),
        subscribedTokens: new Set()
      });

      socket.on('subscribe_tokens', (data: { tokens?: string[] } = {}) => {
        const client = this.connectedClients.get(socket.id);
        if (client && data.tokens) {
          data.tokens.forEach(token => client.subscribedTokens.add(token.toLowerCase()));
          logger.info(`Client ${socket.id} subscribed to tokens: ${data.tokens.join(', ')}`);
        }
      });

      socket.on('unsubscribe_tokens', (data: { tokens?: string[] } = {}) => {
        const client = this.connectedClients.get(socket.id);
        if (client && data.tokens) {
          data.tokens.forEach(token => client.subscribedTokens.delete(token.toLowerCase()));
          logger.info(`Client ${socket.id} unsubscribed from tokens: ${data.tokens.join(', ')}`);
        }
      });

      socket.on('disconnect', () => {
        logger.info(`Client disconnected: ${socket.id}`);
        this.connectedClients.delete(socket.id);
      });
    });
  }

  public broadcastTokenUpdate(updatedTokens: TokenData[]): void {
    const message: WebSocketMessage = {
      type: 'batch_update',
      data: updatedTokens,
      timestamp: Date.now()
    };

    this.io.emit('token_updates', message);
    logger.debug(`Broadcasted update for ${updatedTokens.length} tokens`);
  }

  public broadcastPriceChange(token: TokenData, oldPrice: number): void {
    const changePercent = ((token.price_sol - oldPrice) / oldPrice) * 100;
    
    if (Math.abs(changePercent) > 5) { // Only broadcast significant changes
      const message: WebSocketMessage = {
        type: 'price_update',
        data: {
          token_address: token.token_address,
          old_price: oldPrice,
          new_price: token.price_sol,
          change_percent: changePercent,
          token_name: token.token_name
        },
        timestamp: Date.now()
      };

      this.io.emit('price_alert', message);
      
      // Send to specific subscribers
      this.connectedClients.forEach((client, socketId) => {
        if (client.subscribedTokens.has(token.token_address.toLowerCase())) {
          this.io.to(socketId).emit('subscribed_token_update', message);
        }
      });
    }
  }

  public broadcastVolumeSpike(token: TokenData): void {
    const message: WebSocketMessage = {
      type: 'volume_spike',
      data: {
        token_address: token.token_address,
        token_name: token.token_name,
        volume_sol: token.volume_sol,
        spike_intensity: 'high' // Could be calculated based on historical data
      },
      timestamp: Date.now()
    };

    this.io.emit('volume_alert', message);
  }

  public getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }
}