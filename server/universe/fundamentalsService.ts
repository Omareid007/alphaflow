import { db } from "../db";
import { universeFundamentals, universeAssets, type InsertUniverseFundamentals, type UniverseFundamentals } from "../../shared/schema";
import { finnhub } from "../connectors/finnhub";
import { eq, sql, and, desc, isNull, isNotNull } from "drizzle-orm";
import { getSetting } from "../admin/settings";

export interface QualityGrowthScore {
  qualityScore: number;
  growthScore: number;
  finalScore: number;
  breakdown: {
    revenueGrowthScore: number;
    marginScore: number;
    leverageScore: number;
    dilutionScore: number;
  };
}

export interface FundamentalsComputeResult {
  success: boolean;
  computed: number;
  failed: number;
  duration: number;
  traceId?: string;
}

const DEFAULT_SCORE_WEIGHTS = {
  revenueGrowth: 0.35,
  margins: 0.30,
  leverage: 0.20,
  dilution: 0.15,
};

function safeParseNumeric(value: string | number | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === "string" ? parseFloat(value) : value;
  return isNaN(num) ? null : num;
}

function normalizeScore(value: number | null, min: number, max: number, invert = false): number {
  if (value === null) return 0.5;
  const clamped = Math.max(min, Math.min(max, value));
  const normalized = (clamped - min) / (max - min);
  return invert ? 1 - normalized : normalized;
}

export class FundamentalsService {
  calculateQualityGrowthScore(fundamentals: UniverseFundamentals): QualityGrowthScore {
    const revenueCagr = safeParseNumeric(fundamentals.revenueCagr3y);
    const grossMargin = safeParseNumeric(fundamentals.grossMargin);
    const operatingMargin = safeParseNumeric(fundamentals.operatingMargin);
    const netMargin = safeParseNumeric(fundamentals.netMargin);
    const freeCashFlowMargin = safeParseNumeric(fundamentals.freeCashFlowMargin);
    const debtToEquity = safeParseNumeric(fundamentals.debtToEquity);
    const sharesDilution = safeParseNumeric(fundamentals.sharesDilution1y);

    const revenueGrowthScore = normalizeScore(revenueCagr, -0.10, 0.50);

    const avgMargin = [grossMargin, operatingMargin, netMargin, freeCashFlowMargin]
      .filter((m) => m !== null)
      .reduce((sum, m, _, arr) => sum + (m as number) / arr.length, 0);
    const marginScore = normalizeScore(avgMargin, -0.10, 0.40);

    const leverageScore = normalizeScore(debtToEquity, 0, 3, true);

    const dilutionScore = normalizeScore(sharesDilution, -0.10, 0.15, true);

    const qualityScore = (marginScore + leverageScore) / 2;
    const growthScore = (revenueGrowthScore + (1 - dilutionScore)) / 2;

    const weights = DEFAULT_SCORE_WEIGHTS;
    const finalScore =
      revenueGrowthScore * weights.revenueGrowth +
      marginScore * weights.margins +
      leverageScore * weights.leverage +
      dilutionScore * weights.dilution;

    return {
      qualityScore: Math.round(qualityScore * 100) / 100,
      growthScore: Math.round(growthScore * 100) / 100,
      finalScore: Math.round(finalScore * 100) / 100,
      breakdown: {
        revenueGrowthScore: Math.round(revenueGrowthScore * 100) / 100,
        marginScore: Math.round(marginScore * 100) / 100,
        leverageScore: Math.round(leverageScore * 100) / 100,
        dilutionScore: Math.round(dilutionScore * 100) / 100,
      },
    };
  }

