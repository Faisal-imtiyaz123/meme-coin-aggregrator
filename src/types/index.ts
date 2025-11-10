// src/types/index.ts
export interface TokenData {
  // Basic Identification
  token_address: string;
  token_name: string;
  token_ticker: string;
  
  // Price Data
  price: number;  // Changed from price_sol to price (in USD)
  priceChange1h: number;
  priceChange6h: number;
  priceChange24h: number;
  priceChangePercentage24h: number;
  
  // Market Data
  marketCap: number;  // Changed from market_cap_sol
  marketCapChange24h: number;
  marketCapChangePercentage24h: number;
  volume24h: number;  // Changed from volume_sol
  
  // Supply Data
  circulatingSupply: number;
  totalSupply: number;
  
  // Additional Metrics
  liquidity: number;  // Changed from liquidity_sol
  high_24h: number;
  low_24h: number;
  transaction_count: number;
  
  // Historical Data
  ath: number;
  athChangePercentage: number;
  athDate: string;
  atl: number;
  atlChangePercentage: number;
  atlDate: string;
  roi: number | null;
  
  // Source & Metadata
  dex: string;        // Changed from protocol
  dexUrl: string;
  image: string;
  rank: number | null;
  source: string[];   // Keep as array
  lastUpdated: string; // Changed from number to string
  is_merged?: boolean;
}

// Keep other interfaces the same...
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