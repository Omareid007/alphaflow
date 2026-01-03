#!/usr/bin/env node
/**
 * Trading Utilities MCP Server
 *
 * Provides trading-specific tools for Claude Code:
 * - check_portfolio_risk: Calculate portfolio risk metrics
 * - validate_order: Pre-trade validation
 * - get_live_positions: Current positions with P&L
 * - market_status: Market hours and trading windows
 * - check_circuit_breaker: Circuit breaker state
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";

import { z } from "zod";
import {
  AlpacaAccount,
  AlpacaPosition,
  AlpacaClock,
  CircuitBreakerStatus,
  MarketStatus,
  OrderValidation,
  Position,
  RiskMetrics,
  RISK_THRESHOLDS,
  SECTOR_MAP,
} from "./types.js";

// Environment variables
const ALPACA_API_KEY = process.env.ALPACA_API_KEY || "";
const ALPACA_SECRET_KEY = process.env.ALPACA_SECRET_KEY || "";
const ALPACA_BASE_URL =
  process.env.ALPACA_BASE_URL || "https://paper-api.alpaca.markets";
const SERVER_URL = process.env.SERVER_URL || "http://localhost:5000";

// Helper: Fetch from Alpaca API
async function alpacaFetch<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${ALPACA_BASE_URL}${endpoint}`, {
    headers: {
      "APCA-API-KEY-ID": ALPACA_API_KEY,
      "APCA-API-SECRET-KEY": ALPACA_SECRET_KEY,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Alpaca API error: ${response.status} ${response.statusText}`
    );
  }

  return response.json() as Promise<T>;
}

// Tool: Get Live Positions
async function getLivePositions(): Promise<Position[]> {
  const alpacaPositions = await alpacaFetch<AlpacaPosition[]>("/v2/positions");

  return alpacaPositions.map((p) => ({
    symbol: p.symbol,
    qty: parseFloat(p.qty),
    avgEntryPrice: parseFloat(p.avg_entry_price),
    currentPrice: parseFloat(p.current_price),
    marketValue: parseFloat(p.market_value),
    unrealizedPL: parseFloat(p.unrealized_pl),
    unrealizedPLPercent: parseFloat(p.unrealized_plpc) * 100,
    side: parseFloat(p.qty) >= 0 ? "long" : "short",
    assetClass: p.asset_class,
  }));
}

// Tool: Check Portfolio Risk
async function checkPortfolioRisk(): Promise<RiskMetrics> {
  const [account, positions] = await Promise.all([
    alpacaFetch<AlpacaAccount>("/v2/account"),
    getLivePositions(),
  ]);

  const equity = parseFloat(account.equity);
  const buyingPower = parseFloat(account.buying_power);
  const cash = parseFloat(account.cash);
  const lastEquity = parseFloat(account.last_equity);

  // Calculate total position value
  const totalPositionValue = positions.reduce(
    (sum, p) => sum + Math.abs(p.marketValue),
    0
  );

  // Calculate concentration per position
  let maxConcentration = 0;
  let maxConcentrationSymbol = "";
  for (const pos of positions) {
    const concentration = Math.abs(pos.marketValue) / equity;
    if (concentration > maxConcentration) {
      maxConcentration = concentration;
      maxConcentrationSymbol = pos.symbol;
    }
  }

  // Calculate sector exposure
  const sectorExposure: Record<string, number> = {};
  for (const pos of positions) {
    const sector = SECTOR_MAP[pos.symbol] || "Other";
    sectorExposure[sector] =
      (sectorExposure[sector] || 0) + Math.abs(pos.marketValue);
  }

  // Convert to percentages
  for (const sector of Object.keys(sectorExposure)) {
    sectorExposure[sector] = sectorExposure[sector] / equity;
  }

  // Find max sector
  let maxSectorExposure = 0;
  let maxSectorName = "";
  for (const [sector, exposure] of Object.entries(sectorExposure)) {
    if (exposure > maxSectorExposure) {
      maxSectorExposure = exposure;
      maxSectorName = sector;
    }
  }

  // Calculate drawdown
  const peakEquity = Math.max(equity, lastEquity);
  const currentDrawdown = (peakEquity - equity) / peakEquity;

  // Simple VaR estimate (using historical volatility proxy)
  const portfolioVaR95 = equity * 0.02; // ~2% daily VaR at 95%
  const portfolioVaR99 = equity * 0.03; // ~3% daily VaR at 99%

  // Determine risk level
  const alerts: string[] = [];
  let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";

  const concentrationBreached =
    maxConcentration > RISK_THRESHOLDS.MAX_POSITION_CONCENTRATION;
  const sectorBreached =
    maxSectorExposure > RISK_THRESHOLDS.MAX_SECTOR_EXPOSURE;

  if (concentrationBreached) {
    alerts.push(
      `Position ${maxConcentrationSymbol} exceeds 5% limit (${(maxConcentration * 100).toFixed(1)}%)`
    );
    riskLevel = "HIGH";
  } else if (
    maxConcentration >
    RISK_THRESHOLDS.MAX_POSITION_CONCENTRATION *
      RISK_THRESHOLDS.WARNING_THRESHOLD
  ) {
    alerts.push(
      `Position ${maxConcentrationSymbol} approaching 5% limit (${(maxConcentration * 100).toFixed(1)}%)`
    );
    riskLevel = "MEDIUM";
  }

  if (sectorBreached) {
    alerts.push(
      `Sector ${maxSectorName} exceeds 25% limit (${(maxSectorExposure * 100).toFixed(1)}%)`
    );
    riskLevel = riskLevel === "HIGH" ? "CRITICAL" : "HIGH";
  } else if (
    maxSectorExposure >
    RISK_THRESHOLDS.MAX_SECTOR_EXPOSURE * RISK_THRESHOLDS.WARNING_THRESHOLD
  ) {
    alerts.push(
      `Sector ${maxSectorName} approaching 25% limit (${(maxSectorExposure * 100).toFixed(1)}%)`
    );
    if (riskLevel === "LOW") riskLevel = "MEDIUM";
  }

  if (currentDrawdown > RISK_THRESHOLDS.MAX_DAILY_DRAWDOWN) {
    alerts.push(
      `Daily drawdown exceeds 5% limit (${(currentDrawdown * 100).toFixed(2)}%)`
    );
    riskLevel = "CRITICAL";
  }

  return {
    totalEquity: equity,
    totalPositionValue,
    buyingPower,
    cashBalance: cash,
    maxPositionConcentration: maxConcentration,
    maxPositionSymbol: maxConcentrationSymbol,
    concentrationBreached,
    sectorExposure,
    maxSectorExposure,
    maxSectorName,
    sectorBreached,
    portfolioVaR95,
    portfolioVaR99,
    currentDrawdown,
    peakEquity,
    riskLevel,
    alerts,
  };
}

// Tool: Validate Order
async function validateOrder(
  symbol: string,
  side: "buy" | "sell",
  qty: number
): Promise<OrderValidation> {
  const [account, positions, clock, cbStatus] = await Promise.all([
    alpacaFetch<AlpacaAccount>("/v2/account"),
    getLivePositions(),
    alpacaFetch<AlpacaClock>("/v2/clock"),
    checkCircuitBreaker(),
  ]);

  const equity = parseFloat(account.equity);
  const buyingPower = parseFloat(account.buying_power);

  // Estimate order value (simple estimate)
  const existingPosition = positions.find((p) => p.symbol === symbol);
  const estimatedPrice = existingPosition?.currentPrice || 100; // Default fallback
  const estimatedValue = qty * estimatedPrice;

  // Calculate what new concentration would be
  const currentPositionValue = existingPosition?.marketValue || 0;
  const newPositionValue =
    side === "buy"
      ? currentPositionValue + estimatedValue
      : currentPositionValue - estimatedValue;
  const newConcentration = Math.abs(newPositionValue) / equity;

  // Calculate new sector exposure
  const sector = SECTOR_MAP[symbol] || "Other";
  const currentSectorExposure = positions
    .filter((p) => (SECTOR_MAP[p.symbol] || "Other") === sector)
    .reduce((sum, p) => sum + Math.abs(p.marketValue), 0);
  const newSectorExposure =
    (currentSectorExposure +
      (side === "buy" ? estimatedValue : -estimatedValue)) /
    equity;

  const checks = {
    marketOpen: clock.is_open,
    symbolTradable: true, // Would need asset lookup for full validation
    sufficientBuyingPower:
      side === "buy" ? estimatedValue <= buyingPower : true,
    positionLimitOk:
      newConcentration <= RISK_THRESHOLDS.MAX_POSITION_CONCENTRATION,
    sectorLimitOk: newSectorExposure <= RISK_THRESHOLDS.MAX_SECTOR_EXPOSURE,
    circuitBreakerOk: cbStatus.canTrade,
    dailyLossLimitOk: true, // Would need daily P&L tracking
  };

  const failureReasons: string[] = [];
  const recommendations: string[] = [];

  if (!checks.marketOpen) {
    failureReasons.push("Market is closed");
    recommendations.push(`Wait until market opens at ${clock.next_open}`);
  }

  if (!checks.sufficientBuyingPower) {
    failureReasons.push(
      `Insufficient buying power: need $${estimatedValue.toFixed(2)}, have $${buyingPower.toFixed(2)}`
    );
    recommendations.push(
      `Reduce order size to max ${Math.floor(buyingPower / estimatedPrice)} shares`
    );
  }

  if (!checks.positionLimitOk) {
    failureReasons.push(
      `Position would exceed 5% limit (${(newConcentration * 100).toFixed(1)}%)`
    );
    const maxQty = Math.floor(
      (equity * RISK_THRESHOLDS.MAX_POSITION_CONCENTRATION -
        currentPositionValue) /
        estimatedPrice
    );
    recommendations.push(`Reduce quantity to max ${maxQty} shares`);
  }

  if (!checks.sectorLimitOk) {
    failureReasons.push(
      `Sector ${sector} would exceed 25% limit (${(newSectorExposure * 100).toFixed(1)}%)`
    );
    recommendations.push("Consider diversifying into other sectors");
  }

  if (!checks.circuitBreakerOk) {
    failureReasons.push("Circuit breaker is open - trading suspended");
    recommendations.push(
      `Wait ${cbStatus.cooldownRemaining}s for circuit breaker reset`
    );
  }

  const isValid = Object.values(checks).every(Boolean);

  return {
    isValid,
    symbol,
    side,
    qty,
    estimatedValue,
    checks,
    failureReasons,
    recommendations,
  };
}

// Tool: Market Status
async function getMarketStatus(): Promise<MarketStatus> {
  const clock = await alpacaFetch<AlpacaClock>("/v2/clock");

  const now = new Date(clock.timestamp);
  const nextOpen = clock.next_open ? new Date(clock.next_open) : null;
  const nextClose = clock.next_close ? new Date(clock.next_close) : null;

  // Calculate time until next change
  let timeUntilChange = "";
  if (clock.is_open && nextClose) {
    const diffMs = nextClose.getTime() - now.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    timeUntilChange = `${hours}h ${minutes}m until close`;
  } else if (!clock.is_open && nextOpen) {
    const diffMs = nextOpen.getTime() - now.getTime();
    const hours = Math.floor(diffMs / (1000 * 60 * 60));
    const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    timeUntilChange = `${hours}h ${minutes}m until open`;
  }

  // Check extended hours (pre-market: 4:00-9:30 ET, after-hours: 16:00-20:00 ET)
  const etHour = now.getUTCHours() - 5; // Rough EST conversion
  const preMarketOpen = etHour >= 4 && etHour < 9.5;
  const afterMarketOpen = etHour >= 16 && etHour < 20;

  return {
    isOpen: clock.is_open,
    currentTime: clock.timestamp,
    nextOpen: clock.next_open || null,
    nextClose: clock.next_close || null,
    timeUntilChange,
    preMarketOpen,
    afterMarketOpen,
    equitiesTrading: clock.is_open || preMarketOpen || afterMarketOpen,
    cryptoTrading: true, // Crypto trades 24/7 on Alpaca
  };
}

// Tool: Check Circuit Breaker
async function checkCircuitBreaker(): Promise<CircuitBreakerStatus> {
  try {
    const response = await fetch(
      `${SERVER_URL}/api/alpaca/circuit-breaker/status`
    );
    if (!response.ok) {
      return {
        isOpen: false,
        openedAt: null,
        reason: null,
        failureCount: 0,
        lastFailure: null,
        cooldownRemaining: 0,
        canTrade: true,
      };
    }

    const data = (await response.json()) as {
      isOpen: boolean;
      openedAt?: string;
      reason?: string;
      failureCount?: number;
      lastFailure?: string;
      cooldownRemaining?: number;
    };

    return {
      isOpen: data.isOpen || false,
      openedAt: data.openedAt || null,
      reason: data.reason || null,
      failureCount: data.failureCount || 0,
      lastFailure: data.lastFailure || null,
      cooldownRemaining: data.cooldownRemaining || 0,
      canTrade: !data.isOpen,
    };
  } catch {
    // If server is unreachable, assume trading is OK but warn
    return {
      isOpen: false,
      openedAt: null,
      reason: "Unable to reach trading server",
      failureCount: 0,
      lastFailure: null,
      cooldownRemaining: 0,
      canTrade: true,
    };
  }
}

// Define tools
const tools: Tool[] = [
  {
    name: "check_portfolio_risk",
    description:
      "Calculate comprehensive portfolio risk metrics including concentration, sector exposure, VaR, and drawdown. Returns alerts if any thresholds are breached.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "validate_order",
    description:
      "Pre-trade validation against risk limits. Checks market hours, buying power, position limits (5%), sector exposure (25%), and circuit breaker state.",
    inputSchema: {
      type: "object",
      properties: {
        symbol: {
          type: "string",
          description: "Stock symbol (e.g., AAPL, NVDA)",
        },
        side: {
          type: "string",
          enum: ["buy", "sell"],
          description: "Order side",
        },
        qty: {
          type: "number",
          description: "Number of shares",
        },
      },
      required: ["symbol", "side", "qty"],
    },
  },
  {
    name: "get_live_positions",
    description:
      "Get current portfolio positions with real-time P&L. Returns symbol, quantity, entry price, current price, market value, and unrealized P&L.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "market_status",
    description:
      "Check market hours, next open/close times, and trading availability for equities and crypto.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "check_circuit_breaker",
    description:
      "Check trading circuit breaker status. Returns whether trading is suspended and time until reset.",
    inputSchema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
];

// Input schemas for validation
const ValidateOrderSchema = z.object({
  symbol: z.string(),
  side: z.enum(["buy", "sell"]),
  qty: z.number().positive(),
});

// Create and run server
async function main() {
  const server = new Server(
    {
      name: "trading-utilities",
      version: "1.0.0",
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle tool listing
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools,
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "check_portfolio_risk": {
          const result = await checkPortfolioRisk();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "validate_order": {
          const parsed = ValidateOrderSchema.parse(args);
          const result = await validateOrder(
            parsed.symbol,
            parsed.side,
            parsed.qty
          );
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "get_live_positions": {
          const result = await getLivePositions();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "market_status": {
          const result = await getMarketStatus();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        case "check_circuit_breaker": {
          const result = await checkCircuitBreaker();
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(result, null, 2),
              },
            ],
          };
        }

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Run server
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Trading Utilities MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
