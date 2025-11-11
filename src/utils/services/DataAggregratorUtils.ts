import { TokenData } from "../../types";

export function mapDexScreenerToken(dsToken: any): TokenData {
  const base = dsToken.baseToken || {};
  return {
    token_address: base.address?.toLowerCase() || '',
    token_name: base.name || 'Unknown',
    token_ticker: base.symbol || 'UNKNOWN',
    price: dsToken.priceUsd || 0,
    priceChange1h: dsToken.priceChange?.h1 || 0,
    priceChange6h: dsToken.priceChange?.h6 || 0,
    priceChange24h: dsToken.priceChange?.h24 || 0,
    priceChangePercentage24h: 0,
    marketCap: dsToken.fdv || 0,
    marketCapChange24h: 0,
    marketCapChangePercentage24h: 0,
    volume24h: dsToken.volume?.h24 || 0,
    circulatingSupply: 0,
    totalSupply: 0,
    liquidity: dsToken.liquidity?.usd || 0,
    high_24h: 0,
    low_24h: 0,
    transaction_count:
      (dsToken.txns?.h24?.buys || 0) + (dsToken.txns?.h24?.sells || 0),
    ath: 0,
    athChangePercentage: 0,
    athDate: '',
    atl: 0,
    atlChangePercentage: 0,
    atlDate: '',
    roi: null,
    dex: dsToken.dexId || 'Unknown',
    dexUrl: dsToken.url || '',
    image: dsToken.info?.imageUrl || '',
    rank: null,
    source: ['dexscreener'],
    lastUpdated: dsToken.pairCreatedAt || new Date().toISOString(),
    is_merged: false,
  };
}

export function mapCoinGeckoToken(cg: any): TokenData {
  return {
    token_address: cg.id,
    token_name: cg.name || 'Unknown',
    token_ticker: cg.symbol?.toUpperCase() || 'UNKNOWN',
    price: cg.current_price || 0,
    priceChange1h: 0,
    priceChange6h: 0,
    priceChange24h: cg.price_change_24h || 0,
    priceChangePercentage24h: cg.price_change_percentage_24h || 0,
    marketCap: cg.market_cap || 0,
    marketCapChange24h: cg.market_cap_change_24h || 0,
    marketCapChangePercentage24h: cg.market_cap_change_percentage_24h || 0,
    volume24h: cg.total_volume || 0,
    circulatingSupply: cg.circulating_supply || 0,
    totalSupply: cg.total_supply || 0,
    liquidity: 0,
    high_24h: cg.high_24h || 0,
    low_24h: cg.low_24h || 0,
    transaction_count: 0,
    ath: cg.ath || 0,
    athChangePercentage: cg.ath_change_percentage || 0,
    athDate: cg.ath_date || '',
    atl: cg.atl || 0,
    atlChangePercentage: cg.atl_change_percentage || 0,
    atlDate: cg.atl_date || '',
    roi: cg.roi || null,
    dex: 'Various',
    dexUrl: '',
    image: cg.image || '',
    rank: cg.market_cap_rank || null,
    source: ['coingecko'],
    lastUpdated: cg.last_updated || new Date().toISOString(),
    is_merged: false,
  };
}

export function mergeTokenData(a: TokenData, b: TokenData): TokenData {
  const dex = a.source.includes('dexscreener') ? a : b;
  const cg = a.source.includes('coingecko') ? a : b;

  return {
    token_address: dex.token_address || cg.token_address,
    token_name: dex.token_name || cg.token_name,
    token_ticker: dex.token_ticker || cg.token_ticker,
    price: dex.price || cg.price,
    priceChange1h: dex.priceChange1h,
    priceChange6h: dex.priceChange6h,
    priceChange24h: cg.priceChange24h || dex.priceChange24h,
    priceChangePercentage24h: cg.priceChangePercentage24h,
    marketCap: cg.marketCap || dex.marketCap,
    marketCapChange24h: cg.marketCapChange24h,
    marketCapChangePercentage24h: cg.marketCapChangePercentage24h,
    volume24h: dex.volume24h || cg.volume24h,
    circulatingSupply: cg.circulatingSupply,
    totalSupply: cg.totalSupply,
    liquidity: dex.liquidity,
    high_24h: cg.high_24h,
    low_24h: cg.low_24h,
    transaction_count: dex.transaction_count,
    ath: cg.ath,
    athChangePercentage: cg.athChangePercentage,
    athDate: cg.athDate,
    atl: cg.atl,
    atlChangePercentage: cg.atlChangePercentage,
    atlDate: cg.atlDate,
    roi: cg.roi,
    dex: dex.dex,
    dexUrl: dex.dexUrl,
    image: dex.image || cg.image,
    rank: cg.rank,
    source: [...new Set([...a.source, ...b.source])],
    lastUpdated: new Date().toISOString(),
    is_merged: true,
  };
}

export const validToken = (t: TokenData) =>
  !!t && t.token_address.length > 0 && t.price > 0;