  async fetchAndStoreFundamentals(options: {
    symbols?: string[];
    batchSize?: number;
    traceId?: string;
  } = {}): Promise<FundamentalsComputeResult> {
    const startTime = Date.now();
    const { symbols, batchSize = 10, traceId } = options;

    console.log(`[FUNDAMENTALS] Starting fundamentals fetch, traceId=${traceId}`);

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

    console.log(`[FUNDAMENTALS] Fetching fundamentals for ${targetSymbols.length} symbols`);

    let computed = 0;
    let failed = 0;

    for (let i = 0; i < targetSymbols.length; i += batchSize) {
      const batch = targetSymbols.slice(i, i + batchSize);

      for (const symbol of batch) {
        try {
          const [profile, basicFinancials] = await Promise.all([
            finnhub.getCompanyProfile(symbol),
            finnhub.getBasicFinancials(symbol),
          ]);

          const metric = basicFinancials?.metric || {};
          
          const fundamentalsData: InsertUniverseFundamentals = {
            symbol,
            marketCap: profile?.marketCapitalization?.toString() || null,
            sector: profile?.finnhubIndustry || null,
            industry: profile?.finnhubIndustry || null,
            revenueTtm: metric.revenuePerShareTTM ? (metric.revenuePerShareTTM * (metric.sharesOutstanding || 1)).toString() : null,
            revenueCagr3y: metric.revenueGrowthTTMYoy ? (metric.revenueGrowthTTMYoy / 100).toString() : null,
            grossMargin: metric.grossMarginTTM ? (metric.grossMarginTTM / 100).toString() : null,
            operatingMargin: metric.operatingMarginTTM ? (metric.operatingMarginTTM / 100).toString() : null,
            netMargin: metric.netProfitMarginTTM ? (metric.netProfitMarginTTM / 100).toString() : null,
            freeCashFlowMargin: metric.freeCashFlowMarginTTM ? (metric.freeCashFlowMarginTTM / 100).toString() : null,
            debtToEquity: metric.totalDebtToEquity?.toString() || null,
            sharesDilution1y: null,
            source: "finnhub",
            rawJson: { profile, metric } as unknown as Record<string, unknown>,
          };

          await this.upsertFundamentals(fundamentalsData);
          computed++;
        } catch (error) {
          console.error(`[FUNDAMENTALS] Failed to fetch fundamentals for ${symbol}:`, error);
          failed++;
        }
      }

      if (i + batchSize < targetSymbols.length) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[FUNDAMENTALS] Fetch complete: computed=${computed}, failed=${failed}, duration=${duration}ms`);

    return {
      success: true,
      computed,
      failed,
      duration,
      traceId,
    };
  }

  private async upsertFundamentals(data: InsertUniverseFundamentals): Promise<void> {
    const existing = await db
      .select({ id: universeFundamentals.id })
      .from(universeFundamentals)
      .where(eq(universeFundamentals.symbol, data.symbol))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(universeFundamentals)
        .set({
          ...data,
          lastUpdatedAt: new Date(),
        })
        .where(eq(universeFundamentals.symbol, data.symbol));
    } else {
      await db.insert(universeFundamentals).values(data);
    }
  }

  async getFundamentalsBySymbol(symbol: string): Promise<UniverseFundamentals | null> {
    const result = await db
      .select()
      .from(universeFundamentals)
      .where(eq(universeFundamentals.symbol, symbol.toUpperCase()))
      .limit(1);
    return result[0] || null;
  }

  async getFundamentalsWithScores(limit = 100): Promise<Array<UniverseFundamentals & QualityGrowthScore>> {
    const fundamentals = await db
      .select()
      .from(universeFundamentals)
      .limit(limit);

    return fundamentals.map((f) => ({
      ...f,
      ...this.calculateQualityGrowthScore(f),
    }));
  }

  async getTopByScore(limit = 50): Promise<Array<UniverseFundamentals & QualityGrowthScore>> {
    const fundamentals = await db
      .select()
      .from(universeFundamentals)
      .limit(500);

    const scored = fundamentals.map((f) => ({
      ...f,
      ...this.calculateQualityGrowthScore(f),
    }));

    return scored
      .sort((a, b) => b.finalScore - a.finalScore)
      .slice(0, limit);
  }

  async getStats(): Promise<{
    total: number;
    bySector: Record<string, number>;
    stale: number;
    lastUpdatedAt: Date | null;
  }> {
    const all = await db.select().from(universeFundamentals);

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const bySector: Record<string, number> = {};
    let stale = 0;
    let lastUpdatedAt: Date | null = null;

    for (const f of all) {
      if (f.sector) {
        bySector[f.sector] = (bySector[f.sector] || 0) + 1;
      }
      if (f.lastUpdatedAt < oneDayAgo) stale++;
      if (!lastUpdatedAt || f.lastUpdatedAt > lastUpdatedAt) {
        lastUpdatedAt = f.lastUpdatedAt;
      }
    }

    return {
      total: all.length,
      bySector,
      stale,
      lastUpdatedAt,
    };
  }
}

export const fundamentalsService = new FundamentalsService();
