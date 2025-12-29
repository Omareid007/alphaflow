import { toDecimal, toNumber } from "./money";

export function safeParseFloat(
  value: string | number | null | undefined,
  defaultValue: number = 0
): number {
  if (value === null || value === undefined || value === "") {
    return defaultValue;
  }

  // Handle numbers directly - check for finite before using Decimal
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : defaultValue;
  }

  // Trim string whitespace before parsing (matching original parseFloat behavior)
  const trimmed = value.trim();
  if (trimmed === "") {
    return defaultValue;
  }

  // Use Decimal.js for precision, then convert to number for API compatibility
  return toNumber(toDecimal(trimmed, defaultValue));
}

export function safeParseInt(
  value: string | number | null | undefined,
  defaultValue: number = 0
): number {
  if (value === null || value === undefined || value === "") {
    return defaultValue;
  }

  if (typeof value === "number") {
    return Number.isFinite(value) ? Math.floor(value) : defaultValue;
  }

  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : defaultValue;
}

export function formatPrice(value: number, decimals: number = 2): string {
  // Use Decimal.js for proper rounding
  return toDecimal(value).toDecimalPlaces(decimals).toFixed(decimals);
}

export function formatQuantity(value: number, decimals: number = 4): string {
  const d = toDecimal(value);
  if (!d.isFinite()) return "0";
  if (d.isInteger()) return d.toString();
  return d
    .toDecimalPlaces(decimals)
    .toFixed(decimals)
    .replace(/\.?0+$/, "");
}

export function formatPercent(value: number, decimals: number = 2): string {
  const d = toDecimal(value);
  if (!d.isFinite()) return "0.00%";
  return `${d.toDecimalPlaces(decimals).toFixed(decimals)}%`;
}

export function calculatePnL(
  entryPrice: number,
  exitPrice: number,
  quantity: number,
  side: "long" | "short" = "long"
): number {
  // Check for non-finite values BEFORE Decimal conversion
  if (
    !Number.isFinite(entryPrice) ||
    !Number.isFinite(exitPrice) ||
    !Number.isFinite(quantity)
  ) {
    return 0;
  }

  // Use Decimal.js for precise PnL calculation
  const entry = toDecimal(entryPrice);
  const exit = toDecimal(exitPrice);
  const qty = toDecimal(quantity);

  if (side === "long") {
    return exit.minus(entry).times(qty).toNumber();
  } else {
    return entry.minus(exit).times(qty).toNumber();
  }
}

export function calculatePercentChange(
  currentPrice: number,
  previousPrice: number
): number {
  // Check for non-finite values BEFORE Decimal conversion
  if (
    !Number.isFinite(currentPrice) ||
    !Number.isFinite(previousPrice) ||
    previousPrice === 0
  ) {
    return 0;
  }

  // Use Decimal.js for precise percentage calculation
  const current = toDecimal(currentPrice);
  const previous = toDecimal(previousPrice);

  return current.minus(previous).dividedBy(previous).times(100).toNumber();
}

export interface NormalizedAccountData {
  id: string;
  accountNumber: string;
  status: string;
  currency: string;
  buyingPower: number;
  cash: number;
  portfolioValue: number;
  equity: number;
  lastEquity: number;
  multiplier: number;
  initialMargin: number;
  maintenanceMargin: number;
  daytradeCount: number;
  patternDayTrader: boolean;
  tradingBlocked: boolean;
  transfersBlocked: boolean;
  accountBlocked: boolean;
  shortingEnabled: boolean;
}

export interface NormalizedPositionData {
  assetId: string;
  symbol: string;
  exchange: string;
  assetClass: string;
  avgEntryPrice: number;
  quantity: number;
  side: string;
  marketValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  unrealizedIntradayPnl: number;
  unrealizedIntradayPnlPercent: number;
  currentPrice: number;
  lastdayPrice: number;
  changeToday: number;
}

