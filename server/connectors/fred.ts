import { connectorFetch, buildCacheKey } from "../lib/connectorClient";
import { log } from "../utils/logger";

const FRED_BASE_URL = "https://api.stlouisfed.org/fred";

export interface FREDSeries {
  id: string;
  title: string;
  observation_start: string;
  observation_end: string;
  frequency: string;
  frequency_short: string;
  units: string;
  units_short: string;
  seasonal_adjustment: string;
  seasonal_adjustment_short: string;
  last_updated: string;
  popularity: number;
  notes?: string;
}

export interface FREDObservation {
  realtime_start: string;
  realtime_end: string;
  date: string;
  value: string;
}

export interface FREDSeriesResponse {
  realtime_start: string;
  realtime_end: string;
  seriess: FREDSeries[];
}

export interface FREDObservationsResponse {
  realtime_start: string;
  realtime_end: string;
  observation_start: string;
  observation_end: string;
  units: string;
  output_type: number;
  file_type: string;
  order_by: string;
  sort_order: string;
  count: number;
  offset: number;
  limit: number;
  observations: FREDObservation[];
}

export interface MacroIndicatorData {
  indicatorId: string;
  name: string;
  category: MacroCategory;
  latestValue: number | null;
  previousValue: number | null;
  changePercent: number | null;
  frequency: string;
  lastUpdatedAt: Date;
  source: "FRED";
  rawJson: FREDObservationsResponse;
}

export type MacroCategory = 
  | "treasury_yields"
  | "inflation"
  | "employment"
  | "volatility"
  | "interest_rates"
  | "money_supply"
  | "gdp"
  | "consumer"
  | "housing"
  | "manufacturing";

export const FRED_SERIES: Record<string, { name: string; category: MacroCategory }> = {
  "DGS10": { name: "10-Year Treasury Constant Maturity Rate", category: "treasury_yields" },
  "DGS2": { name: "2-Year Treasury Constant Maturity Rate", category: "treasury_yields" },
  "DGS30": { name: "30-Year Treasury Constant Maturity Rate", category: "treasury_yields" },
  "T10Y2Y": { name: "10-Year Treasury Minus 2-Year Treasury (Yield Curve)", category: "treasury_yields" },
  "T10Y3M": { name: "10-Year Treasury Minus 3-Month Treasury", category: "treasury_yields" },
  "CPIAUCSL": { name: "Consumer Price Index for All Urban Consumers", category: "inflation" },
  "CPILFESL": { name: "Core CPI (Less Food and Energy)", category: "inflation" },
  "PCEPI": { name: "Personal Consumption Expenditures Price Index", category: "inflation" },
  "UNRATE": { name: "Unemployment Rate", category: "employment" },
  "PAYEMS": { name: "Total Nonfarm Payrolls", category: "employment" },
  "ICSA": { name: "Initial Jobless Claims", category: "employment" },
  "VIXCLS": { name: "CBOE Volatility Index (VIX)", category: "volatility" },
  "FEDFUNDS": { name: "Federal Funds Effective Rate", category: "interest_rates" },
  "DFEDTARU": { name: "Federal Funds Target Rate - Upper Bound", category: "interest_rates" },
  "M2SL": { name: "M2 Money Stock", category: "money_supply" },
  "GDP": { name: "Gross Domestic Product", category: "gdp" },
  "GDPC1": { name: "Real Gross Domestic Product", category: "gdp" },
  "UMCSENT": { name: "University of Michigan Consumer Sentiment", category: "consumer" },
  "HOUST": { name: "Housing Starts", category: "housing" },
  "INDPRO": { name: "Industrial Production Index", category: "manufacturing" },
  "NAPM": { name: "ISM Manufacturing PMI", category: "manufacturing" },
};

const CRITICAL_INDICATORS = [
  "DGS10", "DGS2", "T10Y2Y", "VIXCLS", "FEDFUNDS", 
  "UNRATE", "CPIAUCSL", "UMCSENT"
];

class FREDConnector {
  private apiKey: string | null;
  private readonly CACHE_TTL_MS = 6 * 60 * 60 * 1000;

  constructor() {
    this.apiKey = process.env.FRED_API_KEY || null;
  }

  private getApiKey(): string {
    if (!this.apiKey) {
      log.warn("FRED", "No API key configured, using unauthenticated access (limited)");
      return "";
    }
    return this.apiKey;
  }

  async getSeriesInfo(seriesId: string): Promise<FREDSeries | null> {
    try {
      const apiKey = this.getApiKey();
      const url = `${FRED_BASE_URL}/series?series_id=${seriesId}&api_key=${apiKey}&file_type=json`;

      const response = await connectorFetch<FREDSeriesResponse>(url, {
        provider: "FRED",
        endpoint: "series",
        cacheKey: buildCacheKey("FRED", "series", seriesId),
        customTTLMs: 24 * 60 * 60 * 1000,
      });

      return response.data.seriess?.[0] || null;
    } catch (error) {
      log.error("FRED", `Failed to get series info for ${seriesId}`, { error });
      return null;
    }
  }

