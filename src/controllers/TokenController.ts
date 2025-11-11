// src/controllers/TokenController.ts
import { Request, Response } from 'express';
import { CacheService } from '../services/CacheService';
import { DataAggregatorService } from '../services/DataAggregatorService';
import { TokenData, PaginatedResponse, FilterOptions } from '../types';
import { logger } from '../utils/logger';

export class TokenController {
  private cacheService: CacheService;
  private dataAggregator: DataAggregatorService;
  constructor(cacheService: CacheService, dataAggregator: DataAggregatorService) {
    this.cacheService = cacheService;
    this.dataAggregator = dataAggregator;
  }
  async getTokens(req: Request, res: Response): Promise<void> {
    try {
      const filters: FilterOptions = {
        time_period: req.query.time_period as '1h' | '24h' | '7d',
        sort_by: req.query.sort_by as any,
        sort_order: req.query.sort_order as 'asc' | 'desc',
        min_liquidity: req.query.min_liquidity ? Number(req.query.min_liquidity) : undefined,
        min_volume: req.query.min_volume ? Number(req.query.min_volume) : undefined,
        protocol: req.query.protocol as string,
        limit: req.query.limit ? Math.min(Number(req.query.limit), 100) : 20,
        cursor: req.query.cursor as string
      };

      logger.info(`Fetching tokens with filters: ${JSON.stringify(filters)}`);

      // Try to get from cache first
      let tokens = await this.cacheService.getTokens();
      
      // If cache is empty, fetch fresh data
      if (!tokens) {
        logger.info('Cache miss, fetching fresh data');
        tokens = await this.dataAggregator.getAllTokens();
        await this.cacheService.setTokens(tokens);
      }
      logger.info('Cache hit')
      // Apply filters
      const filteredTokens = this.applyFilters(tokens, filters);
      
      // Apply pagination
      const paginatedResponse = this.paginateTokens(filteredTokens, filters);

      res.json(paginatedResponse);
    } catch (error) {
      logger.error('Error in getTokens:', error);
      res.status(500).json({ 
        error: 'Failed to fetch tokens',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  async getTokenByAddress(req: Request, res: Response): Promise<void> {
    try {
      const { address } = req.params;
      
      if (!address) {
        res.status(400).json({ error: 'Token address is required' });
        return;
      }

      logger.info(`Fetching token by address: ${address}`);

      // Try cache first
      let token = await this.cacheService.getToken(address.toLowerCase());
      
      if (!token) {
        // If not in cache, get all tokens and find the specific one
        const tokens = await this.cacheService.getTokens();
        if (!tokens) {
          res.status(404).json({ error: 'Token not found' });
          return;
        }
        
        const foundToken = tokens.find(t => 
          t.token_address.toLowerCase() === address.toLowerCase()
        );
        if (!foundToken) {
          res.status(404).json({ error: 'Token not found' });
          return;
        }
        token = foundToken;
      }
      res.json(token);
    } catch (error) {
      logger.error('Error in getTokenByAddress:', error);
      res.status(500).json({ 
        error: 'Failed to fetch token',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
  private applyFilters(tokens: TokenData[], filters: FilterOptions): TokenData[] {
    let filtered = [...tokens];

    // Apply liquidity filter
    if (filters.min_liquidity) {
      filtered = filtered.filter(token => (token.liquidity || 0) >= filters.min_liquidity!);
    }

    // Apply volume filter
    if (filters.min_volume) {
      filtered = filtered.filter(token => (token.volume24h || 0) >= filters.min_volume!);
    }

    // Apply protocol filter (now called 'dex')
    if (filters.protocol) {
      filtered = filtered.filter(token => 
        token.dex.toLowerCase().includes(filters.protocol!.toLowerCase())
      );
    }

    // Apply time period filter for price changes
    if (filters.time_period) {
      let priceChangeField: keyof TokenData;
      
      switch (filters.time_period) {
        case '1h':
          priceChangeField = 'priceChange1h';
          break;
        case '24h':
          priceChangeField = 'priceChange24h';
          break;
        case '7d':
          // Note: We don't have 7d change in current interface
          // You might want to add priceChange7d to TokenData if needed
          return filtered;
        default:
          priceChangeField = 'priceChange24h';
      }
      
      filtered = filtered.filter(token => {
        const change = token[priceChangeField] as number;
        return change !== undefined && !isNaN(change);
      });
    }

    // Apply sorting
    if (filters.sort_by) {
      filtered.sort((a, b) => {
        let aValue: number = 0;
        let bValue: number = 0;

        switch (filters.sort_by) {
          case 'volume':
            aValue = a.volume24h || 0;
            bValue = b.volume24h || 0;
            break;
          case 'price_change':
            const timePeriod = filters.time_period || '24h';
            if (timePeriod === '1h') {
              aValue = a.priceChange1h || 0;
              bValue = b.priceChange1h || 0;
            } else {
              aValue = a.priceChangePercentage24h || 0;
              bValue = b.priceChangePercentage24h || 0;
            }
            break;
          case 'market_cap':
            aValue = a.marketCap || 0;
            bValue = b.marketCap || 0;
            break;
          case 'liquidity':
            aValue = a.liquidity || 0;
            bValue = b.liquidity || 0;
            break;
          case 'transaction_count':
            aValue = a.transaction_count || 0;
            bValue = b.transaction_count || 0;
            break;
          default:
            aValue = a.volume24h || 0;
            bValue = b.volume24h || 0;
        }

        if (filters.sort_order === 'desc') {
          return bValue - aValue;
        }
        return aValue - bValue;
      });
    } else {
      // Default sort by volume descending
      filtered.sort((a, b) => (b.volume24h || 0) - (a.volume24h || 0));
    }

    return filtered;
  }
  private paginateTokens(tokens: TokenData[], filters: FilterOptions): PaginatedResponse {
    const limit = filters.limit || 20;
    const cursor = filters.cursor ? parseInt(filters.cursor) : 0;
    
    const startIndex = cursor;
    const endIndex = startIndex + limit;
    const paginatedTokens = tokens.slice(startIndex, endIndex);
    
    return {
      tokens: paginatedTokens,
      next_cursor: endIndex < tokens.length ? endIndex.toString() : undefined,
      has_more: endIndex < tokens.length,
      total_count: tokens.length,
      timestamp: Date.now()
    };
  }
}