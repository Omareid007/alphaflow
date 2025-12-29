import { storage } from "../storage";
import { alpaca, AlpacaAsset } from "../connectors/alpaca";
import { log } from "../utils/logger";
import type {
  TradabilityCheck,
  BrokerAsset,
  InsertBrokerAsset,
  AssetClass,
} from "@shared/schema";

const SYNC_STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  check: TradabilityCheck;
  cachedAt: number;
}

const memoryCache = new Map<string, CacheEntry>();

function mapAlpacaAssetToInsert(asset: AlpacaAsset): InsertBrokerAsset {
  return {
    alpacaId: asset.id,
    symbol: asset.symbol.toUpperCase(),
    name: asset.name,
    assetClass: asset.class === "crypto" ? "crypto" : "us_equity",
    exchange: asset.exchange,
    status: asset.status,
    tradable: asset.tradable,
    marginable: asset.marginable,
    shortable: asset.shortable,
    easyToBorrow: asset.easy_to_borrow,
    fractionable: asset.fractionable,
    lastSyncedAt: new Date(),
  };
}

function brokerAssetToTradabilityCheck(asset: BrokerAsset): TradabilityCheck {
  return {
    symbol: asset.symbol,
    tradable: asset.tradable,
    assetClass: asset.assetClass as AssetClass,
    exchange: asset.exchange,
    fractionable: asset.fractionable,
    marginable: asset.marginable,
    shortable: asset.shortable,
    lastSyncedAt: asset.lastSyncedAt,
    reason: asset.tradable ? undefined : `Asset status: ${asset.status}`,
  };
}

export class TradabilityService {
  async validateSymbolTradable(symbol: string): Promise<TradabilityCheck> {
    const normalizedSymbol = symbol.toUpperCase();

    const cached = memoryCache.get(normalizedSymbol);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      return cached.check;
    }

    const dbAsset = await storage.getBrokerAsset(normalizedSymbol);

    if (dbAsset) {
      const check = brokerAssetToTradabilityCheck(dbAsset);
      memoryCache.set(normalizedSymbol, { check, cachedAt: Date.now() });
      return check;
    }

    try {
      const alpacaAsset = await alpaca.getAsset(normalizedSymbol);

      if (alpacaAsset) {
        const insertAsset = mapAlpacaAssetToInsert(alpacaAsset);
        const savedAsset = await storage.upsertBrokerAsset(insertAsset);
        const check = brokerAssetToTradabilityCheck(savedAsset);
        memoryCache.set(normalizedSymbol, { check, cachedAt: Date.now() });
        return check;
      }
    } catch (error: any) {
      log.warn(
        "tradability",
        `Failed to fetch asset ${normalizedSymbol} from Alpaca`,
        { error: error.message }
      );
    }

    const notFoundCheck: TradabilityCheck = {
      symbol: normalizedSymbol,
      tradable: false,
      reason: "Symbol not found in broker asset universe",
    };
    memoryCache.set(normalizedSymbol, {
      check: notFoundCheck,
      cachedAt: Date.now(),
    });
    return notFoundCheck;
  }

  async validateSymbolsTradable(
    symbols: string[]
  ): Promise<Map<string, TradabilityCheck>> {
    const results = new Map<string, TradabilityCheck>();

    for (const symbol of symbols) {
      const check = await this.validateSymbolTradable(symbol);
      results.set(symbol.toUpperCase(), check);
    }

    return results;
  }

  async syncAssetUniverse(
    assetClass: "us_equity" | "crypto" = "us_equity"
  ): Promise<{
    synced: number;
    tradable: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let synced = 0;
    let tradable = 0;

    try {
      log.info("tradability", `Starting universe sync for ${assetClass}`);

      const assets = await alpaca.getAssets("active", assetClass);
      log.info(
        "tradability",
        `Fetched ${assets.length} ${assetClass} assets from Alpaca`
      );

      const insertAssets = assets.map(mapAlpacaAssetToInsert);
      synced = await storage.bulkUpsertBrokerAssets(insertAssets);
      tradable = assets.filter((a: AlpacaAsset) => a.tradable).length;

      log.info(
        "tradability",
        `Universe sync complete: ${synced} synced, ${tradable} tradable`
      );
    } catch (error: any) {
      errors.push(`Sync failed for ${assetClass}: ${error.message}`);
      log.error("tradability", `Universe sync error: ${error.message}`);
    }

    return { synced, tradable, errors };
  }

  async getUniverseStats(): Promise<{
    totalAssets: number;
    tradableEquities: number;
    tradableCrypto: number;
    lastSyncedAt: Date | null;
    isStale: boolean;
  }> {
    const equityCount = await storage.getBrokerAssetCount("us_equity");
    const cryptoCount = await storage.getBrokerAssetCount("crypto");
    const lastSyncedAt = await storage.getLastAssetSyncTime();

    const tradableEquities = (await storage.getBrokerAssets("us_equity", true))
      .length;
    const tradableCrypto = (await storage.getBrokerAssets("crypto", true))
      .length;

    const isStale =
      !lastSyncedAt ||
      Date.now() - lastSyncedAt.getTime() > SYNC_STALE_THRESHOLD_MS;

    return {
      totalAssets: equityCount + cryptoCount,
      tradableEquities,
      tradableCrypto,
      lastSyncedAt,
      isStale,
    };
  }

  async searchSymbols(
    query: string,
    limit: number = 20
  ): Promise<BrokerAsset[]> {
    return storage.searchBrokerAssets(query, limit);
  }

  clearMemoryCache(): void {
    memoryCache.clear();
    log.info("tradability", "Memory cache cleared");
  }
}

export const tradabilityService = new TradabilityService();
