import { log } from "../utils/logger";

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
  qty_available: string;
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

export interface AlpacaClock {
  timestamp: string;
  is_open: boolean;
  next_open: string;
  next_close: string;
}

export interface MarketStatus {
  isOpen: boolean;
  isPreMarket: boolean;
  isAfterHours: boolean;
  isExtendedHours: boolean;
  currentTime: string;
  nextOpen: string;
  nextClose: string;
  session: "pre-market" | "regular" | "after-hours" | "closed";
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
  order_class?: "simple" | "bracket" | "oco" | "oto";
  take_profit?: { limit_price: string };
  stop_loss?: { stop_price: string; limit_price?: string };
  trail_percent?: string;
  trail_price?: string;
}

export interface BracketOrderParams {
  symbol: string;
  qty: string;
  side: "buy" | "sell";
  type?: "market" | "limit";
  time_in_force?: "day" | "gtc";
  limit_price?: string;
  take_profit_price: string;
  stop_loss_price: string;
  stop_loss_limit_price?: string;
}

export interface TrailingStopOrderParams {
  symbol: string;
  qty: string;
  side: "buy" | "sell";
  trail_percent?: number;
  trail_price?: number;
  time_in_force?: "day" | "gtc";
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

class AlpacaConnector {
  private cache: Map<string, CacheEntry<unknown>> = new Map();
  private cacheDuration = 30 * 1000;
  private lastRequestTime = 0;
  private minRequestInterval = 350;
  private requestQueue: Promise<void> = Promise.resolve();
  private activeRequests = 0;
  private maxConcurrentRequests = 3;

  private getCredentials(): { apiKey: string; secretKey: string } | null {
    const apiKey = process.env.ALPACA_API_KEY;
    const secretKey = process.env.ALPACA_SECRET_KEY;
    if (!apiKey || !secretKey) return null;
    return { apiKey, secretKey };
  }

  private async throttle(): Promise<void> {
    while (this.activeRequests >= this.maxConcurrentRequests) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    this.activeRequests++;
    
    const executeThrottle = async () => {
      const now = Date.now();
      const timeSinceLastRequest = now - this.lastRequestTime;
      if (timeSinceLastRequest < this.minRequestInterval) {
        await new Promise((resolve) =>
          setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
        );
      }
      this.lastRequestTime = Date.now();
    };
    
    this.requestQueue = this.requestQueue.then(executeThrottle);
    await this.requestQueue;
  }
  
