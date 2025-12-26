import { db } from "../../db";
import { backtestRuns, backtestTradeEvents, backtestEquityCurve } from "@shared/schema";
import { fetchHistoricalBars, type HistoricalBar } from "./historical-data-service";
import { runSimulation, type StrategySignalGenerator, type SimulationConfig, type StrategySignal } from "./execution-engine";
import { createStrategy, type StrategyType, type StrategyConfig } from "./strategies";
import type { BacktestRun, FeesModel, SlippageModel, ExecutionPriceRule } from "../../../shared/types/backtesting";
import { eq, desc } from "drizzle-orm";
import { log } from "../../utils/logger";
import crypto from "crypto";

export interface RunBacktestParams {
  strategyId?: string;
  strategyConfig: Record<string, unknown>;
  universe: string[];
  timeframe: string;
  startDate: string;
  endDate: string;
  initialCash: number;
  feesModel: { type: "fixed" | "percentage"; value: number };
  slippageModel: { type: "bps" | "spread_proxy"; value: number };
  executionPriceRule: "NEXT_OPEN" | "NEXT_CLOSE";
  strategyType?: StrategyType;
  strategyParams?: Record<string, number>;
}

function hashConfig(config: Record<string, unknown>): string {
  const sorted = JSON.stringify(config, Object.keys(config).sort());
  return crypto.createHash("sha256").update(sorted).digest("hex").substring(0, 16);
}

export async function runBacktest(params: RunBacktestParams): Promise<BacktestRun> {
  const startTime = Date.now();
  const configHash = hashConfig(params.strategyConfig);

  log.info("BacktestRunner", `Starting backtest for ${params.universe.length} symbols from ${params.startDate} to ${params.endDate}`);

  const [insertedRun] = await db
    .insert(backtestRuns)
    .values({
      status: "QUEUED",
      strategyId: params.strategyId || null,
      strategyConfigHash: configHash,
      strategyConfig: params.strategyConfig,
      universe: params.universe,
      broker: "alpaca",
      timeframe: params.timeframe,
      startDate: params.startDate,
      endDate: params.endDate,
      initialCash: params.initialCash.toString(),
      feesModel: params.feesModel,
      slippageModel: params.slippageModel,
      executionPriceRule: params.executionPriceRule,
      dataSource: "alpaca",
    })
    .returning();

  const runId = insertedRun.id;

  try {
    await db
      .update(backtestRuns)
      .set({ status: "RUNNING", updatedAt: new Date() })
      .where(eq(backtestRuns.id, runId));

    log.info("BacktestRunner", `Fetching historical data for run ${runId}`);

    const { bars, provenance } = await fetchHistoricalBars({
      symbols: params.universe,
      timeframe: params.timeframe,
      startDate: params.startDate,
      endDate: params.endDate,
    });

    const totalBars = Object.values(bars).reduce((sum, arr) => sum + arr.length, 0);
    log.info("BacktestRunner", `Fetched ${totalBars} total bars for ${params.universe.length} symbols`);

    // Validate that we have data to work with
    if (totalBars === 0) {
      const symbolsWithData = Object.entries(bars)
        .filter(([_, symbolBars]) => symbolBars.length > 0)
        .map(([symbol]) => symbol);
      const symbolsWithoutData = params.universe.filter(s => !symbolsWithData.includes(s));
      
      throw new Error(
        `No historical data found for the specified date range (${params.startDate} to ${params.endDate}). ` +
        `Symbols without data: ${symbolsWithoutData.join(', ')}. ` +
        `Please verify the date range is valid and the symbols are active.`
      );
    }

    // Log per-symbol data availability
    for (const symbol of params.universe) {
      const symbolBars = bars[symbol] || [];
      if (symbolBars.length === 0) {
        log.warn("BacktestRunner", `No bars fetched for symbol ${symbol} - it may be inactive or date range invalid`);
      } else {
        log.debug("BacktestRunner", `Symbol ${symbol}: ${symbolBars.length} bars`);
      }
    }

    const strategyConfig: StrategyConfig = {
      type: params.strategyType || 'moving_average_crossover',
      params: params.strategyParams || { allocationPct: 10, fastPeriod: 10, slowPeriod: 20 }
    };
    const signalGenerator = createStrategy(strategyConfig, params.universe, params.initialCash);

    const simConfig: SimulationConfig = {
      runId,
      initialCash: params.initialCash,
      feesModel: params.feesModel as FeesModel,
      slippageModel: params.slippageModel as SlippageModel,
      executionPriceRule: params.executionPriceRule as ExecutionPriceRule,
    };

    log.info("BacktestRunner", `Running simulation for run ${runId}`);
    const result = runSimulation(bars, signalGenerator, simConfig);

    if (!result || !result.metrics) {
      throw new Error("Simulation returned invalid results: metrics are null or undefined");
    }

    const metrics = result.metrics;
    if (
      typeof metrics.totalReturnPct !== "number" ||
      typeof metrics.maxDrawdownPct !== "number" ||
      typeof metrics.winRatePct !== "number" ||
      typeof metrics.totalTrades !== "number"
    ) {
      throw new Error(
        `Metrics calculation failed: invalid metric values - ` +
        `totalReturnPct=${metrics.totalReturnPct}, maxDrawdownPct=${metrics.maxDrawdownPct}, ` +
        `winRatePct=${metrics.winRatePct}, totalTrades=${metrics.totalTrades}`
      );
    }

    if (result.trades.length > 0) {
      const tradeInserts = result.trades.map((trade) => ({
        runId: trade.runId,
        ts: new Date(trade.ts),
        symbol: trade.symbol,
        side: trade.side,
        qty: trade.qty.toString(),
        price: trade.price.toString(),
        reason: trade.reason,
        orderType: trade.orderType,
        fees: trade.fees.toString(),
        slippage: trade.slippage.toString(),
        positionAfter: trade.positionAfter.toString(),
        cashAfter: trade.cashAfter.toString(),
      }));

      const BATCH_SIZE = 100;
      for (let i = 0; i < tradeInserts.length; i += BATCH_SIZE) {
        const batch = tradeInserts.slice(i, i + BATCH_SIZE);
        await db.insert(backtestTradeEvents).values(batch);
      }

      log.info("BacktestRunner", `Persisted ${result.trades.length} trade events`);
    }

    if (result.equityCurve.length > 0) {
      const sampleRate = Math.max(1, Math.floor(result.equityCurve.length / 1000));
      const sampledEquity = result.equityCurve.filter((_, i) => i % sampleRate === 0);

      const equityInserts = sampledEquity.map((point) => ({
        runId: point.runId,
        ts: new Date(point.ts),
        equity: point.equity.toString(),
        cash: point.cash.toString(),
        exposure: point.exposure.toString(),
      }));

      const BATCH_SIZE = 100;
      for (let i = 0; i < equityInserts.length; i += BATCH_SIZE) {
        const batch = equityInserts.slice(i, i + BATCH_SIZE);
        await db.insert(backtestEquityCurve).values(batch);
      }

      log.info("BacktestRunner", `Persisted ${equityInserts.length} equity curve points (sampled from ${result.equityCurve.length})`);
    }

    const runtimeMs = Date.now() - startTime;

    const [updatedRun] = await db
      .update(backtestRuns)
      .set({
        status: "DONE",
        provenance,
        resultsSummary: result.metrics,
        runtimeMs,
        updatedAt: new Date(),
      })
      .where(eq(backtestRuns.id, runId))
      .returning();

    log.info("BacktestRunner", `Backtest ${runId} completed in ${runtimeMs}ms with ${result.trades.length} trades`);

    return mapToBacktestRun(updatedRun);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log.error("BacktestRunner", `Backtest ${runId} failed: ${errorMessage}`);

    const [failedRun] = await db
      .update(backtestRuns)
      .set({
        status: "FAILED",
        errorMessage,
        runtimeMs: Date.now() - startTime,
        updatedAt: new Date(),
      })
      .where(eq(backtestRuns.id, runId))
      .returning();

    return mapToBacktestRun(failedRun);
  }
}

