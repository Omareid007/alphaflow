import { db } from "../db";
import { universeCandidates, universeAssets, universeLiquidityMetrics } from "../shared/schema";
import { eq, and } from "drizzle-orm";

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
        console.log(`[ENFORCEMENT] ${traceId || "?"} Symbol ${upperSymbol} NOT in candidates - trade BLOCKED`);
        return {
          symbol: upperSymbol,
          eligible: false,
          reason: "Symbol not in approved candidates list",
          details: { status: "MISSING" },
        };
      }

      if (candidate.status !== "APPROVED") {
        this.rejectedAttempts++;
        console.log(`[ENFORCEMENT] ${traceId || "?"} Symbol ${upperSymbol} status=${candidate.status} - trade BLOCKED`);
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
        console.log(`[ENFORCEMENT] ${traceId || "?"} Symbol ${upperSymbol} marked non-tradable by Alpaca - trade BLOCKED`);
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
        console.log(`[ENFORCEMENT] ${traceId || "?"} Symbol ${upperSymbol} is a penny stock ($${liquidity?.latestPrice}) - trade BLOCKED`);
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

      console.log(`[ENFORCEMENT] ${traceId || "?"} Symbol ${upperSymbol} APPROVED - trade ALLOWED`);
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
      console.error(`[ENFORCEMENT] ${traceId || "?"} Error checking ${upperSymbol}:`, error);
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
      
      console.log(`[ENFORCEMENT] ${traceId || "?"} Retrieved ${approved.length} approved symbols`);
      return new Set(approved.map(c => c.symbol));
    } catch (error) {
      console.error(`[ENFORCEMENT] ${traceId || "?"} Error getting approved symbols:`, error);
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
