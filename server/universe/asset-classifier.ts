import { db } from "../db";
import {
  assetClassifications,
  universeLiquidityMetrics,
  universeFundamentals,
  universeTechnicals,
  universeAssets,
  type InsertAssetClassification,
  type AssetClassification,
  type MarketCapTier,
  type VolatilityTier,
  type TrendStrength,
  type AssetClassType,
  type LiquidityTier,
} from "@shared/schema";
import { eq, and, desc, sql, gte, isNotNull } from "drizzle-orm";
import { alpaca } from "../connectors/alpaca";
import { log } from "../utils/logger";

const CRYPTO_MAJORS = ["BTC", "ETH", "SOL", "XRP", "ADA", "DOGE", "AVAX", "DOT", "LINK", "MATIC"];

export interface ClassificationResult {
  symbol: string;
  assetClass: AssetClassType;
  marketCapTier: MarketCapTier;
  liquidityTier: LiquidityTier;
  volatilityTier: VolatilityTier;
  trendStrength: TrendStrength;
  momentumScore: number;
  valueScore: number;
  qualityScore: number;
}

export interface ClassifyBatchResult {
  success: boolean;
  classified: number;
  errors: string[];
  duration: number;
  traceId?: string;
}

export class AssetClassifier {
  determineMarketCapTier(marketCap: number | null): MarketCapTier {
    if (!marketCap) return "micro";
    if (marketCap >= 200_000_000_000) return "mega";
    if (marketCap >= 10_000_000_000) return "large";
    if (marketCap >= 2_000_000_000) return "mid";
    if (marketCap >= 300_000_000) return "small";
    return "micro";
  }

  determineVolatilityTier(atr14: number | null, price: number | null): VolatilityTier {
    if (!atr14 || !price || price === 0) return "medium";
    const atrPct = (atr14 / price) * 100;
    if (atrPct > 5) return "high";
    if (atrPct < 2) return "low";
    return "medium";
  }

  determineTrendStrength(
    sma20: number | null,
    sma50: number | null,
    sma200: number | null,
    currentPrice: number | null
  ): TrendStrength {
    if (!currentPrice || !sma20 || !sma50 || !sma200) return "neutral";

    const above20 = currentPrice > sma20;
    const above50 = currentPrice > sma50;
    const above200 = currentPrice > sma200;
    const sma20Above50 = sma20 > sma50;
    const sma50Above200 = sma50 > sma200;

    const bullishCount = [above20, above50, above200, sma20Above50, sma50Above200].filter(Boolean).length;

    if (bullishCount >= 5) return "strong_up";
    if (bullishCount >= 3) return "weak_up";
    if (bullishCount <= 1) return "strong_down";
    if (bullishCount <= 2) return "weak_down";
    return "neutral";
  }

  calculateMomentumScore(rsi14: number | null, macd: number | null, macdSignal: number | null): number {
    let score = 0;

    if (rsi14 !== null) {
      if (rsi14 > 70) score -= 20;
      else if (rsi14 > 60) score += 10;
      else if (rsi14 > 40) score += 5;
      else if (rsi14 < 30) score += 20;
      else score -= 10;
    }

    if (macd !== null && macdSignal !== null) {
      const diff = macd - macdSignal;
      if (diff > 0) score += Math.min(30, diff * 10);
      else score += Math.max(-30, diff * 10);
    }

    return Math.max(-100, Math.min(100, score));
  }

  calculateValueScore(
    peRatio: number | null,
    priceToBook: number | null,
    marketCap: number | null,
    revenue: number | null
  ): number {
    let score = 0;

    if (peRatio !== null) {
      if (peRatio < 0) score -= 20;
      else if (peRatio < 15) score += 30;
      else if (peRatio < 25) score += 10;
      else if (peRatio > 50) score -= 20;
    }

    if (priceToBook !== null) {
      if (priceToBook < 1) score += 20;
      else if (priceToBook < 3) score += 10;
      else if (priceToBook > 10) score -= 10;
    }

    if (marketCap !== null && revenue !== null && revenue > 0) {
      const psRatio = marketCap / revenue;
      if (psRatio < 2) score += 20;
      else if (psRatio < 5) score += 10;
      else if (psRatio > 15) score -= 10;
    }

    return Math.max(-100, Math.min(100, score));
  }

