import { callExternal, type CallExternalResult } from "../../lib/callExternal";
import { alpaca, type AlpacaBar, type AlpacaBarsResponse } from "../../connectors/alpaca";
import { log } from "../../utils/logger";
import type { DataProvenance } from "../../shared/types/backtesting";

export interface HistoricalBar {
  ts: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  vwap: number;
  symbol: string;
}

export interface FetchBarsResult {
  bars: Record<string, HistoricalBar[]>;
  provenance: DataProvenance;
}

function transformAlpacaBar(bar: AlpacaBar, symbol: string): HistoricalBar {
  return {
    ts: bar.t,
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
    volume: bar.v,
    vwap: bar.vw,
    symbol,
  };
}

async function fetchBarsPage(
  symbol: string,
  timeframe: string,
  startDate: string,
  endDate: string,
  limit: number,
  cacheKeySuffix: string,
  pageToken?: string
): Promise<CallExternalResult<AlpacaBarsResponse>> {
  const cacheKeyStr = `bars:${symbol}:${timeframe}:${startDate}:${endDate}:${cacheKeySuffix}`;
  const endpoint = `bars/${symbol}/${timeframe}/${startDate}/${endDate}`;

  return callExternal<AlpacaBarsResponse>(
    () => alpaca.getBars([symbol], timeframe, startDate, endDate, limit, pageToken),
    {
      provider: "alpaca",
      endpoint,
      cacheKey: cacheKeyStr,
      budgetPolicy: {
        countAsMultiple: 1,
      },
    }
  );
}

export async function fetchHistoricalBars(options: {
  symbols: string[];
  timeframe: string;
  startDate: string;
  endDate: string;
  maxBarsPerSymbol?: number;
}): Promise<FetchBarsResult> {
  const { symbols, timeframe, startDate, endDate, maxBarsPerSymbol = 5000 } = options;
  const BATCH_LIMIT = 5000;

  log.info("HistoricalData", `Fetching bars for ${symbols.length} symbols from ${startDate} to ${endDate}`);

  const allBars: Record<string, HistoricalBar[]> = {};
  const barsCountBySymbol: Record<string, number> = {};
  let totalCacheHits = 0;
  let totalRequests = 0;
  let nextPageTokensUsed = 0;

  for (const symbol of symbols) {
    allBars[symbol] = [];
    let currentPageToken: string | null = null;
    let totalBarsForSymbol = 0;
    let hasMorePages = true;

    while (hasMorePages) {
      const tokenSuffix: string = currentPageToken || "first";

      try {
        const fetchResult: CallExternalResult<AlpacaBarsResponse> = await fetchBarsPage(
          symbol,
          timeframe,
          startDate,
          endDate,
          BATCH_LIMIT,
          tokenSuffix,
          currentPageToken ?? undefined
        );

        totalRequests++;

        if (fetchResult.provenance.cacheStatus === "fresh") {
          totalCacheHits++;
        }

        const symbolBars: AlpacaBar[] = fetchResult.data.bars?.[symbol] || [];
        const transformedBars: HistoricalBar[] = symbolBars.map(bar => transformAlpacaBar(bar, symbol));
        allBars[symbol].push(...transformedBars);
        totalBarsForSymbol += transformedBars.length;

        const nextToken: string | null = fetchResult.data.next_page_token ?? null;
        if (nextToken) {
          currentPageToken = nextToken;
          nextPageTokensUsed++;
        } else {
          hasMorePages = false;
        }

        if (totalBarsForSymbol >= maxBarsPerSymbol) {
          log.debug("HistoricalData", `Reached max bars limit for ${symbol}: ${totalBarsForSymbol}`);
          hasMorePages = false;
        }
      } catch (error) {
        log.error("HistoricalData", `Failed to fetch bars for ${symbol}: ${error}`);
        hasMorePages = false;
      }
    }

    barsCountBySymbol[symbol] = allBars[symbol].length;
    log.debug("HistoricalData", `Fetched ${allBars[symbol].length} bars for ${symbol}`);
  }

  for (const symbol of symbols) {
    allBars[symbol].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  }

  const cacheHitRate = totalRequests > 0 ? totalCacheHits / totalRequests : 0;

  const provenance: DataProvenance = {
    provider: "alpaca",
    cacheHitRate,
    dataPulledAt: new Date().toISOString(),
    barsCountBySymbol,
    timeframe,
    dateRange: { start: startDate, end: endDate },
    nextPageTokensUsed,
  };

  log.info("HistoricalData", `Completed fetching bars. Cache hit rate: ${(cacheHitRate * 100).toFixed(1)}%`);

  return { bars: allBars, provenance };
}

export async function fetchBarsForSingleSymbol(
  symbol: string,
  timeframe: string,
  startDate: string,
  endDate: string,
  maxBars: number = 5000
): Promise<{ bars: HistoricalBar[]; cacheHit: boolean }> {
  const result = await fetchHistoricalBars({
    symbols: [symbol],
    timeframe,
    startDate,
    endDate,
    maxBarsPerSymbol: maxBars,
  });

  return {
    bars: result.bars[symbol] || [],
    cacheHit: result.provenance.cacheHitRate > 0.5,
  };
}
