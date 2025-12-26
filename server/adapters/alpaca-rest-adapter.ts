/**
 * Alpaca REST Adapter
 *
 * This adapter wraps the existing Alpaca REST connector and implements the IBrokerAdapter interface.
 * It maps Alpaca's snake_case responses to the interface's camelCase format and provides
 * consistent error handling across all broker operations.
 *
 * This is the first adapter implementation. Future adapters (e.g., AlpacaSdkAdapter) will
 * follow this same pattern but use different underlying implementations.
 */

import { alpaca } from '../connectors/alpaca';
import type {
  AlpacaAccount,
  AlpacaPosition,
  AlpacaOrder,
  CreateOrderParams,
  BracketOrderParams as AlpacaBracketOrderParams,
  AlpacaSnapshot,
} from '../connectors/alpaca';
import type {
  IBrokerAdapter,
  BrokerAccount,
  BrokerPosition,
  BrokerOrder,
  OrderParams,
  BracketOrderParams,
  MarketSnapshot,
  BrokerQuote,
  BrokerHealthCheck,
  BrokerConnectionStatus,
} from './broker-adapter.interface';

/**
 * AlpacaRestAdapter - Implements IBrokerAdapter using the Alpaca REST API connector
 */
export class AlpacaRestAdapter implements IBrokerAdapter {
  // ==================== Private Mapping Methods ====================

  /**
   * Maps Alpaca account response to BrokerAccount interface
   */
  private mapAlpacaAccount(alpacaAccount: AlpacaAccount): BrokerAccount {
    return {
      id: alpacaAccount.id,
      buyingPower: parseFloat(alpacaAccount.buying_power),
      cash: parseFloat(alpacaAccount.cash),
      equity: parseFloat(alpacaAccount.equity),
      portfolioValue: parseFloat(alpacaAccount.portfolio_value),
      currency: alpacaAccount.currency,
      tradingBlocked: alpacaAccount.trading_blocked,
      patternDayTrader: alpacaAccount.pattern_day_trader,
    };
  }

  /**
   * Maps Alpaca position response to BrokerPosition interface
   */
  private mapAlpacaPosition(pos: AlpacaPosition): BrokerPosition {
    return {
      symbol: pos.symbol,
      quantity: parseFloat(pos.qty),
      avgEntryPrice: parseFloat(pos.avg_entry_price),
      currentPrice: parseFloat(pos.current_price),
      marketValue: parseFloat(pos.market_value),
      unrealizedPnl: parseFloat(pos.unrealized_pl),
      unrealizedPnlPercent: parseFloat(pos.unrealized_plpc) * 100, // Convert to percentage
      side: pos.side as 'long' | 'short',
    };
  }

  /**
   * Maps Alpaca order response to BrokerOrder interface
   */
  private mapAlpacaOrder(order: AlpacaOrder): BrokerOrder {
    return {
      id: order.id,
      clientOrderId: order.client_order_id,
      symbol: order.symbol,
      side: order.side as 'buy' | 'sell',
      type: order.type as 'market' | 'limit' | 'stop' | 'stop_limit' | 'trailing_stop',
      status: this.normalizeOrderStatus(order.status),
      quantity: parseFloat(order.qty),
      filledQuantity: parseFloat(order.filled_qty),
      filledAvgPrice: order.filled_avg_price ? parseFloat(order.filled_avg_price) : null,
      limitPrice: order.limit_price ? parseFloat(order.limit_price) : undefined,
      stopPrice: order.stop_price ? parseFloat(order.stop_price) : undefined,
      timeInForce: order.time_in_force,
      extendedHours: order.extended_hours,
      createdAt: new Date(order.created_at),
      filledAt: order.filled_at ? new Date(order.filled_at) : null,
    };
  }

  /**
   * Normalizes Alpaca order status to standard status values
   */
  private normalizeOrderStatus(alpacaStatus: string): BrokerOrder['status'] {
    const statusMap: Record<string, BrokerOrder['status']> = {
      'new': 'new',
      'accepted': 'accepted',
      'pending_new': 'pending_new',
      'filled': 'filled',
      'partially_filled': 'partially_filled',
      'canceled': 'canceled',
      'cancelled': 'canceled', // Handle both spellings
      'rejected': 'rejected',
      'expired': 'expired',
    };
    return statusMap[alpacaStatus] || 'new';
  }

