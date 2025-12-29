import { log } from "../utils/logger";
import { macroIndicatorsService } from "./macro-indicators-service";
import { fundamentalsService } from "../universe/fundamentalsService";
import { db } from "../db";
import {
  universeTechnicals,
  brokerAssets,
  universeLiquidityMetrics,
} from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { finnhub } from "../connectors/finnhub";
import { alpaca, type AlpacaBar } from "../connectors/alpaca";
import {
  computeAllIndicators,
  type OHLCBar,
} from "../lib/technical-indicators";

interface EnrichmentJobStatus {
  name: string;
  lastRun: Date | null;
  lastSuccess: boolean;
  nextRun: Date | null;
  isRunning: boolean;
  lastError?: string;
  itemsProcessed?: number;
}

interface EnrichmentConfig {
  macroIndicatorsIntervalMs: number;
  fundamentalsIntervalMs: number;
  technicalsIntervalMs: number;
  enabled: boolean;
}

const DEFAULT_CONFIG: EnrichmentConfig = {
  macroIndicatorsIntervalMs: 4 * 60 * 60 * 1000,
  fundamentalsIntervalMs: 24 * 60 * 60 * 1000,
  technicalsIntervalMs: 60 * 60 * 1000,
  enabled: true,
};

class EnrichmentScheduler {
  private config: EnrichmentConfig = DEFAULT_CONFIG;
  private intervals: Map<string, ReturnType<typeof setInterval>> = new Map();
  private jobStatus: Map<string, EnrichmentJobStatus> = new Map();
  private isStarted = false;

  constructor() {
    this.initJobStatus();
  }

  private initJobStatus() {
    const jobs = ["macro_indicators", "fundamentals", "technicals"];
    for (const job of jobs) {
      this.jobStatus.set(job, {
        name: job,
        lastRun: null,
        lastSuccess: false,
        nextRun: null,
        isRunning: false,
      });
    }
  }

  start() {
    if (this.isStarted) {
      log.warn("EnrichmentScheduler", "Scheduler already started");
      return;
    }

    if (!this.config.enabled) {
      log.info("EnrichmentScheduler", "Scheduler disabled by config");
      return;
    }

    log.info("EnrichmentScheduler", "Starting enrichment scheduler", {
      macroIntervalHours:
        this.config.macroIndicatorsIntervalMs / (60 * 60 * 1000),
      fundamentalsIntervalHours:
        this.config.fundamentalsIntervalMs / (60 * 60 * 1000),
      technicalsIntervalHours:
        this.config.technicalsIntervalMs / (60 * 60 * 1000),
    });

    this.scheduleJob(
      "macro_indicators",
      this.config.macroIndicatorsIntervalMs,
      () => this.runMacroIndicatorsJob()
    );
    this.scheduleJob("fundamentals", this.config.fundamentalsIntervalMs, () =>
      this.runFundamentalsJob()
    );
    this.scheduleJob("technicals", this.config.technicalsIntervalMs, () =>
      this.runTechnicalsJob()
    );

    this.isStarted = true;

    setTimeout(() => this.runInitialEnrichment(), 30000);
  }

