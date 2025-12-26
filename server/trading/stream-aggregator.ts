/**
 * Multi-Source Stream Aggregator
 *
 * Combines multiple Alpaca data streams into a unified event bus:
 * - Trade Updates (order status)
 * - Stock Trades, Quotes, Bars
 * - Crypto Trades, Quotes, Bars
 * - News Headlines
 *
 * Provides typed events with prioritized callbacks for:
 * - Decision Engine (news, quotes)
 * - Risk Manager (trade updates, price changes)
 * - Signal Generator (bars, technicals)
 */

import WebSocket from "ws";
import { log } from "../utils/logger";
import { EventEmitter } from "events";
import { tradingConfig } from "../config/trading-config";

// ============================================================================
// STREAM EVENT TYPES
// ============================================================================

export enum StreamType {
  STOCK_TRADE = "stock_trade",
  STOCK_QUOTE = "stock_quote",
  STOCK_BAR = "stock_bar",
  CRYPTO_TRADE = "crypto_trade",
  CRYPTO_QUOTE = "crypto_quote",
  CRYPTO_BAR = "crypto_bar",
  NEWS = "news",
  TRADE_UPDATE = "trade_update",
}

export interface StreamEvent<T = unknown> {
  streamType: StreamType;
  symbol: string;
  timestamp: Date;
  data: T;
  raw?: unknown;
}

export interface StockTradeData {
  price: number;
  size: number;
  exchange: string;
  conditions?: string[];
}

export interface StockQuoteData {
  bidPrice: number;
  bidSize: number;
  askPrice: number;
  askSize: number;
  spread: number;
  spreadPct: number;
}

export interface BarData {
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap?: number;
  tradeCount?: number;
}

export interface NewsData {
  id: string;
  headline: string;
  summary?: string;
  author?: string;
  source?: string;
  url?: string;
  symbols: string[];
  createdAt: Date;
}

export interface TradeUpdateData {
  event: string;
  orderId: string;
  clientOrderId: string;
  symbol: string;
  side: "buy" | "sell";
  qty: string;
  filledQty: string;
  type: string;
  status: string;
  filledAvgPrice?: string;
}

// ============================================================================
// SUBSCRIPTION CONFIGURATION
// ============================================================================

export interface StreamSubscription {
  id: string;
  symbols: string[];
  streamTypes: StreamType[];
  callback: (event: StreamEvent) => void | Promise<void>;
  priority: number; // Higher = processed first
}

export interface StreamAggregatorConfig {
  dataFeed: "iex" | "sip";
  enableStockData: boolean;
  enableCryptoData: boolean;
  enableNews: boolean;
  enableTradeUpdates: boolean;
  reconnectMaxAttempts: number;
  reconnectDelayMs: number;
}

const DEFAULT_CONFIG: StreamAggregatorConfig = {
  dataFeed: "iex",
  enableStockData: true,
  enableCryptoData: true,
  enableNews: true,
  enableTradeUpdates: true,
  reconnectMaxAttempts: 10,
  reconnectDelayMs: 1000,
};

// ============================================================================
// STREAM AGGREGATOR
// ============================================================================

export class StreamAggregator extends EventEmitter {
  private config: StreamAggregatorConfig;
  private subscriptions: StreamSubscription[] = [];

  // WebSocket connections
  private tradeUpdateWs: WebSocket | null = null;
  private stockDataWs: WebSocket | null = null;
  private cryptoDataWs: WebSocket | null = null;
  private newsWs: WebSocket | null = null;

  // Connection state
  private isRunning = false;
  private reconnectAttempts: Record<string, number> = {};

  // Subscribed symbols
  private stockSymbols: Set<string> = new Set();
  private cryptoSymbols: Set<string> = new Set();
  private newsSymbols: Set<string> = new Set();

  // Event metrics
  private eventCounts: Record<StreamType, number> = {
    [StreamType.STOCK_TRADE]: 0,
    [StreamType.STOCK_QUOTE]: 0,
    [StreamType.STOCK_BAR]: 0,
    [StreamType.CRYPTO_TRADE]: 0,
    [StreamType.CRYPTO_QUOTE]: 0,
    [StreamType.CRYPTO_BAR]: 0,
    [StreamType.NEWS]: 0,
    [StreamType.TRADE_UPDATE]: 0,
  };