  async getLatestObservations(
    seriesId: string,
    limit: number = 10
  ): Promise<FREDObservation[]> {
    try {
      const apiKey = this.getApiKey();
      const url = `${FRED_BASE_URL}/series/observations?series_id=${seriesId}&api_key=${apiKey}&file_type=json&sort_order=desc&limit=${limit}`;

      const response = await connectorFetch<FREDObservationsResponse>(url, {
        provider: "FRED",
        endpoint: "observations",
        cacheKey: buildCacheKey("FRED", "observations", seriesId, limit.toString()),
        customTTLMs: this.CACHE_TTL_MS,
      });

      return response.data.observations || [];
    } catch (error) {
      log.error("FRED", `Failed to get observations for ${seriesId}`, { error });
      return [];
    }
  }

  async getIndicatorData(seriesId: string): Promise<MacroIndicatorData | null> {
    const seriesConfig = FRED_SERIES[seriesId];
    if (!seriesConfig) {
      log.warn("FRED", `Unknown series ID: ${seriesId}`);
      return null;
    }

    try {
      const observations = await this.getLatestObservations(seriesId, 5);

      if (observations.length === 0) {
        return null;
      }

      const latestValue = observations[0]?.value === "." ? null : parseFloat(observations[0]?.value || "");
      const previousValue = observations[1]?.value === "." ? null : parseFloat(observations[1]?.value || "");

      let changePercent: number | null = null;
      if (latestValue !== null && previousValue !== null && previousValue !== 0) {
        changePercent = ((latestValue - previousValue) / Math.abs(previousValue)) * 100;
      }

      return {
        indicatorId: seriesId,
        name: seriesConfig.name,
        category: seriesConfig.category,
        latestValue: isNaN(latestValue!) ? null : latestValue,
        previousValue: isNaN(previousValue!) ? null : previousValue,
        changePercent: changePercent !== null && isNaN(changePercent) ? null : changePercent,
        frequency: "variable",
        lastUpdatedAt: new Date(),
        source: "FRED",
        rawJson: {
          realtime_start: "",
          realtime_end: "",
          observation_start: "",
          observation_end: "",
          units: "",
          output_type: 0,
          file_type: "json",
          order_by: "observation_date",
          sort_order: "desc",
          count: observations.length,
          offset: 0,
          limit: 5,
          observations,
        },
      };
    } catch (error) {
      log.error("FRED", `Failed to get indicator data for ${seriesId}`, { error });
      return null;
    }
  }

  async getCriticalIndicators(): Promise<MacroIndicatorData[]> {
    const results: MacroIndicatorData[] = [];

    for (const seriesId of CRITICAL_INDICATORS) {
      const data = await this.getIndicatorData(seriesId);
      if (data) {
        results.push(data);
      }
    }

    log.info("FRED", `Fetched ${results.length}/${CRITICAL_INDICATORS.length} critical indicators`);
    return results;
  }

  async getAllIndicators(): Promise<MacroIndicatorData[]> {
    const results: MacroIndicatorData[] = [];

    for (const seriesId of Object.keys(FRED_SERIES)) {
      const data = await this.getIndicatorData(seriesId);
      if (data) {
        results.push(data);
      }
    }

    log.info("FRED", `Fetched ${results.length}/${Object.keys(FRED_SERIES).length} indicators`);
    return results;
  }

  async getIndicatorsByCategory(category: MacroCategory): Promise<MacroIndicatorData[]> {
    const seriesIds = Object.entries(FRED_SERIES)
      .filter(([_, config]) => config.category === category)
      .map(([id]) => id);

    const results: MacroIndicatorData[] = [];

    for (const seriesId of seriesIds) {
      const data = await this.getIndicatorData(seriesId);
      if (data) {
        results.push(data);
      }
    }

    return results;
  }

  getYieldCurveSpread(): Promise<MacroIndicatorData | null> {
    return this.getIndicatorData("T10Y2Y");
  }

  getVIX(): Promise<MacroIndicatorData | null> {
    return this.getIndicatorData("VIXCLS");
  }

  getFedFundsRate(): Promise<MacroIndicatorData | null> {
    return this.getIndicatorData("FEDFUNDS");
  }

  getUnemploymentRate(): Promise<MacroIndicatorData | null> {
    return this.getIndicatorData("UNRATE");
  }

  getCPI(): Promise<MacroIndicatorData | null> {
    return this.getIndicatorData("CPIAUCSL");
  }

  isConfigured(): boolean {
    return !!this.apiKey;
  }

  getAvailableSeries(): string[] {
    return Object.keys(FRED_SERIES);
  }

  getSeriesMetadata(seriesId: string): { name: string; category: MacroCategory } | null {
    return FRED_SERIES[seriesId] || null;
  }
}

export const fred = new FREDConnector();
