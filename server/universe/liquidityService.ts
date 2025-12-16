import { db } from "../db";
import { universeLiquidityMetrics, universeAssets, type InsertUniverseLiquidity, type UniverseLiquidity, type LiquidityTier } from "../../shared/schema";
import { alpaca } from "../connectors/alpaca";
import { eq, sql, and, gte, lte, isNull, desc } from "drizzle-orm";
import { getSetting } from "../admin/settings";

const PENNY_STOCK_THRESHOLD = 5;

export interface LiquidityTierThresholds {
  tierA: {
    minAdtvUsd: number;
    maxSpreadPct: number;
    minPrice: number;
  };
  tierB: {
    minAdtvUsd: number;
    maxSpreadPct: number;
    minPrice: number;
  };
}

const DEFAULT_THRESHOLDS: LiquidityTierThresholds = {
  tierA: {
    minAdtvUsd: 50_000_000,
    maxSpreadPct: 0.25,
    minPrice: 5,
  },
  tierB: {
    minAdtvUsd: 20_000_000,
    maxSpreadPct: 0.75,
    minPrice: 3,
  },
};

export interface LiquidityComputeResult {
  success: boolean;
  computed: number;
  tierA: number;
  tierB: number;
  tierC: number;
  duration: number;
  traceId?: string;
}

export class LiquidityService {
  private async getThresholds(): Promise<LiquidityTierThresholds> {
    try {
      const setting = await getSetting<LiquidityTierThresholds>("universe", "liquidity_thresholds");
      if (setting) {
        return setting;
      }
    } catch {
    }
    return DEFAULT_THRESHOLDS;
  }

  calculateLiquidityTier(
    adtvUsd: number | null,
    spreadPct: number | null,
    price: number | null,
    thresholds: LiquidityTierThresholds
  ): LiquidityTier {
    if (!adtvUsd || !price) return "C";

    const effectiveSpread = spreadPct ?? 0.5;

    if (
      adtvUsd >= thresholds.tierA.minAdtvUsd &&
      effectiveSpread <= thresholds.tierA.maxSpreadPct &&
      price >= thresholds.tierA.minPrice
    ) {
      return "A";
    }

    if (
      adtvUsd >= thresholds.tierB.minAdtvUsd &&
      effectiveSpread <= thresholds.tierB.maxSpreadPct &&
      price >= thresholds.tierB.minPrice
    ) {
      return "B";
    }

    return "C";
  }

