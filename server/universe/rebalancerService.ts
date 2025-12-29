import { db } from "../db";
import { rebalanceRuns, universeCandidates } from "@shared/schema";
import type { InsertRebalanceRun, RebalanceRun } from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import { allocationService, type RebalanceIntent } from "./allocationService";
import { tradingEnforcementService } from "./tradingEnforcement";
import { workQueue, generateIdempotencyKey } from "../lib/work-queue";
import { alpaca } from "../connectors/alpaca";
import { log } from "../utils/logger";

export interface RebalanceExecutionResult {
  runId: string;
  traceId: string;
  success: boolean;
  intentsGenerated: number;
  ordersSubmitted: number;
  ordersSkipped: number;
  errors: string[];
  duration: number;
}

export interface ProfitTakingAnalysis {
  symbol: string;
  costBasis: number;
  currentValue: number;
  unrealizedPnlPct: number;
  recommendedTrimPct: number;
  reason: string;
}

class RebalancerService {
  async executeDryRun(traceId: string): Promise<{
    analysis: Awaited<ReturnType<typeof allocationService.analyzeRebalance>>;
    profitTaking: ProfitTakingAnalysis[];
    wouldSubmit: number;
    wouldSkip: number;
  } | null> {
    log.info("RebalancerService", "Starting dry run analysis", { traceId });

    const analysis = await allocationService.analyzeRebalance(traceId);
    if (!analysis) {
      log.info("RebalancerService", "No active policy - cannot analyze", {
        traceId,
      });
      return null;
    }

    const profitTaking = await this.analyzeProfitTaking(
      analysis.policy,
      traceId
    );

    let wouldSubmit = 0;
    let wouldSkip = 0;

    for (const intent of analysis.intents) {
      if (intent.action === "HOLD") {
        wouldSkip++;
        continue;
      }

      const enforcement = await tradingEnforcementService.canTradeSymbol(
        intent.symbol,
        traceId
      );
      if (intent.action === "SELL" || enforcement.eligible) {
        wouldSubmit++;
      } else {
        wouldSkip++;
      }
    }

    log.info("RebalancerService", "Dry run complete", {
      traceId,
      wouldSubmit,
      wouldSkip,
    });

    return {
      analysis,
      profitTaking,
      wouldSubmit,
      wouldSkip,
    };
  }

  async executeRebalance(
    traceId: string,
    dryRun = false
  ): Promise<RebalanceExecutionResult> {
    const startTime = Date.now();
    log.info("RebalancerService", "Starting rebalance execution", {
      traceId,
      dryRun,
    });

    const analysis = await allocationService.analyzeRebalance(traceId);
    if (!analysis) {
      return {
        runId: "",
        traceId,
        success: false,
        intentsGenerated: 0,
        ordersSubmitted: 0,
        ordersSkipped: 0,
        errors: ["No active allocation policy configured"],
        duration: Date.now() - startTime,
      };
    }

    const run = await allocationService.createRebalanceRun({
      policyId: analysis.policy.id,
      traceId,
      status: "pending",
      triggerType: dryRun ? "manual_dry_run" : "manual",
      inputSnapshot: {
        portfolioValue: analysis.portfolioValue,
        approvedSymbolCount: analysis.approvedSymbols.length,
        currentPositionCount: analysis.currentPositions.size,
      },
      orderIntents: analysis.intents,
    });

    if (dryRun) {
      await allocationService.updateRebalanceRun(run.id, {
        status: "dry_run_complete",
        completedAt: new Date(),
        rationale: `Dry run: ${analysis.intents.length} intents generated, no orders submitted`,
      });

      return {
        runId: run.id,
        traceId,
        success: true,
        intentsGenerated: analysis.intents.length,
        ordersSubmitted: 0,
        ordersSkipped: analysis.intents.length,
        errors: [],
        duration: Date.now() - startTime,
      };
    }

    await allocationService.updateRebalanceRun(run.id, { status: "executing" });

    const errors: string[] = [];
    let ordersSubmitted = 0;
    let ordersSkipped = 0;
    const executedOrders: {
      symbol: string;
      workItemId: string;
      side: string;
    }[] = [];

    const sellIntents = analysis.intents.filter(
      (i) => i.action === "SELL" || i.action === "TRIM"
    );
    const buyIntents = analysis.intents.filter((i) => i.action === "BUY");

    for (const intent of sellIntents) {
      if (Math.abs(intent.notionalDelta) < 10) {
        ordersSkipped++;
        continue;
      }

      try {
        const enforcement = await tradingEnforcementService.canTradeSymbol(
          intent.symbol,
          traceId
        );

        if (intent.action === "SELL" || enforcement.eligible) {
          const currentPos = analysis.currentPositions.get(intent.symbol);
          if (!currentPos) {
            ordersSkipped++;
            continue;
          }

          const sellValue = Math.abs(intent.notionalDelta);
          let price = 0;
          try {
            const snapshots = await alpaca.getSnapshots([intent.symbol]);
            const snapshot = snapshots?.[intent.symbol];
            price = snapshot?.latestTrade?.p || snapshot?.latestQuote?.ap || 0;
          } catch (e) {
            log.warn("RebalancerService", "Failed to get snapshot", {
              traceId,
              symbol: intent.symbol,
            });
          }
          if (!price || price <= 0 || !isFinite(price)) {
            errors.push(`${intent.symbol}: Could not get valid price`);
            ordersSkipped++;
            continue;
          }

          const rawQtyToSell = Math.floor(sellValue / price);
          const qtyToSell = Math.min(rawQtyToSell, currentPos.qty);
          if (qtyToSell < 1) {
            ordersSkipped++;
            continue;
          }

          const idempotencyKey = generateIdempotencyKey({
            strategyId: `rebalance-${run.id}`,
            symbol: intent.symbol,
            side: "sell",
          });

          const workItem = await workQueue.enqueue({
            type: "ORDER_SUBMIT",
            symbol: intent.symbol,
            idempotencyKey,
            payload: JSON.stringify({
              symbol: intent.symbol,
              side: "sell",
              qty: qtyToSell.toString(),
              type: "market",
              time_in_force: "day",
              traceId,
            }),
            maxAttempts: 3,
          });

          executedOrders.push({
            symbol: intent.symbol,
            workItemId: workItem.id,
            side: "sell",
          });
          ordersSubmitted++;
        } else {
          ordersSkipped++;
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`${intent.symbol}: ${msg}`);
        ordersSkipped++;
      }
    }

    for (const intent of buyIntents) {
      if (
        !intent.notionalDelta ||
        !isFinite(intent.notionalDelta) ||
        intent.notionalDelta < 10
      ) {
        ordersSkipped++;
        continue;
      }

      try {
        const enforcement = await tradingEnforcementService.canTradeSymbol(
          intent.symbol,
          traceId
        );

        if (!enforcement.eligible) {
          log.info("RebalancerService", "Skipping BUY", {
            traceId,
            symbol: intent.symbol,
            reason: enforcement.reason,
          });
          ordersSkipped++;
          continue;
        }

        const idempotencyKey = generateIdempotencyKey({
          strategyId: `rebalance-${run.id}`,
          symbol: intent.symbol,
          side: "buy",
        });

        const workItem = await workQueue.enqueue({
          type: "ORDER_SUBMIT",
          symbol: intent.symbol,
          idempotencyKey,
          payload: JSON.stringify({
            symbol: intent.symbol,
            side: "buy",
            notional: intent.notionalDelta.toFixed(2),
            type: "market",
            time_in_force: "day",
            traceId,
          }),
          maxAttempts: 3,
        });

        executedOrders.push({
          symbol: intent.symbol,
          workItemId: workItem.id,
          side: "buy",
        });
        ordersSubmitted++;
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`${intent.symbol}: ${msg}`);
        ordersSkipped++;
      }
    }