  /**
   * Maps Alpaca snapshot to MarketSnapshot interface
   */
  private mapAlpacaSnapshot(symbol: string, snapshot: AlpacaSnapshot): MarketSnapshot {
    return {
      symbol,
      bid: snapshot.latestQuote.bp,
      ask: snapshot.latestQuote.ap,
      last: snapshot.latestTrade.p,
      bidSize: snapshot.latestQuote.bs,
      askSize: snapshot.latestQuote.as,
      volume: snapshot.dailyBar?.v,
      timestamp: new Date(snapshot.latestTrade.t),
    };
  }

  /**
   * Maps OrderParams to Alpaca's CreateOrderParams format
   */
  private mapToAlpacaOrderParams(params: OrderParams): CreateOrderParams {
    const alpacaParams: CreateOrderParams = {
      symbol: params.symbol,
      side: params.side,
      type: params.type,
      time_in_force: (params.timeInForce || 'day') as CreateOrderParams['time_in_force'],
      extended_hours: params.extendedHours,
      client_order_id: params.clientOrderId,
    };

    // Add quantity or notional
    if (params.quantity !== undefined) {
      alpacaParams.qty = params.quantity.toString();
    } else if (params.notional !== undefined) {
      alpacaParams.notional = params.notional.toString();
    }

    // Add price parameters
    if (params.limitPrice !== undefined) {
      alpacaParams.limit_price = params.limitPrice.toString();
    }
    if (params.stopPrice !== undefined) {
      alpacaParams.stop_price = params.stopPrice.toString();
    }
    if (params.trailPercent !== undefined) {
      alpacaParams.trail_percent = params.trailPercent.toString();
    }

    return alpacaParams;
  }

  /**
   * Wraps errors with consistent error handling
   */
  private wrapError(error: unknown, operation: string): Error {
    if (error instanceof Error) {
      return new Error(`Alpaca ${operation} failed: ${error.message}`);
    }
    return new Error(`Alpaca ${operation} failed: ${String(error)}`);
  }

  // ==================== Account Operations ====================

  /**
   * Get account information
   */
  async getAccount(): Promise<BrokerAccount> {
    try {
      const alpacaAccount = await alpaca.getAccount();
      return this.mapAlpacaAccount(alpacaAccount);
    } catch (error) {
      throw this.wrapError(error, 'getAccount');
    }
  }

  // ==================== Position Operations ====================

  /**
   * Get all open positions
   */
  async getPositions(): Promise<BrokerPosition[]> {
    try {
      const alpacaPositions = await alpaca.getPositions();
      return alpacaPositions.map(pos => this.mapAlpacaPosition(pos));
    } catch (error) {
      throw this.wrapError(error, 'getPositions');
    }
  }

  /**
   * Get position for specific symbol
   */
  async getPosition(symbol: string): Promise<BrokerPosition | null> {
    try {
      const alpacaPosition = await alpaca.getPosition(symbol);
      if (!alpacaPosition) {
        return null;
      }
      return this.mapAlpacaPosition(alpacaPosition);
    } catch (error) {
      throw this.wrapError(error, 'getPosition');
    }
  }

  /**
   * Close a specific position
   */
  async closePosition(symbol: string): Promise<BrokerOrder> {
    try {
      const alpacaOrder = await alpaca.closePosition(symbol);
      return this.mapAlpacaOrder(alpacaOrder);
    } catch (error) {
      throw this.wrapError(error, 'closePosition');
    }
  }

  /**
   * Close all open positions
   */
  async closeAllPositions(): Promise<BrokerOrder[]> {
    try {
      const alpacaOrders = await alpaca.closeAllPositions();
      return alpacaOrders.map(order => this.mapAlpacaOrder(order));
    } catch (error) {
      throw this.wrapError(error, 'closeAllPositions');
    }
  }

  // ==================== Order Operations ====================

  /**
   * Create a new order
   */
  async createOrder(params: OrderParams): Promise<BrokerOrder> {
    try {
      const alpacaParams = this.mapToAlpacaOrderParams(params);
      const alpacaOrder = await alpaca.createOrder(alpacaParams);
      return this.mapAlpacaOrder(alpacaOrder);
    } catch (error) {
      throw this.wrapError(error, 'createOrder');
    }
  }

