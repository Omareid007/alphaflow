import type { AlpacaPosition, AlpacaOrder } from "../server/connectors/alpaca";

export interface DataSourceMetadata {
  source: "alpaca_live" | "cache_stale" | "unavailable";
  fetchedAt: string;
  cacheAge?: number;
  isStale: boolean;
}

export interface EnrichedPosition {
  id: string;
  symbol: string;
  // SYNC FIX: Use 'qty' for consistency with frontend Position interface
  qty: number;
  quantity: number; // Deprecated: kept for backward compatibility
  entryPrice: number;
  currentPrice: number;
  // SYNC FIX: Use 'unrealizedPl' for consistency with frontend Position interface
  unrealizedPl: number;
  unrealizedPnl: number; // Deprecated: kept for backward compatibility
  // SYNC FIX: Use 'unrealizedPlPct' for consistency with frontend Position interface
  unrealizedPlPct: number;
  unrealizedPnlPercent: number; // Deprecated: kept for backward compatibility
  side: "long" | "short";
  marketValue: number;
  costBasis: number;
  changeToday: number;
  assetClass: string;
  exchange: string;
  _source: DataSourceMetadata;
}

export interface EnrichedOrder {
  id: string;
  clientOrderId: string;
  symbol: string;
  quantity: number;
  filledQuantity: number;
  side: "buy" | "sell";
  type: string;
  status: string;
  limitPrice: number | null;
  stopPrice: number | null;
  filledAvgPrice: number | null;
  createdAt: string;
  filledAt: string | null;
  timeInForce: string;
  extendedHours: boolean;
  _source: DataSourceMetadata;
}

export function safeParseFloat(
  value: string | number | null | undefined,
  fallback: number = 0
): number {
  if (value === null || value === undefined) return fallback;
  const parsed = typeof value === "number" ? value : parseFloat(value);
  return isNaN(parsed) ? fallback : parsed;
}

export function mapAlpacaPositionToEnriched(
  position: AlpacaPosition,
  fetchedAt: Date = new Date()
): EnrichedPosition {
  const qtyValue = safeParseFloat(position.qty);
  const unrealizedPlValue = safeParseFloat(position.unrealized_pl);
  const unrealizedPlPctValue = safeParseFloat(position.unrealized_plpc) * 100;

  return {
    id: position.asset_id,
    symbol: position.symbol,
    // SYNC FIX: Provide both field names for backward compatibility
    qty: qtyValue,
    quantity: qtyValue, // Deprecated alias
    entryPrice: safeParseFloat(position.avg_entry_price),
    currentPrice: safeParseFloat(position.current_price),
    // SYNC FIX: Provide both field names for backward compatibility
    unrealizedPl: unrealizedPlValue,
    unrealizedPnl: unrealizedPlValue, // Deprecated alias
    // SYNC FIX: Provide both field names for backward compatibility
    unrealizedPlPct: unrealizedPlPctValue,
    unrealizedPnlPercent: unrealizedPlPctValue, // Deprecated alias
    side: qtyValue > 0 ? "long" : "short",
    marketValue: safeParseFloat(position.market_value),
    costBasis: safeParseFloat(position.cost_basis),
    changeToday: safeParseFloat(position.change_today) * 100,
    assetClass: position.asset_class,
    exchange: position.exchange,
    _source: {
      source: "alpaca_live",
      fetchedAt: fetchedAt.toISOString(),
      isStale: false,
    },
  };
}

export function mapAlpacaOrderToEnriched(
  order: AlpacaOrder,
  fetchedAt: Date = new Date()
): EnrichedOrder {
  return {
    id: order.id,
    clientOrderId: order.client_order_id,
    symbol: order.symbol,
    quantity: safeParseFloat(order.qty),
    filledQuantity: safeParseFloat(order.filled_qty),
    side: order.side as "buy" | "sell",
    type: order.type,
    status: order.status,
    limitPrice: order.limit_price ? safeParseFloat(order.limit_price) : null,
    stopPrice: order.stop_price ? safeParseFloat(order.stop_price) : null,
    filledAvgPrice: order.filled_avg_price
      ? safeParseFloat(order.filled_avg_price)
      : null,
    createdAt: order.created_at,
    filledAt: order.filled_at,
    timeInForce: order.time_in_force,
    extendedHours: order.extended_hours,
    _source: {
      source: "alpaca_live",
      fetchedAt: fetchedAt.toISOString(),
      isStale: false,
    },
  };
}

export interface DBPositionInsert {
  id?: string;
  symbol: string;
  quantity: string;
  entryPrice: string;
  currentPrice: string;
  unrealizedPnl: string;
  side: string;
  strategyId?: string | null;
}

export function mapAlpacaPositionToDBInsert(
  position: AlpacaPosition
): DBPositionInsert {
  const qty = safeParseFloat(position.qty);

  return {
    symbol: position.symbol,
    quantity: position.qty,
    entryPrice: position.avg_entry_price,
    currentPrice: position.current_price,
    unrealizedPnl: position.unrealized_pl,
    side: qty > 0 ? "long" : "short",
  };
}

export function createUnavailableSourceMetadata(
  error?: string
): DataSourceMetadata {
  return {
    source: "unavailable",
    fetchedAt: new Date().toISOString(),
    isStale: true,
  };
}

export function createStaleSourceMetadata(cachedAt: Date): DataSourceMetadata {
  const now = new Date();
  return {
    source: "cache_stale",
    fetchedAt: cachedAt.toISOString(),
    cacheAge: now.getTime() - cachedAt.getTime(),
    isStale: true,
  };
}

export function createLiveSourceMetadata(): DataSourceMetadata {
  return {
    source: "alpaca_live",
    fetchedAt: new Date().toISOString(),
    isStale: false,
  };
}

export interface PositionResponse {
  positions: EnrichedPosition[];
  _source: DataSourceMetadata;
}

export interface OrderResponse {
  orders: EnrichedOrder[];
  _source: DataSourceMetadata;
}

export function createPositionResponse(
  positions: EnrichedPosition[],
  sourceMetadata: DataSourceMetadata
): PositionResponse {
  return {
    positions,
    _source: sourceMetadata,
  };
}

export function createOrderResponse(
  orders: EnrichedOrder[],
  sourceMetadata: DataSourceMetadata
): OrderResponse {
  return {
    orders,
    _source: sourceMetadata,
  };
}