    const holdIntents = analysis.intents.filter(
      (i) => i.action === "HOLD"
    ).length;
    ordersSkipped += holdIntents;

    const finalStatus =
      errors.length > 0 ? "completed_with_errors" : "completed";
    await allocationService.updateRebalanceRun(run.id, {
      status: finalStatus,
      completedAt: new Date(),
      executedOrders: executedOrders as unknown as Record<string, unknown>[],
      rationale: `Submitted ${ordersSubmitted} orders, skipped ${ordersSkipped}. ${errors.length} errors.`,
    });

    log.info("RebalancerService", "Execution complete", {
      traceId,
      ordersSubmitted,
      errorCount: errors.length,
    });

    return {
      runId: run.id,
      traceId,
      success: errors.length === 0,
      intentsGenerated: analysis.intents.length,
      ordersSubmitted,
      ordersSkipped,
      errors,
      duration: Date.now() - startTime,
    };
  }

  async analyzeProfitTaking(
    policy: Awaited<ReturnType<typeof allocationService.getActivePolicy>>,
    traceId: string
  ): Promise<ProfitTakingAnalysis[]> {
    if (!policy) return [];

    const profitThreshold =
      parseFloat(policy.profitTakingThresholdPct || "20") / 100;
    const positions = await alpaca.getPositions();
    const results: ProfitTakingAnalysis[] = [];

    for (const pos of positions) {
      const costBasis = parseFloat(pos.cost_basis);
      const currentValue = parseFloat(pos.market_value);
      const unrealizedPnlPct = (currentValue - costBasis) / costBasis;

      if (unrealizedPnlPct >= profitThreshold) {
        const excessGain = unrealizedPnlPct - profitThreshold;
        const recommendedTrimPct = Math.min(excessGain * 50, 25);

        results.push({
          symbol: pos.symbol,
          costBasis,
          currentValue,
          unrealizedPnlPct: unrealizedPnlPct * 100,
          recommendedTrimPct,
          reason: `Gain of ${(unrealizedPnlPct * 100).toFixed(1)}% exceeds ${(profitThreshold * 100).toFixed(0)}% threshold`,
        });
      }
    }

    log.info("RebalancerService", "Profit-taking analysis", {
      traceId,
      candidateCount: results.length,
    });
    return results;
  }

  async getStats(): Promise<{
    recentRuns: number;
    successfulRuns: number;
    totalOrdersSubmitted: number;
    lastRunAt: Date | null;
    lastRunStatus: string | null;
  }> {
    const runs = await db.query.rebalanceRuns.findMany({
      orderBy: [desc(rebalanceRuns.startedAt)],
      limit: 20,
    });

    const successfulRuns = runs.filter((r) => r.status === "completed").length;
    const totalOrders = runs.reduce((sum, r) => {
      const orders = r.executedOrders as unknown[];
      return sum + (Array.isArray(orders) ? orders.length : 0);
    }, 0);

    return {
      recentRuns: runs.length,
      successfulRuns,
      totalOrdersSubmitted: totalOrders,
      lastRunAt: runs[0]?.startedAt || null,
      lastRunStatus: runs[0]?.status || null,
    };
  }
}

export const rebalancerService = new RebalancerService();