  /**
   * Create a bracket order (entry + take profit + stop loss)
   */
  async createBracketOrder(params: BracketOrderParams): Promise<BrokerOrder> {
    try {
      // Validate required parameters
      if (!params.quantity) {
        throw new Error('Bracket order requires quantity parameter');
      }

      const alpacaParams: AlpacaBracketOrderParams = {
        symbol: params.symbol,
        qty: params.quantity.toString(),
        side: params.side,
        type: (params.type === 'market' || params.type === 'limit' ? params.type : 'market') as 'market' | 'limit',
        time_in_force: (params.timeInForce === 'day' || params.timeInForce === 'gtc' ? params.timeInForce : 'day') as 'day' | 'gtc',
        take_profit_price: params.takeProfitPrice.toString(),
        stop_loss_price: params.stopLossPrice.toString(),
      };

      // Add optional limit price for entry order
      if (params.limitPrice) {
        alpacaParams.limit_price = params.limitPrice.toString();
      }

      const alpacaOrder = await alpaca.createBracketOrder(alpacaParams);
      return this.mapAlpacaOrder(alpacaOrder);
    } catch (error) {
      throw this.wrapError(error, 'createBracketOrder');
    }
  }

  /**
   * Get all orders filtered by status
   */
  async getOrders(status: 'open' | 'closed' | 'all' = 'all', limit: number = 50): Promise<BrokerOrder[]> {
    try {
      const alpacaOrders = await alpaca.getOrders(status, limit);
      return alpacaOrders.map(order => this.mapAlpacaOrder(order));
    } catch (error) {
      throw this.wrapError(error, 'getOrders');
    }
  }

  /**
   * Get a specific order by ID
   */
  async getOrder(orderId: string): Promise<BrokerOrder | null> {
    try {
      const alpacaOrder = await alpaca.getOrder(orderId);
      if (!alpacaOrder) {
        return null;
      }
      return this.mapAlpacaOrder(alpacaOrder);
    } catch (error) {
      throw this.wrapError(error, 'getOrder');
    }
  }

  /**
   * Cancel a pending order
   */
  async cancelOrder(orderId: string): Promise<void> {
    try {
      await alpaca.cancelOrder(orderId);
    } catch (error) {
      throw this.wrapError(error, 'cancelOrder');
    }
  }

  /**
   * Cancel all pending orders
   */
  async cancelAllOrders(): Promise<void> {
    try {
      await alpaca.cancelAllOrders();
    } catch (error) {
      throw this.wrapError(error, 'cancelAllOrders');
    }
  }

  // ==================== Market Data Operations ====================

  /**
   * Get a real-time quote for a security
   */
  async getQuote(symbol: string): Promise<BrokerQuote> {
    try {
      const snapshots = await alpaca.getSnapshots([symbol]);
      const snapshot = snapshots[symbol];

      if (!snapshot) {
        throw new Error(`No snapshot data available for ${symbol}`);
      }

      return {
        bid: snapshot.latestQuote.bp,
        ask: snapshot.latestQuote.ap,
        last: snapshot.latestTrade.p,
      };
    } catch (error) {
      throw this.wrapError(error, 'getQuote');
    }
  }

  /**
   * Get market snapshots for multiple symbols
   */
  async getSnapshots(symbols: string[]): Promise<Map<string, MarketSnapshot>> {
    try {
      const alpacaSnapshots = await alpaca.getSnapshots(symbols);
      const snapshotMap = new Map<string, MarketSnapshot>();

      for (const [symbol, snapshot] of Object.entries(alpacaSnapshots)) {
        if (snapshot) {
          snapshotMap.set(symbol, this.mapAlpacaSnapshot(symbol, snapshot));
        }
      }

      return snapshotMap;
    } catch (error) {
      throw this.wrapError(error, 'getSnapshots');
    }
  }

  // ==================== Health & Connection ====================

  /**
   * Perform a health check on the broker connection
   */
  async healthCheck(): Promise<BrokerHealthCheck> {
    try {
      const startTime = Date.now();
      const healthResult = await alpaca.healthCheck();
      const latencyMs = Date.now() - startTime;

      return {
        healthy: healthResult.overall === 'healthy',
        latencyMs,
      };
    } catch (error) {
      throw this.wrapError(error, 'healthCheck');
    }
  }

  /**
   * Get the current connection status
   */
  async getConnectionStatus(): Promise<BrokerConnectionStatus> {
    try {
      const status = alpaca.getConnectionStatus();

      return {
        connected: status.connected,
        mode: 'paper', // Alpaca connector is currently using paper trading
      };
    } catch (error) {
      throw this.wrapError(error, 'getConnectionStatus');
    }
  }
}

/**
 * Export singleton instance for convenience
 * This allows importing and using the adapter without instantiation:
 *
 * import { alpacaRestAdapter } from './adapters/alpaca-rest-adapter';
 * const account = await alpacaRestAdapter.getAccount();
 */
export const alpacaRestAdapter = new AlpacaRestAdapter();
