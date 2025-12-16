import { db } from "../db";
import { allocationPolicies, rebalanceRuns, universeCandidates, universeAssets, universeLiquidityMetrics, universeFundamentals } from "../../shared/schema";
import type { AllocationPolicy, InsertAllocationPolicy, InsertRebalanceRun, RebalanceRun } from "../../shared/schema";
import { eq, and, desc, sql, inArray } from "drizzle-orm";
import { alpaca } from "../connectors/alpaca";

export interface TargetPosition {
  symbol: string;
  targetWeightPct: number;
  currentWeightPct: number;
  reason: string;
  sector?: string;
  liquidityTier?: string;
  qualityScore?: number;
}

export interface RebalanceIntent {
  symbol: string;
  action: "BUY" | "SELL" | "TRIM" | "HOLD";
  targetWeightPct: number;
  currentWeightPct: number;
  notionalDelta: number;
  reason: string;
}

export interface RebalanceAnalysis {
  policy: AllocationPolicy;
  portfolioValue: number;
  approvedSymbols: string[];
  currentPositions: Map<string, { qty: number; marketValue: number; weightPct: number }>;
  targetPositions: TargetPosition[];
  intents: RebalanceIntent[];
  profitTakingCandidates: string[];
  rotationCandidates: string[];
}

class AllocationService {
  async getActivePolicy(): Promise<AllocationPolicy | null> {
    const policy = await db.query.allocationPolicies.findFirst({
      where: eq(allocationPolicies.isActive, true),
    });
    return policy ?? null;
  }

  async getPolicyById(id: string): Promise<AllocationPolicy | null> {
    const policy = await db.query.allocationPolicies.findFirst({
      where: eq(allocationPolicies.id, id),
    });
    return policy ?? null;
  }

  async listPolicies(): Promise<AllocationPolicy[]> {
    return db.query.allocationPolicies.findMany({
      orderBy: [desc(allocationPolicies.createdAt)],
    });
  }

  async createPolicy(data: InsertAllocationPolicy): Promise<AllocationPolicy> {
    if (data.isActive) {
      await db.update(allocationPolicies)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(allocationPolicies.isActive, true));
    }

