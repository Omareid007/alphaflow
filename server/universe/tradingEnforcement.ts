import { db } from "../db";
import { universeCandidates, universeAssets, universeLiquidityMetrics } from "@shared/schema";
import { eq, and } from "drizzle-orm";
import { log } from "../utils/logger";

export interface TradingEligibilityResult {
  symbol: string;
  eligible: boolean;
  reason: string;
  details?: {
    status?: string;
    liquidityTier?: string;
    isPennyStock?: boolean;
    approvedAt?: Date | null;
    approvedBy?: string | null;
  };
}

export interface EnforcementStats {
  approvedCount: number;
  rejectedAttempts: number;
  lastCheckedAt: Date | null;
}

class TradingEnforcementService {
  private rejectedAttempts = 0;
  private lastCheckedAt: Date | null = null;

  async canTradeSymbol(symbol: string, traceId?: string): Promise<TradingEligibilityResult> {
    this.lastCheckedAt = new Date();
    const upperSymbol = symbol.toUpperCase();

    try {
      const candidate = await db.query.universeCandidates.findFirst({
        where: eq(universeCandidates.symbol, upperSymbol),
      });

      if (!candidate) {
        this.rejectedAttempts++;
        log.info("TradingEnforcement", "Symbol NOT in candidates - trade BLOCKED", { traceId, symbol: upperSymbol });
        return {
          symbol: upperSymbol,
          eligible: false,
          reason: "Symbol not in approved candidates list",
          details: { status: "MISSING" },
        };
      }

      if (candidate.status !== "APPROVED") {
        this.rejectedAttempts++;
        log.info("TradingEnforcement", "Symbol status not APPROVED - trade BLOCKED", { traceId, symbol: upperSymbol, status: candidate.status });
        return {
          symbol: upperSymbol,
          eligible: false,
          reason: `Symbol status is ${candidate.status}, not APPROVED`,
          details: {
            status: candidate.status,
            liquidityTier: candidate.tier || undefined,
            approvedAt: null,
            approvedBy: null,
          },
        };
      }

      const asset = await db.query.universeAssets.findFirst({
        where: eq(universeAssets.symbol, upperSymbol),
      });

      if (asset && !asset.tradable) {
        this.rejectedAttempts++;
        log.info("TradingEnforcement", "Symbol marked non-tradable by Alpaca - trade BLOCKED", { traceId, symbol: upperSymbol });
        return {
          symbol: upperSymbol,
          eligible: false,
          reason: "Symbol is marked non-tradable by Alpaca",
          details: { status: candidate.status },
        };
      }

      const liquidity = await db.query.universeLiquidityMetrics.findFirst({
        where: eq(universeLiquidityMetrics.symbol, upperSymbol),
      });

      const isPennyStock = liquidity?.latestPrice && parseFloat(liquidity.latestPrice) < 5;
      if (isPennyStock) {
        this.rejectedAttempts++;
        log.info("TradingEnforcement", "Symbol is a penny stock - trade BLOCKED", { traceId, symbol: upperSymbol, price: liquidity?.latestPrice });
        return {
          symbol: upperSymbol,
          eligible: false,
          reason: "Penny stocks (price < $5) are not tradable",
          details: {
            status: candidate.status,
            isPennyStock: true,
            liquidityTier: liquidity?.liquidityTier || undefined,
          },
        };
      }

      log.info("TradingEnforcement", "Symbol APPROVED - trade ALLOWED", { traceId, symbol: upperSymbol });
      return {
        symbol: upperSymbol,
        eligible: true,
        reason: "Symbol is approved for trading",
        details: {
          status: candidate.status,
          liquidityTier: candidate.tier || undefined,
          approvedAt: candidate.approvedAt,
          approvedBy: candidate.approvedBy,
        },
      };
    } catch (error) {
      log.error("TradingEnforcement", "Error checking symbol", { traceId, symbol: upperSymbol, error: error instanceof Error ? error.message : String(error) });
      this.rejectedAttempts++;
      return {
        symbol: upperSymbol,
        eligible: false,
        reason: "Error checking trading eligibility",
      };
    }
  }

  async canTradeMultiple(symbols: string[], traceId?: string): Promise<Map<string, TradingEligibilityResult>> {
    const results = new Map<string, TradingEligibilityResult>();
    
    for (const symbol of symbols) {
      const result = await this.canTradeSymbol(symbol, traceId);
      results.set(symbol.toUpperCase(), result);
    }
    
    return results;
  }

  async getApprovedSymbolsSet(traceId?: string): Promise<Set<string>> {
    try {
      const approved = await db.query.universeCandidates.findMany({
        where: eq(universeCandidates.status, "APPROVED"),
        columns: { symbol: true },
      });
      
      log.info("TradingEnforcement", "Retrieved approved symbols", { traceId, count: approved.length });
      return new Set(approved.map(c => c.symbol));
    } catch (error) {
      log.error("TradingEnforcement", "Error getting approved symbols", { traceId, error: error instanceof Error ? error.message : String(error) });
      return new Set();
    }
  }

  async filterToApproved(symbols: string[], traceId?: string): Promise<string[]> {
    const approvedSet = await this.getApprovedSymbolsSet(traceId);
    return symbols.filter(s => approvedSet.has(s.toUpperCase()));
  }

  async getStats(): Promise<EnforcementStats> {
    const approved = await db.query.universeCandidates.findMany({
      where: eq(universeCandidates.status, "APPROVED"),
      columns: { symbol: true },
    });

    return {
      approvedCount: approved.length,
      rejectedAttempts: this.rejectedAttempts,
      lastCheckedAt: this.lastCheckedAt,
    };
  }

  resetStats(): void {
    this.rejectedAttempts = 0;
    this.lastCheckedAt = null;
  }
}

export const tradingEnforcementService = new TradingEnforcementService();
