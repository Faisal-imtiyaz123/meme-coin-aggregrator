// src/services/DataAggregatorService.ts
import axios, { AxiosInstance } from 'axios';
import { RateLimiterApi, TokenData } from '../types';
import { APIRateLimiter, ExponentialBackoff } from '../utils/rateLimiter';
import { logger } from '../utils/logger';
import { config } from '../config';

export class DataAggregatorService {
  private dexscreenerClient: AxiosInstance;
  private geckoterminalClient: AxiosInstance;
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

    [this.dexscreenerClient, this.geckoterminalClient].forEach(client => {
      client.interceptors.response.use(responseInterceptor, errorInterceptor);
    });
  }

async fetchFromDexScreener(): Promise<TokenData[]> {
  return ExponentialBackoff.retry(async () => {
    await this.rateLimiter.checkLimit(RateLimiterApi.DEX_SCREENER);
    
    const response = await this.dexscreenerClient.get('/search?q=SOLANA');
    const pairs = response.data.pairs || [];
    
    logger.info(`DexScreener returned ${pairs.length} pairs`);
    
    return pairs.slice(0, config.aggregation.batchSize)
      .map((dsToken: any) => {
        try {
          const baseToken = dsToken.baseToken || {};
          return {
            // Basic Identification
            token_address: baseToken.address?.toLowerCase() || '',
            token_name: baseToken.name || 'Unknown',
            token_ticker: baseToken.symbol || 'UNKNOWN',
            
            // Price Data (all in USD now)
            price: dsToken.priceUsd || 0,
            priceChange1h: dsToken.priceChange?.h1 || 0,
            priceChange6h: dsToken.priceChange?.h6 || 0,
            priceChange24h: dsToken.priceChange?.h24 || 0,
            priceChangePercentage24h: 0, // DexScreener doesn't provide percentage
            
            // Market Data
            marketCap: dsToken.fdv || 0, // Using FDV as market cap
            marketCapChange24h: 0,
            marketCapChangePercentage24h: 0,
            volume24h: dsToken.volume?.h24 || 0,
            
            // Supply Data
            circulatingSupply: 0, // Not provided by DexScreener
            totalSupply: 0, // Not provided by DexScreener
            
            // Additional Metrics
            liquidity: dsToken.liquidity?.usd || 0,
            high_24h: 0, // Not provided by DexScreener
            low_24h: 0,  // Not provided by DexScreener
            transaction_count: (dsToken.txns?.h24?.buys || 0) + (dsToken.txns?.h24?.sells || 0),
            
            // Historical Data
            ath: 0,
            athChangePercentage: 0,
            athDate: '',
            atl: 0,
            atlChangePercentage: 0,
            atlDate: '',
            roi: null,
            
            // Source & Metadata
            dex: dsToken.dexId || 'Unknown',
            dexUrl: dsToken.url || '',
            image: dsToken.info?.imageUrl || '',
            rank: null,
            source: ['dexscreener'],
            lastUpdated: dsToken.pairCreatedAt || new Date().toISOString(),
            is_merged: false
          } as TokenData;
        } catch (error) {
          logger.warn('Error processing DexScreener pair:', error);
          return null;
        }
      })
      .filter((token: TokenData | null): token is TokenData => 
        token !== null && 
        token.token_address.length>0 && 
        token.price > 0
      );
  }, config.api.dexscreener.retryAttempts);
}