  private async runInitialEnrichment() {
    log.info("EnrichmentScheduler", "Running initial enrichment check");

    const [macroCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(sql`macro_indicators`);

    if (Number(macroCount?.count || 0) === 0) {
      log.info(
        "EnrichmentScheduler",
        "Macro indicators empty, running initial sync"
      );
      this.runMacroIndicatorsJob().catch((e) =>
        log.error("EnrichmentScheduler", "Initial macro sync failed", {
          error: e,
        })
      );
    }

    const [technicalsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(universeTechnicals);

    const [brokerAssetsCount] = await db
      .select({ count: sql<number>`count(*)` })
      .from(brokerAssets)
      .where(eq(brokerAssets.tradable, true));

    const techCount = Number(technicalsCount?.count || 0);
    const assetCount = Number(brokerAssetsCount?.count || 0);
    const coverageThreshold = Math.min(assetCount, 50) * 0.5;

    if (techCount < coverageThreshold) {
      log.info(
        "EnrichmentScheduler",
        "Technicals coverage low, running initial sync",
        {
          currentCount: techCount,
          threshold: coverageThreshold,
          brokerAssets: assetCount,
        }
      );
      this.runTechnicalsJob().catch((e) =>
        log.error("EnrichmentScheduler", "Initial technicals sync failed", {
          error: e,
        })
      );
    }
  }

  stop() {
    log.info("EnrichmentScheduler", "Stopping enrichment scheduler");
    for (const [name, interval] of this.intervals) {
      clearInterval(interval);
      log.info("EnrichmentScheduler", `Stopped job: ${name}`);
    }
    this.intervals.clear();
    this.isStarted = false;
  }

  private scheduleJob(
    name: string,
    intervalMs: number,
    job: () => Promise<void>
  ) {
    const status = this.jobStatus.get(name);
    if (status) {
      status.nextRun = new Date(Date.now() + intervalMs);
    }

    const interval = setInterval(async () => {
      await this.executeJob(name, job);
    }, intervalMs);

    this.intervals.set(name, interval);
    log.info("EnrichmentScheduler", `Scheduled job: ${name}`, { intervalMs });
  }

  private async executeJob(name: string, job: () => Promise<void>) {
    const status = this.jobStatus.get(name);
    if (!status) return;

    if (status.isRunning) {
      log.warn("EnrichmentScheduler", `Job ${name} already running, skipping`);
      return;
    }

    status.isRunning = true;
    status.lastRun = new Date();

    try {
      log.info("EnrichmentScheduler", `Starting job: ${name}`);
      await job();
      status.lastSuccess = true;
      status.lastError = undefined;
      log.info("EnrichmentScheduler", `Completed job: ${name}`);
    } catch (error) {
      status.lastSuccess = false;
      status.lastError =
        error instanceof Error ? error.message : "Unknown error";
      log.error("EnrichmentScheduler", `Failed job: ${name}`, { error });
    } finally {
      status.isRunning = false;
      const intervalMs = this.getIntervalForJob(name);
      status.nextRun = new Date(Date.now() + intervalMs);
    }
  }

  private getIntervalForJob(name: string): number {
    switch (name) {
      case "macro_indicators":
        return this.config.macroIndicatorsIntervalMs;
      case "fundamentals":
        return this.config.fundamentalsIntervalMs;
      case "technicals":
        return this.config.technicalsIntervalMs;
      default:
        return 60 * 60 * 1000;
    }
  }

  async runMacroIndicatorsJob(): Promise<void> {
    const result = await macroIndicatorsService.refreshAllIndicators();
    const status = this.jobStatus.get("macro_indicators");
    if (status) {
      status.itemsProcessed = result.updated;
    }
  }

  async runFundamentalsJob(): Promise<void> {
    const result = await fundamentalsService.fetchAndStoreFundamentals({
      batchSize: 10,
      traceId: `enrichment-${Date.now()}`,
    });
    const status = this.jobStatus.get("fundamentals");
    if (status) {
      status.itemsProcessed = result.computed;
    }
  }

  async runTechnicalsJob(): Promise<void> {
    const assets = await db
      .select({
        symbol: brokerAssets.symbol,
        assetClass: brokerAssets.assetClass,
      })
      .from(brokerAssets)
      .where(eq(brokerAssets.tradable, true))
      .limit(50);

    let processed = 0;
    const endDate = new Date();
    const startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const { symbol, assetClass } of assets) {
      try {
        const barsResponse = await alpaca.getBars(
          [symbol],
          "1Day",
          startDate.toISOString().split("T")[0],
          endDate.toISOString().split("T")[0],
          400
        );

        const bars = barsResponse.bars[symbol];
        if (!bars || bars.length < 200) {
          log.warn(
            "EnrichmentScheduler",
            `Insufficient bars for ${symbol}: ${bars?.length || 0}`
          );
          continue;
        }

        const ohlcBars: OHLCBar[] = bars.map((b: AlpacaBar) => ({
          open: b.o,
          high: b.h,
          low: b.l,
          close: b.c,
          volume: b.v,
        }));

        const indicators = computeAllIndicators(ohlcBars);
        if (!indicators) {
          continue;
        }

        const lastBar = bars[bars.length - 1];
        const technicalSignals = await finnhub
          .getTechnicalSignals(symbol)
          .catch(() => ({ adx: null }));

        await db
          .insert(universeTechnicals)
          .values({
            symbol,
            date: today,
            open: lastBar.o?.toString(),
            high: lastBar.h?.toString(),
            low: lastBar.l?.toString(),
            close: lastBar.c?.toString(),
            volume: lastBar.v?.toString(),
            sma20: indicators.sma20?.toString(),
            sma50: indicators.sma50?.toString(),
            sma200: indicators.sma200?.toString(),
            ema12: indicators.ema12?.toString(),
            ema26: indicators.ema26?.toString(),
            rsi14: indicators.rsi14?.toString(),
            macd: indicators.macd?.toString(),
            macdSignal: indicators.macdSignal?.toString(),
            macdHistogram: indicators.macdHistogram?.toString(),
            atr14: indicators.atr14?.toString(),
            bollingerUpper: indicators.bollingerUpper?.toString(),
            bollingerLower: indicators.bollingerLower?.toString(),
            adx14: technicalSignals.adx?.toString(),
            source: "alpaca+computed",
            lastUpdatedAt: new Date(),
          } as typeof universeTechnicals.$inferInsert)
          .onConflictDoUpdate({
            target: [universeTechnicals.symbol, universeTechnicals.date],
            set: {
              open: lastBar.o?.toString(),
              high: lastBar.h?.toString(),
              low: lastBar.l?.toString(),
              close: lastBar.c?.toString(),
              volume: lastBar.v?.toString(),
              sma20: indicators.sma20?.toString(),
              sma50: indicators.sma50?.toString(),
              sma200: indicators.sma200?.toString(),
              ema12: indicators.ema12?.toString(),
              ema26: indicators.ema26?.toString(),
              rsi14: indicators.rsi14?.toString(),
              macd: indicators.macd?.toString(),
              macdSignal: indicators.macdSignal?.toString(),
              macdHistogram: indicators.macdHistogram?.toString(),
              atr14: indicators.atr14?.toString(),
              bollingerUpper: indicators.bollingerUpper?.toString(),
              bollingerLower: indicators.bollingerLower?.toString(),
              adx14: technicalSignals.adx?.toString(),
              lastUpdatedAt: new Date(),
            },
          });
        processed++;
        log.info("EnrichmentScheduler", `Computed technicals for ${symbol}`, {
          rsi14: indicators.rsi14?.toFixed(2),
          sma20: indicators.sma20?.toFixed(2),
        });
      } catch (error) {
        const errorDetails =
          error instanceof Error
            ? {
                message: error.message,
                name: error.name,
                stack: error.stack?.split("\n").slice(0, 3).join(" | "),
              }
            : { raw: String(error) };
        log.warn(
          "EnrichmentScheduler",
          `Failed to compute technicals for ${symbol}`,
          errorDetails
        );
      }
    }

    const status = this.jobStatus.get("technicals");
    if (status) {
      status.itemsProcessed = processed;
    }
  }

  async runJobManually(
    jobName: string
  ): Promise<{ success: boolean; message: string; statusCode: number }> {
    const status = this.jobStatus.get(jobName);
    if (!status) {
      return {
        success: false,
        message: `Unknown job: ${jobName}`,
        statusCode: 400,
      };
    }

    if (status.isRunning) {
      return {
        success: false,
        message: `Job ${jobName} is already running`,
        statusCode: 409,
      };
    }

    try {
      switch (jobName) {
        case "macro_indicators":
          await this.executeJob(jobName, () => this.runMacroIndicatorsJob());
          break;
        case "fundamentals":
          await this.executeJob(jobName, () => this.runFundamentalsJob());
          break;
        case "technicals":
          await this.executeJob(jobName, () => this.runTechnicalsJob());
          break;
        default:
          return {
            success: false,
            message: `Unknown job: ${jobName}`,
            statusCode: 400,
          };
      }
      return {
        success: true,
        message: `Job ${jobName} completed successfully`,
        statusCode: 200,
      };
    } catch (error) {
      return {
        success: false,
        message: error instanceof Error ? error.message : "Unknown error",
        statusCode: 500,
      };
    }
  }

  getStatus(): EnrichmentJobStatus[] {
    return Array.from(this.jobStatus.values());
  }

  getJobStatus(name: string): EnrichmentJobStatus | undefined {
    return this.jobStatus.get(name);
  }

  updateConfig(config: Partial<EnrichmentConfig>) {
    this.config = { ...this.config, ...config };
    log.info("EnrichmentScheduler", "Config updated", { config: this.config });

    if (this.isStarted) {
      this.stop();
      this.start();
    }
  }
}

export const enrichmentScheduler = new EnrichmentScheduler();
