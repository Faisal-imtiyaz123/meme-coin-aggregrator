import { createClient, RedisClientType } from 'redis';
import { TokenData } from '../types';
import { config } from '../config';
import { logger } from '../utils/logger';

// Create Redis client (remove this from your other file)
const client: RedisClientType = createClient({
  username: 'default',
  password: 'rRlmzmHJ9dhY2z6ZBpgYLGtLclYJOaZ4',
  socket: {
    host: 'redis-14673.c14.us-east-1-3.ec2.cloud.redislabs.com',
    port: 14673
  }
});

export class CacheService {
  private redis: RedisClientType;
  private readonly DEFAULT_TTL = config.redis.ttl;
  private isConnected: boolean = false;

  constructor() {
    this.redis = client;
    this.setupEventListeners();
    this.connect(); // Ensure connection on initialization
  }

  private async connect(): Promise<void> {
    if (!this.isConnected) {
      try {
        await this.redis.connect();
        this.isConnected = true;
      } catch (error) {
        logger.error('Failed to connect to Redis:', error);
        throw error;
      }
    }
  }

  private setupEventListeners(): void {
    this.redis.on('connect', () => {
      logger.info('Redis connected successfully');
      this.isConnected = true;
    });

    this.redis.on('error', (error: any) => {
      logger.error('Redis connection error:', error);
      this.isConnected = false;
    });

    this.redis.on('end', () => {
      logger.info('Redis connection closed');
      this.isConnected = false;
    });
  }

  private async ensureConnected(): Promise<void> {
    if (!this.isConnected) {
      await this.connect();
    }
  }

  async setTokens(tokens: TokenData[], ttl: number = this.DEFAULT_TTL): Promise<void> {
    try {
      await this.ensureConnected();
      await this.redis.setEx('tokens:all', ttl, JSON.stringify(tokens));
      console.log("tokens set");
    } catch (error) {
      logger.error('Error caching tokens:', error);
      throw error;
    }
  }

  async getTokens(): Promise<TokenData[] | null> {
    try {
      await this.ensureConnected();
      const cached = await this.redis.get('tokens:all');
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Error retrieving tokens from cache:', error);
      return null;
    }
  }

  async getToken(address: string): Promise<TokenData | null> {
    try {
      await this.ensureConnected();
      const cached = await this.redis.get(`token:${address.toLowerCase()}`);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Error retrieving token from cache:', error);
      return null;
    }
  }

  async setKey(key: string, value: any, ttl?: number): Promise<void> {
    try {
      await this.ensureConnected();
      if (ttl) {
        await this.redis.setEx(key, ttl, JSON.stringify(value));
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
      await this.ensureConnected();
      const cached = await this.redis.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      logger.error('Error getting cache key:', error);
      return null;
    }
  }

  async delKey(key: string): Promise<void> {
    try {
      await this.ensureConnected();
      await this.redis.del(key);
    } catch (error) {
      logger.error('Error deleting cache key:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.isConnected) {
      await this.redis.quit();
      this.isConnected = false;
    }
  }

  // Health check method
  async healthCheck(): Promise<boolean> {
    try {
      await this.redis.ping();
      return true;
    } catch (error) {
      return false;
    }
  }
}