    const [policy] = await db.insert(allocationPolicies)
      .values(data)
      .returning();
    return policy;
  }

  async updatePolicy(id: string, data: Partial<InsertAllocationPolicy>): Promise<AllocationPolicy | null> {
    if (data.isActive === true) {
      await db.update(allocationPolicies)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(
          eq(allocationPolicies.isActive, true),
          sql`${allocationPolicies.id} != ${id}`
        ));
    }

    const [updated] = await db.update(allocationPolicies)
      .set({ ...data, updatedAt: new Date() })
      .returning()
      .where(eq(allocationPolicies.id, id));
    return updated || null;
  }

  async activatePolicy(id: string): Promise<AllocationPolicy | null> {
    return this.updatePolicy(id, { isActive: true });
  }

  async deactivatePolicy(id: string): Promise<AllocationPolicy | null> {
    return this.updatePolicy(id, { isActive: false });
  }

  async analyzeRebalance(traceId: string): Promise<RebalanceAnalysis | null> {
    const policy = await this.getActivePolicy();
    if (!policy) {
      console.log(`[ALLOCATION] ${traceId} No active policy found`);
      return null;
    }

    const [account, positions] = await Promise.all([
      alpaca.getAccount(),
      alpaca.getPositions(),
    ]);

    const portfolioValue = parseFloat(account.equity);
    console.log(`[ALLOCATION] ${traceId} Portfolio value: $${portfolioValue.toFixed(2)}`);

    const currentPositions = new Map<string, { qty: number; marketValue: number; weightPct: number }>();
    for (const pos of positions) {
      const marketValue = parseFloat(pos.market_value);
      currentPositions.set(pos.symbol, {
        qty: parseFloat(pos.qty),
        marketValue,
        weightPct: (marketValue / portfolioValue) * 100,
      });
    }

    const approved = await db.query.universeCandidates.findMany({
      where: eq(universeCandidates.status, "APPROVED"),
    });
    const approvedSymbols = approved.map(c => c.symbol);

    const minTier = policy.minLiquidityTier || "B";
    const tierOrder = ["A", "B", "C"];
    const eligibleSymbols: string[] = [];

    for (const candidate of approved) {
      if (!candidate.tier) continue;
      const candidateTierIdx = tierOrder.indexOf(candidate.tier);
      const minTierIdx = tierOrder.indexOf(minTier);
      if (candidateTierIdx <= minTierIdx) {
        eligibleSymbols.push(candidate.symbol);
      }
    }

    const maxWeight = parseFloat(policy.maxPositionWeightPct || "8");
    const rotationTopN = policy.rotationTopN || 10;
    const profitThreshold = parseFloat(policy.profitTakingThresholdPct || "20") / 100;
    const overweightThreshold = parseFloat(policy.overweightThresholdPct || "50") / 100;

    const profitTakingCandidates: string[] = [];
    const overweightPositions: string[] = [];

    for (const [symbol, pos] of currentPositions) {
      if (pos.weightPct > maxWeight * (1 + overweightThreshold)) {
        overweightPositions.push(symbol);
      }
    }

    const targetPositions: TargetPosition[] = [];
    const numPositions = Math.min(eligibleSymbols.length, rotationTopN);
    const equalWeight = numPositions > 0 ? Math.min(100 / numPositions, maxWeight) : 0;

    for (const symbol of eligibleSymbols.slice(0, rotationTopN)) {
      const current = currentPositions.get(symbol);
      targetPositions.push({
        symbol,
        targetWeightPct: equalWeight,
        currentWeightPct: current?.weightPct || 0,
        reason: "Approved high-quality candidate",
      });
    }

    const intents: RebalanceIntent[] = [];

    for (const target of targetPositions) {
      const delta = target.targetWeightPct - target.currentWeightPct;
      const notionalDelta = (delta / 100) * portfolioValue;
      
      if (Math.abs(delta) < 0.5) {
        intents.push({
          symbol: target.symbol,
          action: "HOLD",
          targetWeightPct: target.targetWeightPct,
          currentWeightPct: target.currentWeightPct,
          notionalDelta: 0,
          reason: "Within tolerance",
        });
      } else if (delta > 0) {
        intents.push({
          symbol: target.symbol,
          action: "BUY",
          targetWeightPct: target.targetWeightPct,
          currentWeightPct: target.currentWeightPct,
          notionalDelta,
          reason: "Underweight vs target",
        });
      } else {
        intents.push({
          symbol: target.symbol,
          action: "TRIM",
          targetWeightPct: target.targetWeightPct,
          currentWeightPct: target.currentWeightPct,
          notionalDelta,
          reason: "Overweight vs target",
        });
      }
    }

    for (const [symbol, pos] of currentPositions) {
      if (!approvedSymbols.includes(symbol)) {
        intents.push({
          symbol,
          action: "SELL",
          targetWeightPct: 0,
          currentWeightPct: pos.weightPct,
          notionalDelta: -pos.marketValue,
          reason: "Position not in approved list - sell to exit",
        });
      }
    }

    console.log(`[ALLOCATION] ${traceId} Analysis complete: ${intents.length} intents generated`);

    return {
      policy,
      portfolioValue,
      approvedSymbols,
      currentPositions,
      targetPositions,
      intents,
      profitTakingCandidates,
      rotationCandidates: eligibleSymbols.slice(0, rotationTopN),
    };
  }

  async createRebalanceRun(data: InsertRebalanceRun): Promise<RebalanceRun> {
    const [run] = await db.insert(rebalanceRuns)
      .values(data)
      .returning();
    return run;
  }

  async getRebalanceRuns(limit = 20): Promise<RebalanceRun[]> {
    return db.query.rebalanceRuns.findMany({
      orderBy: [desc(rebalanceRuns.startedAt)],
      limit,
    });
  }

  async getRebalanceRunById(id: string): Promise<RebalanceRun | null> {
    const run = await db.query.rebalanceRuns.findFirst({
      where: eq(rebalanceRuns.id, id),
    });
    return run ?? null;
  }

  async updateRebalanceRun(id: string, data: Partial<RebalanceRun>): Promise<RebalanceRun | null> {
    const [updated] = await db.update(rebalanceRuns)
      .set(data)
      .returning()
      .where(eq(rebalanceRuns.id, id));
    return updated || null;
  }

  async getStats(): Promise<{
    totalPolicies: number;
    activePolicyId: string | null;
    activePolicyName: string | null;
    recentRuns: number;
    lastRunAt: Date | null;
  }> {
    const [policies, activePolicy, runs] = await Promise.all([
      db.query.allocationPolicies.findMany(),
      this.getActivePolicy(),
      db.query.rebalanceRuns.findMany({
        orderBy: [desc(rebalanceRuns.startedAt)],
        limit: 10,
      }),
    ]);

    return {
      totalPolicies: policies.length,
      activePolicyId: activePolicy?.id || null,
      activePolicyName: activePolicy?.name || null,
      recentRuns: runs.length,
      lastRunAt: runs[0]?.startedAt || null,
    };
  }
}

export const allocationService = new AllocationService();
