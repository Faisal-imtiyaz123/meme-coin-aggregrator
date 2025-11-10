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
        
        token = tokens.find(t => 
          t.token_address.toLowerCase() === address.toLowerCase()
        );
        
        if (!token) {
          res.status(404).json({ error: 'Token not found' });
          return;
        }
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

  async getStats(req: Request, res: Response): Promise<void> {
    try {
      const tokens = await this.cacheService.getTokens();
      
      if (!tokens || tokens.length === 0) {
        res.status(404).json({ error: 'No token data available' });
        return;
      }

      const stats = {
        total_tokens: tokens.length,
        total_volume_24h: tokens.reduce((sum, token) => sum + token.volume_sol, 0),
        total_liquidity: tokens.reduce((sum, token) => sum + token.liquidity_sol, 0),
        average_price_change_1h: tokens.reduce((sum, token) => sum + token.price_1hr_change, 0) / tokens.length,
        average_price_change_24h: tokens.reduce((sum, token) => sum + (token.price_24hr_change || 0), 0) / tokens.length,
        top_gainer_1h: tokens.reduce((max, token) => 
          token.price_1hr_change > max.price_1hr_change ? token : max
        ),
        top_loser_1h: tokens.reduce((min, token) => 
          token.price_1hr_change < min.price_1hr_change ? token : min
        ),
        highest_volume: tokens.reduce((max, token) => 
          token.volume_sol > max.volume_sol ? token : max
        ),
        last_updated: Math.max(...tokens.map(t => t.last_updated)),
        protocols: Array.from(new Set(tokens.map(t => t.protocol))).filter(Boolean)
      };

      res.json(stats);
    } catch (error) {
      logger.error('Error in getStats:', error);
      res.status(500).json({ 
        error: 'Failed to fetch stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private applyFilters(tokens: TokenData[], filters: FilterOptions): TokenData[] {
    let filtered = [...tokens];

    // Apply liquidity filter
    if (filters.min_liquidity) {
      filtered = filtered.filter(token => token.liquidity_sol >= filters.min_liquidity!);
    }

    // Apply volume filter
    if (filters.min_volume) {
      filtered = filtered.filter(token => token.volume_sol >= filters.min_volume!);
    }

    // Apply protocol filter
    if (filters.protocol) {
      filtered = filtered.filter(token => 
        token.protocol.toLowerCase().includes(filters.protocol!.toLowerCase())
      );
    }

    // Apply time period filter for price changes
    if (filters.time_period) {
      const priceChangeField = `price_${filters.time_period}_change` as keyof TokenData;
      filtered = filtered.filter(token => {
        const change = token[priceChangeField] as number;
        return change !== undefined && !isNaN(change);
      });
    }

    // Apply sorting
    if (filters.sort_by) {
      filtered.sort((a, b) => {
        let aValue: number, bValue: number;

        if (filters.sort_by === 'price_change') {
          const timePeriod = filters.time_period || '1h';
          const changeField = `price_${timePeriod}_change` as keyof TokenData;
          aValue = a[changeField] as number || 0;
          bValue = b[changeField] as number || 0;
        } else {
          aValue = a[filters.sort_by as keyof TokenData] as number;
          bValue = b[filters.sort_by as keyof TokenData] as number;
        }

        if (filters.sort_order === 'desc') {
          return bValue - aValue;
        }
        return aValue - aValue;
      });
    } else {
      // Default sort by volume descending
      filtered.sort((a, b) => b.volume_sol - a.volume_sol);
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