  calculateQualityScore(
    grossMargin: number | null,
    operatingMargin: number | null,
    debtToEquity: number | null,
    freeCashFlowMargin: number | null
  ): number {
    let score = 0;

    if (grossMargin !== null) {
      if (grossMargin > 0.6) score += 25;
      else if (grossMargin > 0.4) score += 15;
      else if (grossMargin > 0.2) score += 5;
      else score -= 10;
    }

    if (operatingMargin !== null) {
      if (operatingMargin > 0.2) score += 25;
      else if (operatingMargin > 0.1) score += 15;
      else if (operatingMargin > 0) score += 5;
      else score -= 15;
    }

    if (debtToEquity !== null) {
      if (debtToEquity < 0.3) score += 20;
      else if (debtToEquity < 1) score += 10;
      else if (debtToEquity > 2) score -= 20;
    }

    if (freeCashFlowMargin !== null) {
      if (freeCashFlowMargin > 0.15) score += 20;
      else if (freeCashFlowMargin > 0.05) score += 10;
      else if (freeCashFlowMargin < 0) score -= 15;
    }

    return Math.max(-100, Math.min(100, score));
  }

  determineAssetClass(
    symbol: string,
    marketCapTier: MarketCapTier,
    valueScore: number,
    isCrypto: boolean,
    isEtf: boolean
  ): AssetClassType {
    if (isCrypto) {
      const baseSymbol = symbol.replace(/USD$/, "");
      return CRYPTO_MAJORS.includes(baseSymbol) ? "crypto_major" : "crypto_alt";
    }

    if (isEtf) {
      const sectorEtfs = ["XLK", "XLF", "XLE", "XLV", "XLI", "XLB", "XLU", "XLP", "XLY", "XLRE"];
      return sectorEtfs.includes(symbol) ? "etf_sector" : "etf_index";
    }

    const isGrowth = valueScore < 0;

    if (marketCapTier === "mega" || marketCapTier === "large") {
      return isGrowth ? "large_cap_growth" : "large_cap_value";
    }
    if (marketCapTier === "mid") {
      return isGrowth ? "mid_cap_growth" : "mid_cap_value";
    }
    return "small_cap";
  }

  async classifySymbol(symbol: string): Promise<ClassificationResult | null> {
    try {
      const [liquidity] = await db
        .select()
        .from(universeLiquidityMetrics)
        .where(eq(universeLiquidityMetrics.symbol, symbol))
        .limit(1);

      const [fundamentals] = await db
        .select()
        .from(universeFundamentals)
        .where(eq(universeFundamentals.symbol, symbol))
        .limit(1);

      const [technicals] = await db
        .select()
        .from(universeTechnicals)
        .where(eq(universeTechnicals.symbol, symbol))
        .orderBy(desc(universeTechnicals.date))
        .limit(1);

      const [asset] = await db
        .select()
        .from(universeAssets)
        .where(eq(universeAssets.symbol, symbol))
        .limit(1);

      const isCrypto = asset?.assetClass === "crypto";
      const isEtf = asset?.assetClass === "us_equity" && symbol.length <= 4 && 
        ["SPY", "QQQ", "IWM", "DIA", "VTI", "VOO", "XLK", "XLF", "XLE", "XLV"].includes(symbol);

      const marketCap = fundamentals?.marketCap ? Number(fundamentals.marketCap) : null;
      const marketCapTier = this.determineMarketCapTier(marketCap);

      const liquidityTier: LiquidityTier = (liquidity?.liquidityTier as LiquidityTier) || "C";

      const atr14 = technicals?.atr14 ? Number(technicals.atr14) : null;
      const currentPrice = technicals?.close ? Number(technicals.close) : null;
      const volatilityTier = this.determineVolatilityTier(atr14, currentPrice);

      const sma20 = technicals?.sma20 ? Number(technicals.sma20) : null;
      const sma50 = technicals?.sma50 ? Number(technicals.sma50) : null;
      const sma200 = technicals?.sma200 ? Number(technicals.sma200) : null;
      const trendStrength = this.determineTrendStrength(sma20, sma50, sma200, currentPrice);

      const rsi14 = technicals?.rsi14 ? Number(technicals.rsi14) : null;
      const macd = technicals?.macd ? Number(technicals.macd) : null;
      const macdSignal = technicals?.macdSignal ? Number(technicals.macdSignal) : null;
      const momentumScore = this.calculateMomentumScore(rsi14, macd, macdSignal);

      const revenue = fundamentals?.revenueTtm ? Number(fundamentals.revenueTtm) : null;
      const peRatio = fundamentals?.peRatio ? Number(fundamentals.peRatio) : null;
      const priceToBook = fundamentals?.priceToBook ? Number(fundamentals.priceToBook) : null;
      const valueScore = this.calculateValueScore(peRatio, priceToBook, marketCap, revenue);

      const grossMargin = fundamentals?.grossMargin ? Number(fundamentals.grossMargin) : null;
      const operatingMargin = fundamentals?.operatingMargin ? Number(fundamentals.operatingMargin) : null;
      const debtToEquity = fundamentals?.debtToEquity ? Number(fundamentals.debtToEquity) : null;
      const fcfMargin = fundamentals?.freeCashFlowMargin ? Number(fundamentals.freeCashFlowMargin) : null;
      const qualityScore = this.calculateQualityScore(grossMargin, operatingMargin, debtToEquity, fcfMargin);

      const assetClass = this.determineAssetClass(symbol, marketCapTier, valueScore, isCrypto, isEtf);

      return {
        symbol,
        assetClass,
        marketCapTier,
        liquidityTier,
        volatilityTier,
        trendStrength,
        momentumScore,
        valueScore,
        qualityScore,
      };
    } catch (error: any) {
      log.error("AssetClassifier", "Error classifying symbol", { symbol, error: error.message });
      return null;
    }
  }

