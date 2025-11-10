// src/config/index.ts
export const config = {
  server: {
    port: process.env.PORT || 3000,
    env: process.env.NODE_ENV || 'development'
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    ttl: parseInt(process.env.CACHE_TTL || '30') // seconds
  },
  api: {
    dexscreener: {
      baseUrl: 'https://api.dexscreener.com/latest/dex',
      rateLimit: 300, // requests per minute
      retryAttempts: 3
    },
    geckoterminal: {
      baseUrl: 'https://api.coingecko.com/api/v3',
      rateLimit: 100,
      retryAttempts: 3
    },
    jupiter: {
      baseUrl:'https://lite-api.jup.ag',
      rateLimit: 200,
      retryAttempts: 3
    }
  },
  aggregation: {
    updateInterval: 10000, // 10 seconds
    batchSize: 50,
    maxTokens: 1000
  },
  websocket: {
    pingInterval: 25000,
    pingTimeout: 20000
  }
};