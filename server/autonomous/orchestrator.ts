import { alpaca, CreateOrderParams, AlpacaOrder } from "../connectors/alpaca";
import { aiDecisionEngine, AIDecision, MarketData } from "../ai/decision-engine";
import { finnhub } from "../connectors/finnhub";
import { coingecko } from "../connectors/coingecko";
import { storage } from "../storage";
import type { Strategy, WorkItem } from "@shared/schema";
import { safeParseFloat } from "../utils/numeric";
import { marketConditionAnalyzer } from "../ai/market-condition-analyzer";
import { log } from "../utils/logger";
import { waitForAlpacaOrderFill, cancelExpiredOrders, type OrderFillResult } from "../trading/order-execution-flow";
import { recordDecisionFeatures, recordTradeOutcome, updateTradeOutcomeOnClose, runCalibrationAnalysis } from "../ai/learning-service";
import { tradabilityService } from "../services/tradability-service";
import { workQueue, generateIdempotencyKey } from "../lib/work-queue";
import { candidatesService } from "../universe/candidatesService";
import { alpacaTradingEngine } from "../trading/alpaca-trading-engine";
import { tradingSessionManager } from "../services/trading-session-manager";

const DEFAULT_HARD_STOP_LOSS_PERCENT = 3;
const DEFAULT_TAKE_PROFIT_PERCENT = 6;

// Universe expansion constants (Section A requirements)
// OLD CONSERVATIVE VALUES (commented for rollback):
// const MAX_STOCK_SYMBOLS_PER_CYCLE = 120;
// const MAX_CRYPTO_SYMBOLS_PER_CYCLE = 20;
// const MIN_CONFIDENCE_FOR_UNIVERSE = 0.65;

// AGGRESSIVE VALUES - Maximize symbol coverage and trading opportunities
const MAX_STOCK_SYMBOLS_PER_CYCLE = 500;  // AGGRESSIVE: Increased from 120 to analyze more stocks
const MAX_CRYPTO_SYMBOLS_PER_CYCLE = 100;  // AGGRESSIVE: Increased from 20 to analyze more crypto
const ALPACA_SNAPSHOT_CHUNK_SIZE = 50;
const RECENT_DECISIONS_LOOKBACK = 500;
const MIN_CONFIDENCE_FOR_UNIVERSE = 0.50;  // AGGRESSIVE: Lowered from 0.65 to include more candidates

// Universe expansion state for rotation
interface UniverseRotationState {
  stockRotationOffset: number;
  cryptoRotationOffset: number;
  lastRotationTime: Date;
}

const universeRotationState: UniverseRotationState = {
  stockRotationOffset: 0,
  cryptoRotationOffset: 0,
  lastRotationTime: new Date(),
};

export interface UniverseSymbols {
  stocks: string[];
  crypto: string[];
  sources: {
    watchlist: number;
    candidates: number;
    recentDecisions: number;
    executedTrades: number;
  };
}

export interface OrchestratorConfig {
  analysisIntervalMs: number;
  positionCheckIntervalMs: number;
  enabled: boolean;
}

export interface PositionWithRules {
  symbol: string;
  quantity: number;
  availableQuantity: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  unrealizedPnlPercent: number;
  stopLossPrice?: number;
  takeProfitPrice?: number;
  trailingStopPercent?: number;
  maxHoldingPeriodMs?: number;
  openedAt: Date;
  strategyId?: string;
}

export interface RiskLimits {
  maxPositionSizePercent: number;
  maxTotalExposurePercent: number;
  maxPositionsCount: number;
  dailyLossLimitPercent: number;
  killSwitchActive: boolean;
}

export interface ExecutionResult {
  success: boolean;
  orderId?: string;
  error?: string;
  action: "buy" | "sell" | "hold" | "skip";
  reason: string;
  symbol: string;
  quantity?: number;
  price?: number;
}

export interface OrchestratorState {
  isRunning: boolean;
  mode: "autonomous" | "semi-auto" | "manual";
  lastAnalysisTime: Date | null;
  lastPositionCheckTime: Date | null;
  activePositions: Map<string, PositionWithRules>;
  pendingSignals: Map<string, AIDecision>;
  executionHistory: ExecutionResult[];
  dailyPnl: number;
  dailyTradeCount: number;
  errors: string[];
}

const DEFAULT_CONFIG: OrchestratorConfig = {
  analysisIntervalMs: 60000,
  positionCheckIntervalMs: 30000,
  enabled: true,
};

// OLD CONSERVATIVE RISK LIMITS (commented for rollback):
// const DEFAULT_RISK_LIMITS: RiskLimits = {
//   maxPositionSizePercent: 10,
//   maxTotalExposurePercent: 50,
//   maxPositionsCount: 10,
//   dailyLossLimitPercent: 5,
//   killSwitchActive: false,
// };

// AGGRESSIVE RISK LIMITS - Maximize buying power utilization
const DEFAULT_RISK_LIMITS: RiskLimits = {
  maxPositionSizePercent: 15,          // AGGRESSIVE: Increased from 10 to allow larger positions
  maxTotalExposurePercent: 95,         // AGGRESSIVE: Increased from 50 to use 95% of buying power (5% cash reserve)
  maxPositionsCount: 100,              // AGGRESSIVE: Increased from 10 to enterprise-level 100 positions
  dailyLossLimitPercent: 5,            // Keep same for safety
  killSwitchActive: false,
};

const WATCHLIST = {
  stocks: [
    // Technology
    "AAPL", "MSFT", "GOOGL", "AMZN", "NVDA", "META", "TSLA", "AVGO", "ORCL", "CRM",
    "AMD", "INTC", "IBM", "CSCO", "ADBE", "NFLX", "PYPL", "NOW", "UBER", "ABNB",
    // Financials
    "JPM", "V", "MA", "BAC", "WFC", "GS", "MS", "BLK", "SCHW", "AXP",
    "C", "USB", "PNC", "TFC", "COF", "SPGI", "ICE", "CME", "MCO", "MSCI",
    // Healthcare
    "UNH", "JNJ", "LLY", "PFE", "ABBV", "MRK", "TMO", "ABT", "DHR", "BMY",
    "AMGN", "GILD", "ISRG", "VRTX", "REGN", "MDT", "SYK", "BSX", "ZTS", "CI",
    // Consumer Discretionary
    "HD", "NKE", "MCD", "SBUX", "LOW", "TJX", "BKNG", "CMG", "LULU", "YUM",
    "MAR", "HLT", "DPZ", "ORLY", "AZO", "ROST", "ULTA", "EBAY", "ETSY", "DKNG",
    // Consumer Staples
    "WMT", "PG", "KO", "PEP", "COST", "PM", "MO", "EL", "CL", "MDLZ",
    "KMB", "GIS", "K", "HSY", "SJM", "KHC", "STZ", "TAP", "CLX", "CHD",
    // Energy
    "CVX", "XOM", "COP", "SLB", "EOG", "PXD", "MPC", "VLO", "PSX", "OXY",
    "KMI", "WMB", "HAL", "BKR", "DVN", "FANG", "HES", "MRO", "APA", "OKE",
    // Industrials
    "UPS", "RTX", "HON", "BA", "CAT", "GE", "DE", "LMT", "UNP", "MMM",
    "FDX", "NSC", "CSX", "WM", "RSG", "EMR", "ITW", "ETN", "ROK", "CMI",
    // Materials
    "LIN", "APD", "SHW", "ECL", "NEM", "FCX", "NUE", "DD", "PPG", "DOW",
    "VMC", "MLM", "ALB", "CF", "MOS", "FMC", "IP", "AVY", "SEE", "PKG",
    // Utilities
    "NEE", "DUK", "SO", "D", "AEP", "SRE", "EXC", "XEL", "PEG", "ED",
    "WEC", "ES", "AWK", "ATO", "NI", "CMS", "LNT", "EVRG", "DTE", "AEE",
    // Real Estate
    "AMT", "PLD", "CCI", "EQIX", "PSA", "SPG", "O", "WELL", "DLR", "AVB",
    "EQR", "VTR", "ARE", "UDR", "MAA", "ESS", "PEAK", "INVH", "IRM", "REG",
    // Communication Services
    "DIS", "CMCSA", "VZ", "T", "TMUS", "CHTR", "NFLX", "EA", "TTWO", "WBD",
    "PARA", "FOX", "FOXA", "LYV", "MTCH", "ZG", "PINS", "SNAP", "ROKU", "TTD",
  ],
  crypto: ["BTC", "ETH", "SOL", "DOGE", "SHIB", "AVAX"],
};

function isCryptoSymbol(symbol: string): boolean {
  const upperSymbol = symbol.toUpperCase();
  // Check bare tickers
  if (WATCHLIST.crypto.includes(upperSymbol)) return true;
  // Check USD pairs (e.g., BTC/USD, BTCUSD)
  const cryptoPairs = WATCHLIST.crypto.flatMap(c => [`${c}/USD`, `${c}USD`]);
  return cryptoPairs.includes(upperSymbol) || 
         (symbol.includes("/") && upperSymbol.endsWith("USD"));
}

function normalizeCryptoSymbol(symbol: string): string {
  const upperSymbol = symbol.toUpperCase();
  // Already in correct format
  if (upperSymbol.includes("/")) return upperSymbol;
  // Bare ticker (BTC -> BTC/USD)
  if (WATCHLIST.crypto.includes(upperSymbol)) return `${upperSymbol}/USD`;
  // BTCUSD format -> BTC/USD
  if (upperSymbol.endsWith("USD") && upperSymbol.length > 3) {
    const base = upperSymbol.slice(0, -3);
    return `${base}/USD`;
  }
  return upperSymbol;
}

const QUEUE_POLL_INTERVAL_MS = 2000;
const QUEUE_POLL_TIMEOUT_MS = 60000;

interface QueuedOrderResult {
  orderId: string;
  status: string;
  workItemId: string;
}

