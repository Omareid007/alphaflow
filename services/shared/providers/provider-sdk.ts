/**
 * AI Active Trader - Provider SDK
 * Abstract interface for multi-broker/data-provider integration.
 * Supports Alpaca, Interactive Brokers, Coinbase, and extensible to any broker.
 */

import { createLogger } from '../common';
import { CircuitBreaker, CircuitBreakerRegistry } from '../common/circuit-breaker';

const logger = createLogger('provider-sdk');

export interface MarketData {
  symbol: string;
  price: number;
  bid: number;
  ask: number;
  volume: number;
  timestamp: Date;
  exchange?: string;
}

export interface OHLCV {
  symbol: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  timestamp: Date;
}

export interface Order {
  id: string;
  clientOrderId?: string;
  symbol: string;
  side: 'buy' | 'sell';
  type: 'market' | 'limit' | 'stop' | 'stop_limit';
  quantity: number;
  limitPrice?: number;
  stopPrice?: number;
  status: 'pending' | 'open' | 'filled' | 'partially_filled' | 'cancelled' | 'rejected';
  filledQuantity: number;
  filledAvgPrice?: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Position {
  symbol: string;
  quantity: number;
  side: 'long' | 'short';
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
}

export interface Account {
  id: string;
  currency: string;
  cash: number;
  portfolioValue: number;
  buyingPower: number;
  equity: number;
  dayTradeCount?: number;
  patternDayTrader?: boolean;
}

export interface ProviderCapabilities {
  supportsMarketData: boolean;
  supportsHistoricalData: boolean;
  supportsOrders: boolean;
  supportsPositions: boolean;
  supportsStreaming: boolean;
  supportsPaperTrading: boolean;
  supportedAssetClasses: Array<'stocks' | 'crypto' | 'forex' | 'options' | 'futures'>;
  supportedOrderTypes: Array<'market' | 'limit' | 'stop' | 'stop_limit'>;
}

export interface IProvider {
  readonly name: string;
  readonly capabilities: ProviderCapabilities;

  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;

  getQuote(symbol: string): Promise<MarketData>;
  getQuotes(symbols: string[]): Promise<MarketData[]>;
  getHistoricalData(symbol: string, timeframe: string, start: Date, end: Date): Promise<OHLCV[]>;

  getAccount(): Promise<Account>;
  getPositions(): Promise<Position[]>;
  getPosition(symbol: string): Promise<Position | null>;

  submitOrder(order: Omit<Order, 'id' | 'status' | 'filledQuantity' | 'createdAt' | 'updatedAt'>): Promise<Order>;
  cancelOrder(orderId: string): Promise<boolean>;
  getOrder(orderId: string): Promise<Order | null>;
  getOrders(status?: Order['status']): Promise<Order[]>;

  subscribeQuotes?(symbols: string[], callback: (data: MarketData) => void): () => void;
  subscribeTrades?(symbols: string[], callback: (data: { symbol: string; price: number; size: number; timestamp: Date }) => void): () => void;
}

export abstract class BaseProvider implements IProvider {
  abstract readonly name: string;
  abstract readonly capabilities: ProviderCapabilities;

  protected connected = false;
  protected circuitBreaker: CircuitBreaker;

  constructor() {
    this.circuitBreaker = CircuitBreakerRegistry.getInstance().getOrCreate({
      name: `provider:${this.constructor.name}`,
      failureThreshold: 5,
      timeout: 30000,
    });
  }

  abstract connect(): Promise<void>;
  abstract disconnect(): Promise<void>;

  isConnected(): boolean {
    return this.connected;
  }

  abstract getQuote(symbol: string): Promise<MarketData>;
  abstract getQuotes(symbols: string[]): Promise<MarketData[]>;
  abstract getHistoricalData(symbol: string, timeframe: string, start: Date, end: Date): Promise<OHLCV[]>;
  abstract getAccount(): Promise<Account>;
  abstract getPositions(): Promise<Position[]>;
  abstract getPosition(symbol: string): Promise<Position | null>;
  abstract submitOrder(order: Omit<Order, 'id' | 'status' | 'filledQuantity' | 'createdAt' | 'updatedAt'>): Promise<Order>;
  abstract cancelOrder(orderId: string): Promise<boolean>;
  abstract getOrder(orderId: string): Promise<Order | null>;
  abstract getOrders(status?: Order['status']): Promise<Order[]>;

  protected async executeWithCircuitBreaker<T>(operation: () => Promise<T>): Promise<T> {
    return this.circuitBreaker.execute(operation);
  }
}

export class AlpacaProvider extends BaseProvider {
  readonly name = 'Alpaca';
  readonly capabilities: ProviderCapabilities = {
    supportsMarketData: true,
    supportsHistoricalData: true,
    supportsOrders: true,
    supportsPositions: true,
    supportsStreaming: true,
    supportsPaperTrading: true,
    supportedAssetClasses: ['stocks', 'crypto'],
    supportedOrderTypes: ['market', 'limit', 'stop', 'stop_limit'],
  };

  private apiKey: string;
  private secretKey: string;
  private baseUrl: string;
  private dataUrl: string;

