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
 * Pricing: Per retrieval (result count), not per request
 *
 * @see docs/CONNECTORS_AND_INTEGRATIONS.md
 * @see docs/API_BUDGETING_AND_CACHING.md#valyu-retrieval-based-budgeting
 */

import { ApiCache } from "../lib/api-cache";
import { log } from "../utils/logger";
import { callExternal } from "../lib/callExternal";
import { buildCacheKey } from "../lib/connectorClient";
import { recordUsage } from "../lib/apiBudget";

const VALYU_BASE_URL = "https://api.valyu.ai/v1";

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

export interface BalanceSheetData {
  symbol: string;
  totalAssets?: number;
  totalLiabilities?: number;
  totalEquity?: number;
  cashAndEquivalents?: number;
  totalDebt?: number;
  rawData: string;
}

export interface IncomeStatementData {
  symbol: string;
  revenue?: number;
  costOfRevenue?: number;
  grossProfit?: number;
  operatingIncome?: number;
  netIncome?: number;
  rawData: string;
}

export interface CashFlowData {
  symbol: string;
  operatingCashFlow?: number;
  investingCashFlow?: number;
  financingCashFlow?: number;
  freeCashFlow?: number;
  rawData: string;
}

export interface DividendData {
  symbol: string;
  dividendAmount?: number;
  dividendYield?: number;
  exDividendDate?: string;
  paymentDate?: string;
  frequency?: string;
  rawData: string;
}

export interface InsiderTransactionData {
  symbol: string;
  transactions: Array<{
    insiderName?: string;
    title?: string;
    transactionType: "buy" | "sell" | "unknown";
    shares?: number;
    price?: number;
    date?: string;
  }>;
  netInsiderSentiment: "bullish" | "bearish" | "neutral";
  totalBuyValue?: number;
  totalSellValue?: number;
  rawData: string;
}

export interface MarketMoversData {
  gainers: Array<{ symbol: string; change: number; volume?: number }>;
  losers: Array<{ symbol: string; change: number; volume?: number }>;
  mostActive: Array<{ symbol: string; volume: number }>;
  rawData: string;
}

