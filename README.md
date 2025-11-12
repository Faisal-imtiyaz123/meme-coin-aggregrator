# Real-time Meme Coin Aggregator 🚀

A high-performance real-time data aggregation service for meme coins across multiple DEX sources with WebSocket support.

## 🏗️ System Architecture

```mermaid
graph TB
    subgraph "Data Sources"
        DS[DexScreener API]
        CG[CoinGecko API]
    end
    
    subgraph "Application Layer"
        AS[API Server<br/>Express.js]
        WS[WebSocket Server<br/>Socket.IO]
    end
    
    subgraph "Core Services"
        DAS[Data Aggregator<br/>Fetch & Merge Data]
        CS[Cache Service<br/>Redis Client]
        TC[Token Controller<br/>Business Logic]
    end
    
    subgraph "External Clients"
        WC[Web Clients]
        MC[Mobile Apps]
        BC[Bots & Traders]
    end
    
    DS --> DAS
    CG --> DAS
    DAS --> CS
    CS --> TC
    TC --> AS
    TC --> WS
    AS --> WC
    AS --> MC
    AS --> BC
    WS --> WC
    WS --> MC
    
    style DAS fill:#e1f5fe
    style CS fill:#f3e5f5
    style AS fill:#e8f5e8
    style WS fill:#fff3e0