function mapToBacktestRun(row: typeof backtestRuns.$inferSelect): BacktestRun {
  return {
    id: row.id,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    status: row.status as BacktestRun["status"],
    strategyId: row.strategyId,
    strategyConfigHash: row.strategyConfigHash,
    strategyConfig: row.strategyConfig as Record<string, unknown>,
    universe: row.universe,
    broker: row.broker,
    timeframe: row.timeframe,
    startDate: row.startDate,
    endDate: row.endDate,
    initialCash: parseFloat(row.initialCash),
    feesModel: row.feesModel as BacktestRun["feesModel"],
    slippageModel: row.slippageModel as BacktestRun["slippageModel"],
    executionPriceRule: row.executionPriceRule as BacktestRun["executionPriceRule"],
    dataSource: row.dataSource,
    provenance: row.provenance as BacktestRun["provenance"],
    resultsSummary: row.resultsSummary as BacktestRun["resultsSummary"],
    errorMessage: row.errorMessage,
    runtimeMs: row.runtimeMs,
  };
}

export async function getBacktestRun(runId: string): Promise<BacktestRun | null> {
  const [run] = await db
    .select()
    .from(backtestRuns)
    .where(eq(backtestRuns.id, runId))
    .limit(1);

  if (!run) {
    return null;
  }

  return mapToBacktestRun(run);
}

export async function listBacktestRuns(limit: number = 20, offset: number = 0): Promise<BacktestRun[]> {
  const runs = await db
    .select()
    .from(backtestRuns)
    .orderBy(desc(backtestRuns.createdAt))
    .limit(limit)
    .offset(offset);

  return runs.map(mapToBacktestRun);
}
