// src/services/DataAggregatorService.ts
import axios, { AxiosInstance } from 'axios';
import { RateLimiterApi, TokenData } from '../types';
import { APIRateLimiter, ExponentialBackoff } from '../utils/rateLimiter';
import { logger } from '../utils/logger';
import { config } from '../config';
import { mapCoinGeckoToken, mapDexScreenerToken, mergeTokenData, validToken } from '../utils/services/DataAggregratorUtils';

export class DataAggregatorService {
  private clients: Record<'dexscreener' | 'geckoterminal', AxiosInstance>;
  private rateLimiter = new APIRateLimiter();

  constructor() {
    this.clients = {
      dexscreener: this.createClient(config.api.dexscreener.baseUrl),
      geckoterminal: this.createClient(config.api.geckoterminal.baseUrl),
    };
  }

  /** Create a preconfigured axios client */
  private createClient(baseURL: string): AxiosInstance {
    const client = axios.create({
      baseURL,
      timeout: 10000,
      headers: { 'User-Agent': 'MemeCoinAggregator/1.0' },
    });

    client.interceptors.response.use(
      (res) => {
        logger.debug(`API ${res.config.url} - ${res.status}`);
        return res;
      },
      (err) => {
        logger.error(`API Error: ${err.config?.url} - ${err.message}`);
        return Promise.reject(err);
      }
    );

    return client;
  }

  /** Unified fetch with retry + rate limit */
  private async fetchWithRetry<T>(
    api: RateLimiterApi,
    request: () => Promise<T>,
    retries: number
  ): Promise<T> {
    return ExponentialBackoff.retry(async () => {
      await this.rateLimiter.checkLimit(api);
      return request();
    }, retries);
  }

  /** Fetch and map from DexScreener */
  async fetchFromDexScreener(): Promise<TokenData[]> {
    const { dexscreener } = this.clients;

    return this.fetchWithRetry(
      RateLimiterApi.DEX_SCREENER,
      async () => {
        const { data } = await dexscreener.get('/search?q=SOLANA');
        const pairs = data.pairs || [];
        logger.info(`DexScreener returned ${pairs.length} pairs`);

        return pairs
          .slice(0, config.aggregation.batchSize)
          .map(mapDexScreenerToken)
          .filter(validToken);
      },
      config.api.dexscreener.retryAttempts
    );
  }

  /** Fetch and map from CoinGecko/GeckoTerminal */
  async fetchFromGeckoTerminal(): Promise<TokenData[]> {
    const { geckoterminal } = this.clients;

    return this.fetchWithRetry(
      RateLimiterApi.GECKO_TERMINAL,
      async () => {
        const { data } = await geckoterminal.get(
          '/coins/markets?vs_currency=usd&platform=solana'
        );
        logger.info(`CoinGecko returned ${data.length} tokens`);
        return data.map(mapCoinGeckoToken).filter(validToken);
      },
      config.api.geckoterminal.retryAttempts
    );
  }

  /** Merge multiple token arrays */
  mergeTokens(tokenArrays: TokenData[][]): TokenData[] {
    const tokenMap = new Map<string, TokenData>();

    for (const token of tokenArrays.flat()) {
      const key = token.token_address.toLowerCase();
      if (!key) continue;

      if (tokenMap.has(key)) {
        tokenMap.set(key, mergeTokenData(tokenMap.get(key)!, token));
      } else {
        tokenMap.set(key, token);
      }
    }

    return Array.from(tokenMap.values())
      .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
      .slice(0, config.aggregation.maxTokens);
  }

  /** Aggregate everything */
  async getAllTokens(): Promise<TokenData[]> {
    try {
      const [dex, gecko] = await Promise.allSettled([
        this.fetchFromDexScreener(),
        this.fetchFromGeckoTerminal(),
      ]);

      const results = [
        ...(dex.status === 'fulfilled' ? dex.value : []),
        ...(gecko.status === 'fulfilled' ? gecko.value : []),
      ];

      const merged = this.mergeTokens([results]);
      logger.info(`Merged ${merged.length} total tokens`);
      return merged;
    } catch (err) {
      logger.error('Error aggregating tokens:', err);
      throw err;
    }
  }
}
