const ALPACA_PAPER_URL = "https://paper-api.alpaca.markets";
const ALPACA_DATA_URL = "https://data.alpaca.markets";

export interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  buying_power: string;
  cash: string;
  portfolio_value: string;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  transfers_blocked: boolean;
  account_blocked: boolean;
  created_at: string;
  shorting_enabled: boolean;
  equity: string;
  last_equity: string;
  multiplier: string;
  initial_margin: string;
  maintenance_margin: string;
  daytrade_count: number;
}

export interface AlpacaPosition {
  asset_id: string;
  symbol: string;
  exchange: string;
  asset_class: string;
  avg_entry_price: string;
  qty: string;
  side: string;
  market_value: string;
  cost_basis: string;
  unrealized_pl: string;
  unrealized_plpc: string;
  unrealized_intraday_pl: string;
  unrealized_intraday_plpc: string;
  current_price: string;
  lastday_price: string;
  change_today: string;
}

export interface AlpacaOrder {
  id: string;
  client_order_id: string;
  created_at: string;
  updated_at: string;
  submitted_at: string;
  filled_at: string | null;
  expired_at: string | null;
  canceled_at: string | null;
  failed_at: string | null;
  asset_id: string;
  symbol: string;
  asset_class: string;
  notional: string | null;
  qty: string;
  filled_qty: string;
  filled_avg_price: string | null;
  order_class: string;
  order_type: string;
  type: string;
  side: string;
  time_in_force: string;
  limit_price: string | null;
  stop_price: string | null;
  status: string;
  extended_hours: boolean;
  legs: AlpacaOrder[] | null;
}

export interface AlpacaAsset {
  id: string;
  class: string;
  exchange: string;
  symbol: string;
  name: string;
  status: string;
  tradable: boolean;
  marginable: boolean;
  shortable: boolean;
  easy_to_borrow: boolean;
  fractionable: boolean;
}

export interface AlpacaBar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
  n: number;
  vw: number;
}

export interface AlpacaBarsResponse {
  bars: { [symbol: string]: AlpacaBar[] };
  next_page_token: string | null;
}

export interface AlpacaQuote {
  ap: number;
  as: number;
  bp: number;
  bs: number;
  t: string;
}

export interface AlpacaSnapshot {
  latestTrade: {
    t: string;
    x: string;
    p: number;
    s: number;
    c: string[];
    i: number;
    z: string;
  };
  latestQuote: AlpacaQuote;
  minuteBar: AlpacaBar;
  dailyBar: AlpacaBar;
  prevDailyBar: AlpacaBar;
}

export interface CreateOrderParams {
  symbol: string;
  qty?: string;
  notional?: string;
  side: "buy" | "sell";
  type: "market" | "limit" | "stop" | "stop_limit" | "trailing_stop";
  time_in_force: "day" | "gtc" | "opg" | "cls" | "ioc" | "fok";
  limit_price?: string;
  stop_price?: string;
  client_order_id?: string;
  extended_hours?: boolean;
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class AlpacaConnector {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cacheDuration = 30 * 1000;
  private lastRequestTime = 0;
  private minRequestInterval = 200;

  private getCredentials(): { apiKey: string; secretKey: string } | null {
    const apiKey = process.env.ALPACA_API_KEY;
    const secretKey = process.env.ALPACA_SECRET_KEY;
    if (!apiKey || !secretKey) return null;
    return { apiKey, secretKey };
  }

  private async throttle(): Promise<void> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();
  }