  async classifyAndStore(symbol: string): Promise<boolean> {
    const result = await this.classifySymbol(symbol);
    if (!result) return false;

    const record: InsertAssetClassification = {
      symbol: result.symbol,
      assetClass: result.assetClass,
      marketCapTier: result.marketCapTier,
      liquidityTier: result.liquidityTier,
      volatilityTier: result.volatilityTier,
      trendStrength: result.trendStrength,
      momentumScore: result.momentumScore.toString(),
      valueScore: result.valueScore.toString(),
      qualityScore: result.qualityScore.toString(),
      source: "asset_classifier",
    };

    await db
      .insert(assetClassifications)
      .values(record)
      .onConflictDoUpdate({
        target: assetClassifications.symbol,
        set: {
          assetClass: record.assetClass,
          marketCapTier: record.marketCapTier,
          liquidityTier: record.liquidityTier,
          volatilityTier: record.volatilityTier,
          trendStrength: record.trendStrength,
          momentumScore: record.momentumScore,
          valueScore: record.valueScore,
          qualityScore: record.qualityScore,
          source: record.source,
          lastUpdatedAt: new Date(),
        },
      });

    return true;
  }

  async classifyBatch(options: {
    symbols?: string[];
    batchSize?: number;
    traceId?: string;
  } = {}): Promise<ClassifyBatchResult> {
    const startTime = Date.now();
    const { symbols, batchSize = 50, traceId } = options;
    const errors: string[] = [];

    log.info("AssetClassifier", "Starting batch classification", { traceId });

    let targetSymbols: string[];
    if (symbols && symbols.length > 0) {
      targetSymbols = symbols;
    } else {
      const assets = await db
        .select({ symbol: universeAssets.symbol })
        .from(universeAssets)
        .where(and(eq(universeAssets.tradable, true), eq(universeAssets.excluded, false)));
      targetSymbols = assets.map((a) => a.symbol);
    }

    let classified = 0;

    for (let i = 0; i < targetSymbols.length; i += batchSize) {
      const batch = targetSymbols.slice(i, i + batchSize);

      const results = await Promise.allSettled(
        batch.map((symbol) => this.classifyAndStore(symbol))
      );

      for (let j = 0; j < results.length; j++) {
        const result = results[j];
        if (result.status === "fulfilled" && result.value) {
          classified++;
        } else if (result.status === "rejected") {
          errors.push(`${batch[j]}: ${result.reason}`);
        }
      }
    }

    const duration = Date.now() - startTime;
    log.info("AssetClassifier", "Batch classification completed", { classified, total: targetSymbols.length, durationMs: duration });

    return {
      success: errors.length === 0,
      classified,
      errors,
      duration,
      traceId,
    };
  }

  async getClassification(symbol: string): Promise<AssetClassification | null> {
    const [result] = await db
      .select()
      .from(assetClassifications)
      .where(eq(assetClassifications.symbol, symbol))
      .limit(1);
    return result || null;
  }

  async getClassificationsByClass(assetClass: AssetClassType): Promise<AssetClassification[]> {
    return db
      .select()
      .from(assetClassifications)
      .where(eq(assetClassifications.assetClass, assetClass));
  }

  async getClassificationsByTier(
    marketCapTier?: MarketCapTier,
    liquidityTier?: LiquidityTier,
    volatilityTier?: VolatilityTier
  ): Promise<AssetClassification[]> {
    const conditions = [];
    if (marketCapTier) conditions.push(eq(assetClassifications.marketCapTier, marketCapTier));
    if (liquidityTier) conditions.push(eq(assetClassifications.liquidityTier, liquidityTier));
    if (volatilityTier) conditions.push(eq(assetClassifications.volatilityTier, volatilityTier));

    if (conditions.length === 0) {
      return db.select().from(assetClassifications);
    }

    return db
      .select()
      .from(assetClassifications)
      .where(and(...conditions));
  }
}

export const assetClassifier = new AssetClassifier();
