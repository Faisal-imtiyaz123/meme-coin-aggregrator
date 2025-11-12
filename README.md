# Real-time Meme Coin Aggregator 🚀

A high-performance real-time data aggregation service for meme coins across multiple DEX sources.

## 🏗️ System Architecture

```mermaid
graph TB
    subgraph "External APIs"
        DS[DexScreener API]
        CG[CoinGecko API]
    end
    
    subgraph "Core Services"
        DAS[Data Aggregation Service<br/>Fetches & merges data from APIs]
        CS[Cache Service<br/>Redis-based caching layer]
        WS[WebSocket Service<br/>Real-time updates]
    end
    
    subgraph "API Clients"
        WC[Web Clients]
        MC[Mobile Apps]
        API[REST API]
    end
    
    DS --> DAS
    CG --> DAS
    DAS --> CS
    CS --> WS
    CS --> API
    API --> WC
    API --> MC
    WS --> WC
    WS --> MC
    
    style DAS fill:#e1f5fe
    style CS fill:#f3e5f5
    style WS fill:#e8f5e8