import { z } from 'zod';
import { wrapWithLimiter } from '../lib/rateLimiter';
import { ApiCache } from '../lib/api-cache';
import { log } from '../utils/logger';

const SEC_BASE_URL = 'https://data.sec.gov';

const SEC_USER_AGENT = `AI-Active-Trader/1.0 (support@aiactivetrader.com)`;

const CompanyFactsSchema = z.object({
  cik: z.number(),
  entityName: z.string(),
  facts: z.object({
    'us-gaap': z.record(z.any()).optional(),
    'dei': z.record(z.any()).optional(),
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

const cache = new ApiCache<any>({
  freshDuration: 5 * 60 * 1000,
  staleDuration: 24 * 60 * 60 * 1000,
});

const cikCache = new Map<string, string>();

async function fetchSEC(url: string): Promise<any> {
  return wrapWithLimiter('sec-edgar', async () => {
    const response = await fetch(url, {
      headers: {
        'User-Agent': SEC_USER_AGENT,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`SEC API error: ${response.status} ${response.statusText}`);
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
    const tickersData = await fetchSEC(`${SEC_BASE_URL}/files/company_tickers.json`);
    
    for (const entry of Object.values(tickersData) as any[]) {
      if (entry.ticker === normalizedTicker) {
        const cik = String(entry.cik_str).padStart(10, '0');
        cikCache.set(normalizedTicker, cik);
        return cik;
      }
    }
    
    return null;
  } catch (error) {
    log.error('SEC-EDGAR', `Failed to get CIK for ${ticker}: ${(error as Error).message}`);
    return null;
  }
}

export async function getCompanyInfo(ticker: string): Promise<SECCompanyInfo | null> {
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
      sic: data.sic || '',
      sicDescription: data.sicDescription || '',
      category: data.category,
      fiscalYearEnd: data.fiscalYearEnd,
    };

    cache.set(cacheKey, info);
    return info;
  } catch (error) {
    log.error('SEC-EDGAR', `Failed to fetch company info for ${ticker}: ${(error as Error).message}`);
    return null;
  }
}

export async function getCompanyFacts(ticker: string): Promise<CompanyFundamentals | null> {
  const cacheKey = `sec-facts-${ticker}`;
  const cached = cache.getFresh(cacheKey);
  if (cached) return cached as CompanyFundamentals;

  const cik = await getCIKByTicker(ticker);
  if (!cik) return null;

  try {
    const data = await fetchSEC(`${SEC_BASE_URL}/api/xbrl/companyfacts/CIK${cik}.json`);
    const parsed = CompanyFactsSchema.parse(data);

    const getLatestValue = (concept: string, namespace: string = 'us-gaap'): number | undefined => {
      const facts = (parsed.facts as any)?.[namespace]?.[concept]?.units?.USD;
      if (!facts || facts.length === 0) return undefined;
      
      const annual = facts
        .filter((f: any) => f.form === '10-K')
        .sort((a: any, b: any) => new Date(b.end).getTime() - new Date(a.end).getTime());
      
      return annual[0]?.val;
    };

    const fundamentals: CompanyFundamentals = {
      cik,
      ticker: ticker.toUpperCase(),
      name: parsed.entityName,
      revenue: getLatestValue('Revenues') || 
               getLatestValue('RevenueFromContractWithCustomerExcludingAssessedTax') ||
               getLatestValue('SalesRevenueNet'),
      netIncome: getLatestValue('NetIncomeLoss'),
      totalAssets: getLatestValue('Assets'),
      totalLiabilities: getLatestValue('Liabilities'),
      eps: getLatestValue('EarningsPerShareBasic'),
      sharesOutstanding: getLatestValue('CommonStockSharesOutstanding'),
    };

    cache.set(cacheKey, fundamentals);
    log.info('SEC-EDGAR', `Fetched fundamentals for ${ticker}: revenue=${fundamentals.revenue}, netIncome=${fundamentals.netIncome}`);
    return fundamentals;
  } catch (error) {
    log.error('SEC-EDGAR', `Failed to fetch facts for ${ticker}: ${(error as Error).message}`);
    return null;
  }
}

export async function getRecentFilings(
  ticker: string,
  formTypes: string[] = ['10-K', '10-Q', '8-K'],
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
      const primaryDoc = primaryDocuments[i] || 'index.html';
      
      filings.push({
        accessionNumber: accNum,
        filingDate: new Date(filingDates[i]),
        form,
        primaryDocument: primaryDoc,
        documentUrl: `https://www.sec.gov/Archives/edgar/data/${parseInt(cik)}/${accNum.replace(/-/g, '')}/${primaryDoc}`,
      });

      if (filings.length >= limit) break;
    }

    log.info('SEC-EDGAR', `Found ${filings.length} filings for ${ticker}`);
    return filings;
  } catch (error) {
    log.error('SEC-EDGAR', `Failed to fetch filings for ${ticker}: ${(error as Error).message}`);
    return [];
  }
}

export async function getFilingText(filing: SECFiling): Promise<string | null> {
  try {
    const response = await wrapWithLimiter('sec-edgar', async () => {
      return fetch(filing.documentUrl, {
        headers: { 'User-Agent': SEC_USER_AGENT },
      });
    });

    if (!response.ok) return null;
    return response.text();
  } catch {
    return null;
  }
}

export async function getBulkCompanyFacts(tickers: string[]): Promise<Map<string, CompanyFundamentals>> {
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
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }
  
  return results;
}

export const SEC_BULK_DATA = {
  companyFacts: 'https://www.sec.gov/Archives/edgar/daily-index/xbrl/companyfacts.zip',
  submissions: 'https://www.sec.gov/Archives/edgar/daily-index/bulkdata/submissions.zip',
  financialStatements: (year: number, quarter: number) =>
    `https://www.sec.gov/files/dera/data/financial-statement-data-sets/${year}q${quarter}.zip`,
};

class SECEdgarConnector {
  async getCompanyFacts(ticker: string): Promise<CompanyFundamentals | null> {
    return getCompanyFacts(ticker);
  }

  async getRecentFilings(ticker: string, formTypes?: string[], limit?: number): Promise<SECFiling[]> {
    return getRecentFilings(ticker, formTypes, limit);
  }

  async getCompanyInfo(ticker: string): Promise<SECCompanyInfo | null> {
    return getCompanyInfo(ticker);
  }

  async getCIKByTicker(ticker: string): Promise<string | null> {
    return getCIKByTicker(ticker);
  }

  async getBulkCompanyFacts(tickers: string[]): Promise<Map<string, CompanyFundamentals>> {
    return getBulkCompanyFacts(tickers);
  }
}

export const secEdgarConnector = new SECEdgarConnector();
export default secEdgarConnector;
