import { db } from "../db";
import { macroIndicators } from "@shared/schema";
import { eq } from "drizzle-orm";
import {
  fred,
  MacroIndicatorData,
  MacroCategory,
  FRED_SERIES,
} from "../connectors/fred";
import { log } from "../utils/logger";

export interface MacroDataSummary {
  totalIndicators: number;
  lastUpdated: Date;
  byCategory: Record<MacroCategory, number>;
  criticalAlerts: MacroAlert[];
}

export interface MacroAlert {
  indicatorId: string;
  name: string;
  type:
    | "yield_curve_inversion"
    | "high_volatility"
    | "rate_change"
    | "inflation_spike";
  severity: "low" | "medium" | "high";
  message: string;
  value: number;
  threshold: number;
}

class MacroIndicatorsService {
  async refreshAllIndicators(): Promise<{
    success: boolean;
    updated: number;
    failed: number;
    errors: string[];
  }> {
    log.info(
      "MacroIndicatorsService",
      "Starting full macro indicators refresh from FRED"
    );

    const allData = await fred.getAllIndicators();
    let updated = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const data of allData) {
      try {
        await this.upsertIndicator(data);
        updated++;
      } catch (error) {
        failed++;
        errors.push(
          `${data.indicatorId}: ${error instanceof Error ? error.message : "Unknown error"}`
        );
      }
    }

    log.info(
      "MacroIndicatorsService",
      `Refresh complete: ${updated} updated, ${failed} failed`
    );