async function queueOrderExecution(params: {
  orderParams: CreateOrderParams;
  traceId: string | null;
  strategyId?: string;
  symbol: string;
  side: "buy" | "sell";
  decisionId?: string;
}): Promise<QueuedOrderResult> {
  const { orderParams, traceId, strategyId, symbol, side, decisionId } = params;
  
  const timestampBucket = Math.floor(Date.now() / 300000).toString();
  const idempotencyKey = generateIdempotencyKey({
    strategyId: strategyId || "autonomous",
    symbol,
    side,
    timeframeBucket: timestampBucket,
  });

  log.info("Orchestrator", `Queuing ORDER_SUBMIT for ${symbol} ${side}`, { 
    traceId, 
    idempotencyKey,
    symbol,
    side,
  });

  const normalizedOrderParams = {
    symbol: orderParams.symbol,
    side: orderParams.side,
    type: orderParams.type || "market",
    time_in_force: orderParams.time_in_force || "day",
    ...(orderParams.qty && { qty: orderParams.qty }),
    ...(orderParams.notional && { notional: orderParams.notional }),
    ...(orderParams.limit_price && { limit_price: orderParams.limit_price }),
    ...(orderParams.stop_price && { stop_price: orderParams.stop_price }),
    ...(orderParams.extended_hours !== undefined && { extended_hours: orderParams.extended_hours }),
    ...(orderParams.order_class && { order_class: orderParams.order_class }),
    ...(orderParams.take_profit && { take_profit: orderParams.take_profit }),
    ...(orderParams.stop_loss && { stop_loss: orderParams.stop_loss }),
  };

  const workItem = await workQueue.enqueue({
    type: "ORDER_SUBMIT",
    symbol,
    idempotencyKey,
    decisionId: decisionId || null,
    payload: JSON.stringify({
      ...normalizedOrderParams,
      traceId,
      strategyId,
    }),
    maxAttempts: 3,
  });

  log.info("Orchestrator", `Work item created: ${workItem.id}`, { 
    traceId, 
    workItemId: workItem.id,
    status: workItem.status,
  });

  if (workItem.status === "SUCCEEDED" && workItem.result) {
    const result = JSON.parse(workItem.result);
    log.info("Orchestrator", `Order already succeeded (duplicate): ${result.orderId}`, { traceId });
    return {
      orderId: result.orderId,
      status: result.status || "filled",
      workItemId: workItem.id,
    };
  }

  const startTime = Date.now();
  while (Date.now() - startTime < QUEUE_POLL_TIMEOUT_MS) {
    await new Promise(resolve => setTimeout(resolve, QUEUE_POLL_INTERVAL_MS));
    
    const updatedItem = await workQueue.getById(workItem.id);
    if (!updatedItem) {
      throw new Error(`Work item ${workItem.id} not found during polling`);
    }

    if (updatedItem.status === "SUCCEEDED") {
      const result = updatedItem.result ? JSON.parse(updatedItem.result) : {};
      const orderStatus = result.status || "accepted";
      const validSuccessStates = ["filled", "accepted", "new", "pending_new", "partially_filled", "queued"];
      
      if (validSuccessStates.includes(orderStatus.toLowerCase()) || result.orderId || updatedItem.brokerOrderId) {
        log.info("Orchestrator", `ORDER_SUBMIT succeeded: ${result.orderId || updatedItem.brokerOrderId}`, { 
          traceId, 
          workItemId: workItem.id,
          orderId: result.orderId,
          orderStatus,
        });
        return {
          orderId: result.orderId || updatedItem.brokerOrderId || "",
          status: orderStatus,
          workItemId: workItem.id,
        };
      }
    }

    if (updatedItem.brokerOrderId && !updatedItem.result) {
      log.info("Orchestrator", `ORDER_SUBMIT has broker order ID: ${updatedItem.brokerOrderId}`, { 
        traceId, 
        workItemId: workItem.id,
      });
      return {
        orderId: updatedItem.brokerOrderId,
        status: "accepted",
        workItemId: workItem.id,
      };
    }

    if (updatedItem.status === "DEAD_LETTER") {
      log.error("Orchestrator", `ORDER_SUBMIT failed permanently: ${updatedItem.lastError}`, { 
        traceId, 
        workItemId: workItem.id,
      });
      throw new Error(`Order submission failed: ${updatedItem.lastError || "Unknown error"}`);
    }

    log.info("Orchestrator", `Polling work item ${workItem.id}: ${updatedItem.status}`, { 
      traceId,
      attempts: updatedItem.attempts,
    });
  }

  throw new Error(`Order submission timed out after ${QUEUE_POLL_TIMEOUT_MS}ms`);
}

async function queueOrderCancellation(params: {
  orderId: string;
  traceId: string | null;
  symbol: string;
  strategyId?: string;
}): Promise<void> {
  const { orderId, traceId, symbol, strategyId } = params;

  const timestampBucket = Math.floor(Date.now() / 60000).toString();
  const idempotencyKey = generateIdempotencyKey({
    strategyId: strategyId || "autonomous",
    symbol,
    side: `cancel-${orderId}`,
    timeframeBucket: timestampBucket,
  });

  log.info("Orchestrator", `Queuing ORDER_CANCEL for order ${orderId}`, { 
    traceId, 
    orderId,
    symbol,
    idempotencyKey,
  });

  const workItem = await workQueue.enqueue({
    type: "ORDER_CANCEL",
    symbol,
    idempotencyKey,
    payload: JSON.stringify({ orderId, traceId }),
    maxAttempts: 3,
  });

  if (workItem.status === "SUCCEEDED") {
    log.info("Orchestrator", `Order cancellation already succeeded (duplicate)`, { traceId, orderId });
    return;
  }

  const startTime = Date.now();
  while (Date.now() - startTime < QUEUE_POLL_TIMEOUT_MS) {
    await new Promise(resolve => setTimeout(resolve, QUEUE_POLL_INTERVAL_MS));
    
    const updatedItem = await workQueue.getById(workItem.id);
    if (!updatedItem) {
      throw new Error(`Cancel work item ${workItem.id} not found during polling`);
    }

    if (updatedItem.status === "SUCCEEDED") {
      log.info("Orchestrator", `ORDER_CANCEL succeeded for order ${orderId}`, { traceId });
      return;
    }

    if (updatedItem.status === "CANCELLED") {
      log.info("Orchestrator", `ORDER_CANCEL completed with CANCELLED status for order ${orderId}`, { traceId });
      return;
    }

    if (updatedItem.status === "DEAD_LETTER") {
      const errorLower = (updatedItem.lastError || "").toLowerCase();
      if (errorLower.includes("already") || errorLower.includes("cancel") || errorLower.includes("not found")) {
        log.info("Orchestrator", `ORDER_CANCEL completed (order already cancelled or not found): ${orderId}`, { traceId });
        return;
      }
      log.warn("Orchestrator", `ORDER_CANCEL failed: ${updatedItem.lastError}`, { 
        traceId, 
        orderId,
      });
      return;
    }
  }

  log.warn("Orchestrator", `Order cancellation timed out for ${orderId}`, { traceId });
}

const HEARTBEAT_INTERVAL_MS = 30000;
const STALE_HEARTBEAT_THRESHOLD_MS = 120000;
const AUTO_RESTART_DELAY_MS = 5000;
const MAX_CONSECUTIVE_ERRORS = 5;

interface PreTradeCheck {
  canTrade: boolean;
  reason?: string;
  marketSession: "regular" | "pre_market" | "after_hours" | "closed";
  availableBuyingPower: number;
  requiredBuyingPower: number;
  useExtendedHours: boolean;
  useLimitOrder: boolean;
  limitPrice?: number;
}

async function preTradeGuard(
  symbol: string,
  side: "buy" | "sell",
  orderValue: number,
  isCrypto: boolean
): Promise<PreTradeCheck> {
  try {
    const account = await alpaca.getAccount();
    const availableBuyingPower = safeParseFloat(account.buying_power);

    // Use trading session manager for enhanced session detection
    const exchange = isCrypto ? "CRYPTO" : "US_EQUITIES";
    const sessionInfo = tradingSessionManager.getCurrentSession(exchange);

    // Also get Alpaca market status for compatibility
    const marketStatus = await alpaca.getMarketStatus();

    const result: PreTradeCheck = {
      canTrade: false,
      marketSession: sessionInfo.session,
      availableBuyingPower,
      requiredBuyingPower: orderValue,
      useExtendedHours: false,
      useLimitOrder: false,
    };

    if (side === "buy" && orderValue > availableBuyingPower) {
      result.reason = `Insufficient buying power ($${availableBuyingPower.toFixed(2)} available < $${orderValue.toFixed(2)} required)`;
      return result;
    }

    // Crypto markets are 24/7
    if (isCrypto) {
      result.canTrade = true;
      log.info("Orchestrator", `Crypto market 24/7 - trading enabled for ${symbol}`);
      return result;
    }

    // Check if market is on holiday
    if (tradingSessionManager.isHoliday(exchange, new Date())) {
      result.canTrade = false;
      result.reason = `Market is closed for holiday (next open: ${sessionInfo.nextOpen?.toISOString()})`;
      return result;
    }

    // Regular trading hours
    if (sessionInfo.session === "regular") {
      result.canTrade = true;
      log.info("Orchestrator", `Regular hours - trading enabled for ${symbol}`);
      return result;
    }

    // Extended hours trading (pre-market or after-hours)
    if (sessionInfo.isExtendedHours && (sessionInfo.session === "pre_market" || sessionInfo.session === "after_hours")) {
      result.useExtendedHours = true;
      result.useLimitOrder = true;

      try {
        const snapshots = await alpaca.getSnapshots([symbol]);
        const snapshot = snapshots[symbol];
        if (snapshot?.latestTrade?.p) {
          // Apply volatility adjustment for extended hours pricing
          const basePrice = snapshot.latestTrade.p;
          const volatilityMultiplier = sessionInfo.volatilityMultiplier;
          result.limitPrice = Math.round(basePrice * 100) / 100;
          result.canTrade = true;
          log.info("Orchestrator", `Extended hours (${sessionInfo.session}) trading enabled for ${symbol} at $${result.limitPrice} (volatility: ${volatilityMultiplier}x)`);
          return result;
        } else {
          result.reason = `Cannot get current price for ${symbol} during ${sessionInfo.session}`;
          return result;
        }
      } catch (error) {
        result.reason = `Failed to get market price for extended hours order: ${error}`;
        return result;
      }
    }

    // Market is closed
    if (sessionInfo.session === "closed") {
      result.canTrade = false;
      const nextOpenStr = sessionInfo.nextOpen ? sessionInfo.nextOpen.toLocaleString() : "unknown";
      result.reason = `Market is closed (next open: ${nextOpenStr})`;
      log.info("Orchestrator", `Market closed for ${symbol} - next open: ${nextOpenStr}`);
      return result;
    }

    return result;
  } catch (error) {
    return {
      canTrade: false,
      reason: `Pre-trade check failed: ${error}`,
      marketSession: "closed",
      availableBuyingPower: 0,
      requiredBuyingPower: orderValue,
      useExtendedHours: false,
      useLimitOrder: false,
    };
  }
}