  async computeLiquidityMetrics(options: {
    symbols?: string[];
    batchSize?: number;
    traceId?: string;
  } = {}): Promise<LiquidityComputeResult> {
    const startTime = Date.now();
    const { symbols, batchSize = 50, traceId } = options;

    console.log(`[LIQUIDITY] Starting liquidity computation, traceId=${traceId}`);

    const thresholds = await this.getThresholds();

    let targetSymbols: string[];
    if (symbols && symbols.length > 0) {
      targetSymbols = symbols;
    } else {
      const assets = await db
        .select({ symbol: universeAssets.symbol })
        .from(universeAssets)
        .where(and(
          eq(universeAssets.tradable, true),
          eq(universeAssets.excluded, false)
        ));
      targetSymbols = assets.map((a) => a.symbol);
    }

    console.log(`[LIQUIDITY] Computing metrics for ${targetSymbols.length} symbols`);

    let computed = 0;
    let tierACount = 0;
    let tierBCount = 0;
    let tierCCount = 0;

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const startDate = thirtyDaysAgo.toISOString().split("T")[0];
    const endDate = now.toISOString().split("T")[0];

    for (let i = 0; i < targetSymbols.length; i += batchSize) {
      const batch = targetSymbols.slice(i, i + batchSize);
      
      try {
        const barsResponse = await alpaca.getBars(
          batch,
          "1Day",
          startDate,
          endDate,
          1000
        );

        for (const symbol of batch) {
          const bars = barsResponse.bars?.[symbol] || [];
          
          if (bars.length === 0) {
            const metrics: InsertUniverseLiquidity = {
              symbol,
              avgDailyVolumeShares: null,
              avgDailyTradedValueUsd: null,
              avgBidAskSpreadPct: null,
              latestPrice: null,
              priceDataDays: 0,
              liquidityTier: "C",
              source: "alpaca",
              rawJson: { noData: true },
            };

            await this.upsertLiquidityMetrics(metrics);
            tierCCount++;
            computed++;
            continue;
          }

          let totalVolume = 0;
          let totalValue = 0;
          const latestPrice = bars[bars.length - 1]?.c || 0;

          for (const bar of bars) {
            totalVolume += bar.v;
            totalValue += bar.v * ((bar.h + bar.l) / 2);
          }

          const avgVolume = bars.length > 0 ? totalVolume / bars.length : 0;
          const avgTradedValue = bars.length > 0 ? totalValue / bars.length : 0;

          const tier = this.calculateLiquidityTier(
            avgTradedValue,
            null,
            latestPrice,
            thresholds
          );

          const metrics: InsertUniverseLiquidity = {
            symbol,
            avgDailyVolumeShares: avgVolume.toString(),
            avgDailyTradedValueUsd: avgTradedValue.toString(),
            avgBidAskSpreadPct: null,
            latestPrice: latestPrice.toString(),
            priceDataDays: bars.length,
            liquidityTier: tier,
            source: "alpaca",
            rawJson: { barCount: bars.length, computed: now.toISOString() },
          };

          await this.upsertLiquidityMetrics(metrics);
          
          const isPennyStock = latestPrice < PENNY_STOCK_THRESHOLD && latestPrice > 0;
          await this.updatePennyStockFlag(symbol, isPennyStock, latestPrice);

          if (tier === "A") tierACount++;
          else if (tier === "B") tierBCount++;
          else tierCCount++;

          computed++;
        }
      } catch (error) {
        console.error(`[LIQUIDITY] Failed to process batch starting at ${i}:`, error);
      }

      if (i + batchSize < targetSymbols.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[LIQUIDITY] Computation complete: computed=${computed}, tierA=${tierACount}, tierB=${tierBCount}, tierC=${tierCCount}, duration=${duration}ms`);

    return {
      success: true,
      computed,
      tierA: tierACount,
      tierB: tierBCount,
      tierC: tierCCount,
      duration,
      traceId,
    };
  }

  private async upsertLiquidityMetrics(metrics: InsertUniverseLiquidity): Promise<void> {
    const existing = await db
      .select({ id: universeLiquidityMetrics.id })
      .from(universeLiquidityMetrics)
      .where(eq(universeLiquidityMetrics.symbol, metrics.symbol))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(universeLiquidityMetrics)
        .set({
          ...metrics,
          lastUpdatedAt: new Date(),
        })
        .where(eq(universeLiquidityMetrics.symbol, metrics.symbol));
    } else {
      await db.insert(universeLiquidityMetrics).values(metrics);
    }
  }

  async getMetricsBySymbol(symbol: string): Promise<UniverseLiquidity | null> {
    const result = await db
      .select()
      .from(universeLiquidityMetrics)
      .where(eq(universeLiquidityMetrics.symbol, symbol.toUpperCase()))
      .limit(1);
    return result[0] || null;
  }

  async getMetricsByTier(tier: LiquidityTier, limit = 100): Promise<UniverseLiquidity[]> {
    return db
      .select()
      .from(universeLiquidityMetrics)
      .where(eq(universeLiquidityMetrics.liquidityTier, tier))
      .orderBy(desc(universeLiquidityMetrics.avgDailyTradedValueUsd))
      .limit(limit);
  }

  async getTierStats(): Promise<{ tierA: number; tierB: number; tierC: number; stale: number; total: number }> {
    const all = await db.select().from(universeLiquidityMetrics);
    
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    let tierA = 0, tierB = 0, tierC = 0, stale = 0;

    for (const m of all) {
      if (m.liquidityTier === "A") tierA++;
      else if (m.liquidityTier === "B") tierB++;
      else tierC++;

      if (m.lastUpdatedAt < oneDayAgo) stale++;
    }

    return { tierA, tierB, tierC, stale, total: all.length };
  }

  async getTopLiquid(limit = 50): Promise<UniverseLiquidity[]> {
    return db
      .select()
      .from(universeLiquidityMetrics)
      .orderBy(desc(universeLiquidityMetrics.avgDailyTradedValueUsd))
      .limit(limit);
  }

  async getThresholdsForAdmin(): Promise<LiquidityTierThresholds> {
    return this.getThresholds();
  }

  private async updatePennyStockFlag(symbol: string, isPennyStock: boolean, latestPrice: number): Promise<void> {
    try {
      await db
        .update(universeAssets)
        .set({
          isPennyStock,
          excluded: isPennyStock ? true : undefined,
          excludeReason: isPennyStock ? `Penny stock (price $${latestPrice.toFixed(2)} < $${PENNY_STOCK_THRESHOLD})` : undefined,
        })
        .where(eq(universeAssets.symbol, symbol));
    } catch (error) {
      console.error(`[LIQUIDITY] Failed to update penny stock flag for ${symbol}:`, error);
    }
  }
}

export const liquidityService = new LiquidityService();
