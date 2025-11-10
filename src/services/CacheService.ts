// src/services/CacheService.ts
import Redis from 'ioredis';
import { TokenData } from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';

export class CacheService {
  private redis: Redis;
  private readonly DEFAULT_TTL = config.redis.ttl;

  constructor() {
    this.redis = new Redis(config.redis.url, {
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      lazyConnect: true
    });

    this.setupEventListeners();
  }

  private setupEventListeners(): void {
    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
    });

    this.redis.on('error', (error) => {
      logger.error('Redis connection error:', error);
    });
  }

  async setTokens(tokens: TokenData[], ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      await this.redis.setex('tokens:all', ttl, JSON.stringify(tokens));
      
      // Also cache individual tokens for quick lookup
      for (const token of tokens.slice(0, 100)) { // Cache top 100 individually
        await this.redis.setex(
          `token:${token.token_address}`, 
          ttl, 
          JSON.stringify(token)
        );
      }
    } catch (error) {
      logger.error('Error caching tokens:', error);
      throw error;
    }
  }

  async getTokens(): Promise<TokenData[] | null> {
    try {
      const cached = await this.redis.get('tokens:all');
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Error retrieving tokens from cache:', error);
      return null;
    }
  }

  async getToken(address: string): Promise<TokenData | null> {
    try {
      const cached = await this.redis.get(`token:${address.toLowerCase()}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Error retrieving token from cache:', error);
      return null;
    }
  }

  async setKey(key: string, value: any, ttl?: number): Promise<void> {
    try {
      if (ttl) {
        await this.redis.setex(key, ttl, JSON.stringify(value));
      } else {
        await this.redis.set(key, JSON.stringify(value));
      }
    } catch (error) {
      logger.error('Error setting cache key:', error);
      throw error;
    }
  }

  async getKey<T>(key: string): Promise<T | null> {
    try {
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Error getting cache key:', error);
      return null;
    }
  }

  async delKey(key: string): Promise<void> {
    try {
      await this.redis.del(key);
    } catch (error) {
      logger.error('Error deleting cache key:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}