  // Latest events cache
  private latestPrices: Map<string, number> = new Map();
  private latestQuotes: Map<string, StockQuoteData> = new Map();

  constructor(config: Partial<StreamAggregatorConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    log.info("StreamAggregator", "Initialized", { config: this.config });
  }

  // ==================== SUBSCRIPTION MANAGEMENT ====================

  subscribe(subscription: Omit<StreamSubscription, "id">): string {
    const id = `sub-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const sub: StreamSubscription = { ...subscription, id };

    this.subscriptions.push(sub);
    this.subscriptions.sort((a, b) => b.priority - a.priority);

    // Add symbols to tracking sets
    for (const symbol of subscription.symbols) {
      if (subscription.streamTypes.some(t => t.startsWith("stock_"))) {
        this.stockSymbols.add(symbol);
      }
      if (subscription.streamTypes.some(t => t.startsWith("crypto_"))) {
        this.cryptoSymbols.add(symbol);
      }
      if (subscription.streamTypes.includes(StreamType.NEWS)) {
        this.newsSymbols.add(symbol);
      }
    }

    log.info("StreamAggregator", `Subscription added: ${id}`, {
      symbols: subscription.symbols.length,
      streamTypes: subscription.streamTypes,
      priority: subscription.priority,
    });

    // If already running, update subscriptions on active streams
    if (this.isRunning) {
      this.updateLiveSubscriptions();
    }

    return id;
  }

  unsubscribe(subscriptionId: string): boolean {
    const index = this.subscriptions.findIndex(s => s.id === subscriptionId);
    if (index === -1) return false;

    this.subscriptions.splice(index, 1);
    log.info("StreamAggregator", `Subscription removed: ${subscriptionId}`);
    return true;
  }

  // ==================== EVENT DISPATCH ====================

  private async dispatchEvent(event: StreamEvent): Promise<void> {
    this.eventCounts[event.streamType]++;

    // Update price cache
    if (event.streamType === StreamType.STOCK_TRADE || event.streamType === StreamType.CRYPTO_TRADE) {
      const tradeData = event.data as StockTradeData;
      this.latestPrices.set(event.symbol, tradeData.price);
    }

    if (event.streamType === StreamType.STOCK_QUOTE || event.streamType === StreamType.CRYPTO_QUOTE) {
      const quoteData = event.data as StockQuoteData;
      this.latestQuotes.set(event.symbol, quoteData);
      // Update price to mid-price
      const midPrice = (quoteData.bidPrice + quoteData.askPrice) / 2;
      this.latestPrices.set(event.symbol, midPrice);
    }

    // Emit on event emitter for general listeners
    this.emit(event.streamType, event);
    this.emit("all", event);

    // Dispatch to subscriptions (sorted by priority)
    for (const sub of this.subscriptions) {
      if (!sub.streamTypes.includes(event.streamType)) continue;
      if (!sub.symbols.includes(event.symbol) && !sub.symbols.includes("*")) continue;

      try {
        const result = sub.callback(event);
        if (result instanceof Promise) {
          await result;
        }
      } catch (error) {
        log.error("StreamAggregator", `Callback error for subscription ${sub.id}`, { error });
      }
    }
  }

  // ==================== CONNECTION MANAGEMENT ====================

  private getCredentials(): { apiKey: string; secretKey: string } | null {
    const apiKey = process.env.ALPACA_API_KEY;
    const secretKey = process.env.ALPACA_SECRET_KEY;
    if (!apiKey || !secretKey) return null;
    return { apiKey, secretKey };
  }

  async start(
    stockSymbols: string[] = [],
    cryptoSymbols: string[] = [],
    newsSymbols: string[] = []
  ): Promise<void> {
    if (this.isRunning) {
      log.warn("StreamAggregator", "Already running");
      return;
    }

    const credentials = this.getCredentials();
    if (!credentials) {
      log.warn("StreamAggregator", "Alpaca credentials not configured");
      return;
    }

    this.isRunning = true;

    // Add provided symbols
    stockSymbols.forEach(s => this.stockSymbols.add(s));
    cryptoSymbols.forEach(s => this.cryptoSymbols.add(s));
    newsSymbols.forEach(s => this.newsSymbols.add(s));

    // Start all enabled streams
    const connectionPromises: Promise<void>[] = [];

    if (this.config.enableTradeUpdates) {
      connectionPromises.push(this.connectTradeUpdates(credentials));
    }

    if (this.config.enableStockData && this.stockSymbols.size > 0) {
      connectionPromises.push(this.connectStockData(credentials));
    }

    if (this.config.enableCryptoData && this.cryptoSymbols.size > 0) {
      connectionPromises.push(this.connectCryptoData(credentials));
    }

    if (this.config.enableNews && this.newsSymbols.size > 0) {
      connectionPromises.push(this.connectNews(credentials));
    }

    await Promise.allSettled(connectionPromises);
    log.info("StreamAggregator", "All streams started");
  }

  async stop(): Promise<void> {
    this.isRunning = false;

    const closePromises: Promise<void>[] = [];

    if (this.tradeUpdateWs) {
      closePromises.push(this.closeWebSocket(this.tradeUpdateWs, "trade_updates"));
    }
    if (this.stockDataWs) {
      closePromises.push(this.closeWebSocket(this.stockDataWs, "stock_data"));
    }
    if (this.cryptoDataWs) {
      closePromises.push(this.closeWebSocket(this.cryptoDataWs, "crypto_data"));
    }
    if (this.newsWs) {
      closePromises.push(this.closeWebSocket(this.newsWs, "news"));
    }

    await Promise.allSettled(closePromises);
    log.info("StreamAggregator", "All streams stopped");
  }

  private closeWebSocket(ws: WebSocket, name: string): Promise<void> {
    return new Promise((resolve) => {
      if (ws.readyState === WebSocket.CLOSED) {
        resolve();
        return;
      }

      ws.once("close", () => {
        log.info("StreamAggregator", `${name} WebSocket closed`);
        resolve();
      });

      ws.close();

      // Force close after timeout
      setTimeout(() => {
        if (ws.readyState !== WebSocket.CLOSED) {
          ws.terminate();
        }
        resolve();
      }, 5000);
    });
  }

  // ==================== TRADE UPDATES STREAM ====================

  private async connectTradeUpdates(credentials: { apiKey: string; secretKey: string }): Promise<void> {
    const url = tradingConfig.alpaca.tradingMode === "live"
      ? "wss://api.alpaca.markets/stream"
      : "wss://paper-api.alpaca.markets/stream";

    return new Promise((resolve, reject) => {
      try {
        this.tradeUpdateWs = new WebSocket(url);

        this.tradeUpdateWs.on("open", () => {
          log.info("StreamAggregator", "Trade updates WebSocket connected");
          this.authenticateTradeUpdates(credentials);
        });

        this.tradeUpdateWs.on("message", (data) => {
          this.handleTradeUpdateMessage(data);
        });

        this.tradeUpdateWs.on("close", (code, reason) => {
          log.warn("StreamAggregator", `Trade updates closed: ${code}`, { reason: reason.toString() });
          if (this.isRunning) {
            this.scheduleReconnect("trade_updates", () => this.connectTradeUpdates(credentials));
          }
        });

        this.tradeUpdateWs.on("error", (error) => {
          log.error("StreamAggregator", `Trade updates error: ${error.message}`);
        });

        // Resolve after auth success or timeout
        const timeout = setTimeout(() => resolve(), 10000);
        this.once("trade_updates_authenticated", () => {
          clearTimeout(timeout);
          resolve();
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  private authenticateTradeUpdates(credentials: { apiKey: string; secretKey: string }): void {
    if (!this.tradeUpdateWs || this.tradeUpdateWs.readyState !== WebSocket.OPEN) return;

    this.tradeUpdateWs.send(JSON.stringify({
      action: "auth",
      key: credentials.apiKey,
      secret: credentials.secretKey,
    }));
  }

  private handleTradeUpdateMessage(data: WebSocket.Data): void {
    try {
      const message = JSON.parse(data.toString());

      if (message.stream === "authorization") {
        if (message.data?.status === "authorized") {
          log.info("StreamAggregator", "Trade updates authenticated");
          this.reconnectAttempts["trade_updates"] = 0;

          // Subscribe to trade_updates
          this.tradeUpdateWs?.send(JSON.stringify({
            action: "listen",
            data: { streams: ["trade_updates"] },
          }));

          this.emit("trade_updates_authenticated");
        }
        return;
      }

      if (message.stream === "trade_updates") {
        const update = message.data;
        const event: StreamEvent<TradeUpdateData> = {
          streamType: StreamType.TRADE_UPDATE,
          symbol: update.order.symbol,
          timestamp: new Date(update.timestamp),
          data: {
            event: update.event,
            orderId: update.order.id,
            clientOrderId: update.order.client_order_id,
            symbol: update.order.symbol,
            side: update.order.side as "buy" | "sell",
            qty: update.order.qty,
            filledQty: update.order.filled_qty,
            type: update.order.type,
            status: update.order.status,
            filledAvgPrice: update.order.filled_avg_price,
          },
          raw: update,
        };

        this.dispatchEvent(event);
      }

    } catch (error) {
      log.error("StreamAggregator", `Trade update parse error: ${error}`);
    }
  }

  // ==================== STOCK DATA STREAM ====================

  private async connectStockData(credentials: { apiKey: string; secretKey: string }): Promise<void> {
    const feed = this.config.dataFeed;
    const url = `wss://stream.data.alpaca.markets/v2/${feed}`;

    return new Promise((resolve, reject) => {
      try {
        this.stockDataWs = new WebSocket(url);

        this.stockDataWs.on("open", () => {
          log.info("StreamAggregator", `Stock data WebSocket connected (${feed})`);
          this.authenticateStockData(credentials);
        });

        this.stockDataWs.on("message", (data) => {
          this.handleStockDataMessage(data);
        });

        this.stockDataWs.on("close", (code, reason) => {
          log.warn("StreamAggregator", `Stock data closed: ${code}`);
          if (this.isRunning) {
            this.scheduleReconnect("stock_data", () => this.connectStockData(credentials));
          }
        });

        this.stockDataWs.on("error", (error) => {
          log.error("StreamAggregator", `Stock data error: ${error.message}`);
        });

        const timeout = setTimeout(() => resolve(), 10000);
        this.once("stock_data_authenticated", () => {
          clearTimeout(timeout);
          resolve();
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  private authenticateStockData(credentials: { apiKey: string; secretKey: string }): void {
    if (!this.stockDataWs || this.stockDataWs.readyState !== WebSocket.OPEN) return;

    this.stockDataWs.send(JSON.stringify({
      action: "auth",
      key: credentials.apiKey,
      secret: credentials.secretKey,
    }));
  }

  private subscribeStockSymbols(): void {
    if (!this.stockDataWs || this.stockDataWs.readyState !== WebSocket.OPEN) return;

    const symbols = Array.from(this.stockSymbols);
    if (symbols.length === 0) return;

    this.stockDataWs.send(JSON.stringify({
      action: "subscribe",
      trades: symbols,
      quotes: symbols,
      bars: symbols,
    }));

    log.info("StreamAggregator", `Subscribed to ${symbols.length} stock symbols`);
  }

  private handleStockDataMessage(data: WebSocket.Data): void {
    try {
      const messages = JSON.parse(data.toString());

      for (const msg of Array.isArray(messages) ? messages : [messages]) {
        if (msg.T === "success" && msg.msg === "authenticated") {
          log.info("StreamAggregator", "Stock data authenticated");
          this.reconnectAttempts["stock_data"] = 0;
          this.subscribeStockSymbols();
          this.emit("stock_data_authenticated");
          continue;
        }

        if (msg.T === "subscription") {
          log.debug("StreamAggregator", "Stock subscription confirmed", msg);
          continue;
        }

        // Trade message
        if (msg.T === "t") {
          const event: StreamEvent<StockTradeData> = {
            streamType: StreamType.STOCK_TRADE,
            symbol: msg.S,
            timestamp: new Date(msg.t),
            data: {
              price: msg.p,
              size: msg.s,
              exchange: msg.x,
              conditions: msg.c,
            },
            raw: msg,
          };
          this.dispatchEvent(event);
        }

        // Quote message
        if (msg.T === "q") {
          const bidPrice = msg.bp || 0;
          const askPrice = msg.ap || 0;
          const spread = askPrice - bidPrice;

          const event: StreamEvent<StockQuoteData> = {
            streamType: StreamType.STOCK_QUOTE,
            symbol: msg.S,
            timestamp: new Date(msg.t),
            data: {
              bidPrice,
              bidSize: msg.bs || 0,
              askPrice,
              askSize: msg.as || 0,
              spread,
              spreadPct: bidPrice > 0 ? (spread / bidPrice) * 100 : 0,
            },
            raw: msg,
          };
          this.dispatchEvent(event);
        }

        // Bar message
        if (msg.T === "b") {
          const event: StreamEvent<BarData> = {
            streamType: StreamType.STOCK_BAR,
            symbol: msg.S,
            timestamp: new Date(msg.t),
            data: {
              open: msg.o,
              high: msg.h,
              low: msg.l,
              close: msg.c,
              volume: msg.v,
              vwap: msg.vw,
              tradeCount: msg.n,
            },
            raw: msg,
          };
          this.dispatchEvent(event);
        }
      }

    } catch (error) {
      log.error("StreamAggregator", `Stock data parse error: ${error}`);
    }
  }

  // ==================== CRYPTO DATA STREAM ====================

  private async connectCryptoData(credentials: { apiKey: string; secretKey: string }): Promise<void> {
    const url = "wss://stream.data.alpaca.markets/v1beta3/crypto/us";

    return new Promise((resolve, reject) => {
      try {
        this.cryptoDataWs = new WebSocket(url);

        this.cryptoDataWs.on("open", () => {
          log.info("StreamAggregator", "Crypto data WebSocket connected");
          this.authenticateCryptoData(credentials);
        });

        this.cryptoDataWs.on("message", (data) => {
          this.handleCryptoDataMessage(data);
        });

        this.cryptoDataWs.on("close", (code, reason) => {
          log.warn("StreamAggregator", `Crypto data closed: ${code}`);
          if (this.isRunning) {
            this.scheduleReconnect("crypto_data", () => this.connectCryptoData(credentials));
          }
        });

        this.cryptoDataWs.on("error", (error) => {
          log.error("StreamAggregator", `Crypto data error: ${error.message}`);
        });

        const timeout = setTimeout(() => resolve(), 10000);
        this.once("crypto_data_authenticated", () => {
          clearTimeout(timeout);
          resolve();
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  private authenticateCryptoData(credentials: { apiKey: string; secretKey: string }): void {
    if (!this.cryptoDataWs || this.cryptoDataWs.readyState !== WebSocket.OPEN) return;

    this.cryptoDataWs.send(JSON.stringify({
      action: "auth",
      key: credentials.apiKey,
      secret: credentials.secretKey,
    }));
  }

  private subscribeCryptoSymbols(): void {
    if (!this.cryptoDataWs || this.cryptoDataWs.readyState !== WebSocket.OPEN) return;

    const symbols = Array.from(this.cryptoSymbols);
    if (symbols.length === 0) return;

    this.cryptoDataWs.send(JSON.stringify({
      action: "subscribe",
      trades: symbols,
      quotes: symbols,
      bars: symbols,
    }));

    log.info("StreamAggregator", `Subscribed to ${symbols.length} crypto symbols`);
  }

  private handleCryptoDataMessage(data: WebSocket.Data): void {
    try {
      const messages = JSON.parse(data.toString());

      for (const msg of Array.isArray(messages) ? messages : [messages]) {
        if (msg.T === "success" && msg.msg === "authenticated") {
          log.info("StreamAggregator", "Crypto data authenticated");
          this.reconnectAttempts["crypto_data"] = 0;
          this.subscribeCryptoSymbols();
          this.emit("crypto_data_authenticated");
          continue;
        }

        // Trade message
        if (msg.T === "t") {
          const event: StreamEvent<StockTradeData> = {
            streamType: StreamType.CRYPTO_TRADE,
            symbol: msg.S,
            timestamp: new Date(msg.t),
            data: {
              price: msg.p,
              size: msg.s,
              exchange: msg.x || "CRYPTO",
            },
            raw: msg,
          };
          this.dispatchEvent(event);
        }

        // Quote message
        if (msg.T === "q") {
          const bidPrice = msg.bp || 0;
          const askPrice = msg.ap || 0;
          const spread = askPrice - bidPrice;

          const event: StreamEvent<StockQuoteData> = {
            streamType: StreamType.CRYPTO_QUOTE,
            symbol: msg.S,
            timestamp: new Date(msg.t),
            data: {
              bidPrice,
              bidSize: msg.bs || 0,
              askPrice,
              askSize: msg.as || 0,
              spread,
              spreadPct: bidPrice > 0 ? (spread / bidPrice) * 100 : 0,
            },
            raw: msg,
          };
          this.dispatchEvent(event);
        }

        // Bar message
        if (msg.T === "b") {
          const event: StreamEvent<BarData> = {
            streamType: StreamType.CRYPTO_BAR,
            symbol: msg.S,
            timestamp: new Date(msg.t),
            data: {
              open: msg.o,
              high: msg.h,
              low: msg.l,
              close: msg.c,
              volume: msg.v,
              vwap: msg.vw,
            },
            raw: msg,
          };
          this.dispatchEvent(event);
        }
      }

    } catch (error) {
      log.error("StreamAggregator", `Crypto data parse error: ${error}`);
    }
  }

  // ==================== NEWS STREAM ====================

  private async connectNews(credentials: { apiKey: string; secretKey: string }): Promise<void> {
    const url = "wss://stream.data.alpaca.markets/v1beta1/news";

    return new Promise((resolve, reject) => {
      try {
        this.newsWs = new WebSocket(url);

        this.newsWs.on("open", () => {
          log.info("StreamAggregator", "News WebSocket connected");
          this.authenticateNews(credentials);
        });

        this.newsWs.on("message", (data) => {
          this.handleNewsMessage(data);
        });

        this.newsWs.on("close", (code, reason) => {
          log.warn("StreamAggregator", `News stream closed: ${code}`);
          if (this.isRunning) {
            this.scheduleReconnect("news", () => this.connectNews(credentials));
          }
        });

        this.newsWs.on("error", (error) => {
          log.error("StreamAggregator", `News error: ${error.message}`);
        });

        const timeout = setTimeout(() => resolve(), 10000);
        this.once("news_authenticated", () => {
          clearTimeout(timeout);
          resolve();
        });

      } catch (error) {
        reject(error);
      }
    });
  }

  private authenticateNews(credentials: { apiKey: string; secretKey: string }): void {
    if (!this.newsWs || this.newsWs.readyState !== WebSocket.OPEN) return;

    this.newsWs.send(JSON.stringify({
      action: "auth",
      key: credentials.apiKey,
      secret: credentials.secretKey,
    }));
  }

  private subscribeNewsSymbols(): void {
    if (!this.newsWs || this.newsWs.readyState !== WebSocket.OPEN) return;

    const symbols = Array.from(this.newsSymbols);
    if (symbols.length === 0) {
      // Subscribe to all news if no specific symbols
      symbols.push("*");
    }

    this.newsWs.send(JSON.stringify({
      action: "subscribe",
      news: symbols,
    }));

    log.info("StreamAggregator", `Subscribed to news for ${symbols.length} symbols`);
  }

  private handleNewsMessage(data: WebSocket.Data): void {
    try {
      const messages = JSON.parse(data.toString());

      for (const msg of Array.isArray(messages) ? messages : [messages]) {
        if (msg.T === "success" && msg.msg === "authenticated") {
          log.info("StreamAggregator", "News stream authenticated");
          this.reconnectAttempts["news"] = 0;
          this.subscribeNewsSymbols();
          this.emit("news_authenticated");
          continue;
        }

        // News message
        if (msg.T === "n") {
          const symbols = msg.symbols || [];
          const primarySymbol = symbols[0] || "MARKET";

          const event: StreamEvent<NewsData> = {
            streamType: StreamType.NEWS,
            symbol: primarySymbol,
            timestamp: new Date(msg.created_at),
            data: {
              id: msg.id,
              headline: msg.headline,
              summary: msg.summary,
              author: msg.author,
              source: msg.source,
              url: msg.url,
              symbols,
              createdAt: new Date(msg.created_at),
            },
            raw: msg,
          };

          // Dispatch to all related symbols
          for (const symbol of symbols) {
            this.dispatchEvent({ ...event, symbol });
          }

          // Also dispatch once to primary symbol
          if (symbols.length > 1) {
            this.dispatchEvent(event);
          }
        }
      }

    } catch (error) {
      log.error("StreamAggregator", `News parse error: ${error}`);
    }
  }

  // ==================== RECONNECTION ====================

  private scheduleReconnect(streamName: string, reconnectFn: () => Promise<void>): void {
    const attempts = this.reconnectAttempts[streamName] || 0;

    if (attempts >= this.config.reconnectMaxAttempts) {
      log.error("StreamAggregator", `Max reconnect attempts reached for ${streamName}`);
      return;
    }

    const delay = Math.min(
      this.config.reconnectDelayMs * Math.pow(2, attempts),
      60000
    );

    this.reconnectAttempts[streamName] = attempts + 1;

    log.info("StreamAggregator", `Scheduling ${streamName} reconnect in ${delay}ms (attempt ${attempts + 1})`);

    setTimeout(() => {
      if (this.isRunning) {
        reconnectFn().catch(err => {
          log.error("StreamAggregator", `Reconnect failed for ${streamName}: ${err}`);
        });
      }
    }, delay);
  }

  private updateLiveSubscriptions(): void {
    // Update stock subscriptions
    if (this.stockDataWs?.readyState === WebSocket.OPEN) {
      this.subscribeStockSymbols();
    }

    // Update crypto subscriptions
    if (this.cryptoDataWs?.readyState === WebSocket.OPEN) {
      this.subscribeCryptoSymbols();
    }

    // Update news subscriptions
    if (this.newsWs?.readyState === WebSocket.OPEN) {
      this.subscribeNewsSymbols();
    }
  }

  // ==================== PUBLIC API ====================

  getLatestPrice(symbol: string): number | undefined {
    return this.latestPrices.get(symbol);
  }

  getLatestQuote(symbol: string): StockQuoteData | undefined {
    return this.latestQuotes.get(symbol);
  }

  getMetrics(): {
    eventCounts: Record<StreamType, number>;
    subscriptionCount: number;
    stockSymbolCount: number;
    cryptoSymbolCount: number;
    newsSymbolCount: number;
    isRunning: boolean;
    connections: Record<string, boolean>;
  } {
    return {
      eventCounts: { ...this.eventCounts },
      subscriptionCount: this.subscriptions.length,
      stockSymbolCount: this.stockSymbols.size,
      cryptoSymbolCount: this.cryptoSymbols.size,
      newsSymbolCount: this.newsSymbols.size,
      isRunning: this.isRunning,
      connections: {
        tradeUpdates: this.tradeUpdateWs?.readyState === WebSocket.OPEN,
        stockData: this.stockDataWs?.readyState === WebSocket.OPEN,
        cryptoData: this.cryptoDataWs?.readyState === WebSocket.OPEN,
        news: this.newsWs?.readyState === WebSocket.OPEN,
      },
    };
  }

  addSymbols(stockSymbols: string[] = [], cryptoSymbols: string[] = [], newsSymbols: string[] = []): void {
    stockSymbols.forEach(s => this.stockSymbols.add(s));
    cryptoSymbols.forEach(s => this.cryptoSymbols.add(s));
    newsSymbols.forEach(s => this.newsSymbols.add(s));

    if (this.isRunning) {
      this.updateLiveSubscriptions();
    }
  }

  // Alias for getMetrics - provides compatibility
  getStatus(): {
    isRunning: boolean;
    subscriptionCount: number;
    stockSymbolCount: number;
    cryptoSymbolCount: number;
    newsSymbolCount: number;
    eventCounts: Record<StreamType, number>;
    connections: Record<string, boolean>;
  } {
    return this.getMetrics();
  }
}

// Export singleton instance
export const streamAggregator = new StreamAggregator();
