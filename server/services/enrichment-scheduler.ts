import { log } from "../utils/logger";
import { macroIndicatorsService } from "./macro-indicators-service";
import { fundamentalsService } from "../universe/fundamentalsService";
import { db } from "../db";
import { universeTechnicals, universeAssets, universeLiquidityMetrics } from "@shared/schema";
import { eq, and, desc, sql } from "drizzle-orm";
import { finnhub } from "../connectors/finnhub";

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
      macroIntervalHours: this.config.macroIndicatorsIntervalMs / (60 * 60 * 1000),
      fundamentalsIntervalHours: this.config.fundamentalsIntervalMs / (60 * 60 * 1000),
      technicalsIntervalHours: this.config.technicalsIntervalMs / (60 * 60 * 1000),
    });

    this.scheduleJob("macro_indicators", this.config.macroIndicatorsIntervalMs, () =>
      this.runMacroIndicatorsJob()
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
      log.info("EnrichmentScheduler", "Macro indicators empty, running initial sync");
      this.runMacroIndicatorsJob().catch((e) =>
        log.error("EnrichmentScheduler", "Initial macro sync failed", { error: e })
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

  private scheduleJob(name: string, intervalMs: number, job: () => Promise<void>) {
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
      status.lastError = error instanceof Error ? error.message : "Unknown error";
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
      .select({ symbol: universeAssets.symbol })
      .from(universeAssets)
      .where(and(eq(universeAssets.tradable, true), eq(universeAssets.excluded, false)))
      .limit(50);

    let processed = 0;

    for (const { symbol } of assets) {
      try {
        const quote = await finnhub.getQuote(symbol);
        const technicalSignals = await finnhub.getTechnicalSignals(symbol);

        if (quote) {
          const techData: Record<string, unknown> = {
            symbol,
            date: new Date(),
            open: quote.o?.toString(),
            high: quote.h?.toString(),
            low: quote.l?.toString(),
            close: quote.c?.toString(),
            source: "finnhub",
            lastUpdatedAt: new Date(),
          };
          
          if (technicalSignals.adx !== null) {
            techData.adx14 = technicalSignals.adx.toString();
          }
          
          await db
            .insert(universeTechnicals)
            .values(techData as typeof universeTechnicals.$inferInsert)
            .onConflictDoUpdate({
              target: [universeTechnicals.symbol, universeTechnicals.date],
              set: {
                open: quote.o?.toString(),
                high: quote.h?.toString(),
                low: quote.l?.toString(),
                close: quote.c?.toString(),
                adx14: technicalSignals.adx?.toString() || undefined,
                lastUpdatedAt: new Date(),
              },
            });
          processed++;
        }
      } catch (error) {
        log.warn("EnrichmentScheduler", `Failed to fetch technicals for ${symbol}`, { error });
      }
    }

    const status = this.jobStatus.get("technicals");
    if (status) {
      status.itemsProcessed = processed;
    }
  }

  async runJobManually(jobName: string): Promise<{ success: boolean; message: string; statusCode: number }> {
    const status = this.jobStatus.get(jobName);
    if (!status) {
      return { success: false, message: `Unknown job: ${jobName}`, statusCode: 400 };
    }

    if (status.isRunning) {
      return { success: false, message: `Job ${jobName} is already running`, statusCode: 409 };
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
          return { success: false, message: `Unknown job: ${jobName}`, statusCode: 400 };
      }
      return { success: true, message: `Job ${jobName} completed successfully`, statusCode: 200 };
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
