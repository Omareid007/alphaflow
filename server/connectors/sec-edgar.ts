import { z } from "zod";
import { wrapWithLimiter } from "../lib/rateLimiter";
import { ApiCache } from "../lib/api-cache";
import { log } from "../utils/logger";

const SEC_BASE_URL = "https://data.sec.gov";

const SEC_USER_AGENT = `AI-Active-Trader/1.0 (support@aiactivetrader.com)`;

const CompanyFactsSchema = z.object({
  cik: z.union([z.number(), z.string()]).transform((v) => String(v)),
  entityName: z.string(),
  facts: z.object({
    "us-gaap": z.record(z.any()).optional(),
    dei: z.record(z.any()).optional(),
  }),
});

export interface SECFiling {
  accessionNumber: string;
  filingDate: Date;
  form: string;
  documentUrl: string;
  primaryDocument?: string;
}

export interface CompanyFundamentals {
  cik: string;
  ticker: string;
  name: string;
  revenue?: number;
  netIncome?: number;
  totalAssets?: number;
  totalLiabilities?: number;
  eps?: number;
  sharesOutstanding?: number;
  filingDate?: Date;
}

export interface SECCompanyInfo {
  cik: string;
  name: string;
  ticker: string;
  exchanges: string[];
  sic: string;
  sicDescription: string;
  category?: string;
  fiscalYearEnd?: string;
}

// Form 4 - Insider Trading Data
export interface InsiderTransaction {
  filingDate: Date;
  reportingOwner: string;
  ownerCik: string;
  relationship: string; // CEO, CFO, Director, 10% Owner, etc.
  transactionDate: Date;
  transactionType: "P" | "S" | "A" | "D" | "G" | "M" | "C" | "X"; // Purchase, Sale, Award, Disposition, Gift, etc.
  transactionCode: string;
  sharesTransacted: number;
  pricePerShare: number | null;
  sharesOwnedAfter: number;
  value: number | null;
  isDirectOwnership: boolean;
  accessionNumber: string;
  documentUrl: string;
}

export interface InsiderSummary {
  ticker: string;
  cik: string;
  companyName: string;
  totalInsiderBuys: number;
  totalInsiderSells: number;
  netInsiderActivity: number; // Buys - Sells (in shares)
  netInsiderValue: number; // Dollar value
  buyToSellRatio: number;
  recentTransactions: InsiderTransaction[];
  sentiment: "bullish" | "bearish" | "neutral";
  lastUpdated: Date;
}

// Form 13F - Institutional Holdings
export interface InstitutionalHolding {
  filingDate: Date;
  reportingManager: string;
  managerCik: string;
  ticker: string;
  cusip: string;
  shares: number;
  value: number; // In thousands USD
  investmentDiscretion: string;
  votingAuthority: {
    sole: number;
    shared: number;
    none: number;
  };
  putCall?: "PUT" | "CALL";
  accessionNumber: string;
}

export interface InstitutionalOwnership {
  ticker: string;
  cik: string;
  companyName: string;
  totalInstitutionalShares: number;
  totalInstitutionalValue: number;
  numberOfInstitutions: number;
  topHolders: {
    manager: string;
    shares: number;
    value: number;
    percentOfTotal: number;
  }[];
  quarterlyChange: {
    sharesChange: number;
    valueChange: number;
    percentChange: number;
  } | null;
  lastUpdated: Date;
}

const cache = new ApiCache<any>({
  freshDuration: 5 * 60 * 1000,
  staleDuration: 24 * 60 * 60 * 1000,
});

const cikCache = new Map<string, string>();