const DEFAULT_MAX_RESULTS = 5;
const DEFAULT_RELEVANCE_THRESHOLD = 0.7;

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
  private balanceSheetCache = new ApiCache<BalanceSheetData>({
    freshDuration: 60 * 60 * 1000,
    staleDuration: 24 * 60 * 60 * 1000,
  });
  private incomeStatementCache = new ApiCache<IncomeStatementData>({
    freshDuration: 60 * 60 * 1000,
    staleDuration: 24 * 60 * 60 * 1000,
  });
  private cashFlowCache = new ApiCache<CashFlowData>({
    freshDuration: 60 * 60 * 1000,
    staleDuration: 24 * 60 * 60 * 1000,
  });
  private dividendCache = new ApiCache<DividendData>({
    freshDuration: 4 * 60 * 60 * 1000,
    staleDuration: 24 * 60 * 60 * 1000,
  });
  private insiderCache = new ApiCache<InsiderTransactionData>({
    freshDuration: 30 * 60 * 1000,
    staleDuration: 4 * 60 * 60 * 1000,
  });
  private marketMoversCache = new ApiCache<MarketMoversData>({
    freshDuration: 5 * 60 * 1000,
    staleDuration: 15 * 60 * 1000,
  });

  private getApiKey(): string | undefined {
    return process.env.VALYU_API_KEY;
  }

  isAvailable(): boolean {
    return !!this.getApiKey();
  }

  private async search(
    query: string,
    options: {
      sources?: string[];
      maxResults?: number;
      maxPrice?: number;
      relevanceThreshold?: number;
    } = {}
  ): Promise<ValyuResponse> {
    const apiKey = this.getApiKey();
    if (!apiKey) {
      throw new Error("VALYU_API_KEY is not configured");
    }

    const maxResults = options.maxResults ?? DEFAULT_MAX_RESULTS;
    const maxPrice = options.maxPrice ?? 0.1;
    const relevanceThreshold =
      options.relevanceThreshold ?? DEFAULT_RELEVANCE_THRESHOLD;

    const cacheKey = buildCacheKey(
      "valyu",
      "search",
      query,
      maxResults.toString(),
      maxPrice.toString(),
      options.sources?.join(",") || "all"
    );

    const l1Cached = this.searchCache.get(cacheKey);
    if (l1Cached?.isFresh) {
      log.debug("Valyu", "L1 cache hit", { query: query.substring(0, 30) });
      return l1Cached.data;
    }

    const body: Record<string, unknown> = {
      query,
      max_num_results: maxResults,
      max_price: maxPrice,
      relevance_threshold: relevanceThreshold,
    };

    if (options.sources && options.sources.length > 0) {
      body.included_sources = options.sources;
    }

    const fetcher = async (): Promise<ValyuResponse> => {
      const response = await fetch(`${VALYU_BASE_URL}/deepsearch`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => "Unknown error");
        throw new Error(`Valyu API error: ${response.status} - ${errorText}`);
      }

      return response.json() as Promise<ValyuResponse>;
    };

    const result = await callExternal<ValyuResponse>(fetcher, {
      provider: "valyu",
      endpoint: "deepsearch",
      cacheKey,
      budgetPolicy: {
        countAsMultiple: 1,
      },
    });

    const retrievalCount = result.data.results?.length || 0;
    if (retrievalCount > 1 && result.provenance.cacheStatus === "miss") {
      for (let i = 1; i < retrievalCount; i++) {
        await recordUsage("valyu", { isCacheHit: false });
      }
    }

    this.searchCache.set(cacheKey, result.data);

    log.info("Valyu", "Search completed", {
      query: query.substring(0, 50),
      resultsCount: retrievalCount,
      cacheStatus: result.provenance.cacheStatus,
      cost: result.data.total_deduction_dollars,
    });

    return result.data;
  }

  async getEarnings(symbol: string): Promise<EarningsData> {
    const cacheKey = buildCacheKey("valyu", "earnings", symbol);
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

    const content = response.results.map((r) => r.content).join("\n");

    const data: EarningsData = {
      symbol,
      rawData: content,
    };

    const epsMatch = content.match(/EPS[:\s]*\$?([\d.]+)/i);
    if (epsMatch) data.eps = parseFloat(epsMatch[1]);

    const revenueMatch = content.match(
      /revenue[:\s]*\$?([\d.]+)\s*(billion|million)?/i
    );
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
    const cacheKey = buildCacheKey("valyu", "ratios", symbol);
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

    const content = response.results.map((r) => r.content).join("\n");

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
    const cacheKey = buildCacheKey("valyu", "filing", symbol, filingType);
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

  async getBalanceSheet(symbol: string): Promise<BalanceSheetData> {
    const cacheKey = buildCacheKey("valyu", "balance", symbol);
    const cached = this.balanceSheetCache.get(cacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    const response = await this.search(
      `${symbol} balance sheet total assets liabilities equity cash debt`,
      {
        sources: ["valyu/valyu-balance-sheet-US"],
        maxResults: 5,
      }
    );

    const content = response.results.map((r) => r.content).join("\n");

    const data: BalanceSheetData = {
      symbol,
      rawData: content,
    };

    const assetsMatch = content.match(
      /total\s*assets[:\s]*\$?([\d.,]+)\s*(billion|million|B|M)?/i
    );
    if (assetsMatch) {
      data.totalAssets = this.parseFinancialValue(
        assetsMatch[1],
        assetsMatch[2]
      );
    }

    const liabilitiesMatch = content.match(
      /total\s*liabilities[:\s]*\$?([\d.,]+)\s*(billion|million|B|M)?/i
    );
    if (liabilitiesMatch) {
      data.totalLiabilities = this.parseFinancialValue(
        liabilitiesMatch[1],
        liabilitiesMatch[2]
      );
    }

    const equityMatch = content.match(
      /(?:total\s*)?(?:shareholders?[']?\s*)?equity[:\s]*\$?([\d.,]+)\s*(billion|million|B|M)?/i
    );
    if (equityMatch) {
      data.totalEquity = this.parseFinancialValue(
        equityMatch[1],
        equityMatch[2]
      );
    }

    const cashMatch = content.match(
      /cash\s*(?:and\s*)?(?:equivalents)?[:\s]*\$?([\d.,]+)\s*(billion|million|B|M)?/i
    );
    if (cashMatch) {
      data.cashAndEquivalents = this.parseFinancialValue(
        cashMatch[1],
        cashMatch[2]
      );
    }

    const debtMatch = content.match(
      /total\s*debt[:\s]*\$?([\d.,]+)\s*(billion|million|B|M)?/i
    );
    if (debtMatch) {
      data.totalDebt = this.parseFinancialValue(debtMatch[1], debtMatch[2]);
    }

    this.balanceSheetCache.set(cacheKey, data);
    log.info("Valyu", "Balance sheet fetched", { symbol, hasData: !!content });
    return data;
  }

  async getIncomeStatement(symbol: string): Promise<IncomeStatementData> {
    const cacheKey = buildCacheKey("valyu", "income", symbol);
    const cached = this.incomeStatementCache.get(cacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    const response = await this.search(
      `${symbol} income statement revenue gross profit operating income net income`,
      {
        sources: ["valyu/valyu-income-statement-US"],
        maxResults: 5,
      }
    );

    const content = response.results.map((r) => r.content).join("\n");

    const data: IncomeStatementData = {
      symbol,
      rawData: content,
    };

    const revenueMatch = content.match(
      /(?:total\s*)?revenue[:\s]*\$?([\d.,]+)\s*(billion|million|B|M)?/i
    );
    if (revenueMatch) {
      data.revenue = this.parseFinancialValue(revenueMatch[1], revenueMatch[2]);
    }

    const costMatch = content.match(
      /cost\s*of\s*(?:goods\s*sold|revenue)[:\s]*\$?([\d.,]+)\s*(billion|million|B|M)?/i
    );
    if (costMatch) {
      data.costOfRevenue = this.parseFinancialValue(costMatch[1], costMatch[2]);
    }

    const grossMatch = content.match(
      /gross\s*profit[:\s]*\$?([\d.,]+)\s*(billion|million|B|M)?/i
    );
    if (grossMatch) {
      data.grossProfit = this.parseFinancialValue(grossMatch[1], grossMatch[2]);
    }

    const opIncomeMatch = content.match(
      /operating\s*income[:\s]*\$?([\d.,]+)\s*(billion|million|B|M)?/i
    );
    if (opIncomeMatch) {
      data.operatingIncome = this.parseFinancialValue(
        opIncomeMatch[1],
        opIncomeMatch[2]
      );
    }

    const netIncomeMatch = content.match(
      /net\s*income[:\s]*\$?([\d.,]+)\s*(billion|million|B|M)?/i
    );
    if (netIncomeMatch) {
      data.netIncome = this.parseFinancialValue(
        netIncomeMatch[1],
        netIncomeMatch[2]
      );
    }

    this.incomeStatementCache.set(cacheKey, data);
    log.info("Valyu", "Income statement fetched", {
      symbol,
      hasData: !!content,
    });
    return data;
  }

  async getCashFlow(symbol: string): Promise<CashFlowData> {
    const cacheKey = buildCacheKey("valyu", "cashflow", symbol);
    const cached = this.cashFlowCache.get(cacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    const response = await this.search(
      `${symbol} cash flow statement operating investing financing free cash flow`,
      {
        sources: ["valyu/valyu-cash-flow-US"],
        maxResults: 5,
      }
    );

    const content = response.results.map((r) => r.content).join("\n");

    const data: CashFlowData = {
      symbol,
      rawData: content,
    };

    const opCashMatch = content.match(
      /(?:net\s*)?(?:cash\s*from\s*)?operating\s*(?:activities|cash\s*flow)?[:\s]*\$?([-\d.,]+)\s*(billion|million|B|M)?/i
    );
    if (opCashMatch) {
      data.operatingCashFlow = this.parseFinancialValue(
        opCashMatch[1],
        opCashMatch[2]
      );
    }

    const invCashMatch = content.match(
      /(?:net\s*)?(?:cash\s*from\s*)?investing\s*(?:activities)?[:\s]*\$?([-\d.,]+)\s*(billion|million|B|M)?/i
    );
    if (invCashMatch) {
      data.investingCashFlow = this.parseFinancialValue(
        invCashMatch[1],
        invCashMatch[2]
      );
    }

    const finCashMatch = content.match(
      /(?:net\s*)?(?:cash\s*from\s*)?financing\s*(?:activities)?[:\s]*\$?([-\d.,]+)\s*(billion|million|B|M)?/i
    );
    if (finCashMatch) {
      data.financingCashFlow = this.parseFinancialValue(
        finCashMatch[1],
        finCashMatch[2]
      );
    }

    const freeCashMatch = content.match(
      /free\s*cash\s*flow[:\s]*\$?([-\d.,]+)\s*(billion|million|B|M)?/i
    );
    if (freeCashMatch) {
      data.freeCashFlow = this.parseFinancialValue(
        freeCashMatch[1],
        freeCashMatch[2]
      );
    }

    this.cashFlowCache.set(cacheKey, data);
    log.info("Valyu", "Cash flow fetched", { symbol, hasData: !!content });
    return data;
  }

  async getDividends(symbol: string): Promise<DividendData> {
    const cacheKey = buildCacheKey("valyu", "dividend", symbol);
    const cached = this.dividendCache.get(cacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    const response = await this.search(
      `${symbol} dividend yield amount ex-dividend date payment frequency`,
      {
        sources: ["valyu/valyu-dividends-US"],
        maxResults: 5,
      }
    );

    const content = response.results.map((r) => r.content).join("\n");

    const data: DividendData = {
      symbol,
      rawData: content,
    };

    const amountMatch = content.match(
      /dividend\s*(?:amount)?[:\s]*\$?([\d.,]+)/i
    );
    if (amountMatch) {
      data.dividendAmount = this.parseFinancialValue(amountMatch[1]);
    }

    const yieldMatch = content.match(/(?:dividend\s*)?yield[:\s]*([\d.,]+)%?/i);
    if (yieldMatch) {
      data.dividendYield = parseFloat(yieldMatch[1].replace(/,/g, ""));
    }

    const exDateMatch = content.match(
      /ex[- ]?dividend\s*date[:\s]*(\d{4}[-/]\d{2}[-/]\d{2}|\w+\s+\d+,?\s*\d{4})/i
    );
    if (exDateMatch) {
      data.exDividendDate = exDateMatch[1];
    }

    const payDateMatch = content.match(
      /payment\s*date[:\s]*(\d{4}[-/]\d{2}[-/]\d{2}|\w+\s+\d+,?\s*\d{4})/i
    );
    if (payDateMatch) {
      data.paymentDate = payDateMatch[1];
    }

    const freqMatch = content.match(
      /(?:dividend\s*)?(?:payment\s*)?frequency[:\s]*(quarterly|monthly|annual|semi-?annual)/i
    );
    if (freqMatch) {
      data.frequency = freqMatch[1].toLowerCase();
    }

    this.dividendCache.set(cacheKey, data);
    log.info("Valyu", "Dividend data fetched", {
      symbol,
      yield: data.dividendYield,
    });
    return data;
  }

  async getInsiderTransactions(
    symbol: string
  ): Promise<InsiderTransactionData> {
    const cacheKey = buildCacheKey("valyu", "insider", symbol);
    const cached = this.insiderCache.get(cacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    const response = await this.search(
      `${symbol} insider trading transactions buy sell shares officers directors SEC Form 4`,
      {
        sources: ["valyu/valyu-insider-US"],
        maxResults: 10,
      }
    );

    const content = response.results.map((r) => r.content).join("\n");

    const data: InsiderTransactionData = {
      symbol,
      transactions: [],
      netInsiderSentiment: "neutral",
      rawData: content,
    };

    let totalBuyValue = 0;
    let totalSellValue = 0;

    const transactionPatterns = [
      /(\w+[\w\s,]+?)\s*(?:,\s*)?(CEO|CFO|COO|CTO|Director|Officer|President|VP|Chairman)?\s*(?:bought|purchased|acquired)\s*([\d,]+)\s*shares?\s*(?:at|@)\s*\$?([\d.]+)/gi,
      /(\w+[\w\s,]+?)\s*(?:,\s*)?(CEO|CFO|COO|CTO|Director|Officer|President|VP|Chairman)?\s*(?:sold|disposed)\s*([\d,]+)\s*shares?\s*(?:at|@)\s*\$?([\d.]+)/gi,
    ];

    for (const pattern of transactionPatterns) {
      const isBuy = pattern.source.includes("bought|purchased|acquired");
      let match;
      while ((match = pattern.exec(content)) !== null) {
        const shares = parseInt(match[3].replace(/,/g, ""), 10);
        const price = parseFloat(match[4]);
        const value = shares * price;

        if (isBuy) {
          totalBuyValue += value;
        } else {
          totalSellValue += value;
        }

        data.transactions.push({
          insiderName: match[1].trim(),
          title: match[2] || undefined,
          transactionType: isBuy ? "buy" : "sell",
          shares,
          price,
        });
      }
    }

    data.totalBuyValue = totalBuyValue;
    data.totalSellValue = totalSellValue;

    if (totalBuyValue > totalSellValue * 1.5) {
      data.netInsiderSentiment = "bullish";
    } else if (totalSellValue > totalBuyValue * 1.5) {
      data.netInsiderSentiment = "bearish";
    }

    this.insiderCache.set(cacheKey, data);
    log.info("Valyu", "Insider transactions fetched", {
      symbol,
      transactionCount: data.transactions.length,
      sentiment: data.netInsiderSentiment,
    });
    return data;
  }

  async getMarketMovers(): Promise<MarketMoversData> {
    const cacheKey = buildCacheKey("valyu", "market_movers");
    const cached = this.marketMoversCache.get(cacheKey);
    if (cached?.isFresh) {
      return cached.data;
    }

    const response = await this.search(
      "today top stock gainers losers most active volume market movers",
      {
        sources: ["valyu/valyu-market-movers-US"],
        maxResults: 10,
      }
    );

    const content = response.results.map((r) => r.content).join("\n");

    const data: MarketMoversData = {
      gainers: [],
      losers: [],
      mostActive: [],
      rawData: content,
    };

    const gainerPattern = /([A-Z]{1,5})\s*(?:\+|up\s*)([\d.]+)%/gi;
    let match;
    while ((match = gainerPattern.exec(content)) !== null) {
      data.gainers.push({
        symbol: match[1],
        change: parseFloat(match[2]),
      });
    }

    const loserPattern = /([A-Z]{1,5})\s*(?:-|down\s*)([\d.]+)%/gi;
    while ((match = loserPattern.exec(content)) !== null) {
      data.losers.push({
        symbol: match[1],
        change: -parseFloat(match[2]),
      });
    }

    data.gainers = data.gainers.slice(0, 10);
    data.losers = data.losers.slice(0, 10);

    this.marketMoversCache.set(cacheKey, data);
    log.info("Valyu", "Market movers fetched", {
      gainersCount: data.gainers.length,
      losersCount: data.losers.length,
    });
    return data;
  }

  async getComprehensiveAnalysis(symbol: string): Promise<{
    earnings: EarningsData;
    ratios: FinancialRatios;
    balanceSheet: BalanceSheetData;
    incomeStatement: IncomeStatementData;
    cashFlow: CashFlowData;
    dividends: DividendData;
    insiderActivity: InsiderTransactionData;
  }> {
    const [
      earnings,
      ratios,
      balanceSheet,
      incomeStatement,
      cashFlow,
      dividends,
      insiderActivity,
    ] = await Promise.all([
      this.getEarnings(symbol),
      this.getFinancialRatios(symbol),
      this.getBalanceSheet(symbol),
      this.getIncomeStatement(symbol),
      this.getCashFlow(symbol),
      this.getDividends(symbol),
      this.getInsiderTransactions(symbol),
    ]);

    return {
      earnings,
      ratios,
      balanceSheet,
      incomeStatement,
      cashFlow,
      dividends,
      insiderActivity,
    };
  }

  private parseFinancialValue(valueStr: string, unit?: string): number {
    let value = parseFloat(valueStr.replace(/,/g, ""));
    if (unit) {
      const unitLower = unit.toLowerCase();
      if (unitLower === "billion" || unitLower === "b") {
        value *= 1e9;
      } else if (unitLower === "million" || unitLower === "m") {
        value *= 1e6;
      }
    }
    return value;
  }

  getConnectionStatus(): {
    connected: boolean;
    hasApiKey: boolean;
    cacheSize: number;
  } {
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
    this.balanceSheetCache.clear();
    this.incomeStatementCache.clear();
    this.cashFlowCache.clear();
    this.dividendCache.clear();
    this.insiderCache.clear();
    this.marketMoversCache.clear();
  }
}

export const valyu = new ValyuConnector();
