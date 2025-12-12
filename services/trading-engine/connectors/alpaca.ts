/**
 * AI Active Trader - Alpaca API Connector
 * Paper trading integration with Alpaca Markets API
 */

import { createLogger } from '../../shared/common';
import { Order, OrderRequest, OrderResult, OrderStatus, Position } from '../types';

const logger = createLogger('alpaca-connector', 'info');

const ALPACA_PAPER_URL = 'https://paper-api.alpaca.markets';
const ALPACA_DATA_URL = 'https://data.alpaca.markets';

interface AlpacaCredentials {
  apiKey: string;
  secretKey: string;
}

interface AlpacaAccount {
  id: string;
  account_number: string;
  status: string;
  currency: string;
  buying_power: string;
  cash: string;
  portfolio_value: string;
  equity: string;
  last_equity: string;
  pattern_day_trader: boolean;
  trading_blocked: boolean;
  transfers_blocked: boolean;
  account_blocked: boolean;
}

interface AlpacaOrder {
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
  qty: string;
  filled_qty: string;
  type: string;
  side: string;
  time_in_force: string;
  limit_price: string | null;
  stop_price: string | null;
  filled_avg_price: string | null;
  status: string;
  extended_hours: boolean;
  legs: any;
}

interface AlpacaPosition {
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

interface AlpacaQuote {
  symbol: string;
  bid_price: number;
  bid_size: number;
  ask_price: number;
  ask_size: number;
  timestamp: string;
}

export class AlpacaConnector {
  private credentials: AlpacaCredentials | null = null;
  private connected: boolean = false;

  constructor() {
    this.loadCredentials();
  }

  private loadCredentials(): void {
    const apiKey = process.env.ALPACA_API_KEY;
    const secretKey = process.env.ALPACA_SECRET_KEY;

    if (apiKey && secretKey) {
      this.credentials = { apiKey, secretKey };
      this.connected = true;
      logger.info('Alpaca credentials loaded successfully');
    } else {
      logger.warn('Alpaca credentials not found - paper trading disabled');
    }
  }

  isConnected(): boolean {
    return this.connected && this.credentials !== null;
  }

  private getHeaders(): Record<string, string> {
    if (!this.credentials) {
      throw new Error('Alpaca credentials not configured');
    }

    return {
      'APCA-API-KEY-ID': this.credentials.apiKey,
      'APCA-API-SECRET-KEY': this.credentials.secretKey,
      'Content-Type': 'application/json',
    };
  }