async fetchFromGeckoTerminal(): Promise<TokenData[]> {
  return ExponentialBackoff.retry(async () => {
    await this.rateLimiter.checkLimit(RateLimiterApi.GECKO_TERMINAL);
    
    // Get popular Solana tokens
    const response = await this.geckoterminalClient.get('/coins/markets?vs_currency=usd&platform=solana');
    
    const tokens = response.data || [];
    
    logger.info(`CoinGecko returned ${tokens.length} tokens`);
    
    return tokens.map((cgToken: any) => {
      try {
        return {
          // Basic Identification
          token_address: cgToken.id, // Using CoinGecko ID as identifier
          token_name: cgToken.name || 'Unknown',
          token_ticker: cgToken.symbol ? cgToken.symbol.toUpperCase() : 'UNKNOWN',
          
          // Price Data
          price: cgToken.current_price || 0,
          priceChange1h: 0, // CoinGecko doesn't provide 1h change
          priceChange6h: 0, // CoinGecko doesn't provide 6h change
          priceChange24h: cgToken.price_change_24h || 0,
          priceChangePercentage24h: cgToken.price_change_percentage_24h || 0,
          
          // Market Data
          marketCap: cgToken.market_cap || 0,
          marketCapChange24h: cgToken.market_cap_change_24h || 0,
          marketCapChangePercentage24h: cgToken.market_cap_change_percentage_24h || 0,
          volume24h: cgToken.total_volume || 0,
          
          // Supply Data
          circulatingSupply: cgToken.circulating_supply || 0,
          totalSupply: cgToken.total_supply || 0,
          
          // Additional Metrics
          liquidity: 0, // CoinGecko doesn't provide liquidity
          high_24h: cgToken.high_24h || 0,
          low_24h: cgToken.low_24h || 0,
          transaction_count: 0, // Not provided by CoinGecko
          
          // Historical Data
          ath: cgToken.ath || 0,
          athChangePercentage: cgToken.ath_change_percentage || 0,
          athDate: cgToken.ath_date || '',
          atl: cgToken.atl || 0,
          atlChangePercentage: cgToken.atl_change_percentage || 0,
          atlDate: cgToken.atl_date || '',
          roi: cgToken.roi || null,
          
          // Source & Metadata
          dex: 'Various', // CoinGecko aggregates from multiple DEXs
          dexUrl: '',
          image: cgToken.image || '',
          rank: cgToken.market_cap_rank || null,
          source: ['coingecko'],
          lastUpdated: cgToken.last_updated || new Date().toISOString(),
          is_merged: false
        } as TokenData;
      } catch (error) {
        logger.warn(`Error processing CoinGecko token ${cgToken.id}:`, error);
        return null;
      }
    }).filter((token: TokenData | null): token is TokenData => 
      token !== null && 
      token.token_address.length>0 && 
      token.price > 0
    );
  }, config.api.geckoterminal.retryAttempts);
}
 mergeTokens(tokensArrays: TokenData[][]): TokenData[] {
  const tokenMap = new Map<string, TokenData>();
  
  tokensArrays.flat().forEach(token => {
    const key = token.token_address.toLowerCase();
    
    if (!key) return;
    
    if (tokenMap.has(key)) {
      // Merge tokens - prefer DexScreener for DEX data, CoinGecko for market data
      const existing = tokenMap.get(key)!;
      const merged = this.mergeTokenData(existing, token);
      tokenMap.set(key, merged);
    } else {
      tokenMap.set(key, { ...token, is_merged: false });
    }
  });
  
  return Array.from(tokenMap.values())
    .sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0))
    .slice(0, config.aggregation.maxTokens);
}

private mergeTokenData(tokenA: TokenData, tokenB: TokenData): TokenData {
  // Determine which source is which
  const isADexScreener = tokenA.source.includes('dexscreener');
  const isBCoinGecko = tokenB.source.includes('coingecko');
  
  const dexToken = isADexScreener ? tokenA : (isBCoinGecko ? tokenB : tokenA);
  const cgToken = isBCoinGecko ? tokenB : (isADexScreener ? tokenA : tokenB);
  
  return {
    // Use DexScreener for DEX-specific data, CoinGecko for market data
    token_address: dexToken.token_address || cgToken.token_address,
    token_name: dexToken.token_name || cgToken.token_name,
    token_ticker: dexToken.token_ticker || cgToken.token_ticker,
    
    // Price - prefer real-time from DexScreener
    price: dexToken.price || cgToken.price,
    priceChange1h: dexToken.priceChange1h,
    priceChange6h: dexToken.priceChange6h,
    priceChange24h: cgToken.priceChange24h || dexToken.priceChange24h,
    priceChangePercentage24h: cgToken.priceChangePercentage24h,
    
    // Market data - prefer CoinGecko
    marketCap: cgToken.marketCap || dexToken.marketCap,
    marketCapChange24h: cgToken.marketCapChange24h,
    marketCapChangePercentage24h: cgToken.marketCapChangePercentage24h,
    volume24h: dexToken.volume24h || cgToken.volume24h,
    
    // Supply - from CoinGecko
    circulatingSupply: cgToken.circulatingSupply,
    totalSupply: cgToken.totalSupply,
    
    // Additional metrics - combine best of both
    liquidity: dexToken.liquidity,
    high_24h: cgToken.high_24h,
    low_24h: cgToken.low_24h,
    transaction_count: dexToken.transaction_count,
    
    // Historical - from CoinGecko
    ath: cgToken.ath,
    athChangePercentage: cgToken.athChangePercentage,
    athDate: cgToken.athDate,
    atl: cgToken.atl,
    atlChangePercentage: cgToken.atlChangePercentage,
    atlDate: cgToken.atlDate,
    roi: cgToken.roi,
    
    // Metadata
    dex: dexToken.dex,
    dexUrl: dexToken.dexUrl,
    image: dexToken.image || cgToken.image,
    rank: cgToken.rank,
    source: [...new Set([...tokenA.source, ...tokenB.source])], // Combine sources
    lastUpdated: new Date().toISOString(),
    is_merged: true
  };
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