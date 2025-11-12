cat > README.md << 'EOF'
# Real-time Meme Coin Aggregator 🚀

A high-performance real-time data aggregation service for meme coins across multiple DEX sources with WebSocket support.

## 🏗️ System Architecture

```mermaid
graph TB
    subgraph "External Data Sources"
        DS[DexScreener API]
        CG[CoinGecko API]
    end
    
    subgraph "Core Services"
        DAS[DataAggregatorService]
        CS[CacheService]
        WS[WebSocketService]
        TC[TokenController]
    end
    
    subgraph "Data Flow"
        DS --> DAS
        CG --> DAS
        DAS --> CS
        CS --> TC
        CS --> WS
    end
    
    subgraph "API Layer"
        TC --> API1[/api/tokens]
        TC --> API2[/api/tokens/:address]
        TC --> API3[/api/stats]
        TC --> API4[/api/tokens/search]
    end
    
    subgraph "Real-time Updates"
        WS --> WSC[WebSocket Clients]
    end
    
    subgraph "Cache Layer"
        Redis[(Redis Cache)]
        CS --> Redis
    end

    style DAS fill:#e1f5fe
    style CS fill:#f3e5f5
    style WS fill:#e8f5e8
    style TC fill:#fff3e0sequenceDiagram
    participant Client
    participant API as REST API
    participant TC as TokenController
    participant CS as CacheService
    participant DAS as DataAggregatorService
    participant DS as DexScreener
    participant CG as CoinGecko
    participant WS as WebSocketService
    participant Redis as Redis Cache

    Client->>API: GET /api/tokens
    API->>TC: Handle Request
    TC->>CS: getTokens()
    CS->>Redis: GET tokens:all
    
    alt Cache Hit
        Redis-->>CS: Return cached data
        CS-->>TC: Return tokens
        TC-->>API: Return response
        API-->>Client: 200 OK with tokens
    else Cache Miss
        Redis-->>CS: Cache miss (null)
        CS-->>TC: Cache miss
        TC->>DAS: getAllTokens()
        DAS->>DS: fetchFromDexScreener()
        DAS->>CG: fetchFromCoinGecko()
        DS-->>DAS: Return tokens
        CG-->>DAS: Return tokens
        DAS->>DAS: mergeTokens()
        DAS-->>TC: Return merged tokens
        TC->>CS: setTokens(tokens)
        CS->>Redis: SETEX tokens:all
        TC-->>API: Return response
        API-->>Client: 200 OK with tokens
    end
    
    Note over DAS,WS: Background Updates Every 10s
    loop Background Updates
        DAS->>DS: Periodic fetch
        DAS->>CG: Periodic fetch
        DAS->>DAS: Merge & detect changes
        DAS->>CS: Update cache
        CS->>WS: Broadcast updates
        WS->>Client: Real-time WebSocket updates
    endclassDiagram
    class TokenController {
        -cacheService: CacheService
        -dataAggregator: DataAggregatorService
        +getTokens()
        +getTokenByAddress()
        +getStats()
        +searchTokens()
        -applyFilters()
        -paginateTokens()
    }
    
    class DataAggregatorService {
        -rateLimiter: APIRateLimiter
        +fetchFromDexScreener()
        +fetchFromCoinGecko()
        +getAllTokens()
        +mergeTokens()
        -detectSignificantChanges()
    }
    
    class CacheService {
        -redis: Redis
        +setTokens()
        +getTokens()
        +getToken()
        +setKey()
        +getKey()
        -setupEventListeners()
    }
    
    class WebSocketService {
        -io: SocketIOServer
        -cacheService: CacheService
        +broadcastTokenUpdate()
        +broadcastPriceChange()
        +broadcastVolumeSpike()
        -setupSocketHandlers()
    }
    
    class TokenData {
        +token_address: string
        +token_name: string
        +token_ticker: string
        +price: number
        +volume24h: number
        +marketCap: number
        +liquidity: number
        +priceChange1h: number
        +priceChange24h: number
        +source: string[]
        +dex: string
        +lastUpdated: string
    }

    TokenController --> CacheService
    TokenController --> DataAggregatorService
    DataAggregatorService --> TokenData
    WebSocketService --> CacheService
    CacheService --> TokenDatagraph LR
    subgraph "REST API Endpoints"
        A1[GET /api/tokens] --> F1[Filtering<br/>Sorting<br/>Pagination]
        A2[GET /api/tokens/:address] --> F2[Token Details<br/>by Address]
        A3[GET /api/stats] --> F3[Aggregated<br/>Statistics]
        A4[GET /api/tokens/search] --> F4[Search by<br/>Name/Ticker/Address]
        A5[GET /health] --> F5[Health Check<br/>& System Status]
    end
    
    subgraph "WebSocket Events"
        W1[token_updates] --> E1[Batch Token Updates]
        W2[price_alert] --> E2[Significant Price Changes]
        W3[volume_alert] --> E3[Volume Spikes]
        W4[subscribed_token_update] --> E4[Updates for<br/>Subscribed Tokens]
    end
    
    subgraph "Query Parameters"
        Q1[time_period] --> P1[1h, 24h, 7d]
        Q2[sort_by] --> P2[volume, price_change,<br/>market_cap, liquidity]
        Q3[min_liquidity] --> P3[Liquidity Filter]
        Q4[min_volume] --> P4[Volume Filter]
        Q5[limit] --> P5[Pagination Limit]
        Q6[cursor] --> P6[Pagination Cursor]
    endgraph TB
    subgraph "Cache Keys"
        K1[tokens:all] --> V1[All merged tokens<br/>TTL: 30s]
        K2[token:address] --> V2[Individual tokens<br/>TTL: 30s]
    end
    
    subgraph "Cache Operations"
        O1[Read-Through Cache] --> D1[Check cache first<br/>Fetch if miss]
        O2[Write-Through Cache] --> D2[Update cache on<br/>data refresh]
        O3[Background Refresh] --> D3[Auto-update every 10s]
    endgraph LR
    subgraph "DexScreener API"
        DS1[Search Endpoint] --> F1[Real-time DEX data]
        DS2[Token Pairs] --> F2[Price, Volume, Liquidity]
        DS3[Trending Tokens] --> F3[New/Meme coins]
    end
    
    subgraph "CoinGecko API"
        CG1[Markets Endpoint] --> G1[Market data]
        CG2[Solana Ecosystem] --> G2[Established tokens]
        CG3[Historical Data] --> G3[ATH, ATL, ROI]
    end
    
    subgraph "Data Merging"
        M1[Address Matching] --> R1[Primary merge key]
        M2[Name+Ticker] --> R2[Fallback matching]
        M3[Smart Field Selection] --> R3[DexScreener for real-time<br/>CoinGecko for market data]
    end