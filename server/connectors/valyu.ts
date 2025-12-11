/**
 * Valyu.ai Connector - AI-native financial data API
 * 
 * Natural language queries for structured financial data:
 * - Earnings data (quarterly & annual EPS, revenue, net income)
 * - Financial ratios (P/E, ROE, debt/equity, revenue growth)
 * - Balance sheets, income statements, cash flow statements
 * - SEC filings (10-K, 10-Q, 8-K in markdown)
 * - Insider trading data
 * 
 * Pricing: $1.50 per 1,000 queries
 * 
 * @see docs/CONNECTORS_AND_INTEGRATIONS.md
 */

import { ApiCache } from "../lib/api-cache";
import { log } from "../utils/logger";

const VALYU_BASE_URL = "https://api.valyu.network/v1";

export interface ValyuSearchResult {
  url: string;
  title: string;
  content: string;
  relevance_score: number;
  data_type: "structured" | "unstructured";
  citation?: string;
}

export interface ValyuResponse {
  success: boolean;
  results: ValyuSearchResult[];
  total_deduction_dollars?: number;
  query: string;
  source_filter?: string[];
}

export interface EarningsData {
  symbol: string;
  quarter?: string;
  year?: number;
  eps?: number;
  revenue?: number;
  netIncome?: number;
  surprise?: number;
  rawData: string;
}

export interface FinancialRatios {
  symbol: string;
  peRatio?: number;
  roe?: number;
  debtToEquity?: number;
  revenueGrowth?: number;
  currentRatio?: number;
  rawData: string;
}

export interface SECFiling {
  symbol: string;
  filingType: string;
  filedDate?: string;
  content: string;
  url?: string;
}

class ValyuConnector {
  private searchCache = new ApiCache<ValyuResponse>({
    freshDuration: 15 * 60 * 1000,
    staleDuration: 60 * 60 * 1000,
  });
  private earningsCache = new ApiCache<EarningsData>({
    freshDuration: 60 * 60 * 1000,
    staleDuration: 24 * 60 * 60 * 1000,
  });
  private ratiosCache = new ApiCache<FinancialRatios>({
    freshDuration: 60 * 60 * 1000,
    staleDuration: 24 * 60 * 60 * 1000,
  });
  private filingsCache = new ApiCache<SECFiling>({
    freshDuration: 60 * 60 * 1000,
    staleDuration: 24 * 60 * 60 * 1000,
  });

  private lastRequestTime = 0;
  private minRequestInterval = 100;

  private getApiKey(): string | undefined {
    return process.env.VALYU_API_KEY;
  }

  isAvailable(): boolean {
    return !!this.getApiKey();
  }

  private async throttle(): Promise<void> {
    const timeSinceLastRequest = Date.now() - this.lastRequestTime;
    if (timeSinceLastRequest < this.minRequestInterval) {
      await new Promise((resolve) =>
        setTimeout(resolve, this.minRequestInterval - timeSinceLastRequest)
      );
    }
    this.lastRequestTime = Date.now();
  }