  private releaseThrottle(): void {
    this.activeRequests = Math.max(0, this.activeRequests - 1);
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
    retries = 5
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

    try {
      for (let i = 0; i < retries; i++) {
        try {
          const response = await fetch(url, {
            ...options,
            headers,
          });

          if (response.status === 429) {
            const waitTime = Math.min(Math.pow(2, i + 1) * 1000, 16000);
            log.warn("Alpaca", `Rate limited, waiting ${waitTime}ms (attempt ${i + 1}/${retries})`);
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
          const waitTime = Math.min(1000 * Math.pow(2, i), 8000);
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }

      throw new Error("Failed to fetch from Alpaca after retries");
    } finally {
      this.releaseThrottle();
    }
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

  async createBracketOrder(params: BracketOrderParams): Promise<AlpacaOrder> {
    // CRITICAL: Alpaca requires time_in_force: "day" for bracket orders
    // Using "gtc" will result in 422 rejection from the API
    const orderParams: CreateOrderParams = {
      symbol: params.symbol,
      qty: params.qty,
      side: params.side,
      type: params.type || "market",
      time_in_force: "day", // MUST be "day" for bracket orders per Alpaca API requirements
      order_class: "bracket",
      take_profit: {
        limit_price: params.take_profit_price,
      },
      stop_loss: {
        stop_price: params.stop_loss_price,
        limit_price: params.stop_loss_limit_price,
      },
    };

    if (params.limit_price) {
      orderParams.limit_price = params.limit_price;
    }

    log.info("Alpaca", `Creating bracket order for ${params.symbol}: TP=${params.take_profit_price}, SL=${params.stop_loss_price}, TIF=day`);
    try {
      const order = await this.createOrder(orderParams);
      log.info("Alpaca", `Bracket order created successfully for ${params.symbol}`, { orderId: order.id, status: order.status });
      return order;
    } catch (error) {
      log.error("Alpaca", `Bracket order FAILED for ${params.symbol}: ${(error as Error).message}`);
      throw error;
    }
  }

  async createTrailingStopOrder(params: TrailingStopOrderParams): Promise<AlpacaOrder> {
    const orderParams: CreateOrderParams = {
      symbol: params.symbol,
      qty: params.qty,
      side: params.side,
      type: "trailing_stop",
      time_in_force: params.time_in_force || "gtc",
    };

    if (params.trail_percent !== undefined) {
      orderParams.trail_percent = params.trail_percent.toString();
    } else if (params.trail_price !== undefined) {
      orderParams.trail_price = params.trail_price.toString();
    } else {
      orderParams.trail_percent = "2";
    }

    log.debug("Alpaca", `Creating trailing stop order for ${params.symbol}: trail=${params.trail_percent || params.trail_price}`);
    return this.createOrder(orderParams);
  }

  async createStopLossOrder(
    symbol: string,
    qty: string,
    stopPrice: string,
    limitPrice?: string
  ): Promise<AlpacaOrder> {
    const orderParams: CreateOrderParams = {
      symbol,
      qty,
      side: "sell",
      type: limitPrice ? "stop_limit" : "stop",
      time_in_force: "gtc",
      stop_price: stopPrice,
    };

    if (limitPrice) {
      orderParams.limit_price = limitPrice;
    }

    log.debug("Alpaca", `Creating stop loss order for ${symbol} at $${stopPrice}`);
    return this.createOrder(orderParams);
  }

  async createTakeProfitOrder(
    symbol: string,
    qty: string,
    limitPrice: string
  ): Promise<AlpacaOrder> {
    const orderParams: CreateOrderParams = {
      symbol,
      qty,
      side: "sell",
      type: "limit",
      time_in_force: "gtc",
      limit_price: limitPrice,
    };

    log.debug("Alpaca", `Creating take profit order for ${symbol} at $${limitPrice}`);
    return this.createOrder(orderParams);
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
    limit = 100,
    pageToken?: string
  ): Promise<AlpacaBarsResponse> {
    const symbolsParam = symbols.join(",");
    
    if (!pageToken) {
      const cacheKey = `bars_${symbolsParam}_${timeframe}_${start}_${end}`;
      const cached = this.getCached<AlpacaBarsResponse>(cacheKey);
      if (cached) return cached;
    }

    let url = `${ALPACA_DATA_URL}/v2/stocks/bars?symbols=${symbolsParam}&timeframe=${timeframe}&limit=${limit}&feed=iex`;
    if (start) url += `&start=${start}`;
    if (end) url += `&end=${end}`;
    if (pageToken) url += `&page_token=${pageToken}`;

    const data = await this.fetchWithRetry<AlpacaBarsResponse>(url);
    
    if (!pageToken) {
      const cacheKey = `bars_${symbolsParam}_${timeframe}_${start}_${end}`;
      this.setCache(cacheKey, data);
    }
    return data;
  }

  async getSnapshots(symbols: string[]): Promise<{ [symbol: string]: AlpacaSnapshot }> {
    const symbolsParam = symbols.join(",");
    const cacheKey = `snapshots_${symbolsParam}`;
    const cached = this.getCached<{ [symbol: string]: AlpacaSnapshot }>(cacheKey);
    if (cached) return cached;

    const url = `${ALPACA_DATA_URL}/v2/stocks/snapshots?symbols=${symbolsParam}&feed=iex`;
    const data = await this.fetchWithRetry<{ [symbol: string]: AlpacaSnapshot }>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  async getCryptoSnapshots(symbols: string[]): Promise<{ [symbol: string]: AlpacaSnapshot }> {
    const symbolsParam = symbols.join(",");
    const cacheKey = `crypto_snapshots_${symbolsParam}`;
    const cached = this.getCached<{ [symbol: string]: AlpacaSnapshot }>(cacheKey);
    if (cached) return cached;

    const url = `${ALPACA_DATA_URL}/v1beta3/crypto/us/snapshots?symbols=${symbolsParam}`;
    
    interface CryptoSnapshotResponse {
      snapshots: { 
        [symbol: string]: {
          dailyBar?: AlpacaBar;
          prevDailyBar?: AlpacaBar;
          latestTrade?: { p: number; s: number; t: string };
          latestQuote?: AlpacaQuote;
          minuteBar?: AlpacaBar;
        } 
      };
    }
    
    const response = await this.fetchWithRetry<CryptoSnapshotResponse>(url);
    
    const result: { [symbol: string]: AlpacaSnapshot } = {};
    for (const [symbol, snapshot] of Object.entries(response.snapshots || {})) {
      result[symbol] = {
        latestTrade: {
          t: snapshot.latestTrade?.t || "",
          x: "CBSE",
          p: snapshot.latestTrade?.p || 0,
          s: snapshot.latestTrade?.s || 0,
          c: [],
          i: 0,
          z: "",
        },
        latestQuote: snapshot.latestQuote || { ap: 0, as: 0, bp: 0, bs: 0, t: "" },
        minuteBar: snapshot.minuteBar || { t: "", o: 0, h: 0, l: 0, c: 0, v: 0, n: 0, vw: 0 },
        dailyBar: snapshot.dailyBar || { t: "", o: 0, h: 0, l: 0, c: 0, v: 0, n: 0, vw: 0 },
        prevDailyBar: snapshot.prevDailyBar || { t: "", o: 0, h: 0, l: 0, c: 0, v: 0, n: 0, vw: 0 },
      };
    }
    
    this.setCache(cacheKey, result);
    return result;
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

  async getClock(): Promise<AlpacaClock> {
    const cacheKey = "clock";
    const cached = this.getCached<AlpacaClock>(cacheKey);
    if (cached) return cached;

    const url = `${ALPACA_PAPER_URL}/v2/clock`;
    const data = await this.fetchWithRetry<AlpacaClock>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  async getMarketStatus(): Promise<MarketStatus> {
    const clock = await this.getClock();
    const now = new Date(clock.timestamp);
    const nextOpen = new Date(clock.next_open);
    const nextClose = new Date(clock.next_close);
    
    const etHour = parseInt(
      now.toLocaleString("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false })
    );
    const etMinute = parseInt(
      now.toLocaleString("en-US", { timeZone: "America/New_York", minute: "2-digit" })
    );
    const etTime = etHour * 60 + etMinute;
    
    const preMarketStart = 4 * 60;
    const marketOpen = 9 * 60 + 30;
    const marketClose = 16 * 60;
    const afterHoursEnd = 20 * 60;
    
    const isWeekday = now.getDay() >= 1 && now.getDay() <= 5;
    const isPreMarket = isWeekday && etTime >= preMarketStart && etTime < marketOpen;
    const isRegularHours = clock.is_open;
    const isAfterHours = isWeekday && etTime >= marketClose && etTime < afterHoursEnd;
    const isExtendedHours = isPreMarket || isAfterHours;
    
    let session: "pre-market" | "regular" | "after-hours" | "closed";
    if (isRegularHours) {
      session = "regular";
    } else if (isPreMarket) {
      session = "pre-market";
    } else if (isAfterHours) {
      session = "after-hours";
    } else {
      session = "closed";
    }
    
    return {
      isOpen: clock.is_open,
      isPreMarket,
      isAfterHours,
      isExtendedHours,
      currentTime: clock.timestamp,
      nextOpen: clock.next_open,
      nextClose: clock.next_close,
      session,
    };
  }

  async healthCheck(): Promise<HealthCheckResult> {
    const result: HealthCheckResult = {
      overall: "unhealthy",
      timestamp: new Date().toISOString(),
      endpoints: {
        account: { status: "unknown", latencyMs: 0 },
        positions: { status: "unknown", latencyMs: 0 },
        orders: { status: "unknown", latencyMs: 0 },
        marketData: { status: "unknown", latencyMs: 0 },
      },
      account: null,
    };

    const credentials = this.getCredentials();
    if (!credentials) {
      result.endpoints.account.status = "error";
      result.endpoints.account.error = "API credentials not configured";
      return result;
    }

    const checkEndpoint = async (
      name: keyof typeof result.endpoints,
      fn: () => Promise<unknown>
    ) => {
      const start = Date.now();
      try {
        await fn();
        result.endpoints[name].status = "healthy";
        result.endpoints[name].latencyMs = Date.now() - start;
      } catch (error) {
        result.endpoints[name].status = "error";
        result.endpoints[name].latencyMs = Date.now() - start;
        result.endpoints[name].error = error instanceof Error ? error.message : "Unknown error";
      }
    };

    await checkEndpoint("account", async () => {
      const account = await this.getAccount();
      result.account = {
        id: account.id,
        status: account.status,
        currency: account.currency,
        buyingPower: account.buying_power,
        portfolioValue: account.portfolio_value,
        cash: account.cash,
        equity: account.equity,
        tradingBlocked: account.trading_blocked,
      };
    });

    await Promise.all([
      checkEndpoint("positions", () => this.getPositions()),
      checkEndpoint("orders", () => this.getOrders("open", 1)),
      checkEndpoint("marketData", () => this.getSnapshots(["AAPL"])),
    ]);

    const healthyCount = Object.values(result.endpoints).filter(
      (e) => e.status === "healthy"
    ).length;
    const total = Object.keys(result.endpoints).length;

    if (healthyCount === total) {
      result.overall = "healthy";
    } else if (healthyCount > 0) {
      result.overall = "degraded";
    } else {
      result.overall = "unhealthy";
    }

    return result;
  }

  async getPortfolioHistory(
    period: string = "1M",
    timeframe: string = "1D"
  ): Promise<PortfolioHistory> {
    const cacheKey = `portfolio_history_${period}_${timeframe}`;
    const cached = this.getCached<PortfolioHistory>(cacheKey);
    if (cached) return cached;

    const url = `${ALPACA_PAPER_URL}/v2/account/portfolio/history?period=${period}&timeframe=${timeframe}`;
    const data = await this.fetchWithRetry<PortfolioHistory>(url);
    this.setCache(cacheKey, data);
    return data;
  }

  async getTopStocks(limit: number = 25): Promise<TopAsset[]> {
    const cacheKey = `top_stocks_${limit}`;
    const cached = this.getCached<TopAsset[]>(cacheKey);
    if (cached) return cached;

    const assets = await this.getAssets("active", "us_equity");
    const tradableAssets = assets
      .filter((a) => a.tradable && a.fractionable)
      .slice(0, 100);

    const symbols = tradableAssets.slice(0, 50).map((a) => a.symbol);
    let snapshots: { [symbol: string]: AlpacaSnapshot } = {};
    
    try {
      snapshots = await this.getSnapshots(symbols);
    } catch {
      snapshots = {};
    }

    const result: TopAsset[] = tradableAssets
      .map((asset) => {
        const snapshot = snapshots[asset.symbol];
        const price = snapshot?.dailyBar?.c ?? snapshot?.latestTrade?.p ?? 0;
        const prevClose = snapshot?.prevDailyBar?.c ?? price;
        const change = price && prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
        const volume = snapshot?.dailyBar?.v ?? 0;
        
        return {
          symbol: asset.symbol,
          name: asset.name,
          price,
          change,
          volume,
          tradable: asset.tradable,
          fractionable: asset.fractionable,
          assetClass: "us_equity" as const,
        };
      })
      .filter((a) => a.price > 0)
      .sort((a, b) => b.volume - a.volume)
      .slice(0, limit);

    this.setCache(cacheKey, result);
    return result;
  }

  async getTopCrypto(limit: number = 25): Promise<TopAsset[]> {
    const cacheKey = `top_crypto_${limit}`;
    const cached = this.getCached<TopAsset[]>(cacheKey);
    if (cached) return cached;

    const assets = await this.getAssets("active", "crypto");
    const tradableAssets = assets.filter((a) => a.tradable).slice(0, limit * 2);

    const symbols = tradableAssets.map((a) => a.symbol);
    
    interface CryptoSnapshot {
      dailyBar?: AlpacaBar;
      prevDailyBar?: AlpacaBar;
      latestTrade?: { p: number };
    }
    
    let cryptoSnapshots: { snapshots: { [symbol: string]: CryptoSnapshot } } = { snapshots: {} };
    
    try {
      const url = `${ALPACA_DATA_URL}/v1beta3/crypto/us/snapshots?symbols=${symbols.join(",")}`;
      cryptoSnapshots = await this.fetchWithRetry<{ snapshots: { [symbol: string]: CryptoSnapshot } }>(url);
    } catch {
      cryptoSnapshots = { snapshots: {} };
    }

    const result: TopAsset[] = tradableAssets.map((asset) => {
      const snapshot = cryptoSnapshots.snapshots?.[asset.symbol];
      const price = snapshot?.dailyBar?.c ?? snapshot?.latestTrade?.p ?? 0;
      const prevClose = snapshot?.prevDailyBar?.c ?? price;
      const change = price && prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
      const volume = snapshot?.dailyBar?.v ?? 0;

      return {
        symbol: asset.symbol,
        name: asset.name,
        price,
        change,
        volume,
        tradable: asset.tradable,
        fractionable: asset.fractionable,
        assetClass: "crypto" as const,
      };
    })
    .filter((a) => a.price > 0)
    .sort((a, b) => b.volume - a.volume)
    .slice(0, limit);

    this.setCache(cacheKey, result);
    return result;
  }

  async getTopETFs(limit: number = 25): Promise<TopAsset[]> {
    const cacheKey = `top_etfs_${limit}`;
    const cached = this.getCached<TopAsset[]>(cacheKey);
    if (cached) return cached;

    const popularETFs: { symbol: string; name: string }[] = [
      { symbol: "SPY", name: "S&P 500 ETF" },
      { symbol: "QQQ", name: "Nasdaq 100 ETF" },
      { symbol: "IWM", name: "Russell 2000 ETF" },
      { symbol: "DIA", name: "Dow Jones ETF" },
      { symbol: "VTI", name: "Total Stock Market" },
      { symbol: "VOO", name: "Vanguard S&P 500" },
      { symbol: "VEA", name: "Developed Markets" },
      { symbol: "VWO", name: "Emerging Markets" },
      { symbol: "EFA", name: "EAFE Index ETF" },
      { symbol: "EEM", name: "Emerging Mkts ETF" },
      { symbol: "GLD", name: "Gold Trust" },
      { symbol: "SLV", name: "Silver Trust" },
      { symbol: "USO", name: "US Oil Fund" },
      { symbol: "TLT", name: "20+ Year Treasury" },
      { symbol: "IEF", name: "7-10 Year Treasury" },
      { symbol: "LQD", name: "Investment Grade Corp" },
      { symbol: "HYG", name: "High Yield Corporate" },
      { symbol: "XLF", name: "Financial Sector" },
      { symbol: "XLK", name: "Technology Sector" },
      { symbol: "XLE", name: "Energy Sector" },
      { symbol: "XLV", name: "Healthcare Sector" },
      { symbol: "XLI", name: "Industrial Sector" },
      { symbol: "XLY", name: "Consumer Discretionary" },
      { symbol: "XLP", name: "Consumer Staples" },
      { symbol: "XLU", name: "Utilities Sector" },
    ];

    const etfList = popularETFs.slice(0, limit);
    const symbols = etfList.map((e) => e.symbol);
    let snapshots: { [symbol: string]: AlpacaSnapshot } = {};

    try {
      snapshots = await this.getSnapshots(symbols);
    } catch {
      snapshots = {};
    }

    const result: TopAsset[] = etfList.map((etf) => {
      const snapshot = snapshots[etf.symbol];
      const price = snapshot?.dailyBar?.c ?? snapshot?.latestTrade?.p ?? 0;
      const prevClose = snapshot?.prevDailyBar?.c ?? price;
      const change = price && prevClose ? ((price - prevClose) / prevClose) * 100 : 0;
      const volume = snapshot?.dailyBar?.v ?? 0;

      return {
        symbol: etf.symbol,
        name: etf.name,
        price,
        change,
        volume,
        tradable: true,
        fractionable: true,
        assetClass: "us_equity" as const,
      };
    })
    .filter((a) => a.price > 0)
    .sort((a, b) => b.volume - a.volume);

    this.setCache(cacheKey, result);
    return result;
  }

  validateOrder(params: CreateOrderParams): OrderValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const adjustments: { field: string; from: unknown; to: unknown; reason: string }[] = [];

    if (!params.symbol || params.symbol.trim() === "") {
      errors.push("Symbol is required");
    }

    if (!params.qty && !params.notional) {
      errors.push("Either qty or notional is required");
    }

    if (params.qty && params.notional) {
      warnings.push("Both qty and notional provided - qty takes precedence");
    }

    if (params.qty) {
      const qty = parseFloat(params.qty);
      if (isNaN(qty) || qty <= 0) {
        errors.push("Quantity must be a positive number");
      }
    }

    if (params.notional) {
      const notional = parseFloat(params.notional);
      if (isNaN(notional) || notional <= 0) {
        errors.push("Notional value must be positive");
      }
      if (notional < 1) {
        errors.push("Minimum order value is $1");
      }
    }

    if (params.type === "limit" && !params.limit_price) {
      errors.push("Limit price required for limit orders");
    }

    if (params.type === "stop" && !params.stop_price) {
      errors.push("Stop price required for stop orders");
    }

    if (params.type === "stop_limit" && (!params.limit_price || !params.stop_price)) {
      errors.push("Both limit and stop prices required for stop-limit orders");
    }

    const normalizedParams = { ...params };
    normalizedParams.symbol = params.symbol?.toUpperCase().trim();

    if (params.type === "market" && params.time_in_force === "gtc") {
      adjustments.push({
        field: "time_in_force",
        from: "gtc",
        to: "day",
        reason: "Market orders cannot be GTC",
      });
      normalizedParams.time_in_force = "day";
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      adjustments,
      normalizedParams,
    };
  }
}

export interface HealthCheckResult {
  overall: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  endpoints: {
    account: EndpointStatus;
    positions: EndpointStatus;
    orders: EndpointStatus;
    marketData: EndpointStatus;
  };
  account: {
    id: string;
    status: string;
    currency: string;
    buyingPower: string;
    portfolioValue: string;
    cash: string;
    equity: string;
    tradingBlocked: boolean;
  } | null;
}

interface EndpointStatus {
  status: "healthy" | "error" | "unknown";
  latencyMs: number;
  error?: string;
}

export interface PortfolioHistory {
  timestamp: number[];
  equity: number[];
  profit_loss: number[];
  profit_loss_pct: number[];
  base_value: number;
  timeframe: string;
}

export interface TopAsset {
  symbol: string;
  name: string;
  price: number;
  change: number;
  volume: number;
  tradable: boolean;
  fractionable: boolean;
  assetClass: "us_equity" | "crypto";
}

export interface OrderValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  adjustments: { field: string; from: unknown; to: unknown; reason: string }[];
  normalizedParams: CreateOrderParams;
}

export const alpaca = new AlpacaConnector();