  private async makeRequest<T>(
    endpoint: string,
    method: string = 'GET',
    body?: any,
    useDataApi: boolean = false
  ): Promise<T> {
    const baseUrl = useDataApi ? ALPACA_DATA_URL : ALPACA_PAPER_URL;
    const url = `${baseUrl}${endpoint}`;

    try {
      const response = await fetch(url, {
        method,
        headers: this.getHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Alpaca API error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('Alpaca API request failed', error instanceof Error ? error : undefined, {
        endpoint,
        method,
      });
      throw error;
    }
  }

  async getAccount(): Promise<AlpacaAccount | null> {
    if (!this.isConnected()) {
      logger.warn('Cannot get account - Alpaca not connected');
      return null;
    }

    try {
      return await this.makeRequest<AlpacaAccount>('/v2/account');
    } catch (error) {
      logger.error('Failed to get Alpaca account', error instanceof Error ? error : undefined);
      return null;
    }
  }

  async submitOrder(request: OrderRequest): Promise<OrderResult> {
    if (!this.isConnected()) {
      return {
        success: false,
        orderId: '',
        error: 'Alpaca not connected',
        status: OrderStatus.FAILED,
      };
    }

    try {
      const alpacaOrder = await this.makeRequest<AlpacaOrder>('/v2/orders', 'POST', {
        symbol: request.symbol.toUpperCase(),
        qty: request.quantity.toString(),
        side: request.side,
        type: request.orderType,
        time_in_force: request.timeInForce || 'day',
        limit_price: request.limitPrice?.toString(),
        stop_price: request.stopLoss?.toString(),
        extended_hours: false,
      });

      logger.info('Order submitted to Alpaca', {
        orderId: alpacaOrder.id,
        symbol: alpacaOrder.symbol,
        status: alpacaOrder.status,
      });

      return {
        success: true,
        orderId: alpacaOrder.id,
        status: this.mapAlpacaStatus(alpacaOrder.status),
        filledQuantity: parseFloat(alpacaOrder.filled_qty) || 0,
        filledPrice: alpacaOrder.filled_avg_price ? parseFloat(alpacaOrder.filled_avg_price) : undefined,
      };
    } catch (error) {
      logger.error('Failed to submit order to Alpaca', error instanceof Error ? error : undefined);
      return {
        success: false,
        orderId: '',
        error: (error as Error).message,
        status: OrderStatus.FAILED,
      };
    }
  }

  async cancelOrder(orderId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isConnected()) {
      return { success: false, error: 'Alpaca not connected' };
    }

    try {
      await this.makeRequest(`/v2/orders/${orderId}`, 'DELETE');
      logger.info('Order canceled on Alpaca', { orderId });
      return { success: true };
    } catch (error) {
      logger.error('Failed to cancel order on Alpaca', error instanceof Error ? error : undefined);
      return { success: false, error: (error as Error).message };
    }
  }

  async getOrder(orderId: string): Promise<AlpacaOrder | null> {
    if (!this.isConnected()) {
      return null;
    }

    try {
      return await this.makeRequest<AlpacaOrder>(`/v2/orders/${orderId}`);
    } catch (error) {
      logger.error('Failed to get order from Alpaca', error instanceof Error ? error : undefined);
      return null;
    }
  }

  async getOrders(status: string = 'open'): Promise<AlpacaOrder[]> {
    if (!this.isConnected()) {
      return [];
    }

    try {
      return await this.makeRequest<AlpacaOrder[]>(`/v2/orders?status=${status}`);
    } catch (error) {
      logger.error('Failed to get orders from Alpaca', error instanceof Error ? error : undefined);
      return [];
    }
  }

  async getPositions(): Promise<AlpacaPosition[]> {
    if (!this.isConnected()) {
      return [];
    }

    try {
      return await this.makeRequest<AlpacaPosition[]>('/v2/positions');
    } catch (error) {
      logger.error('Failed to get positions from Alpaca', error instanceof Error ? error : undefined);
      return [];
    }
  }

  async getPosition(symbol: string): Promise<AlpacaPosition | null> {
    if (!this.isConnected()) {
      return null;
    }

    try {
      return await this.makeRequest<AlpacaPosition>(`/v2/positions/${symbol.toUpperCase()}`);
    } catch (error) {
      logger.error('Failed to get position from Alpaca', error instanceof Error ? error : undefined);
      return null;
    }
  }

  async closePosition(symbol: string): Promise<{ success: boolean; error?: string }> {
    if (!this.isConnected()) {
      return { success: false, error: 'Alpaca not connected' };
    }

    try {
      await this.makeRequest(`/v2/positions/${symbol.toUpperCase()}`, 'DELETE');
      logger.info('Position closed on Alpaca', { symbol });
      return { success: true };
    } catch (error) {
      logger.error('Failed to close position on Alpaca', error instanceof Error ? error : undefined);
      return { success: false, error: (error as Error).message };
    }
  }

  async closeAllPositions(): Promise<{ success: boolean; error?: string }> {
    if (!this.isConnected()) {
      return { success: false, error: 'Alpaca not connected' };
    }

    try {
      await this.makeRequest('/v2/positions', 'DELETE');
      logger.info('All positions closed on Alpaca');
      return { success: true };
    } catch (error) {
      logger.error('Failed to close all positions on Alpaca', error instanceof Error ? error : undefined);
      return { success: false, error: (error as Error).message };
    }
  }

  async getQuote(symbol: string): Promise<AlpacaQuote | null> {
    if (!this.isConnected()) {
      return null;
    }

    try {
      const response = await this.makeRequest<{ quotes: Record<string, AlpacaQuote> }>(
        `/v2/stocks/${symbol.toUpperCase()}/quotes/latest`,
        'GET',
        undefined,
        true
      );
      return response.quotes?.[symbol.toUpperCase()] || null;
    } catch (error) {
      logger.error('Failed to get quote from Alpaca', error instanceof Error ? error : undefined);
      return null;
    }
  }

  async getMarketClock(): Promise<{ is_open: boolean; next_open: string; next_close: string } | null> {
    if (!this.isConnected()) {
      return null;
    }

    try {
      return await this.makeRequest('/v2/clock');
    } catch (error) {
      logger.error('Failed to get market clock from Alpaca', error instanceof Error ? error : undefined);
      return null;
    }
  }

  private mapAlpacaStatus(alpacaStatus: string): OrderStatus {
    const statusMap: Record<string, OrderStatus> = {
      new: OrderStatus.PENDING,
      accepted: OrderStatus.SUBMITTED,
      pending_new: OrderStatus.PENDING,
      accepted_for_bidding: OrderStatus.SUBMITTED,
      stopped: OrderStatus.SUBMITTED,
      rejected: OrderStatus.FAILED,
      suspended: OrderStatus.FAILED,
      calculated: OrderStatus.SUBMITTED,
      held: OrderStatus.SUBMITTED,
      filled: OrderStatus.FILLED,
      partially_filled: OrderStatus.PARTIALLY_FILLED,
      done_for_day: OrderStatus.CANCELED,
      canceled: OrderStatus.CANCELED,
      expired: OrderStatus.CANCELED,
      replaced: OrderStatus.CANCELED,
      pending_cancel: OrderStatus.PENDING,
      pending_replace: OrderStatus.PENDING,
    };

    return statusMap[alpacaStatus.toLowerCase()] || OrderStatus.PENDING;
  }

  getConnectionStatus(): { connected: boolean; hasCredentials: boolean; mode: string } {
    return {
      connected: this.connected,
      hasCredentials: this.credentials !== null,
      mode: 'paper',
    };
  }
}

export const alpacaConnector = new AlpacaConnector();
