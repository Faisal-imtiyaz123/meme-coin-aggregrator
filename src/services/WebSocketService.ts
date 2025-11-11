// src/services/WebSocketService.ts
import { Server as SocketIOServer } from 'socket.io';
import { TokenData, WebSocketMessage } from '../types';
import { CacheService } from './CacheService';
import { logger } from '../utils/logger';

export class WebSocketService {
  private io: SocketIOServer;
  private connectedClients: Map<string, any> = new Map();

  constructor(io: SocketIOServer, cacheService: CacheService) {
    this.io = io;
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
  public getConnectedClientsCount(): number {
    return this.connectedClients.size;
  }
}