async function isSymbolTradable(symbol: string, isCrypto: boolean): Promise<{ tradable: boolean; reason?: string }> {
  try {
    if (isCrypto) {
      const normalizedSymbol = normalizeCryptoSymbol(symbol);
      const assets = await alpaca.getAssets("active", "crypto");
      const found = assets.find(a => a.symbol === normalizedSymbol && a.tradable);
      if (!found) {
        return { tradable: false, reason: `Crypto ${normalizedSymbol} is not tradable on Alpaca` };
      }
      return { tradable: true };
    } else {
      const asset = await alpaca.getAsset(symbol);
      if (!asset.tradable) {
        return { tradable: false, reason: `Stock ${symbol} is not tradable` };
      }
      return { tradable: true };
    }
  } catch (error) {
    return { tradable: false, reason: `Symbol validation failed: ${error}` };
  }
}

class AutonomousOrchestrator {
  private state: OrchestratorState;
  private config: OrchestratorConfig;
  private riskLimits: RiskLimits;
  private analysisTimer: NodeJS.Timeout | null = null;
  private positionTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isProcessing = false;
  private consecutiveErrors = 0;
  private lastHeartbeat: Date | null = null;
  private autoStartEnabled = true;
  private isAutoStarting = false;
  private lastCalibrationDate: string | null = null;
  private currentTraceId: string | null = null;

  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.riskLimits = { ...DEFAULT_RISK_LIMITS };
    this.state = {
      isRunning: false,
      mode: "autonomous",
      lastAnalysisTime: null,
      lastPositionCheckTime: null,
      activePositions: new Map(),
      pendingSignals: new Map(),
      executionHistory: [],
      dailyPnl: 0,
      dailyTradeCount: 0,
      errors: [],
    };
  }

  async autoStart(): Promise<void> {
    if (this.isAutoStarting) {
      log.info("Orchestrator", "Auto-start already in progress");
      return;
    }

    this.isAutoStarting = true;

    try {
      log.info("Orchestrator", "Auto-start initializing...");

      const agentStatus = await storage.getAgentStatus();
      this.autoStartEnabled = agentStatus?.autoStartEnabled ?? true;

      if (!this.autoStartEnabled) {
        log.info("Orchestrator", "Auto-start is disabled in settings");
        this.isAutoStarting = false;
        return;
      }

      if (agentStatus?.killSwitchActive) {
        log.warn("Orchestrator", "Auto-start blocked: Kill switch is active");
        this.isAutoStarting = false;
        return;
      }

      await marketConditionAnalyzer.initialize();

      await this.start();

      this.startHeartbeat();

      log.info("Orchestrator", "Auto-start complete - Agent is now running persistently");
    } catch (error) {
      log.error("Orchestrator", "Auto-start failed", { error: String(error) });
      this.state.errors.push(`Auto-start failed: ${error}`);

      setTimeout(() => {
        this.isAutoStarting = false;
        this.autoStart().catch(err => {
          log.error("Orchestrator", "Auto-restart retry failed", { error: String(err) });
        });
      }, AUTO_RESTART_DELAY_MS);
    } finally {
      this.isAutoStarting = false;
    }
  }

  private startHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
    }

    this.lastHeartbeat = new Date();

    this.heartbeatTimer = setInterval(async () => {
      await this.performHeartbeat();
    }, HEARTBEAT_INTERVAL_MS) as unknown as NodeJS.Timeout;

    log.info("Orchestrator", "Heartbeat started");
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private async performHeartbeat(): Promise<void> {
    try {
      const now = new Date();
      this.lastHeartbeat = now;

      await storage.updateAgentStatus({
        lastHeartbeat: now,
      });

      await this.checkAndRecoverIfStale();

      if (this.consecutiveErrors > 0) {
        this.consecutiveErrors = Math.max(0, this.consecutiveErrors - 1);
      }
    } catch (error) {
      log.error("Orchestrator", "Heartbeat error", { error: String(error) });
      this.consecutiveErrors++;

      if (this.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        log.warn("Orchestrator", "Too many consecutive errors, triggering self-healing");
        await this.selfHeal();
      }
    }
  }

  private async checkAndRecoverIfStale(): Promise<void> {
    if (!this.state.isRunning) return;

    const now = Date.now();
    const lastAnalysis = this.state.lastAnalysisTime?.getTime() || 0;
    const timeSinceAnalysis = now - lastAnalysis;

    if (timeSinceAnalysis > STALE_HEARTBEAT_THRESHOLD_MS && lastAnalysis > 0) {
      log.warn("Orchestrator", `Stale state detected (${Math.round(timeSinceAnalysis / 1000)}s since last analysis)`);
      await this.selfHeal();
    }
  }

  private async selfHeal(): Promise<void> {
    log.info("Orchestrator", "Initiating self-healing...");

    const wasAutoStartEnabled = this.autoStartEnabled;

    try {
      await this.stop(true);

      await new Promise(resolve => setTimeout(resolve, AUTO_RESTART_DELAY_MS));

      this.consecutiveErrors = 0;
      this.state.errors = [];

      if (wasAutoStartEnabled) {
        await this.start();
        this.startHeartbeat();
        log.info("Orchestrator", "Self-healing complete - Agent restarted");
      }
    } catch (error) {
      log.error("Orchestrator", "Self-healing failed", { error: String(error) });
      this.state.errors.push(`Self-healing failed: ${error}`);
    }
  }

  async setAutoStartEnabled(enabled: boolean): Promise<void> {
    this.autoStartEnabled = enabled;
    await storage.updateAgentStatus({ autoStartEnabled: enabled });
    log.info("Orchestrator", `Auto-start ${enabled ? "enabled" : "disabled"}`);
  }

  isAutoStartEnabledFlag(): boolean {
    return this.autoStartEnabled;
  }

  getHealthStatus(): {
    isHealthy: boolean;
    lastHeartbeat: Date | null;
    consecutiveErrors: number;
    autoStartEnabled: boolean;
    marketCondition: string | null;
    dynamicOrderLimit: number;
  } {
    const analyzerStatus = marketConditionAnalyzer.getStatus();
    return {
      isHealthy: this.consecutiveErrors < MAX_CONSECUTIVE_ERRORS && this.state.isRunning,
      lastHeartbeat: this.lastHeartbeat,
      consecutiveErrors: this.consecutiveErrors,
      autoStartEnabled: this.autoStartEnabled,
      marketCondition: analyzerStatus.lastAnalysis?.condition || null,
      dynamicOrderLimit: analyzerStatus.currentOrderLimit,
    };
  }

  async initialize(): Promise<void> {
    await this.loadRiskLimitsFromDB();
    await this.syncPositionsFromBroker();
    
    // Bootstrap universe candidates if empty - ensures trading enforcement doesn't block all trades
    const allSymbols = [...WATCHLIST.stocks, ...WATCHLIST.crypto.map(c => `${c}/USD`)];
    await candidatesService.ensureWatchlistApproved(allSymbols, "orchestrator-init");
    
    log.info("Orchestrator", "Initialized with risk limits", { ...this.riskLimits });
  }

  private async loadRiskLimitsFromDB(): Promise<void> {
    try {
      const agentStatus = await storage.getAgentStatus();
      const dynamicLimit = marketConditionAnalyzer.getCurrentOrderLimit();
      
      if (agentStatus) {
        this.riskLimits = {
          maxPositionSizePercent: Number(agentStatus.maxPositionSizePercent) || 10,
          maxTotalExposurePercent: Number(agentStatus.maxTotalExposurePercent) || 50,
          maxPositionsCount: agentStatus.dynamicOrderLimit || dynamicLimit || 10,
          dailyLossLimitPercent: Number(agentStatus.dailyLossLimitPercent) || 5,
          killSwitchActive: agentStatus.killSwitchActive || false,
        };
      }
    } catch (error) {
      log.error("Orchestrator", "Failed to load risk limits", { error: String(error) });
    }
  }

  async syncPositionsFromBroker(): Promise<void> {
    try {
      const positions = await alpaca.getPositions();
      const existingPositions = new Map(this.state.activePositions);
      this.state.activePositions.clear();

      try {
        await storage.syncPositionsFromAlpaca(positions);
        log.info("Orchestrator", `Synced ${positions.length} positions to database`);
      } catch (dbError) {
        log.error("Orchestrator", "Failed to sync positions to database", { error: String(dbError) });
      }

      for (const pos of positions) {
        const entryPrice = safeParseFloat(pos.avg_entry_price);
        const currentPrice = safeParseFloat(pos.current_price);
        
        const existingPos = existingPositions.get(pos.symbol);
        
        let stopLossPrice = existingPos?.stopLossPrice;
        let takeProfitPrice = existingPos?.takeProfitPrice;
        let trailingStopPercent = existingPos?.trailingStopPercent;
        
        const hardStopLoss = entryPrice * (1 - DEFAULT_HARD_STOP_LOSS_PERCENT / 100);
        const defaultTakeProfit = entryPrice * (1 + DEFAULT_TAKE_PROFIT_PERCENT / 100);
        
        if (!stopLossPrice && entryPrice > 0) {
          stopLossPrice = hardStopLoss;
        }
        if (!takeProfitPrice && entryPrice > 0) {
          takeProfitPrice = defaultTakeProfit;
        }
        
        if (stopLossPrice && stopLossPrice < hardStopLoss && entryPrice > 0) {
          log.info("Orchestrator", `Enforcing hard stop-loss for ${pos.symbol}: $${stopLossPrice.toFixed(2)} -> $${hardStopLoss.toFixed(2)}`);
          stopLossPrice = hardStopLoss;
        }
        
        if (existingPos?.trailingStopPercent && currentPrice > entryPrice) {
          const profitPercent = ((currentPrice - entryPrice) / entryPrice) * 100;
          if (profitPercent > 5) {
            const newStopLoss = currentPrice * (1 - existingPos.trailingStopPercent / 100);
            if (!stopLossPrice || newStopLoss > stopLossPrice) {
              stopLossPrice = newStopLoss;
              log.info("Orchestrator", `Trailing stop updated for ${pos.symbol}: $${stopLossPrice.toFixed(2)}`);
            }
          }
        }

        const totalQty = safeParseFloat(pos.qty);
        const availableQty = safeParseFloat(pos.qty_available);
        
        const positionWithRules: PositionWithRules = {
          symbol: pos.symbol,
          quantity: totalQty,
          availableQuantity: availableQty,
          entryPrice,
          currentPrice,
          unrealizedPnl: safeParseFloat(pos.unrealized_pl),
          unrealizedPnlPercent: safeParseFloat(pos.unrealized_plpc) * 100,
          openedAt: existingPos?.openedAt || new Date(),
          stopLossPrice,
          takeProfitPrice,
          trailingStopPercent,
          strategyId: existingPos?.strategyId,
        };

        this.state.activePositions.set(pos.symbol, positionWithRules);
      }

      log.info("Orchestrator", `Synced ${positions.length} positions from broker`);
    } catch (error) {
      log.error("Orchestrator", "Failed to sync positions", { error: String(error) });
      this.state.errors.push(`Position sync failed: ${error}`);
    }
  }

  private async fetchCurrentPrice(symbol: string): Promise<number> {
    try {
      const isCrypto = isCryptoSymbol(symbol);
      if (isCrypto) {
        const normSymbol = normalizeCryptoSymbol(symbol);
        const snapshots = await alpaca.getCryptoSnapshots([normSymbol]);
        const snapshot = snapshots[normSymbol];
        return snapshot?.latestTrade?.p || 0;
      } else {
        const snapshots = await alpaca.getSnapshots([symbol]);
        const snapshot = snapshots[symbol];
        return snapshot?.latestTrade?.p || 0;
      }
    } catch (error) {
      log.warn("Orchestrator", `Failed to fetch current price for ${symbol}`, { error: String(error) });
      return 0;
    }
  }

  async start(): Promise<void> {
    if (this.state.isRunning) {
      log.info("Orchestrator", "Already running");
      return;
    }

    await this.initialize();

    if (this.riskLimits.killSwitchActive) {
      log.warn("Orchestrator", "Kill switch is active - cannot start");
      throw new Error("Kill switch is active. Disable it to start autonomous trading.");
    }

    alpacaTradingEngine.enableOrchestratorControl();
    log.info("Orchestrator", "Enabled orchestrator control over AlpacaTradingEngine");

    this.state.isRunning = true;
    this.state.mode = "autonomous";
    this.state.errors = [];

    await storage.updateAgentStatus({ isRunning: true });

    this.analysisTimer = setInterval(() => {
      this.runAnalysisCycle().catch((err) => {
        log.error("Orchestrator", "Analysis cycle error", { error: String(err) });
        this.state.errors.push(`Analysis error: ${err.message}`);
      });
    }, this.config.analysisIntervalMs) as unknown as NodeJS.Timeout;

    this.positionTimer = setInterval(() => {
      this.runPositionManagementCycle().catch((err) => {
        log.error("Orchestrator", "Position management error", { error: String(err) });
        this.state.errors.push(`Position mgmt error: ${err.message}`);
      });
    }, this.config.positionCheckIntervalMs) as unknown as NodeJS.Timeout;

    await this.runAnalysisCycle();
    await this.runPositionManagementCycle();

    log.info("Orchestrator", "Started autonomous trading mode");
  }

  async stop(preserveAutoStart = false): Promise<void> {
    if (!this.state.isRunning) {
      log.info("Orchestrator", "Not running");
      return;
    }

    this.state.isRunning = false;
    this.state.mode = "manual";

    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = null;
    }

    if (this.positionTimer) {
      clearInterval(this.positionTimer);
      this.positionTimer = null;
    }

    this.stopHeartbeat();
    marketConditionAnalyzer.stop();

    alpacaTradingEngine.disableOrchestratorControl();
    log.info("Orchestrator", "Disabled orchestrator control - AlpacaTradingEngine can now trade autonomously");

    await storage.updateAgentStatus({ isRunning: false });

    log.info("Orchestrator", "Stopped autonomous trading mode");
  }

  async activateKillSwitch(reason: string): Promise<void> {
    log.warn("Orchestrator", `KILL SWITCH ACTIVATED: ${reason}`);

    this.riskLimits.killSwitchActive = true;
    await this.stop();

    await storage.updateAgentStatus({ killSwitchActive: true });

    this.state.errors.push(`Kill switch activated: ${reason}`);
  }

  async deactivateKillSwitch(): Promise<void> {
    this.riskLimits.killSwitchActive = false;
    await storage.updateAgentStatus({ killSwitchActive: false });
    log.info("Orchestrator", "Kill switch deactivated");
  }

  private async runAnalysisCycle(): Promise<void> {
    if (this.isProcessing || !this.state.isRunning) return;
    this.isProcessing = true;
    const cycleId = log.generateCycleId();
    log.setCycleId(cycleId);
    this.currentTraceId = cycleId;

    try {
      // Log market session info at cycle start
      const allSessions = tradingSessionManager.getAllSessionInfo();
      log.info("Orchestrator", "Running analysis cycle...", {
        cycleId,
        traceId: cycleId,
        marketSessions: {
          usEquities: allSessions.US_EQUITIES.session,
          crypto: allSessions.CRYPTO.session,
          usEquitiesOpen: allSessions.US_EQUITIES.isOpen,
          nextOpen: allSessions.US_EQUITIES.nextOpen?.toISOString(),
        }
      });
      this.state.lastAnalysisTime = new Date();

      await this.loadRiskLimitsFromDB();

      if (this.riskLimits.killSwitchActive) {
        log.info("Orchestrator", "Kill switch active - skipping analysis");
        return;
      }

      const canceledOrderCount = await cancelExpiredOrders();
      if (canceledOrderCount > 0) {
        log.info("Orchestrator", `Analysis cycle: cleaned up ${canceledOrderCount} stale pending orders`);
      }

      const today = new Date().toISOString().split("T")[0];
      if (this.lastCalibrationDate !== today) {
        this.lastCalibrationDate = today;
        runCalibrationAnalysis(30).catch(err => 
          log.error("Orchestrator", `Calibration failed: ${err}`)
        );
        log.info("Orchestrator", "Daily AI calibration triggered");
      }

      if (this.checkDailyLossLimit()) {
        await this.activateKillSwitch("Daily loss limit exceeded");
        return;
      }

      const marketData = await this.fetchMarketData();

      const allStrategies = await storage.getStrategies();
      const activeStrategies = allStrategies.filter((s: Strategy) => s.isActive);

      for (const [symbol, data] of marketData.entries()) {
        const strategy = activeStrategies.find((s: Strategy) =>
          s.assets?.includes(symbol)
        ) || activeStrategies[0];

        try {
          const decision = await aiDecisionEngine.analyzeOpportunity(
            symbol,
            data,
            undefined,
            strategy
              ? {
                  id: strategy.id,
                  name: strategy.name,
                  type: strategy.type,
                  parameters: strategy.parameters ? JSON.parse(strategy.parameters) : undefined,
                }
              : undefined,
            { traceId: this.currentTraceId || undefined }
          );

          if (decision.confidence >= 0.7 && decision.action !== "hold") {
            const aiDecision = await storage.createAiDecision({
              strategyId: strategy?.id || null,
              symbol,
              action: decision.action,
              confidence: decision.confidence.toString(),
              reasoning: decision.reasoning,
              marketContext: JSON.stringify(data),
              status: "pending",
              traceId: this.currentTraceId,
            });
            
            recordDecisionFeatures(aiDecision.id, symbol, {
              volatility: data.priceChangePercent24h ? Math.abs(data.priceChangePercent24h) / 10 : undefined,
              priceChangePercent: data.priceChangePercent24h,
              marketCondition: this.state.mode,
            }).catch(err => log.error("Orchestrator", `Failed to record features: ${err}`));
            
            this.state.pendingSignals.set(symbol, { ...decision, aiDecisionId: aiDecision.id });
          }
        } catch (error) {
          log.error("Orchestrator", `Analysis failed for ${symbol}`, { error: String(error) });
        }
      }

      await this.processSignals();
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Get the dynamic analysis universe by merging multiple sources:
   * - Base watchlist stocks/crypto
   * - APPROVED candidates from candidatesService
   * - Symbols from recent high-confidence AI decisions
   * - Symbols from recently executed trades (with boost priority)
   */
  private async getAnalysisUniverseSymbols(): Promise<UniverseSymbols> {
    const sources = { watchlist: 0, candidates: 0, recentDecisions: 0, executedTrades: 0 };
    
    // Start with base watchlist
    const stockSet = new Set<string>(WATCHLIST.stocks.map(s => s.toUpperCase()));
    const cryptoSet = new Set<string>(WATCHLIST.crypto.map(c => c.toUpperCase()));
    sources.watchlist = stockSet.size + cryptoSet.size;

    try {
      // Add APPROVED candidates from universe
      const approvedSymbols = await candidatesService.getApprovedSymbols();
      for (const symbol of approvedSymbols) {
        const upper = symbol.toUpperCase();
        if (isCryptoSymbol(upper)) {
          cryptoSet.add(upper.replace('/USD', ''));
        } else {
          stockSet.add(upper);
        }
      }
      sources.candidates = approvedSymbols.length;
    } catch (error) {
      log.warn("Orchestrator", "Failed to get approved candidates", { error: String(error) });
    }

    try {
      // Add symbols from recent high-confidence AI decisions (action != hold)
      const recentDecisions = await storage.getAiDecisions(RECENT_DECISIONS_LOOKBACK);
      const highConfDecisions = recentDecisions.filter(d => {
        const confidence = parseFloat(d.confidence || "0");
        return confidence >= MIN_CONFIDENCE_FOR_UNIVERSE && d.action !== "hold";
      });
      
      for (const decision of highConfDecisions) {
        const upper = decision.symbol.toUpperCase();
        if (isCryptoSymbol(upper)) {
          cryptoSet.add(upper.replace('/USD', ''));
        } else {
          stockSet.add(upper);
        }
        
        // Boost priority for executed trades (always include)
        if (decision.executedTradeId) {
          sources.executedTrades++;
        }
      }
      sources.recentDecisions = highConfDecisions.length;
    } catch (error) {
      log.warn("Orchestrator", "Failed to get recent AI decisions for universe", { error: String(error) });
    }

    // Apply rotation if universe exceeds caps
    let stocks = Array.from(stockSet);
    let crypto = Array.from(cryptoSet);

    if (stocks.length > MAX_STOCK_SYMBOLS_PER_CYCLE) {
      // Rotate through the full universe over time
      const now = Date.now();
      const hoursSinceLastRotation = (now - universeRotationState.lastRotationTime.getTime()) / (1000 * 60 * 60);
      if (hoursSinceLastRotation >= 1) {
        universeRotationState.stockRotationOffset = (universeRotationState.stockRotationOffset + MAX_STOCK_SYMBOLS_PER_CYCLE / 2) % stocks.length;
        universeRotationState.lastRotationTime = new Date();
      }
      
      // Take a window with rotation offset
      const offset = universeRotationState.stockRotationOffset;
      const rotated = [...stocks.slice(offset), ...stocks.slice(0, offset)];
      stocks = rotated.slice(0, MAX_STOCK_SYMBOLS_PER_CYCLE);
    }

    if (crypto.length > MAX_CRYPTO_SYMBOLS_PER_CYCLE) {
      const offset = universeRotationState.cryptoRotationOffset;
      const rotated = [...crypto.slice(offset), ...crypto.slice(0, offset)];
      crypto = rotated.slice(0, MAX_CRYPTO_SYMBOLS_PER_CYCLE);
    }

    log.info("Orchestrator", `Universe built: ${stocks.length} stocks, ${crypto.length} crypto`, {
      sources,
      totalStockPool: stockSet.size,
      totalCryptoPool: cryptoSet.size,
    });

    return { stocks, crypto, sources };
  }

  private async fetchMarketData(): Promise<Map<string, MarketData>> {
    const marketData = new Map<string, MarketData>();

    // Get dynamic universe instead of static watchlist
    const universe = await this.getAnalysisUniverseSymbols();

    // Fetch stock data using Alpaca batch snapshots (faster than sequential Finnhub)
    try {
      const fetchedFromAlpaca = new Set<string>();
      
      // Chunk requests to avoid URL length issues
      for (let i = 0; i < universe.stocks.length; i += ALPACA_SNAPSHOT_CHUNK_SIZE) {
        const chunk = universe.stocks.slice(i, i + ALPACA_SNAPSHOT_CHUNK_SIZE);
        try {
          const snapshots = await alpaca.getSnapshots(chunk);
          for (const [symbol, snapshot] of Object.entries(snapshots)) {
            if (snapshot?.latestTrade?.p || snapshot?.dailyBar?.c) {
              const price = snapshot.latestTrade?.p || snapshot.dailyBar?.c || 0;
              const prevClose = snapshot.prevDailyBar?.c || price;
              const change = price - prevClose;
              const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
              
              marketData.set(symbol, {
                symbol,
                currentPrice: price,
                priceChange24h: change,
                priceChangePercent24h: changePercent,
                high24h: snapshot.dailyBar?.h,
                low24h: snapshot.dailyBar?.l,
                volume: snapshot.dailyBar?.v,
              });
              fetchedFromAlpaca.add(symbol);
            }
          }
        } catch (chunkError) {
          log.warn("Orchestrator", `Alpaca snapshot chunk failed, will use Finnhub fallback`, { 
            chunkStart: i, 
            error: String(chunkError) 
          });
        }
      }

      // Fallback to Finnhub for symbols missing from Alpaca
      const missingSymbols = universe.stocks.filter(s => !fetchedFromAlpaca.has(s));
      if (missingSymbols.length > 0 && missingSymbols.length <= 30) {
        try {
          const finnhubPrices = await finnhub.getMultipleQuotes(missingSymbols);
          for (const [symbol, quote] of finnhubPrices.entries()) {
            if (quote.c > 0) {
              marketData.set(symbol, {
                symbol,
                currentPrice: quote.c,
                priceChange24h: quote.d,
                priceChangePercent24h: quote.dp,
                high24h: quote.h,
                low24h: quote.l,
              });
            }
          }
          log.info("Orchestrator", `Finnhub fallback fetched ${finnhubPrices.size}/${missingSymbols.length} symbols`);
        } catch (finnhubError) {
          log.warn("Orchestrator", `Finnhub fallback also failed`, { error: String(finnhubError) });
        }
      }

      log.info("Orchestrator", `Stock data fetched: ${marketData.size}/${universe.stocks.length} symbols via Alpaca+Finnhub`);
    } catch (error) {
      log.error("Orchestrator", "Failed to fetch stock data", { error: String(error) });
    }

    // Fetch crypto data - prefer Alpaca crypto snapshots
    try {
      const cryptoSymbols = universe.crypto.map(c => normalizeCryptoSymbol(c));
      if (cryptoSymbols.length > 0) {
        try {
          const cryptoSnapshots = await alpaca.getCryptoSnapshots(cryptoSymbols);
          for (const [symbol, snapshot] of Object.entries(cryptoSnapshots)) {
            if (snapshot?.latestTrade?.p) {
              const price = snapshot.latestTrade.p;
              const prevClose = snapshot.prevDailyBar?.c || price;
              const change = price - prevClose;
              const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
              
              // Store with bare symbol (BTC) not pair (BTC/USD)
              const bareSymbol = symbol.replace('/USD', '').toUpperCase();
              marketData.set(bareSymbol, {
                symbol: bareSymbol,
                currentPrice: price,
                priceChange24h: change,
                priceChangePercent24h: changePercent,
                high24h: snapshot.dailyBar?.h,
                low24h: snapshot.dailyBar?.l,
                volume: snapshot.dailyBar?.v,
              });
            }
          }
          log.info("Orchestrator", `Crypto data fetched via Alpaca: ${Object.keys(cryptoSnapshots).length} symbols`);
        } catch (alpacaCryptoError) {
          // Fallback to CoinGecko
          log.warn("Orchestrator", "Alpaca crypto failed, falling back to CoinGecko", { error: String(alpacaCryptoError) });
          const cryptoPrices = await coingecko.getMarkets();
          const watchedCrypto = cryptoPrices.filter((c) =>
            universe.crypto.includes(c.symbol.toUpperCase())
          );
          for (const price of watchedCrypto) {
            marketData.set(price.symbol.toUpperCase(), {
              symbol: price.symbol.toUpperCase(),
              currentPrice: price.current_price,
              priceChange24h: price.price_change_24h || 0,
              priceChangePercent24h: price.price_change_percentage_24h || 0,
              high24h: price.high_24h,
              low24h: price.low_24h,
              volume: price.total_volume,
              marketCap: price.market_cap,
            });
          }
        }
      }
    } catch (error) {
      log.error("Orchestrator", "Failed to fetch crypto data", { error: String(error) });
    }

    return marketData;
  }

  private async processSignals(): Promise<void> {
    for (const [symbol, decision] of this.state.pendingSignals.entries()) {
      let result: ExecutionResult;
      try {
        result = await this.executeSignal(symbol, decision);
      } catch (error) {
        result = {
          success: false,
          action: "skip",
          reason: `Execution error: ${String(error)}`,
          symbol,
        };
        log.error("Orchestrator", `Error executing signal for ${symbol}`, { error: String(error) });
      }
      
      this.state.executionHistory.push(result);
      
      if (decision.aiDecisionId) {
        try {
          if (result.success && result.action !== "hold" && result.action !== "skip") {
            await storage.updateAiDecision(decision.aiDecisionId, {
              status: "executed",
              filledPrice: result.price?.toString(),
              filledAt: new Date(),
            });
          } else if (result.action === "hold") {
            await storage.updateAiDecision(decision.aiDecisionId, {
              status: "skipped",
              skipReason: "Hold action - no trade executed",
            });
          } else {
            await storage.updateAiDecision(decision.aiDecisionId, {
              status: "skipped",
              skipReason: result.reason || "Trade not executed",
            });
          }
        } catch (e) {
          log.error("Orchestrator", `Failed to update AI decision status for ${decision.aiDecisionId}`, { error: String(e) });
        }
      }

      if (this.state.executionHistory.length > 100) {
        this.state.executionHistory = this.state.executionHistory.slice(-100);
      }
    }

    this.state.pendingSignals.clear();
  }

  private async executeSignal(
    symbol: string,
    decision: AIDecision
  ): Promise<ExecutionResult> {
    const positionCount = this.state.activePositions.size;
    if (
      decision.action === "buy" &&
      positionCount >= this.riskLimits.maxPositionsCount
    ) {
      return {
        success: false,
        action: "skip",
        reason: `Max positions limit reached (${positionCount}/${this.riskLimits.maxPositionsCount})`,
        symbol,
      };
    }

    const existingPosition = this.state.activePositions.get(symbol);

    if (decision.action === "buy" && existingPosition) {
      // FIX: Lowered confidence threshold from 0.85 to 0.50 for more aggressive position reinforcement
      // User preference: 50% minimum confidence to reinforce existing positions during momentum
      if (decision.confidence >= 0.50) {
        log.info("Orchestrator", `Reinforcing position: ${symbol} (confidence: ${(decision.confidence * 100).toFixed(1)}%)`);
        return await this.reinforcePosition(symbol, decision, existingPosition);
      }
      return {
        success: false,
        action: "skip",
        reason: `Already have position, confidence ${(decision.confidence * 100).toFixed(1)}% below 50% threshold`,
        symbol,
      };
    }

    if (decision.action === "sell" && !existingPosition) {
      return {
        success: false,
        action: "skip",
        reason: "No position to sell",
        symbol,
      };
    }

    if (decision.action === "buy") {
      return await this.openPosition(symbol, decision);
    }

    if (decision.action === "sell" && existingPosition) {
      return await this.closePosition(symbol, decision, existingPosition);
    }

    return {
      success: true,
      action: "hold",
      reason: decision.reasoning,
      symbol,
    };
  }

  private async openPosition(
    symbol: string,
    decision: AIDecision
  ): Promise<ExecutionResult> {
    try {
      const account = await alpaca.getAccount();
      const portfolioValue = safeParseFloat(account.portfolio_value);

      const positionSizePercent = Math.min(
        (decision.suggestedQuantity || 0.05) * 100,
        this.riskLimits.maxPositionSizePercent
      );
      const positionValue = portfolioValue * (positionSizePercent / 100);

      const totalExposure = this.calculateTotalExposure(portfolioValue);
      if (
        totalExposure + positionSizePercent >
        this.riskLimits.maxTotalExposurePercent
      ) {
        return {
          success: false,
          action: "skip",
          reason: `Would exceed max exposure (${totalExposure.toFixed(1)}% + ${positionSizePercent.toFixed(1)}% > ${this.riskLimits.maxTotalExposurePercent}%)`,
          symbol,
        };
      }

      const isCrypto = isCryptoSymbol(symbol);
      const brokerSymbol = isCrypto ? normalizeCryptoSymbol(symbol) : symbol;

      const tradableCheck = await isSymbolTradable(symbol, isCrypto);
      if (!tradableCheck.tradable) {
        log.warn("Orchestrator", `Symbol ${symbol} not tradable: ${tradableCheck.reason}`);
        return {
          success: false,
          action: "skip",
          reason: tradableCheck.reason || "Symbol not tradable",
          symbol,
        };
      }

      const preCheck = await preTradeGuard(symbol, "buy", positionValue, isCrypto);
      if (!preCheck.canTrade) {
        log.warn("Orchestrator", `Pre-trade check failed for ${symbol}: ${preCheck.reason}`);
        return {
          success: false,
          action: "skip",
          reason: preCheck.reason || "Pre-trade check failed",
          symbol,
        };
      }

      const tradabilityCheck = await tradabilityService.validateSymbolTradable(symbol);
      if (!tradabilityCheck.tradable) {
        log.warn("Orchestrator", `Symbol ${symbol} not tradable: ${tradabilityCheck.reason}`);
        return {
          success: false,
          action: "skip",
          reason: `Symbol not tradable: ${tradabilityCheck.reason || 'Not in broker universe'}`,
          symbol,
        };
      }

      let queuedResult: QueuedOrderResult;
      const hasBracketParams = decision.targetPrice && decision.stopLoss && !isCrypto;
      
      if (preCheck.useExtendedHours && preCheck.useLimitOrder && preCheck.limitPrice) {
        log.info("Orchestrator", `Extended hours limit order for ${symbol} @ $${preCheck.limitPrice}`);
        const estimatedQty = Math.floor(positionValue / preCheck.limitPrice);
        if (estimatedQty < 1) {
          return {
            success: false,
            action: "skip",
            reason: `Position value too small for whole share order ($${positionValue.toFixed(2)} at $${preCheck.limitPrice})`,
            symbol,
          };
        }
        const orderParams: CreateOrderParams = {
          symbol: brokerSymbol,
          qty: estimatedQty.toString(),
          side: "buy",
          type: "limit",
          time_in_force: "day",
          limit_price: preCheck.limitPrice.toFixed(2),
          extended_hours: true,
        };
        queuedResult = await queueOrderExecution({
          orderParams,
          traceId: this.currentTraceId,
          symbol,
          side: "buy",
          decisionId: decision.aiDecisionId,
        });
      } else if (hasBracketParams && decision.targetPrice && decision.stopLoss) {
        log.info("Orchestrator", `Bracket order for ${symbol}: TP=$${decision.targetPrice.toFixed(2)}, SL=$${decision.stopLoss.toFixed(2)}`);
        const currentPrice = await this.fetchCurrentPrice(symbol);
        if (currentPrice > 0 && positionValue > 0) {
          const estimatedQty = (positionValue / currentPrice).toFixed(6);
          const orderParams: CreateOrderParams = {
            symbol: brokerSymbol,
            qty: estimatedQty,
            side: "buy",
            type: "market",
            time_in_force: "gtc",
            take_profit: { limit_price: decision.targetPrice.toFixed(2) },
            stop_loss: { stop_price: decision.stopLoss.toFixed(2) },
            order_class: "bracket",
          };
          queuedResult = await queueOrderExecution({
            orderParams,
            traceId: this.currentTraceId,
            symbol,
            side: "buy",
            decisionId: decision.aiDecisionId,
          });
        } else {
          log.warn("Orchestrator", `Bracket order fallback - invalid price/value for ${symbol}`);
          const orderParams: CreateOrderParams = {
            symbol: brokerSymbol,
            notional: positionValue.toFixed(2),
            side: "buy",
            type: "market",
            time_in_force: "day",
          };
          queuedResult = await queueOrderExecution({
            orderParams,
            traceId: this.currentTraceId,
            symbol,
            side: "buy",
            decisionId: decision.aiDecisionId,
          });
        }
      } else {
        const orderParams: CreateOrderParams = {
          symbol: brokerSymbol,
          notional: positionValue.toFixed(2),
          side: "buy",
          type: "market",
          time_in_force: isCrypto ? "gtc" : "day",
        };
        queuedResult = await queueOrderExecution({
          orderParams,
          traceId: this.currentTraceId,
          symbol,
          side: "buy",
          decisionId: decision.aiDecisionId,
        });
      }
      
      const fillResult = await waitForAlpacaOrderFill(queuedResult.orderId);
      
      if (!fillResult.order) {
        log.error("Orchestrator", `Order ${queuedResult.orderId} - no order data received`);
        await this.syncPositionsFromBroker();
        return {
          success: false,
          action: "buy",
          reason: "Order failed - no response from broker",
          symbol,
          orderId: queuedResult.orderId,
        };
      }
      
      if (!fillResult.hasFillData) {
        log.error("Orchestrator", `Order ${queuedResult.orderId} has no fill data, syncing positions`);
        await this.syncPositionsFromBroker();
        return {
          success: false,
          action: "buy",
          reason: fillResult.timedOut 
            ? "Order fill timed out - position sync triggered" 
            : "Order rejected or no fill data",
          symbol,
          orderId: queuedResult.orderId,
        };
      }
      
      if (fillResult.timedOut && !fillResult.isFullyFilled) {
        log.warn("Orchestrator", `Order ${queuedResult.orderId} timed out with partial fill, using available data`);
      }
      
      const order = fillResult.order;
      let filledPrice = safeParseFloat(order.filled_avg_price, 0);
      const filledQty = safeParseFloat(order.filled_qty, 0);

      // If Alpaca didn't return filled price, fetch current market price
      if (filledPrice === 0) {
        try {
          const isCrypto = isCryptoSymbol(symbol);
          if (isCrypto) {
            const normSymbol = normalizeCryptoSymbol(symbol);
            const snapshots = await alpaca.getCryptoSnapshots([normSymbol]);
            const snapshot = snapshots[normSymbol];
            filledPrice = snapshot?.latestTrade?.p || 0;
          } else {
            const snapshots = await alpaca.getSnapshots([symbol]);
            const snapshot = snapshots[symbol];
            filledPrice = snapshot?.latestTrade?.p || 0;
          }
          if (filledPrice > 0) {
            log.info("Orchestrator", `Using market price ${filledPrice} for ${symbol}`);
          }
        } catch (error) {
          log.warn("Orchestrator", `Failed to fetch market price for ${symbol}`, { error: String(error) });
        }
      }

      const trade = await storage.createTrade({
        symbol,
        side: "buy",
        quantity: filledQty.toString(),
        price: filledPrice.toString(),
        status: "completed",
        notes: `AI autonomous: ${decision.reasoning}`,
        traceId: this.currentTraceId,
      });

      if (decision.aiDecisionId) {
        const marketStatus = await alpaca.getMarketStatus();
        recordTradeOutcome({
          decisionId: decision.aiDecisionId,
          tradeId: trade.id,
          symbol,
          action: "buy",
          predictionConfidence: decision.confidence,
          entryPrice: filledPrice,
          quantity: filledQty,
          marketSessionAtEntry: marketStatus.session,
          strategyId: undefined,
        }).catch(err => log.error("Orchestrator", `Failed to record trade outcome: ${err}`));
      }

      this.state.dailyTradeCount++;

      const positionWithRules: PositionWithRules = {
        symbol,
        quantity: filledQty,
        availableQuantity: filledQty,
        entryPrice: filledPrice,
        currentPrice: filledPrice,
        unrealizedPnl: 0,
        unrealizedPnlPercent: 0,
        openedAt: new Date(),
        stopLossPrice: decision.stopLoss,
        takeProfitPrice: decision.targetPrice,
        trailingStopPercent: decision.trailingStopPercent,
      };

      this.state.activePositions.set(symbol, positionWithRules);

      log.trade(`Opened position: ${symbol} $${positionValue.toFixed(2)}`, { symbol, value: positionValue });

      return {
        success: true,
        orderId: order.id,
        action: "buy",
        reason: decision.reasoning,
        symbol,
        quantity: positionWithRules.quantity,
        price: positionWithRules.entryPrice,
      };
    } catch (error) {
      log.error("Orchestrator", `Failed to open position ${symbol}`, { error: String(error) });
      return {
        success: false,
        action: "buy",
        reason: `Order failed: ${error}`,
        symbol,
        error: String(error),
      };
    }
  }

  private async closePosition(
    symbol: string,
    decision: AIDecision,
    position: PositionWithRules,
    partialPercent: number = 100,
    options: { isStopLossTriggered?: boolean; isEmergencyStop?: boolean } = {}
  ): Promise<ExecutionResult> {
    try {
      const isCrypto = isCryptoSymbol(symbol);
      const brokerSymbol = isCrypto ? normalizeCryptoSymbol(symbol) : symbol;

      // LOSS PROTECTION: Don't close positions at a loss unless stop-loss or emergency stop triggered
      const isAtLoss = position.currentPrice < position.entryPrice;
      const isProtectedClose = options.isStopLossTriggered || options.isEmergencyStop;
      
      if (isAtLoss && !isProtectedClose) {
        const lossPercent = ((position.entryPrice - position.currentPrice) / position.entryPrice * 100).toFixed(2);
        log.info("Orchestrator", `Blocking close of ${symbol} at ${lossPercent}% loss - stop loss not triggered`, {
          symbol,
          entryPrice: position.entryPrice,
          currentPrice: position.currentPrice,
          lossPercent,
        });
        return {
          success: false,
          action: "hold",
          reason: `Position at ${lossPercent}% loss - holding until stop-loss triggers or price recovers`,
          symbol,
        };
      }

      try {
        const openOrders = await alpaca.getOrders("open");
        const symbolOrders = openOrders.filter(o => o.symbol === brokerSymbol);
        for (const order of symbolOrders) {
          try {
            await queueOrderCancellation({
              orderId: order.id,
              traceId: this.currentTraceId,
              symbol,
            });
            log.info("Orchestrator", `Queued cancellation for pending order ${order.id} for ${symbol} before closing`);
          } catch {
          }
        }
        if (symbolOrders.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      } catch (err) {
        log.warn("Orchestrator", `Failed to cancel orders for ${symbol}: ${err}`);
      }

      let orderId: string;
      if (partialPercent >= 100) {
        const initialOrder = await alpaca.closePosition(brokerSymbol);
        orderId = initialOrder.id;
      } else {
        const tradabilityCheck = await tradabilityService.validateSymbolTradable(symbol);
        if (!tradabilityCheck.tradable) {
          log.warn("Orchestrator", `Cannot partial close ${symbol}: not tradable`);
          return {
            success: false,
            action: "sell",
            reason: `Symbol not tradable: ${tradabilityCheck.reason || 'Not in broker universe'}`,
            symbol,
          };
        }
        const closeQty = (position.quantity * partialPercent) / 100;
        const orderParams: CreateOrderParams = {
          symbol: brokerSymbol,
          qty: closeQty.toString(),
          side: "sell",
          type: "market",
          time_in_force: isCrypto ? "gtc" : "day",
        };
        const queuedResult = await queueOrderExecution({
          orderParams,
          traceId: this.currentTraceId,
          symbol,
          side: "sell",
          decisionId: decision.aiDecisionId,
        });
        orderId = queuedResult.orderId;
      }

      const fillResult = await waitForAlpacaOrderFill(orderId);
      
      if (!fillResult.order) {
        log.error("Orchestrator", `Close order ${orderId} - no order data received`);
        await this.syncPositionsFromBroker();
        return {
          success: false,
          action: "sell",
          reason: "Close order failed - no response from broker",
          symbol,
          orderId,
        };
      }
      
      if (!fillResult.hasFillData) {
        log.error("Orchestrator", `Close order ${orderId} has no fill data, syncing positions`);
        await this.syncPositionsFromBroker();
        return {
          success: false,
          action: "sell",
          reason: fillResult.timedOut 
            ? "Close order fill timed out - position sync triggered" 
            : "Close order rejected or no fill data",
          symbol,
          orderId,
        };
      }
      
      if (fillResult.timedOut && !fillResult.isFullyFilled) {
        log.warn("Orchestrator", `Close order ${orderId} timed out with partial fill, using available data`);
      }
      
      const order = fillResult.order;
      let filledPrice = safeParseFloat(order.filled_avg_price, 0);
      const filledQty = safeParseFloat(order.filled_qty, 0);

      // If Alpaca didn't return filled price, fetch current market price
      if (filledPrice === 0) {
        try {
          const isCrypto = isCryptoSymbol(symbol);
          if (isCrypto) {
            const normSymbol = normalizeCryptoSymbol(symbol);
            const snapshots = await alpaca.getCryptoSnapshots([normSymbol]);
            const snapshot = snapshots[normSymbol];
            filledPrice = snapshot?.latestTrade?.p || 0;
          } else {
            const snapshots = await alpaca.getSnapshots([symbol]);
            const snapshot = snapshots[symbol];
            filledPrice = snapshot?.latestTrade?.p || 0;
          }
          if (filledPrice > 0) {
            log.info("Orchestrator", `Using market price ${filledPrice} for ${symbol}`);
          }
        } catch (error) {
          log.warn("Orchestrator", `Failed to fetch market price for ${symbol}`, { error: String(error) });
        }
      }

      const pnl = (filledPrice - position.entryPrice) * filledQty;
      const exitReason = decision.reasoning || (pnl > 0 ? "take_profit" : "stop_loss");

      await storage.createTrade({
        symbol,
        side: "sell",
        quantity: filledQty.toString(),
        price: filledPrice.toString(),
        pnl: pnl.toString(),
        status: "completed",
        notes: `AI autonomous: ${decision.reasoning}`,
        traceId: this.currentTraceId,
      });

      if (decision.aiDecisionId) {
        const marketStatus = await alpaca.getMarketStatus();
        updateTradeOutcomeOnClose(
          decision.aiDecisionId,
          filledPrice,
          exitReason,
          marketStatus.session
        ).catch(err => log.error("Orchestrator", `Failed to update trade outcome: ${err}`));
      }

      this.state.dailyPnl += pnl;
      this.state.dailyTradeCount++;

      if (partialPercent >= 100) {
        this.state.activePositions.delete(symbol);
      } else {
        const remaining = position.quantity * (1 - partialPercent / 100);
        position.quantity = remaining;
        this.state.activePositions.set(symbol, position);
      }

      log.trade(`Closed ${partialPercent}% of ${symbol}, P&L: $${pnl.toFixed(2)}`, { symbol, pnl, partialPercent });

      return {
        success: true,
        orderId: order.id,
        action: "sell",
        reason: decision.reasoning,
        symbol,
        quantity: filledQty,
        price: filledPrice,
      };
    } catch (error) {
      log.error("Orchestrator", `Failed to close position ${symbol}`, { error: String(error) });
      return {
        success: false,
        action: "sell",
        reason: `Close failed: ${error}`,
        symbol,
        error: String(error),
      };
    }
  }

  private async reinforcePosition(
    symbol: string,
    decision: AIDecision,
    existingPosition: PositionWithRules
  ): Promise<ExecutionResult> {
    log.info("Orchestrator", `Reinforcing position: ${symbol}`);

    const reinforceDecision: AIDecision = {
      ...decision,
      suggestedQuantity: (decision.suggestedQuantity || 0.05) * 0.5,
    };

    return await this.openPosition(symbol, reinforceDecision);
  }

  private async runPositionManagementCycle(): Promise<void> {
    if (!this.state.isRunning) return;

    try {
      this.state.lastPositionCheckTime = new Date();

      await this.syncPositionsFromBroker();

      for (const [symbol, position] of this.state.activePositions.entries()) {
        await this.checkPositionRules(symbol, position);
      }

      await this.rebalancePositions();
    } catch (error) {
      log.error("Orchestrator", "Position management cycle error", { error: String(error) });
    }
  }

  private async checkPositionRules(
    symbol: string,
    position: PositionWithRules
  ): Promise<void> {
    if (position.stopLossPrice && position.currentPrice <= position.stopLossPrice) {
      log.warn("Orchestrator", `Stop-loss triggered for ${symbol}`);
      await this.closePosition(
        symbol,
        {
          action: "sell",
          confidence: 1,
          reasoning: `Stop-loss triggered at $${position.stopLossPrice}`,
          riskLevel: "high",
        },
        position,
        100,
        { isStopLossTriggered: true }
      );
      return;
    }

    if (position.takeProfitPrice && position.currentPrice >= position.takeProfitPrice) {
      log.info("Orchestrator", `Take-profit triggered for ${symbol}`);

      const pnlPercent = position.unrealizedPnlPercent;
      if (pnlPercent > 15) {
        await this.closePosition(
          symbol,
          {
            action: "sell",
            confidence: 1,
            reasoning: `Take-profit fully triggered at $${position.takeProfitPrice}`,
            riskLevel: "low",
          },
          position,
          100
        );
      } else if (pnlPercent > 10) {
        await this.closePosition(
          symbol,
          {
            action: "sell",
            confidence: 0.9,
            reasoning: `Partial take-profit at $${position.currentPrice}`,
            riskLevel: "low",
          },
          position,
          50
        );
      }
      return;
    }

    if (position.unrealizedPnlPercent <= -8) {
      log.warn("Orchestrator", `Emergency stop for ${symbol} at ${position.unrealizedPnlPercent.toFixed(1)}% loss`);
      await this.closePosition(
        symbol,
        {
          action: "sell",
          confidence: 1,
          reasoning: `Emergency stop: ${position.unrealizedPnlPercent.toFixed(1)}% loss`,
          riskLevel: "high",
        },
        position,
        100,
        { isEmergencyStop: true }
      );
    }
  }

  private calculateTotalExposure(portfolioValue: number): number {
    let totalValue = 0;
    for (const position of this.state.activePositions.values()) {
      totalValue += position.currentPrice * position.quantity;
    }
    return (totalValue / portfolioValue) * 100;
  }

  private checkDailyLossLimit(): boolean {
    const lossPercent = Math.abs(
      Math.min(0, this.state.dailyPnl) / 100000
    ) * 100;
    return lossPercent >= this.riskLimits.dailyLossLimitPercent;
  }

  getState(): OrchestratorState {
    return { ...this.state };
  }

  getPendingAnalysis(): { symbol: string; startedAt: Date; status: string }[] {
    const pending: { symbol: string; startedAt: Date; status: string }[] = [];
    
    for (const [symbol, signal] of this.state.pendingSignals.entries()) {
      pending.push({
        symbol,
        startedAt: new Date(),
        status: "pending_execution",
      });
    }
    
    return pending;
  }

  getRiskLimits(): RiskLimits {
    return { ...this.riskLimits };
  }

  async updateRiskLimits(limits: Partial<RiskLimits>): Promise<void> {
    this.riskLimits = { ...this.riskLimits, ...limits };

    await storage.updateAgentStatus({
      maxPositionSizePercent: limits.maxPositionSizePercent?.toString(),
      maxTotalExposurePercent: limits.maxTotalExposurePercent?.toString(),
      maxPositionsCount: limits.maxPositionsCount,
      dailyLossLimitPercent: limits.dailyLossLimitPercent?.toString(),
      killSwitchActive: limits.killSwitchActive,
    });

    log.info("Orchestrator", "Updated risk limits", { ...this.riskLimits });
  }

  async setMode(mode: "autonomous" | "semi-auto" | "manual"): Promise<void> {
    if (mode === "autonomous" && !this.state.isRunning) {
      await this.start();
    } else if (mode === "manual" && this.state.isRunning) {
      await this.stop();
    }
    this.state.mode = mode;
  }

  getMode(): string {
    return this.state.mode;
  }

  resetDailyStats(): void {
    this.state.dailyPnl = 0;
    this.state.dailyTradeCount = 0;
    log.info("Orchestrator", "Reset daily stats");
  }

  async rebalancePositions(): Promise<void> {
    try {
      const account = await alpaca.getAccount();
      const portfolioValue = parseFloat(account.portfolio_value);
      const availableCash = safeParseFloat(account.cash);
      
      if (portfolioValue <= 0) {
        log.warn("Orchestrator", "Cannot rebalance: invalid portfolio value");
        return;
      }

      const targetAllocationPercent = this.riskLimits.maxPositionSizePercent;
      const rebalanceThresholdPercent = 2;
      const buyTheDipThresholdPercent = 3;
      const minCashReservePercent = 10;

      const approvedSymbols = await candidatesService.getApprovedSymbols();
      const approvedSet = new Set(approvedSymbols.map(s => s.toUpperCase()));

      for (const [symbol, position] of this.state.activePositions.entries()) {
        const positionValue = position.currentPrice * position.quantity;
        const currentAllocationPercent = (positionValue / portfolioValue) * 100;
        const drift = currentAllocationPercent - targetAllocationPercent;

        if (Math.abs(drift) > rebalanceThresholdPercent) {
          log.info("Orchestrator", `Position ${symbol} drifted by ${drift.toFixed(2)}%`);

          if (drift > rebalanceThresholdPercent) {
            const excessValue = positionValue - (portfolioValue * targetAllocationPercent / 100);
            let sharesToSell = Math.floor(excessValue / position.currentPrice);
            
            const availableShares = Math.floor(position.availableQuantity);
            if (availableShares <= 0) {
              log.warn("Orchestrator", `Skipping rebalance for ${symbol}: no available shares (${position.availableQuantity} available, ${position.quantity - position.availableQuantity} held for orders)`);
              continue;
            }
            
            if (sharesToSell > availableShares) {
              log.info("Orchestrator", `Limiting rebalance for ${symbol}: requested ${sharesToSell} but only ${availableShares} available`);
              sharesToSell = availableShares;
            }
            
            if (sharesToSell > 0 && sharesToSell < position.quantity) {
              log.info("Orchestrator", `Rebalancing: Selling ${sharesToSell} shares of ${symbol} (${availableShares} available)`);
              await this.closePosition(
                symbol,
                {
                  action: "sell",
                  confidence: 0.8,
                  reasoning: `Rebalancing: Position overweight by ${drift.toFixed(1)}%`,
                  riskLevel: "low",
                },
                position,
                (sharesToSell / position.quantity) * 100
              );
            }
          } else if (drift < -buyTheDipThresholdPercent) {
            if (!approvedSet.has(symbol.toUpperCase())) {
              log.info("Orchestrator", `Skipping buy-the-dip for ${symbol}: not in approved candidates`);
              continue;
            }

            const cashReserve = portfolioValue * (minCashReservePercent / 100);
            const availableForBuying = Math.max(0, availableCash - cashReserve);
            
            if (availableForBuying <= 0) {
              log.info("Orchestrator", `Skipping buy-the-dip for ${symbol}: insufficient cash (${availableCash.toFixed(2)} available, ${cashReserve.toFixed(2)} reserve)`);
              continue;
            }

            const deficitValue = (portfolioValue * targetAllocationPercent / 100) - positionValue;
            const buyValue = Math.min(deficitValue, availableForBuying, portfolioValue * 0.02);
            
            if (buyValue >= 50 && position.unrealizedPnlPercent <= 0) {
              log.info("Orchestrator", `Buy-the-dip: Adding $${buyValue.toFixed(2)} to underweight ${symbol} (at ${position.unrealizedPnlPercent.toFixed(1)}% loss)`);

              const isCrypto = isCryptoSymbol(symbol);
              const brokerSymbol = isCrypto ? normalizeCryptoSymbol(symbol) : symbol;

              try {
                const preCheck = await preTradeGuard(symbol, "buy", buyValue, isCrypto);
                if (!preCheck.canTrade) {
                  log.warn("Orchestrator", `Buy-the-dip blocked for ${symbol}: ${preCheck.reason}`);
                  continue;
                }

                await queueOrderExecution({
                  orderParams: {
                    symbol: brokerSymbol,
                    side: "buy",
                    type: preCheck.useLimitOrder ? "limit" : "market",
                    notional: buyValue.toFixed(2),
                    time_in_force: "day",
                    extended_hours: preCheck.useExtendedHours,
                    ...(preCheck.limitPrice && { limit_price: preCheck.limitPrice.toString() }),
                  },
                  traceId: this.currentTraceId,
                  symbol,
                  side: "buy",
                });

                log.trade(`Buy-the-dip: ${symbol} $${buyValue.toFixed(2)}`, { symbol, value: buyValue });
              } catch (error) {
                log.error("Orchestrator", `Buy-the-dip failed for ${symbol}`, { error: String(error) });
              }
            }
          }
        }
      }

      // NEW: Pyramid-up logic for winning positions
      // User preference: Add 50% of original position size when position is profitable
      const pyramidedThisCycle = new Set<string>();
      const pyramidMinProfitPercent = 5;  // Start pyramiding at 5% profit
      const pyramidMaxProfitPercent = 20; // Stop pyramiding above 20% (take profit instead)

      for (const [symbol, position] of this.state.activePositions.entries()) {
        // Skip if already pyramided this cycle or not in approved list
        if (pyramidedThisCycle.has(symbol) || !approvedSet.has(symbol.toUpperCase())) {
          continue;
        }

        // Check if position is in the profitable sweet spot for pyramid-up
        if (position.unrealizedPnlPercent >= pyramidMinProfitPercent &&
            position.unrealizedPnlPercent <= pyramidMaxProfitPercent) {

          const cashReserve = portfolioValue * (minCashReservePercent / 100);
          const availableForBuying = Math.max(0, availableCash - cashReserve);

          if (availableForBuying <= 50) {
            continue; // Not enough cash
          }

          // Calculate 50% of original position value as pyramid amount
          const originalPositionValue = position.quantity * position.entryPrice;
          const pyramidValue = Math.min(
            originalPositionValue * 0.5,  // 50% of original position
            availableForBuying,
            portfolioValue * 0.05  // Max 5% of portfolio per pyramid
          );

          if (pyramidValue >= 50) {
            log.info("Orchestrator", `Pyramid-up: Adding $${pyramidValue.toFixed(2)} (50% of original) to winning ${symbol} (at +${position.unrealizedPnlPercent.toFixed(1)}%)`);

            const isCrypto = isCryptoSymbol(symbol);
            const brokerSymbol = isCrypto ? normalizeCryptoSymbol(symbol) : symbol;

            try {
              const preCheck = await preTradeGuard(symbol, "buy", pyramidValue, isCrypto);
              if (!preCheck.canTrade) {
                log.warn("Orchestrator", `Pyramid-up blocked for ${symbol}: ${preCheck.reason}`);
                continue;
              }

              await queueOrderExecution({
                orderParams: {
                  symbol: brokerSymbol,
                  side: "buy",
                  type: preCheck.useLimitOrder ? "limit" : "market",
                  notional: pyramidValue.toFixed(2),
                  time_in_force: "day",
                  extended_hours: preCheck.useExtendedHours,
                  ...(preCheck.limitPrice && { limit_price: preCheck.limitPrice.toString() }),
                },
                traceId: this.currentTraceId,
                symbol,
                side: "buy",
              });

              pyramidedThisCycle.add(symbol);
              log.trade(`Pyramid-up: ${symbol} $${pyramidValue.toFixed(2)} (+${position.unrealizedPnlPercent.toFixed(1)}%)`, {
                symbol,
                value: pyramidValue,
                profitPercent: position.unrealizedPnlPercent,
              });
            } catch (error) {
              log.error("Orchestrator", `Pyramid-up failed for ${symbol}`, { error: String(error) });
            }
          }
        }
      }
    } catch (error) {
      log.error("Orchestrator", "Rebalancing error", { error: String(error) });
      this.state.errors.push(`Rebalancing failed: ${error}`);
    }
  }

  async adjustStopLossTakeProfit(
    symbol: string,
    newStopLoss?: number,
    newTakeProfit?: number,
    trailingStopPercent?: number
  ): Promise<boolean> {
    const position = this.state.activePositions.get(symbol);
    if (!position) {
      log.warn("Orchestrator", `Cannot adjust SL/TP: Position ${symbol} not found`);
      return false;
    }

    if (newStopLoss !== undefined) {
      if (newStopLoss >= position.currentPrice) {
        log.warn("Orchestrator", `Invalid stop loss: $${newStopLoss} >= current price $${position.currentPrice}`);
        return false;
      }
      position.stopLossPrice = newStopLoss;
    }

    if (newTakeProfit !== undefined) {
      if (newTakeProfit <= position.currentPrice) {
        log.warn("Orchestrator", `Invalid take profit: $${newTakeProfit} <= current price $${position.currentPrice}`);
        return false;
      }
      position.takeProfitPrice = newTakeProfit;
    }

    if (trailingStopPercent !== undefined) {
      if (trailingStopPercent <= 0 || trailingStopPercent >= 100) {
        log.warn("Orchestrator", `Invalid trailing stop percent: ${trailingStopPercent}`);
        return false;
      }
      position.trailingStopPercent = trailingStopPercent;
    }

    this.state.activePositions.set(symbol, position);
    log.info("Orchestrator", `Updated ${symbol} - SL: $${position.stopLossPrice?.toFixed(2)}, TP: $${position.takeProfitPrice?.toFixed(2)}, Trail: ${position.trailingStopPercent || 'N/A'}%`);
    return true;
  }

  async applyTrailingStopToAllPositions(trailPercent: number = 5): Promise<void> {
    for (const [symbol, position] of this.state.activePositions.entries()) {
      if (position.unrealizedPnlPercent > 0) {
        position.trailingStopPercent = trailPercent;
        this.state.activePositions.set(symbol, position);
        log.info("Orchestrator", `Applied ${trailPercent}% trailing stop to ${symbol}`);
      }
    }
  }
}

export const orchestrator = new AutonomousOrchestrator();