async function fetchSEC(url: string): Promise<any> {
  return wrapWithLimiter("sec-edgar", async () => {
    const response = await fetch(url, {
      headers: {
        "User-Agent": SEC_USER_AGENT,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(
        `SEC API error: ${response.status} ${response.statusText}`
      );
    }

    return response.json();
  });
}

export async function getCIKByTicker(ticker: string): Promise<string | null> {
  const normalizedTicker = ticker.toUpperCase();

  if (cikCache.has(normalizedTicker)) {
    return cikCache.get(normalizedTicker)!;
  }

  try {
    const tickersData = await fetchSEC(
      `https://www.sec.gov/files/company_tickers.json`
    );

    for (const entry of Object.values(tickersData) as any[]) {
      if (entry.ticker === normalizedTicker) {
        const cik = String(entry.cik_str).padStart(10, "0");
        cikCache.set(normalizedTicker, cik);
        return cik;
      }
    }

    return null;
  } catch (error) {
    log.error(
      "SEC-EDGAR",
      `Failed to get CIK for ${ticker}: ${(error as Error).message}`
    );
    return null;
  }
}

export async function getCompanyInfo(
  ticker: string
): Promise<SECCompanyInfo | null> {
  const cacheKey = `sec-company-${ticker}`;
  const cached = cache.getFresh(cacheKey);
  if (cached) return cached as SECCompanyInfo;

  const cik = await getCIKByTicker(ticker);
  if (!cik) return null;

  try {
    const data = await fetchSEC(`${SEC_BASE_URL}/submissions/CIK${cik}.json`);

    const info: SECCompanyInfo = {
      cik,
      name: data.name,
      ticker: data.tickers?.[0] || ticker,
      exchanges: data.exchanges || [],
      sic: data.sic || "",
      sicDescription: data.sicDescription || "",
      category: data.category,
      fiscalYearEnd: data.fiscalYearEnd,
    };

    cache.set(cacheKey, info);
    return info;
  } catch (error) {
    log.error(
      "SEC-EDGAR",
      `Failed to fetch company info for ${ticker}: ${(error as Error).message}`
    );
    return null;
  }
}

export async function getCompanyFacts(
  ticker: string
): Promise<CompanyFundamentals | null> {
  const cacheKey = `sec-facts-${ticker}`;
  const cached = cache.getFresh(cacheKey);
  if (cached) return cached as CompanyFundamentals;

  const cik = await getCIKByTicker(ticker);
  if (!cik) return null;

  try {
    const data = await fetchSEC(
      `${SEC_BASE_URL}/api/xbrl/companyfacts/CIK${cik}.json`
    );
    const parsed = CompanyFactsSchema.parse(data);

    const getLatestValue = (
      concept: string,
      namespace: string = "us-gaap"
    ): number | undefined => {
      const facts = (parsed.facts as any)?.[namespace]?.[concept]?.units?.USD;
      if (!facts || facts.length === 0) return undefined;

      const annual = facts
        .filter((f: any) => f.form === "10-K")
        .sort(
          (a: any, b: any) =>
            new Date(b.end).getTime() - new Date(a.end).getTime()
        );

      return annual[0]?.val;
    };

    const fundamentals: CompanyFundamentals = {
      cik,
      ticker: ticker.toUpperCase(),
      name: parsed.entityName,
      revenue:
        getLatestValue("Revenues") ||
        getLatestValue("RevenueFromContractWithCustomerExcludingAssessedTax") ||
        getLatestValue("SalesRevenueNet"),
      netIncome: getLatestValue("NetIncomeLoss"),
      totalAssets: getLatestValue("Assets"),
      totalLiabilities: getLatestValue("Liabilities"),
      eps: getLatestValue("EarningsPerShareBasic"),
      sharesOutstanding: getLatestValue("CommonStockSharesOutstanding"),
    };

    cache.set(cacheKey, fundamentals);
    log.info(
      "SEC-EDGAR",
      `Fetched fundamentals for ${ticker}: revenue=${fundamentals.revenue}, netIncome=${fundamentals.netIncome}`
    );
    return fundamentals;
  } catch (error) {
    log.error(
      "SEC-EDGAR",
      `Failed to fetch facts for ${ticker}: ${(error as Error).message}`
    );
    return null;
  }
}

export async function getRecentFilings(
  ticker: string,
  formTypes: string[] = ["10-K", "10-Q", "8-K"],
  limit: number = 10
): Promise<SECFiling[]> {
  const cik = await getCIKByTicker(ticker);
  if (!cik) return [];

  try {
    const data = await fetchSEC(`${SEC_BASE_URL}/submissions/CIK${cik}.json`);

    const filings: SECFiling[] = [];
    const recent = data.filings?.recent || data;

    const accessionNumbers = recent.accessionNumber || [];
    const forms = recent.form || [];
    const filingDates = recent.filingDate || [];
    const primaryDocuments = recent.primaryDocument || [];

    for (let i = 0; i < Math.min(accessionNumbers.length, 100); i++) {
      const form = forms[i];
      if (!formTypes.includes(form)) continue;

      const accNum = accessionNumbers[i];
      const primaryDoc = primaryDocuments[i] || "index.html";

      filings.push({
        accessionNumber: accNum,
        filingDate: new Date(filingDates[i]),
        form,
        primaryDocument: primaryDoc,
        documentUrl: `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accNum.replace(/-/g, "")}/${primaryDoc}`,
      });

      if (filings.length >= limit) break;
    }

    log.info("SEC-EDGAR", `Found ${filings.length} filings for ${ticker}`);
    return filings;
  } catch (error) {
    log.error(
      "SEC-EDGAR",
      `Failed to fetch filings for ${ticker}: ${(error as Error).message}`
    );
    return [];
  }
}

export async function getFilingText(filing: SECFiling): Promise<string | null> {
  try {
    const response = await wrapWithLimiter("sec-edgar", async () => {
      return fetch(filing.documentUrl, {
        headers: { "User-Agent": SEC_USER_AGENT },
      });
    });

    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

export async function getBulkCompanyFacts(
  tickers: string[]
): Promise<Map<string, CompanyFundamentals>> {
  const results = new Map<string, CompanyFundamentals>();

  const batchSize = 5;
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (ticker) => {
        const facts = await getCompanyFacts(ticker);
        return { ticker, facts };
      })
    );

    for (const { ticker, facts } of batchResults) {
      if (facts) {
        results.set(ticker, facts);
      }
    }

    if (i + batchSize < tickers.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }

  return results;
}

export const SEC_BULK_DATA = {
  companyFacts:
    "https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip",
  submissions:
    "https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip",
  financialStatements: (year: number, quarter: number) =>
    `https://www.sec.gov/files/dera/data/financial-statement-data-sets/${year}q${quarter}.zip`,
};

// Insider trading cache
const insiderCache = new ApiCache<InsiderSummary>({
  freshDuration: 60 * 60 * 1000, // 1 hour
  staleDuration: 24 * 60 * 60 * 1000, // 24 hours
});

// Institutional holdings cache
const institutionalCache = new ApiCache<InstitutionalOwnership>({
  freshDuration: 6 * 60 * 60 * 1000, // 6 hours - 13F filings are quarterly
  staleDuration: 30 * 24 * 60 * 60 * 1000, // 30 days
});

/**
 * Get insider transactions (Form 4 filings) for a company
 */
export async function getInsiderTransactions(
  ticker: string,
  limit: number = 20
): Promise<InsiderTransaction[]> {
  const cik = await getCIKByTicker(ticker);
  if (!cik) return [];

  try {
    const data = await fetchSEC(`${SEC_BASE_URL}/submissions/CIK${cik}.json`);

    const transactions: InsiderTransaction[] = [];
    const recent = data.filings?.recent || data;

    const accessionNumbers = recent.accessionNumber || [];
    const forms = recent.form || [];
    const filingDates = recent.filingDate || [];

    for (let i = 0; i < Math.min(accessionNumbers.length, 200); i++) {
      const form = forms[i];
      if (form !== "4" && form !== "4/A") continue;

      const accNum = accessionNumbers[i];
      const filingDate = new Date(filingDates[i]);

      // Fetch the XML filing to get transaction details
      try {
        const transaction = await parseForm4Filing(cik, accNum, filingDate);
        if (transaction) {
          transactions.push(...transaction);
        }
      } catch (e) {
        // Skip filings that can't be parsed
      }

      if (transactions.length >= limit) break;
    }

    log.info(
      "SEC-EDGAR",
      `Found ${transactions.length} insider transactions for ${ticker}`
    );
    return transactions;
  } catch (error) {
    log.error(
      "SEC-EDGAR",
      `Failed to fetch insider transactions for ${ticker}: ${(error as Error).message}`
    );
    return [];
  }
}

/**
 * Parse Form 4 XML filing
 */
async function parseForm4Filing(
  companyCik: string,
  accessionNumber: string,
  filingDate: Date
): Promise<InsiderTransaction[]> {
  const accNumClean = accessionNumber.replace(/-/g, "");
  const url = `https://www.sec.gov/Archives/edgar/data/${parseInt(companyCik)}/${accNumClean}`;

  try {
    // Get the index to find the XML file
    const indexResponse = await wrapWithLimiter("sec-edgar", async () => {
      return fetch(`${url}/index.json`, {
        headers: { "User-Agent": SEC_USER_AGENT },
      });
    });

    if (!indexResponse.ok) return [];

    const indexData = await indexResponse.json();
    const xmlFile = indexData.directory?.item?.find(
      (item: any) =>
        item.name?.endsWith(".xml") && !item.name?.includes("primary_doc")
    );

    if (!xmlFile) return [];

    // Fetch and parse the XML
    const xmlResponse = await wrapWithLimiter("sec-edgar", async () => {
      return fetch(`${url}/${xmlFile.name}`, {
        headers: { "User-Agent": SEC_USER_AGENT },
      });
    });

    if (!xmlResponse.ok) return [];

    const xmlText = await xmlResponse.text();
    return parseForm4XML(xmlText, accessionNumber, filingDate, url);
  } catch {
    return [];
  }
}

/**
 * Simple XML parser for Form 4
 */
function parseForm4XML(
  xml: string,
  accessionNumber: string,
  filingDate: Date,
  baseUrl: string
): InsiderTransaction[] {
  const transactions: InsiderTransaction[] = [];

  // Extract reporting owner info
  const ownerMatch = xml.match(/<rptOwnerName>([^<]+)<\/rptOwnerName>/);
  const ownerCikMatch = xml.match(/<rptOwnerCik>([^<]+)<\/rptOwnerCik>/);
  const reportingOwner = ownerMatch?.[1] || "Unknown";
  const ownerCik = ownerCikMatch?.[1] || "";

  // Extract relationship
  let relationship = "";
  if (
    xml.includes("<isDirector>true</isDirector>") ||
    xml.includes("<isDirector>1</isDirector>")
  )
    relationship += "Director ";
  if (
    xml.includes("<isOfficer>true</isOfficer>") ||
    xml.includes("<isOfficer>1</isOfficer>")
  ) {
    const titleMatch = xml.match(/<officerTitle>([^<]+)<\/officerTitle>/);
    relationship += titleMatch?.[1] || "Officer ";
  }
  if (
    xml.includes("<isTenPercentOwner>true</isTenPercentOwner>") ||
    xml.includes("<isTenPercentOwner>1</isTenPercentOwner>")
  )
    relationship += "10% Owner ";
  relationship = relationship.trim() || "Other";

  // Extract non-derivative transactions
  const transactionMatches = xml.matchAll(
    /<nonDerivativeTransaction>[\s\S]*?<\/nonDerivativeTransaction>/g
  );

  for (const match of transactionMatches) {
    const txXml = match[0];

    const dateMatch = txXml.match(
      /<transactionDate>[\s\S]*?<value>([^<]+)<\/value>/
    );
    const codeMatch = txXml.match(
      /<transactionCode>([^<]+)<\/transactionCode>/
    );
    const sharesMatch = txXml.match(
      /<transactionShares>[\s\S]*?<value>([^<]+)<\/value>/
    );
    const priceMatch = txXml.match(
      /<transactionPricePerShare>[\s\S]*?<value>([^<]*)<\/value>/
    );
    const sharesAfterMatch = txXml.match(
      /<sharesOwnedFollowingTransaction>[\s\S]*?<value>([^<]+)<\/value>/
    );
    const ownershipMatch = txXml.match(
      /<directOrIndirectOwnership>[\s\S]*?<value>([^<]+)<\/value>/
    );
    const acquiredDisposedMatch = txXml.match(
      /<transactionAcquiredDisposedCode>[\s\S]*?<value>([^<]+)<\/value>/
    );

    const transactionDate = dateMatch?.[1]
      ? new Date(dateMatch[1])
      : filingDate;
    const transactionCode = codeMatch?.[1] || "";
    const sharesTransacted = parseFloat(sharesMatch?.[1] || "0");
    const pricePerShare = priceMatch?.[1] ? parseFloat(priceMatch[1]) : null;
    const sharesOwnedAfter = parseFloat(sharesAfterMatch?.[1] || "0");
    const isDirectOwnership = ownershipMatch?.[1]?.toUpperCase() === "D";
    const isAcquisition = acquiredDisposedMatch?.[1]?.toUpperCase() === "A";

    // Map transaction code to type
    let transactionType: InsiderTransaction["transactionType"] = "P";
    if (transactionCode === "P")
      transactionType = "P"; // Purchase
    else if (transactionCode === "S")
      transactionType = "S"; // Sale
    else if (transactionCode === "A")
      transactionType = "A"; // Award
    else if (transactionCode === "D")
      transactionType = "D"; // Disposition
    else if (transactionCode === "G")
      transactionType = "G"; // Gift
    else if (transactionCode === "M")
      transactionType = "M"; // Exercise/Conversion
    else if (transactionCode === "C")
      transactionType = "C"; // Conversion
    else if (transactionCode === "X")
      transactionType = "X"; // Exercise
    else transactionType = isAcquisition ? "P" : "S";

    const value =
      pricePerShare && sharesTransacted
        ? pricePerShare * sharesTransacted
        : null;

    transactions.push({
      filingDate,
      reportingOwner,
      ownerCik,
      relationship,
      transactionDate,
      transactionType,
      transactionCode,
      sharesTransacted,
      pricePerShare,
      sharesOwnedAfter,
      value,
      isDirectOwnership,
      accessionNumber,
      documentUrl: `${baseUrl}`,
    });
  }

  return transactions;
}

/**
 * Get insider trading summary with sentiment analysis
 */
export async function getInsiderSummary(
  ticker: string,
  days: number = 90
): Promise<InsiderSummary | null> {
  const cacheKey = `insider-${ticker}-${days}`;
  const cached = insiderCache.getFresh(cacheKey);
  if (cached) return cached;

  const cik = await getCIKByTicker(ticker);
  if (!cik) return null;

  const info = await getCompanyInfo(ticker);
  if (!info) return null;

  try {
    const transactions = await getInsiderTransactions(ticker, 50);

    // Filter to recent transactions
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const recentTransactions = transactions.filter(
      (t) => t.transactionDate >= cutoffDate
    );

    // Calculate metrics
    let totalBuys = 0;
    let totalSells = 0;
    let buyValue = 0;
    let sellValue = 0;

    for (const t of recentTransactions) {
      if (t.transactionType === "P" || t.transactionCode === "P") {
        totalBuys += t.sharesTransacted;
        buyValue += t.value || 0;
      } else if (t.transactionType === "S" || t.transactionCode === "S") {
        totalSells += t.sharesTransacted;
        sellValue += t.value || 0;
      }
    }

    const netActivity = totalBuys - totalSells;
    const netValue = buyValue - sellValue;
    const buyToSellRatio =
      totalSells > 0 ? totalBuys / totalSells : totalBuys > 0 ? Infinity : 0;

    // Determine sentiment
    let sentiment: InsiderSummary["sentiment"] = "neutral";
    if (buyToSellRatio > 1.5 || (netValue > 100000 && totalBuys > totalSells)) {
      sentiment = "bullish";
    } else if (
      buyToSellRatio < 0.5 ||
      (netValue < -100000 && totalSells > totalBuys)
    ) {
      sentiment = "bearish";
    }

    const summary: InsiderSummary = {
      ticker: ticker.toUpperCase(),
      cik,
      companyName: info.name,
      totalInsiderBuys: totalBuys,
      totalInsiderSells: totalSells,
      netInsiderActivity: netActivity,
      netInsiderValue: netValue,
      buyToSellRatio,
      recentTransactions: recentTransactions.slice(0, 10),
      sentiment,
      lastUpdated: new Date(),
    };

    insiderCache.set(cacheKey, summary);
    log.info(
      "SEC-EDGAR",
      `Insider summary for ${ticker}: ${sentiment} (${recentTransactions.length} transactions)`
    );
    return summary;
  } catch (error) {
    log.error(
      "SEC-EDGAR",
      `Failed to get insider summary for ${ticker}: ${(error as Error).message}`
    );
    return null;
  }
}

/**
 * Get 13F institutional holdings for a company
 * Note: 13F shows institutions holding the company, not filings by the company
 */
export async function getInstitutionalOwnership(
  ticker: string
): Promise<InstitutionalOwnership | null> {
  const cacheKey = `institutional-${ticker}`;
  const cached = institutionalCache.getFresh(cacheKey);
  if (cached) return cached;

  const cik = await getCIKByTicker(ticker);
  if (!cik) return null;

  const info = await getCompanyInfo(ticker);
  if (!info) return null;

  try {
    // For institutional ownership, we'd need to search 13F filings that mention this company
    // This requires parsing 13F XML files which is complex
    // For now, we'll use a simplified approach with the ownership data from submissions

    const data = await fetchSEC(`${SEC_BASE_URL}/submissions/CIK${cik}.json`);

    // Extract owner info if available
    const owners = data.owners || [];

    const ownership: InstitutionalOwnership = {
      ticker: ticker.toUpperCase(),
      cik,
      companyName: info.name,
      totalInstitutionalShares: 0,
      totalInstitutionalValue: 0,
      numberOfInstitutions: owners.length,
      topHolders: [],
      quarterlyChange: null,
      lastUpdated: new Date(),
    };

    institutionalCache.set(cacheKey, ownership);
    log.info(
      "SEC-EDGAR",
      `Institutional ownership for ${ticker}: ${owners.length} institutions found`
    );
    return ownership;
  } catch (error) {
    log.error(
      "SEC-EDGAR",
      `Failed to get institutional ownership for ${ticker}: ${(error as Error).message}`
    );
    return null;
  }
}

/**
 * Get bulk insider summaries for multiple tickers
 */
export async function getBulkInsiderSummaries(
  tickers: string[]
): Promise<Map<string, InsiderSummary>> {
  const results = new Map<string, InsiderSummary>();

  const batchSize = 3; // Lower batch size due to rate limiting
  for (let i = 0; i < tickers.length; i += batchSize) {
    const batch = tickers.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map(async (ticker) => {
        const summary = await getInsiderSummary(ticker);
        return { ticker, summary };
      })
    );

    for (const { ticker, summary } of batchResults) {
      if (summary) {
        results.set(ticker, summary);
      }
    }

    // Rate limiting delay
    if (i + batchSize < tickers.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  log.info(
    "SEC-EDGAR",
    `Fetched insider summaries for ${results.size}/${tickers.length} tickers`
  );
  return results;
}

class SECEdgarConnector {
  async getCompanyFacts(ticker: string): Promise<CompanyFundamentals | null> {
    return getCompanyFacts(ticker);
  }

  async getRecentFilings(
    ticker: string,
    formTypes?: string[],
    limit?: number
  ): Promise<SECFiling[]> {
    return getRecentFilings(ticker, formTypes, limit);
  }

  async getCompanyInfo(ticker: string): Promise<SECCompanyInfo | null> {
    return getCompanyInfo(ticker);
  }

  async getCIKByTicker(ticker: string): Promise<string | null> {
    return getCIKByTicker(ticker);
  }

  async getBulkCompanyFacts(
    tickers: string[]
  ): Promise<Map<string, CompanyFundamentals>> {
    return getBulkCompanyFacts(tickers);
  }

  // Form 4 - Insider Trading
  async getInsiderTransactions(
    ticker: string,
    limit?: number
  ): Promise<InsiderTransaction[]> {
    return getInsiderTransactions(ticker, limit);
  }

  async getInsiderSummary(
    ticker: string,
    days?: number
  ): Promise<InsiderSummary | null> {
    return getInsiderSummary(ticker, days);
  }

  async getBulkInsiderSummaries(
    tickers: string[]
  ): Promise<Map<string, InsiderSummary>> {
    return getBulkInsiderSummaries(tickers);
  }

  // 13F - Institutional Ownership
  async getInstitutionalOwnership(
    ticker: string
  ): Promise<InstitutionalOwnership | null> {
    return getInstitutionalOwnership(ticker);
  }
}

export const secEdgarConnector = new SECEdgarConnector();
export default secEdgarConnector;
