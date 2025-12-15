import { db } from "../../db";
import { backtestRuns, backtestTradeEvents, backtestEquityCurve } from "../../../shared/schema";
import { fetchHistoricalBars, type HistoricalBar } from "./historical-data-service";
import { runSimulation, type StrategySignalGenerator, type SimulationConfig, type StrategySignal } from "./execution-engine";
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

    const signalGenerator = createSignalGenerator(params.strategyConfig, params.initialCash);

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

function createSignalGenerator(
  config: Record<string, unknown>,
  initialCash: number
): StrategySignalGenerator {
  const strategyType = (config.strategyType as string) || "moving-average";
  const fastPeriod = (config.fastPeriod as number) || 7;
  const slowPeriod = (config.slowPeriod as number) || 20;
  const allocationPct = (config.allocationPct as number) || 0.1;
  const symbol = (config.symbol as string) || "";

  if (strategyType === "moving-average") {
    return createMovingAverageCrossoverGenerator(fastPeriod, slowPeriod, allocationPct, initialCash, symbol);
  }

  return {
    onBar: () => [],
  };
}

function createMovingAverageCrossoverGenerator(
  fastPeriod: number,
  slowPeriod: number,
  allocationPct: number,
  initialCash: number,
  targetSymbol: string
): StrategySignalGenerator {
  let previousFastSMA: number | null = null;
  let previousSlowSMA: number | null = null;
  let inPosition = false;

  function calculateSMA(prices: number[], period: number): number | null {
    if (prices.length < period) {
      return null;
    }
    const slice = prices.slice(-period);
    return slice.reduce((a, b) => a + b, 0) / period;
  }

  return {
    onBar(bar: HistoricalBar, barIndex: number, allBarsUpToNow: HistoricalBar[]): StrategySignal[] {
      const signals: StrategySignal[] = [];
      const prices = allBarsUpToNow.map((b) => b.close);

      const fastSMA = calculateSMA(prices, fastPeriod);
      const slowSMA = calculateSMA(prices, slowPeriod);

      if (fastSMA === null || slowSMA === null) {
        previousFastSMA = fastSMA;
        previousSlowSMA = slowSMA;
        return signals;
      }

      if (previousFastSMA !== null && previousSlowSMA !== null) {
        const previousFastAboveSlow = previousFastSMA > previousSlowSMA;
        const currentFastAboveSlow = fastSMA > slowSMA;

        if (!previousFastAboveSlow && currentFastAboveSlow && !inPosition) {
          const allocationAmount = initialCash * allocationPct;
          const qty = Math.floor(allocationAmount / bar.close);

          if (qty > 0) {
            signals.push({
              symbol: targetSymbol || "AAPL",
              side: "buy",
              qty,
              reason: `Bullish crossover: Fast SMA (${fastSMA.toFixed(2)}) crossed above Slow SMA (${slowSMA.toFixed(2)})`,
            });
            inPosition = true;
          }
        }

        if (previousFastAboveSlow && !currentFastAboveSlow && inPosition) {
          signals.push({
            symbol: targetSymbol || "AAPL",
            side: "sell",
            qty: 999999,
            reason: `Bearish crossover: Fast SMA (${fastSMA.toFixed(2)}) crossed below Slow SMA (${slowSMA.toFixed(2)})`,
          });
          inPosition = false;
        }
      }

      previousFastSMA = fastSMA;
      previousSlowSMA = slowSMA;

      return signals;
    },
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
