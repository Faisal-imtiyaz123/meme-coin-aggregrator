// src/types/index.ts
export interface TokenData {
  token_address: string;
  token_name: string;
  token_ticker: string;
  price_sol: number;
  market_cap_sol: number;
  volume_sol: number;
  liquidity_sol: number;
  transaction_count: number;
  price_1hr_change: number;
  price_24hr_change?: number;
  price_7d_change?: number;
  protocol: string;
  dex_url?: string;
  source: string[];
  last_updated: number;
  is_merged?: boolean;
}

export interface PaginatedResponse {
  tokens: TokenData[];
  next_cursor?: string;
  has_more: boolean;
  total_count: number;
  timestamp: number;
}

export interface FilterOptions {
  time_period?: '1h' | '24h' | '7d';
  sort_by?: 'volume' | 'price_change' | 'market_cap' | 'liquidity' | 'transaction_count';
  sort_order?: 'asc' | 'desc';
  min_liquidity?: number;
  min_volume?: number;
  protocol?: string;
  limit?: number;
  cursor?: string;
}

export interface WebSocketMessage {
  type: 'initial_data' | 'price_update' | 'volume_spike' | 'token_update' | 'batch_update';
  data: any;
  timestamp: number;
}

export interface CacheConfig {
  ttl: number;
  key: string;
}