  private getCached<T>(key: string): T | null {
    const entry = this.cache.get(key) as CacheEntry<T> | undefined;
    if (entry && Date.now() - entry.timestamp < this.cacheDuration) {
      return entry.data;
    }
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  private async fetchWithRetry<T>(
    url: string,
    options: RequestInit = {},
    retries = 3
  ): Promise<T> {
    const credentials = this.getCredentials();
    if (!credentials) {
      throw new Error("Alpaca API credentials not configured");
    }

    await this.throttle();

    const headers: Record<string, string> = {
      "APCA-API-KEY-ID": credentials.apiKey,
      "APCA-API-SECRET-KEY": credentials.secretKey,
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.headers as Record<string, string>),
    };

    for (let i = 0; i < retries; i++) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        if (response.status === 429) {
          const waitTime = Math.pow(2, i) * 1000;
          console.log(`Alpaca rate limited, waiting ${waitTime}ms...`);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
          continue;
        }

        if (!response.ok) {
          const errorBody = await response.text();
          throw new Error(`Alpaca API error: ${response.status} - ${errorBody}`);
        }

        const text = await response.text();
        if (!text) return {} as T;
        return JSON.parse(text) as T;
      } catch (error) {
        if (i === retries - 1) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000 * (i + 1)));
      }
    }

    throw new Error("Failed to fetch from Alpaca after retries");
  }

  async getAccount(): Promise<AlpacaAccount> {
    const cacheKey = "account";
    const cached = this.getCached<AlpacaAccount>(cacheKey);
    if (cached) return cached;

    const url = `${ALPACA_PAPER_URL}/v2/account`;
    const data = await this.fetchWithRetry<AlpacaAccount>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  async getPositions(): Promise<AlpacaPosition[]> {
    const cacheKey = "positions";
    const cached = this.getCached<AlpacaPosition[]>(cacheKey);
    if (cached) return cached;

    const url = `${ALPACA_PAPER_URL}/v2/positions`;
    const data = await this.fetchWithRetry<AlpacaPosition[]>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  async getPosition(symbol: string): Promise<AlpacaPosition | null> {
    try {
      const url = `${ALPACA_PAPER_URL}/v2/positions/${symbol.toUpperCase()}`;
      return await this.fetchWithRetry<AlpacaPosition>(url);
    } catch {
      return null;
    }
  }

  async closePosition(symbol: string): Promise<AlpacaOrder> {
    const url = `${ALPACA_PAPER_URL}/v2/positions/${symbol.toUpperCase()}`;
    return await this.fetchWithRetry<AlpacaOrder>(url, { method: "DELETE" });
  }

  async closeAllPositions(): Promise<AlpacaOrder[]> {
    const url = `${ALPACA_PAPER_URL}/v2/positions`;
    return await this.fetchWithRetry<AlpacaOrder[]>(url, { method: "DELETE" });
  }

  async createOrder(params: CreateOrderParams): Promise<AlpacaOrder> {
    const url = `${ALPACA_PAPER_URL}/v2/orders`;
    return await this.fetchWithRetry<AlpacaOrder>(url, {
      method: "POST",
      body: JSON.stringify(params),
    });
  }

  async getOrders(status: "open" | "closed" | "all" = "all", limit = 50): Promise<AlpacaOrder[]> {
    const cacheKey = `orders_${status}_${limit}`;
    const cached = this.getCached<AlpacaOrder[]>(cacheKey);
    if (cached) return cached;

    const url = `${ALPACA_PAPER_URL}/v2/orders?status=${status}&limit=${limit}`;
    const data = await this.fetchWithRetry<AlpacaOrder[]>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  async getOrder(orderId: string): Promise<AlpacaOrder> {
    const url = `${ALPACA_PAPER_URL}/v2/orders/${orderId}`;
    return await this.fetchWithRetry<AlpacaOrder>(url);
  }

  async cancelOrder(orderId: string): Promise<void> {
    const url = `${ALPACA_PAPER_URL}/v2/orders/${orderId}`;
    await this.fetchWithRetry<void>(url, { method: "DELETE" });
  }

  async cancelAllOrders(): Promise<void> {
    const url = `${ALPACA_PAPER_URL}/v2/orders`;
    await this.fetchWithRetry<void>(url, { method: "DELETE" });
  }

  async getAssets(
    status: "active" | "inactive" = "active",
    assetClass: "us_equity" | "crypto" = "us_equity"
  ): Promise<AlpacaAsset[]> {
    const cacheKey = `assets_${status}_${assetClass}`;
    const cached = this.getCached<AlpacaAsset[]>(cacheKey);
    if (cached) return cached;

    const url = `${ALPACA_PAPER_URL}/v2/assets?status=${status}&asset_class=${assetClass}`;
    const data = await this.fetchWithRetry<AlpacaAsset[]>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  async getAsset(symbol: string): Promise<AlpacaAsset> {
    const cacheKey = `asset_${symbol}`;
    const cached = this.getCached<AlpacaAsset>(cacheKey);
    if (cached) return cached;

    const url = `${ALPACA_PAPER_URL}/v2/assets/${symbol.toUpperCase()}`;
    const data = await this.fetchWithRetry<AlpacaAsset>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  async getBars(
    symbols: string[],
    timeframe: string = "1Day",
    start?: string,
    end?: string,
    limit = 100
  ): Promise<AlpacaBarsResponse> {
    const symbolsParam = symbols.join(",");
    const cacheKey = `bars_${symbolsParam}_${timeframe}_${start}_${end}`;
    const cached = this.getCached<AlpacaBarsResponse>(cacheKey);
    if (cached) return cached;

    let url = `${ALPACA_DATA_URL}/v2/stocks/bars?symbols=${symbolsParam}&timeframe=${timeframe}&limit=${limit}`;
    if (start) url += `&start=${start}`;
    if (end) url += `&end=${end}`;

    const data = await this.fetchWithRetry<AlpacaBarsResponse>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  async getSnapshots(symbols: string[]): Promise<{ [symbol: string]: AlpacaSnapshot }> {
    const symbolsParam = symbols.join(",");
    const cacheKey = `snapshots_${symbolsParam}`;
    const cached = this.getCached<{ [symbol: string]: AlpacaSnapshot }>(cacheKey);
    if (cached) return cached;

    const url = `${ALPACA_DATA_URL}/v2/stocks/snapshots?symbols=${symbolsParam}`;
    const data = await this.fetchWithRetry<{ [symbol: string]: AlpacaSnapshot }>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  async searchAssets(query: string): Promise<AlpacaAsset[]> {
    const assets = await this.getAssets("active", "us_equity");
    const lowerQuery = query.toLowerCase();
    return assets.filter(
      (asset) =>
        asset.symbol.toLowerCase().includes(lowerQuery) ||
        asset.name.toLowerCase().includes(lowerQuery)
    );
  }

  getConnectionStatus(): { connected: boolean; hasCredentials: boolean; cacheSize: number } {
    const credentials = this.getCredentials();
    return {
      connected: !!credentials,
      hasCredentials: !!credentials,
      cacheSize: this.cache.size,
    };
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const alpaca = new AlpacaConnector();
