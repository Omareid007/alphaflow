import { db } from "../db";
import { universeAssets, universeLiquidityMetrics, type InsertUniverseAsset, type UniverseAsset } from "@shared/schema";
import { alpaca, type AlpacaAsset } from "../connectors/alpaca";
import { eq, sql, and, desc } from "drizzle-orm";
import { log } from "../utils/logger";

export interface UniverseRefreshOptions {
  status?: "active" | "inactive";
  assetClass?: "us_equity" | "crypto";
  includeOtc?: boolean;
  includeSpac?: boolean;
  includePennyStocks?: boolean;
  traceId?: string;
}

export interface UniverseStats {
  totalAssets: number;
  activeTradable: number;
  excluded: number;
  byExchange: Record<string, number>;
  byAssetClass: Record<string, number>;
  otcCount: number;
  spacCount: number;
  pennyStockCount: number;
  lastRefreshedAt: Date | null;
}

export interface UniverseRefreshResult {
  success: boolean;
  added: number;
  updated: number;
  removed: number;
  excluded: number;
  duration: number;
  traceId?: string;
}

const OTC_EXCHANGES = ["OTC", "OTCBB", "OTCQB", "OTCQX", "PINK"];
const PENNY_STOCK_THRESHOLD = 5;

function isOtcExchange(exchange: string): boolean {
  return OTC_EXCHANGES.includes(exchange.toUpperCase());
}

function isSpacName(name: string): boolean {
  const spacPatterns = [
    /acquisition corp/i,
    /SPAC/i,
    /blank check/i,
    /special purpose/i,
  ];
  return spacPatterns.some((pattern) => pattern.test(name));
}

export class AlpacaUniverseService {
  async refreshAssets(options: UniverseRefreshOptions = {}): Promise<UniverseRefreshResult> {
    const startTime = Date.now();
    const {
      status = "active",
      assetClass = "us_equity",
      includeOtc = false,
      includeSpac = false,
      includePennyStocks = false,
      traceId,
    } = options;

    log.info("AlpacaUniverse", "Starting asset refresh", { assetClass, status, traceId });

    let alpacaAssets: AlpacaAsset[];
    try {
      alpacaAssets = await alpaca.getAssets(status, assetClass);
    } catch (error) {
      log.error("AlpacaUniverse", "Failed to fetch Alpaca assets", { error: error instanceof Error ? error.message : String(error) });
      throw new Error(`Failed to fetch Alpaca assets: ${error}`);
    }

    log.info("AlpacaUniverse", "Fetched assets from Alpaca", { count: alpacaAssets.length });

    let added = 0;
    let updated = 0;
    let excluded = 0;

    const existingSymbols = new Set(
      (await db.select({ symbol: universeAssets.symbol }).from(universeAssets)).map((a) => a.symbol)
    );

    for (const asset of alpacaAssets) {
      const isOtc = isOtcExchange(asset.exchange);
      const isSpac = isSpacName(asset.name);

      let shouldExclude = false;
      let excludeReason: string | null = null;

      if (isOtc && !includeOtc) {
        shouldExclude = true;
        excludeReason = "OTC excluded by policy";
      } else if (isSpac && !includeSpac) {
        shouldExclude = true;
        excludeReason = "SPAC excluded by policy";
      }

      const assetData: InsertUniverseAsset = {
        symbol: asset.symbol,
        name: asset.name,
        exchange: asset.exchange,
        assetClass: asset.class,
        status: asset.status,
        tradable: asset.tradable,
        marginable: asset.marginable,
        shortable: asset.shortable,
        fractionable: asset.fractionable,
        easyToBorrow: asset.easy_to_borrow,
        isOtc,
        isSpac,
        isPennyStock: false,
        excluded: shouldExclude,
        excludeReason,
        rawJson: asset as unknown as Record<string, unknown>,
      };

      try {
        if (existingSymbols.has(asset.symbol)) {
          await db
            .update(universeAssets)
            .set({
              ...assetData,
              lastRefreshedAt: new Date(),
            })
            .where(eq(universeAssets.symbol, asset.symbol));
          updated++;
        } else {
          await db.insert(universeAssets).values(assetData);
          added++;
        }

        if (shouldExclude) {
          excluded++;
        }
      } catch (error) {
        log.error("AlpacaUniverse", "Failed to upsert asset", { symbol: asset.symbol, error: error instanceof Error ? error.message : String(error) });
      }
    }

    const fetchedSymbols = new Set(alpacaAssets.map((a) => a.symbol));
    const symbolsToRemove = [...existingSymbols].filter((s) => !fetchedSymbols.has(s));
    
    for (const symbol of symbolsToRemove) {
      await db
        .update(universeAssets)
        .set({ 
          tradable: false, 
          status: "delisted",
          excluded: true,
          excludeReason: "No longer in Alpaca assets",
          lastRefreshedAt: new Date(),
        })
        .where(eq(universeAssets.symbol, symbol));
      
      await db
        .delete(universeLiquidityMetrics)
        .where(eq(universeLiquidityMetrics.symbol, symbol));
    }
    
    log.info("AlpacaUniverse", "Cleaned up delisted symbols from liquidity metrics", { count: symbolsToRemove.length });

    const duration = Date.now() - startTime;
    log.info("AlpacaUniverse", "Refresh complete", { added, updated, removed: symbolsToRemove.length, excluded, duration });

    return {
      success: true,
      added,
      updated,
      removed: symbolsToRemove.length,
      excluded,
      duration,
      traceId,
    };
  }