    return { success: failed === 0, updated, failed, errors };
  }

  async refreshCriticalIndicators(): Promise<{
    success: boolean;
    updated: number;
    data: MacroIndicatorData[];
  }> {
    log.info(
      "MacroIndicatorsService",
      "Refreshing critical macro indicators from FRED"
    );

    const criticalData = await fred.getCriticalIndicators();
    let updated = 0;

    for (const data of criticalData) {
      try {
        await this.upsertIndicator(data);
        updated++;
      } catch (error) {
        log.error(
          "MacroIndicatorsService",
          `Failed to upsert ${data.indicatorId}`,
          { error }
        );
      }
    }

    return { success: true, updated, data: criticalData };
  }

  private async upsertIndicator(data: MacroIndicatorData): Promise<void> {
    const existing = await db
      .select()
      .from(macroIndicators)
      .where(eq(macroIndicators.indicatorId, data.indicatorId))
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(macroIndicators)
        .set({
          latestValue: data.latestValue?.toString() || null,
          previousValue: data.previousValue?.toString() || null,
          changePercent: data.changePercent?.toString() || null,
          lastUpdatedAt: new Date(),
          rawJson: data.rawJson,
        })
        .where(eq(macroIndicators.indicatorId, data.indicatorId));
    } else {
      await db.insert(macroIndicators).values({
        indicatorId: data.indicatorId,
        name: data.name,
        category: data.category,
        latestValue: data.latestValue?.toString() || null,
        previousValue: data.previousValue?.toString() || null,
        changePercent: data.changePercent?.toString() || null,
        frequency: data.frequency,
        lastUpdatedAt: new Date(),
        source: "FRED",
        rawJson: data.rawJson,
      });
    }
  }

  async getLatestIndicators(): Promise<
    (typeof macroIndicators.$inferSelect)[]
  > {
    return db
      .select()
      .from(macroIndicators)
      .orderBy(macroIndicators.lastUpdatedAt);
  }

  async getIndicatorsByCategory(
    category: MacroCategory
  ): Promise<(typeof macroIndicators.$inferSelect)[]> {
    return db
      .select()
      .from(macroIndicators)
      .where(eq(macroIndicators.category, category));
  }

  async getIndicator(
    indicatorId: string
  ): Promise<typeof macroIndicators.$inferSelect | null> {
    const result = await db
      .select()
      .from(macroIndicators)
      .where(eq(macroIndicators.indicatorId, indicatorId))
      .limit(1);

    return result[0] || null;
  }

  async getMacroSummary(): Promise<MacroDataSummary> {
    const all = await this.getLatestIndicators();

    const byCategory: Record<MacroCategory, number> = {
      treasury_yields: 0,
      inflation: 0,
      employment: 0,
      volatility: 0,
      interest_rates: 0,
      money_supply: 0,
      gdp: 0,
      consumer: 0,
      housing: 0,
      manufacturing: 0,
    };

    for (const indicator of all) {
      const cat = indicator.category as MacroCategory;
      if (cat in byCategory) {
        byCategory[cat]++;
      }
    }

    const criticalAlerts = this.detectAlerts(all);

    return {
      totalIndicators: all.length,
      lastUpdated: all.length > 0 ? all[0].lastUpdatedAt : new Date(),
      byCategory,
      criticalAlerts,
    };
  }

  private detectAlerts(
    indicators: (typeof macroIndicators.$inferSelect)[]
  ): MacroAlert[] {
    const alerts: MacroAlert[] = [];

    for (const indicator of indicators) {
      const value = parseFloat(indicator.latestValue || "0");

      if (indicator.indicatorId === "T10Y2Y" && value < 0) {
        alerts.push({
          indicatorId: indicator.indicatorId,
          name: indicator.name,
          type: "yield_curve_inversion",
          severity: "high",
          message: "Yield curve is inverted - potential recession signal",
          value,
          threshold: 0,
        });
      }

      if (indicator.indicatorId === "VIXCLS" && value > 30) {
        alerts.push({
          indicatorId: indicator.indicatorId,
          name: indicator.name,
          type: "high_volatility",
          severity: value > 40 ? "high" : "medium",
          message: `VIX at ${value.toFixed(2)} indicates elevated market fear`,
          value,
          threshold: 30,
        });
      }

      if (indicator.indicatorId === "CPIAUCSL") {
        const change = parseFloat(indicator.changePercent || "0");
        if (Math.abs(change) > 0.5) {
          alerts.push({
            indicatorId: indicator.indicatorId,
            name: indicator.name,
            type: "inflation_spike",
            severity: Math.abs(change) > 1 ? "high" : "medium",
            message: `CPI changed ${change.toFixed(2)}% - notable inflation movement`,
            value: change,
            threshold: 0.5,
          });
        }
      }

      if (indicator.indicatorId === "FEDFUNDS") {
        const change = parseFloat(indicator.changePercent || "0");
        if (Math.abs(change) > 5) {
          alerts.push({
            indicatorId: indicator.indicatorId,
            name: indicator.name,
            type: "rate_change",
            severity: "high",
            message: `Fed Funds rate changed significantly (${change.toFixed(2)}%)`,
            value: change,
            threshold: 5,
          });
        }
      }
    }

    return alerts;
  }

  getMarketRegimeFromMacro(
    indicators: (typeof macroIndicators.$inferSelect)[]
  ): {
    regime: "risk_on" | "risk_off" | "neutral" | "uncertain";
    confidence: number;
    signals: string[];
  } {
    const signals: string[] = [];
    let riskOnScore = 0;
    let riskOffScore = 0;

    for (const indicator of indicators) {
      const value = parseFloat(indicator.latestValue || "0");

      if (indicator.indicatorId === "VIXCLS") {
        if (value < 15) {
          riskOnScore += 2;
          signals.push("Low VIX indicates market complacency");
        } else if (value > 25) {
          riskOffScore += 2;
          signals.push("Elevated VIX indicates fear");
        }
      }

      if (indicator.indicatorId === "T10Y2Y") {
        if (value < 0) {
          riskOffScore += 3;
          signals.push("Yield curve inversion - recession warning");
        } else if (value > 1) {
          riskOnScore += 1;
          signals.push("Steep yield curve - healthy growth outlook");
        }
      }

      if (indicator.indicatorId === "UMCSENT") {
        if (value > 80) {
          riskOnScore += 1;
          signals.push("Strong consumer sentiment");
        } else if (value < 60) {
          riskOffScore += 1;
          signals.push("Weak consumer sentiment");
        }
      }
    }

    const totalScore = Math.abs(riskOnScore - riskOffScore);
    const confidence = Math.min(totalScore * 0.15, 1);

    let regime: "risk_on" | "risk_off" | "neutral" | "uncertain";
    if (riskOnScore > riskOffScore + 2) {
      regime = "risk_on";
    } else if (riskOffScore > riskOnScore + 2) {
      regime = "risk_off";
    } else if (indicators.length < 3) {
      regime = "uncertain";
    } else {
      regime = "neutral";
    }

    return { regime, confidence, signals };
  }

  isConfigured(): boolean {
    return fred.isConfigured();
  }
}

export const macroIndicatorsService = new MacroIndicatorsService();