  private async search(
    query: string,
    options: {
      sources?: string[];
      maxResults?: number;
      maxPrice?: number;
    } = {}
  ): Promise<ValyuResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("VALYU_API_KEY is not configured");
    }

    const cacheKey = `search_${query}_${JSON.stringify(options)}`;
    const cached = this.searchCache.get(cacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    await this.throttle();

    const body: Record<string, unknown> = {
      query,
      max_num_results: options.maxResults ?? 10,
      max_price: options.maxPrice ?? 10,
    };

    if (options.sources && options.sources.length > 0) {
      body.included_sources = options.sources;
    }

    try {
      const response = await fetch(`${VALYU_BASE_URL}/deepsearch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        log.error("Valyu", "API request failed", {
          statusCode: response.status,
          error: errorText,
        });

        const stale = this.searchCache.getStale(cacheKey);
        if (stale) {
          log.warn("Valyu", `Serving stale data for query: ${query}`);
          return stale;
        }

        throw new Error(`Valyu API error: ${response.status} - ${errorText}`);
      }

      const data = (await response.json()) as ValyuResponse;
      this.searchCache.set(cacheKey, data);

      log.info("Valyu", "Search completed", {
        query: query.substring(0, 50),
        resultsCount: data.results.length,
        cost: data.total_deduction_dollars,
      });

      return data;
    } catch (error) {
      const stale = this.searchCache.getStale(cacheKey);
      if (stale) {
        log.warn("Valyu", `Error fetching, serving stale data for: ${query}`);
        return stale;
      }
      throw error;
    }
  }

  async getEarnings(symbol: string): Promise<EarningsData> {
    const cacheKey = `earnings_${symbol}`;
    const cached = this.earningsCache.get(cacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    const response = await this.search(
      `${symbol} latest quarterly earnings report EPS revenue net income`,
      {
        sources: ["valyu/valyu-earnings-US"],
        maxResults: 5,
      }
    );

    const content = response.results.map(r => r.content).join("\n");
    
    const data: EarningsData = {
      symbol,
      rawData: content,
    };

    const epsMatch = content.match(/EPS[:\s]*\$?([\d.]+)/i);
    if (epsMatch) data.eps = parseFloat(epsMatch[1]);

    const revenueMatch = content.match(/revenue[:\s]*\$?([\d.]+)\s*(billion|million)?/i);
    if (revenueMatch) {
      let revenue = parseFloat(revenueMatch[1]);
      if (revenueMatch[2]?.toLowerCase() === "billion") revenue *= 1e9;
      if (revenueMatch[2]?.toLowerCase() === "million") revenue *= 1e6;
      data.revenue = revenue;
    }

    this.earningsCache.set(cacheKey, data);
    return data;
  }

  async getFinancialRatios(symbol: string): Promise<FinancialRatios> {
    const cacheKey = `ratios_${symbol}`;
    const cached = this.ratiosCache.get(cacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    const response = await this.search(
      `${symbol} P/E ratio ROE debt to equity revenue growth financial ratios`,
      {
        sources: ["valyu/valyu-financial-ratios-US"],
        maxResults: 5,
      }
    );

    const content = response.results.map(r => r.content).join("\n");
    
    const data: FinancialRatios = {
      symbol,
      rawData: content,
    };

    const peMatch = content.match(/P\/E[:\s]*([\d.]+)/i);
    if (peMatch) data.peRatio = parseFloat(peMatch[1]);

    const roeMatch = content.match(/ROE[:\s]*([\d.]+)%?/i);
    if (roeMatch) data.roe = parseFloat(roeMatch[1]);

    const debtMatch = content.match(/debt.?to.?equity[:\s]*([\d.]+)/i);
    if (debtMatch) data.debtToEquity = parseFloat(debtMatch[1]);

    this.ratiosCache.set(cacheKey, data);
    return data;
  }

  async getSECFiling(
    symbol: string,
    filingType: "10-K" | "10-Q" | "8-K" = "10-K"
  ): Promise<SECFiling> {
    const cacheKey = `filing_${symbol}_${filingType}`;
    const cached = this.filingsCache.get(cacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    const response = await this.search(
      `${symbol} ${filingType} SEC filing annual report`,
      {
        sources: ["valyu/valyu-sec-filings-US"],
        maxResults: 3,
      }
    );

    const result = response.results[0];
    const data: SECFiling = {
      symbol,
      filingType,
      content: result?.content || "",
      url: result?.url,
    };

    this.filingsCache.set(cacheKey, data);
    return data;
  }

  async getCompanyFinancials(symbol: string): Promise<{
    earnings: EarningsData;
    ratios: FinancialRatios;
  }> {
    const [earnings, ratios] = await Promise.all([
      this.getEarnings(symbol),
      this.getFinancialRatios(symbol),
    ]);

    return { earnings, ratios };
  }

  async searchFinancialData(query: string): Promise<ValyuResponse> {
    return this.search(query, {
      sources: [
        "valyu/valyu-earnings-US",
        "valyu/valyu-financial-ratios-US",
        "valyu/valyu-balance-sheet-US",
        "valyu/valyu-income-statement-US",
        "valyu/valyu-cash-flow-US",
      ],
      maxResults: 15,
    });
  }

  getConnectionStatus(): { connected: boolean; hasApiKey: boolean; cacheSize: number } {
    return {
      connected: this.isAvailable(),
      hasApiKey: this.isAvailable(),
      cacheSize:
        this.searchCache.size() +
        this.earningsCache.size() +
        this.ratiosCache.size() +
        this.filingsCache.size(),
    };
  }

  clearCache(): void {
    this.searchCache.clear();
    this.earningsCache.clear();
    this.ratiosCache.clear();
    this.filingsCache.clear();
  }
}

export const valyu = new ValyuConnector();