  constructor(config?: { paper?: boolean }) {
    super();
    this.apiKey = process.env.ALPACA_API_KEY || '';
    this.secretKey = process.env.ALPACA_SECRET_KEY || '';
    const paper = config?.paper !== false;
    this.baseUrl = paper ? 'https://paper-api.alpaca.markets' : 'https://api.alpaca.markets';
    this.dataUrl = 'https://data.alpaca.markets';
  }

  async connect(): Promise<void> {
    if (!this.apiKey || !this.secretKey) {
      throw new Error('Alpaca API credentials not configured');
    }

    const account = await this.getAccount();
    this.connected = true;
    logger.info('Connected to Alpaca', { accountId: account.id });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    logger.info('Disconnected from Alpaca');
  }

  private async request<T>(url: string, options: RequestInit = {}): Promise<T> {
    return this.executeWithCircuitBreaker(async () => {
      const response = await fetch(url, {
        ...options,
        headers: {
          'APCA-API-KEY-ID': this.apiKey,
          'APCA-API-SECRET-KEY': this.secretKey,
          'Content-Type': 'application/json',
          ...options.headers,
        },
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Alpaca API error: ${response.status} - ${error}`);
      }

      return response.json();
    });
  }

  async getQuote(symbol: string): Promise<MarketData> {
    const data = await this.request<{
      symbol: string;
      trade: { p: number; s: number; t: string };
      quote: { bp: number; ap: number };
    }>(`${this.dataUrl}/v2/stocks/${symbol}/snapshot`);

    return {
      symbol: data.symbol,
      price: data.trade?.p || 0,
      bid: data.quote?.bp || 0,
      ask: data.quote?.ap || 0,
      volume: data.trade?.s || 0,
      timestamp: new Date(data.trade?.t || Date.now()),
    };
  }

  async getQuotes(symbols: string[]): Promise<MarketData[]> {
    const snapshots = await this.request<Record<string, {
      trade: { p: number; s: number; t: string };
      quote: { bp: number; ap: number };
    }>>(`${this.dataUrl}/v2/stocks/snapshots?symbols=${symbols.join(',')}`);

    return Object.entries(snapshots).map(([symbol, data]) => ({
      symbol,
      price: data.trade?.p || 0,
      bid: data.quote?.bp || 0,
      ask: data.quote?.ap || 0,
      volume: data.trade?.s || 0,
      timestamp: new Date(data.trade?.t || Date.now()),
    }));
  }

  async getHistoricalData(symbol: string, timeframe: string, start: Date, end: Date): Promise<OHLCV[]> {
    const data = await this.request<{
      bars: Array<{ o: number; h: number; l: number; c: number; v: number; t: string }>;
    }>(`${this.dataUrl}/v2/stocks/${symbol}/bars?timeframe=${timeframe}&start=${start.toISOString()}&end=${end.toISOString()}`);

    return (data.bars || []).map(bar => ({
      symbol,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      close: bar.c,
      volume: bar.v,
      timestamp: new Date(bar.t),
    }));
  }

  async getAccount(): Promise<Account> {
    const data = await this.request<{
      id: string;
      currency: string;
      cash: string;
      portfolio_value: string;
      buying_power: string;
      equity: string;
      daytrade_count: number;
      pattern_day_trader: boolean;
    }>(`${this.baseUrl}/v2/account`);

    return {
      id: data.id,
      currency: data.currency,
      cash: parseFloat(data.cash),
      portfolioValue: parseFloat(data.portfolio_value),
      buyingPower: parseFloat(data.buying_power),
      equity: parseFloat(data.equity),
      dayTradeCount: data.daytrade_count,
      patternDayTrader: data.pattern_day_trader,
    };
  }

  async getPositions(): Promise<Position[]> {
    const data = await this.request<Array<{
      symbol: string;
      qty: string;
      side: string;
      avg_entry_price: string;
      current_price: string;
      market_value: string;
      unrealized_pl: string;
      unrealized_plpc: string;
    }>>(`${this.baseUrl}/v2/positions`);

    return data.map(pos => ({
      symbol: pos.symbol,
      quantity: parseFloat(pos.qty),
      side: pos.side === 'long' ? 'long' : 'short',
      avgEntryPrice: parseFloat(pos.avg_entry_price),
      currentPrice: parseFloat(pos.current_price),
      marketValue: parseFloat(pos.market_value),
      unrealizedPnl: parseFloat(pos.unrealized_pl),
      unrealizedPnlPercent: parseFloat(pos.unrealized_plpc) * 100,
    }));
  }

  async getPosition(symbol: string): Promise<Position | null> {
    try {
      const data = await this.request<{
        symbol: string;
        qty: string;
        side: string;
        avg_entry_price: string;
        current_price: string;
        market_value: string;
        unrealized_pl: string;
        unrealized_plpc: string;
      }>(`${this.baseUrl}/v2/positions/${symbol}`);

      return {
        symbol: data.symbol,
        quantity: parseFloat(data.qty),
        side: data.side === 'long' ? 'long' : 'short',
        avgEntryPrice: parseFloat(data.avg_entry_price),
        currentPrice: parseFloat(data.current_price),
        marketValue: parseFloat(data.market_value),
        unrealizedPnl: parseFloat(data.unrealized_pl),
        unrealizedPnlPercent: parseFloat(data.unrealized_plpc) * 100,
      };
    } catch {
      return null;
    }
  }

  async submitOrder(order: Omit<Order, 'id' | 'status' | 'filledQuantity' | 'createdAt' | 'updatedAt'>): Promise<Order> {
    const data = await this.request<{
      id: string;
      client_order_id: string;
      symbol: string;
      side: string;
      type: string;
      qty: string;
      limit_price: string | null;
      stop_price: string | null;
      status: string;
      filled_qty: string;
      filled_avg_price: string | null;
      created_at: string;
      updated_at: string;
    }>(`${this.baseUrl}/v2/orders`, {
      method: 'POST',
      body: JSON.stringify({
        symbol: order.symbol,
        side: order.side,
        type: order.type,
        qty: order.quantity.toString(),
        limit_price: order.limitPrice?.toString(),
        stop_price: order.stopPrice?.toString(),
        time_in_force: 'day',
        client_order_id: order.clientOrderId,
      }),
    });

    return this.mapOrder(data);
  }

  async cancelOrder(orderId: string): Promise<boolean> {
    try {
      await this.request(`${this.baseUrl}/v2/orders/${orderId}`, { method: 'DELETE' });
      return true;
    } catch {
      return false;
    }
  }

  async getOrder(orderId: string): Promise<Order | null> {
    try {
      const data = await this.request<{
        id: string;
        client_order_id: string;
        symbol: string;
        side: string;
        type: string;
        qty: string;
        limit_price: string | null;
        stop_price: string | null;
        status: string;
        filled_qty: string;
        filled_avg_price: string | null;
        created_at: string;
        updated_at: string;
      }>(`${this.baseUrl}/v2/orders/${orderId}`);
      return this.mapOrder(data);
    } catch {
      return null;
    }
  }

  async getOrders(status?: Order['status']): Promise<Order[]> {
    const queryStatus = status === 'open' ? 'open' : status === 'filled' ? 'closed' : 'all';
    const data = await this.request<Array<{
      id: string;
      client_order_id: string;
      symbol: string;
      side: string;
      type: string;
      qty: string;
      limit_price: string | null;
      stop_price: string | null;
      status: string;
      filled_qty: string;
      filled_avg_price: string | null;
      created_at: string;
      updated_at: string;
    }>>(`${this.baseUrl}/v2/orders?status=${queryStatus}`);

    return data.map(o => this.mapOrder(o));
  }

  private mapOrder(data: {
    id: string;
    client_order_id: string;
    symbol: string;
    side: string;
    type: string;
    qty: string;
    limit_price: string | null;
    stop_price: string | null;
    status: string;
    filled_qty: string;
    filled_avg_price: string | null;
    created_at: string;
    updated_at: string;
  }): Order {
    const statusMap: Record<string, Order['status']> = {
      new: 'pending',
      accepted: 'open',
      filled: 'filled',
      partially_filled: 'partially_filled',
      canceled: 'cancelled',
      rejected: 'rejected',
    };

    return {
      id: data.id,
      clientOrderId: data.client_order_id,
      symbol: data.symbol,
      side: data.side as 'buy' | 'sell',
      type: data.type as Order['type'],
      quantity: parseFloat(data.qty),
      limitPrice: data.limit_price ? parseFloat(data.limit_price) : undefined,
      stopPrice: data.stop_price ? parseFloat(data.stop_price) : undefined,
      status: statusMap[data.status] || 'pending',
      filledQuantity: parseFloat(data.filled_qty),
      filledAvgPrice: data.filled_avg_price ? parseFloat(data.filled_avg_price) : undefined,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }
}

export class ProviderRegistry {
  private static instance: ProviderRegistry;
  private providers: Map<string, IProvider> = new Map();

  static getInstance(): ProviderRegistry {
    if (!ProviderRegistry.instance) {
      ProviderRegistry.instance = new ProviderRegistry();
    }
    return ProviderRegistry.instance;
  }

  register(name: string, provider: IProvider): void {
    this.providers.set(name, provider);
    logger.info('Provider registered', { name });
  }

  get(name: string): IProvider | undefined {
    return this.providers.get(name);
  }

  getAll(): IProvider[] {
    return Array.from(this.providers.values());
  }

  async connectAll(): Promise<void> {
    for (const [name, provider] of this.providers) {
      try {
        await provider.connect();
      } catch (error) {
        logger.error(`Failed to connect provider: ${name}`, error instanceof Error ? error : undefined);
      }
    }
  }

  async disconnectAll(): Promise<void> {
    for (const [name, provider] of this.providers) {
      try {
        await provider.disconnect();
      } catch (error) {
        logger.error(`Failed to disconnect provider: ${name}`, error instanceof Error ? error : undefined);
      }
    }
  }
}

export function createAlpacaProvider(config?: { paper?: boolean }): AlpacaProvider {
  return new AlpacaProvider(config);
}

export function getProviderRegistry(): ProviderRegistry {
  return ProviderRegistry.getInstance();
}
