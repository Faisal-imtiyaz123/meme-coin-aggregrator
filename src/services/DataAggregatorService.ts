// src/services/DataAggregatorService.ts
import axios, { AxiosInstance } from 'axios';
import { TokenData } from '../types';
import { APIRateLimiter, ExponentialBackoff } from '../utils/rateLimiter';
import { logger } from '../utils/logger';
import { config } from '../config';

export class DataAggregatorService {
  private dexscreenerClient: AxiosInstance;
  private geckoterminalClient: AxiosInstance;
  private jupiterClient: AxiosInstance;
  private rateLimiter: APIRateLimiter;

  constructor() {
    this.rateLimiter = new APIRateLimiter();
    
    this.dexscreenerClient = axios.create({
      baseURL: config.api.dexscreener.baseUrl,
      timeout: 10000,
      headers: {
        'User-Agent': 'MemeCoinAggregator/1.0'
      }
    });
    
    this.geckoterminalClient = axios.create({
      baseURL: config.api.geckoterminal.baseUrl,
      timeout: 10000,
      headers: {
        'User-Agent': 'MemeCoinAggregator/1.0'
      }
    });
    
    this.jupiterClient = axios.create({
      baseURL: config.api.jupiter.baseUrl,
      timeout: 10000,
      headers: {
        'User-Agent': 'MemeCoinAggregator/1.0'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Response interceptor for logging
    const responseInterceptor = (response: any) => {
      logger.debug(`API ${response.config.url} - Status: ${response.status}`);
      return response;
    };

    const errorInterceptor = (error: any) => {
      logger.error(`API Error: ${error.config?.url} - ${error.message}`);
      return Promise.reject(error);
    };

    [this.dexscreenerClient, this.geckoterminalClient, this.jupiterClient].forEach(client => {
      client.interceptors.response.use(responseInterceptor, errorInterceptor);
    });
  }

  async fetchFromDexScreener(): Promise<TokenData[]> {
    return ExponentialBackoff.retry(async () => {
      await this.rateLimiter.checkLimit('dexscreener');
      
      const response = await this.dexscreenerClient.get('/search?q=SOLANA');
      const pairs = response.data.pairs || [];
      
      return pairs.slice(0, config.aggregation.batchSize).map((pair: any) => {
        const baseToken = pair.baseToken || {};
        const quoteToken = pair.quoteToken || {};
        
        // Convert USD values to SOL (approximate)
        const solPrice = 20; // Approximate SOL price in USD
        const priceSol = pair.priceUsd ? pair.priceUsd / solPrice : 0;
        const volumeSol = pair.volume?.h24 ? pair.volume.h24 / solPrice : 0;
        const liquiditySol = pair.liquidity?.usd ? pair.liquidity.usd / solPrice : 0;
        const marketCapSol = pair.fdv ? pair.fdv / solPrice : 0;

        return {
          token_address: baseToken.address?.toLowerCase(),
          token_name: baseToken.name || 'Unknown',
          token_ticker: baseToken.symbol || 'UNKNOWN',
          price_sol: priceSol,
          market_cap_sol: marketCapSol,
          volume_sol: volumeSol,
          liquidity_sol: liquiditySol,
          transaction_count: (pair.txns?.h24?.buys || 0) + (pair.txns?.h24?.sells || 0),
          price_1hr_change: pair.priceChange?.h1 || 0,
          price_24hr_change: pair.priceChange?.h24 || 0,
          protocol: pair.dexId || 'Unknown',
          dex_url: pair.url,
          source: ['dexscreener'],
          last_updated: Date.now()
        } as TokenData;
      }).filter((token: TokenData) => token.token_address && token.price_sol > 0);
    }, config.api.dexscreener.retryAttempts);
  }

  async fetchFromGeckoTerminal(): Promise<TokenData[]> {
    return ExponentialBackoff.retry(async () => {
      await this.rateLimiter.checkLimit('geckoterminal');
      
      const response = await this.geckoterminalClient.get('/coins/markets?vs_currency=usd&platform=solana');
      const tokens = response.data || [];
      
      return tokens.slice(0, config.aggregation.batchSize).map((token: any) => {
        const attributes = token.attributes;
        const solPrice = 20; // Approximate SOL price
        
        return {
          token_address: token.id?.split('_')[1]?.toLowerCase() || token.id?.toLowerCase(),
          token_name: attributes.name || 'Unknown',
          token_ticker: attributes.symbol || 'UNKNOWN',
          price_sol: attributes.price_usd ? attributes.price_usd / solPrice : 0,
          market_cap_sol: attributes.fdv_usd ? attributes.fdv_usd / solPrice : 0,
          volume_sol: attributes.volume_usd?.h24 ? attributes.volume_usd.h24 / solPrice : 0,
          liquidity_sol: attributes.reserve_in_usd ? attributes.reserve_in_usd / solPrice : 0,
          transaction_count: 0, // Not provided by GeckoTerminal
          price_1hr_change: attributes.price_change_percentage?.h1 || 0,
          price_24hr_change: attributes.price_change_percentage?.h24 || 0,
          protocol: 'Unknown',
          source: ['geckoterminal'],
          last_updated: Date.now()
        } as TokenData;
      }).filter((token: TokenData) => token.token_address && token.price_sol > 0);
    }, config.api.geckoterminal.retryAttempts);
  }
  mergeTokens(tokensArrays: TokenData[][]): TokenData[] {
    const tokenMap = new Map<string, TokenData>();
    
    tokensArrays.flat().forEach(token => {
      const key = token.token_address.toLowerCase();
      
      if (!key) return;
      
      if (tokenMap.has(key)) {
        // Merge tokens from different sources
        const existing = tokenMap.get(key)!;
        
        // Prefer data from source with higher liquidity
        const shouldReplace = token.liquidity_sol > existing.liquidity_sol;
        const mergedSources = Array.from(new Set([
        ...(Array.isArray(existing.source) ? existing.source : [existing.source]),
        ...(Array.isArray(token.source) ? token.source : [token.source]),
      ]));
        if (shouldReplace) {
          tokenMap.set(key, {
            ...token,
            is_merged: true,
            source: mergedSources
          });
        } else {
          existing.source = mergedSources
        }
      } else {
        tokenMap.set(key, { ...token, is_merged: false });
      }
    });
    
    return Array.from(tokenMap.values())
      .sort((a, b) => b.volume_sol - a.volume_sol)
      .slice(0, config.aggregation.maxTokens);
  }

  async getAllTokens(): Promise<TokenData[]> {
    try {
      const [dexscreenerTokens, geckoterminalTokens] = await Promise.allSettled([
        this.fetchFromDexScreener(),
        this.fetchFromGeckoTerminal(),
      ]);

      const tokensArrays = [];
      
      if (dexscreenerTokens.status === 'fulfilled') {
        tokensArrays.push(dexscreenerTokens.value);
        logger.info(`Fetched ${dexscreenerTokens.value.length} tokens from DexScreener`);
      }
      
      if (geckoterminalTokens.status === 'fulfilled') {
        tokensArrays.push(geckoterminalTokens.value);
        logger.info(`Fetched ${geckoterminalTokens.value.length} tokens from GeckoTerminal`);
      }

      const mergedTokens = this.mergeTokens(tokensArrays);
      logger.info(`Total merged tokens: ${mergedTokens.length}`);
      
      return mergedTokens;
    } catch (error) {
      logger.error('Error aggregating tokens:', error);
      throw error;
    }
  }
}