export interface NormalizedOrderData {
  id: string;
  clientOrderId: string;
  createdAt: string;
  updatedAt: string;
  submittedAt: string;
  filledAt: string | null;
  expiredAt: string | null;
  canceledAt: string | null;
  failedAt: string | null;
  assetId: string;
  symbol: string;
  assetClass: string;
  notional: number | null;
  quantity: number;
  filledQuantity: number;
  filledAvgPrice: number | null;
  orderClass: string;
  orderType: string;
  type: string;
  side: string;
  timeInForce: string;
  limitPrice: number | null;
  stopPrice: number | null;
  status: string;
  extendedHours: boolean;
}

export function normalizeAccountData(account: {
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
  shorting_enabled: boolean;
  equity: string;
  last_equity: string;
  multiplier: string;
  initial_margin: string;
  maintenance_margin: string;
  daytrade_count: number;
}): NormalizedAccountData {
  return {
    id: account.id,
    accountNumber: account.account_number,
    status: account.status,
    currency: account.currency,
    buyingPower: safeParseFloat(account.buying_power),
    cash: safeParseFloat(account.cash),
    portfolioValue: safeParseFloat(account.portfolio_value),
    equity: safeParseFloat(account.equity),
    lastEquity: safeParseFloat(account.last_equity),
    multiplier: safeParseFloat(account.multiplier),
    initialMargin: safeParseFloat(account.initial_margin),
    maintenanceMargin: safeParseFloat(account.maintenance_margin),
    daytradeCount: account.daytrade_count,
    patternDayTrader: account.pattern_day_trader,
    tradingBlocked: account.trading_blocked,
    transfersBlocked: account.transfers_blocked,
    accountBlocked: account.account_blocked,
    shortingEnabled: account.shorting_enabled,
  };
}

export function normalizePositionData(position: {
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
}): NormalizedPositionData {
  return {
    assetId: position.asset_id,
    symbol: position.symbol,
    exchange: position.exchange,
    assetClass: position.asset_class,
    avgEntryPrice: safeParseFloat(position.avg_entry_price),
    quantity: safeParseFloat(position.qty),
    side: position.side,
    marketValue: safeParseFloat(position.market_value),
    costBasis: safeParseFloat(position.cost_basis),
    unrealizedPnl: safeParseFloat(position.unrealized_pl),
    unrealizedPnlPercent: safeParseFloat(position.unrealized_plpc),
    unrealizedIntradayPnl: safeParseFloat(position.unrealized_intraday_pl),
    unrealizedIntradayPnlPercent: safeParseFloat(
      position.unrealized_intraday_plpc
    ),
    currentPrice: safeParseFloat(position.current_price),
    lastdayPrice: safeParseFloat(position.lastday_price),
    changeToday: safeParseFloat(position.change_today),
  };
}

export function normalizeOrderData(order: {
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
}): NormalizedOrderData {
  return {
    id: order.id,
    clientOrderId: order.client_order_id,
    createdAt: order.created_at,
    updatedAt: order.updated_at,
    submittedAt: order.submitted_at,
    filledAt: order.filled_at,
    expiredAt: order.expired_at,
    canceledAt: order.canceled_at,
    failedAt: order.failed_at,
    assetId: order.asset_id,
    symbol: order.symbol,
    assetClass: order.asset_class,
    notional: order.notional ? safeParseFloat(order.notional) : null,
    quantity: safeParseFloat(order.qty),
    filledQuantity: safeParseFloat(order.filled_qty),
    filledAvgPrice: order.filled_avg_price
      ? safeParseFloat(order.filled_avg_price)
      : null,
    orderClass: order.order_class,
    orderType: order.order_type,
    type: order.type,
    side: order.side,
    timeInForce: order.time_in_force,
    limitPrice: order.limit_price ? safeParseFloat(order.limit_price) : null,
    stopPrice: order.stop_price ? safeParseFloat(order.stop_price) : null,
    status: order.status,
    extendedHours: order.extended_hours,
  };
}