  async getStats(): Promise<UniverseStats> {
    const allAssets = await db.select().from(universeAssets);
    
    const byExchange: Record<string, number> = {};
    const byAssetClass: Record<string, number> = {};
    let activeTradable = 0;
    let excluded = 0;
    let otcCount = 0;
    let spacCount = 0;
    let pennyStockCount = 0;
    let lastRefreshedAt: Date | null = null;

    for (const asset of allAssets) {
      byExchange[asset.exchange] = (byExchange[asset.exchange] || 0) + 1;
      byAssetClass[asset.assetClass] = (byAssetClass[asset.assetClass] || 0) + 1;

      if (asset.tradable && !asset.excluded) {
        activeTradable++;
      }
      if (asset.excluded) {
        excluded++;
      }
      if (asset.isOtc) {
        otcCount++;
      }
      if (asset.isSpac) {
        spacCount++;
      }
      if (asset.isPennyStock) {
        pennyStockCount++;
      }
      if (!lastRefreshedAt || asset.lastRefreshedAt > lastRefreshedAt) {
        lastRefreshedAt = asset.lastRefreshedAt;
      }
    }

    return {
      totalAssets: allAssets.length,
      activeTradable,
      excluded,
      byExchange,
      byAssetClass,
      otcCount,
      spacCount,
      pennyStockCount,
      lastRefreshedAt,
    };
  }

  async getAssets(options: {
    tradableOnly?: boolean;
    excludeOtc?: boolean;
    excludeSpac?: boolean;
    excludePennyStocks?: boolean;
    exchange?: string;
    limit?: number;
    offset?: number;
  } = {}): Promise<UniverseAsset[]> {
    const {
      tradableOnly = true,
      excludeOtc = true,
      excludeSpac = true,
      excludePennyStocks = true,
      exchange,
      limit = 1000,
      offset = 0,
    } = options;

    let query = db.select().from(universeAssets);
    const conditions: ReturnType<typeof eq>[] = [];

    if (tradableOnly) {
      conditions.push(eq(universeAssets.tradable, true));
      conditions.push(eq(universeAssets.excluded, false));
    }
    if (excludeOtc) {
      conditions.push(eq(universeAssets.isOtc, false));
    }
    if (excludeSpac) {
      conditions.push(eq(universeAssets.isSpac, false));
    }
    if (excludePennyStocks) {
      conditions.push(eq(universeAssets.isPennyStock, false));
    }
    if (exchange) {
      conditions.push(eq(universeAssets.exchange, exchange));
    }

    if (conditions.length > 0) {
      query = query.where(and(...conditions)) as typeof query;
    }

    return query.limit(limit).offset(offset);
  }

  async getAssetBySymbol(symbol: string): Promise<UniverseAsset | null> {
    const result = await db
      .select()
      .from(universeAssets)
      .where(eq(universeAssets.symbol, symbol.toUpperCase()))
      .limit(1);
    return result[0] || null;
  }

  async setExcluded(symbol: string, excluded: boolean, reason?: string): Promise<boolean> {
    const result = await db
      .update(universeAssets)
      .set({
        excluded,
        excludeReason: reason || null,
        lastRefreshedAt: new Date(),
      })
      .where(eq(universeAssets.symbol, symbol.toUpperCase()));
    return true;
  }

  async markPennyStock(symbol: string, isPennyStock: boolean): Promise<boolean> {
    await db
      .update(universeAssets)
      .set({
        isPennyStock,
        excluded: isPennyStock,
        excludeReason: isPennyStock ? "Penny stock (price < $5)" : null,
        lastRefreshedAt: new Date(),
      })
      .where(eq(universeAssets.symbol, symbol.toUpperCase()));
    return true;
  }

  async updatePennyStockFlags(prices: Record<string, number>): Promise<number> {
    let updated = 0;
    for (const [symbol, price] of Object.entries(prices)) {
      const isPenny = price < PENNY_STOCK_THRESHOLD;
      await this.markPennyStock(symbol, isPenny);
      if (isPenny) updated++;
    }
    return updated;
  }

  async getTradableSymbols(): Promise<string[]> {
    const assets = await this.getAssets({ tradableOnly: true });
    return assets.map((a) => a.symbol);
  }

  async isSymbolTradable(symbol: string): Promise<boolean> {
    const asset = await this.getAssetBySymbol(symbol);
    if (!asset) return false;
    return asset.tradable && !asset.excluded;
  }
}

export const alpacaUniverseService = new AlpacaUniverseService();
