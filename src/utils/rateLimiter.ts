// src/utils/rateLimiter.ts
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { RateLimiterApi } from '../types';

export class APIRateLimiter {
  private limiters: Map<string, RateLimiterMemory> = new Map();

  constructor() {
    // Initialize rate limiters for different APIs
    this.limiters.set(RateLimiterApi.DEX_SCREENER, new RateLimiterMemory({
      points: 300,
      duration: 60 // 300 requests per minute
    }));
    
    this.limiters.set(RateLimiterApi.GECKO_TERMINAL, new RateLimiterMemory({
      points: 100,
      duration: 60
    }));
  }

  async checkLimit(apiName: string): Promise<void> {
    const limiter = this.limiters.get(apiName);
    if (!limiter) {
      throw new Error(`No rate limiter configured for ${apiName}`);
    }

    try {
      await limiter.consume(1);
    } catch (rejRes: any) {
      const waitTime = Math.ceil(rejRes.msBeforeNext / 1000);
      throw new Error(`Rate limit exceeded for ${apiName}. Try again in ${waitTime} seconds`);
    }
  }
}

export class ExponentialBackoff {
  static async retry<T>(
    operation: () => Promise<T>,
    maxAttempts: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxAttempts) {
          break;
        }
        const delay = baseDelay * Math.pow(2, attempt - 1);
        await new Promise(resolve => setTimeout(resolve, delay + Math.random() * 1000));
      }
    }

    throw lastError!;
  }
}