import { db } from "../db";
import { valyuRetrievalCounters } from "../../shared/schema";
import { eq, and } from "drizzle-orm";
import { log } from "../utils/logger";

export type ValyuSourceTier = "web" | "finance" | "proprietary";

export interface ValyuBudgetConfig {
  webRetrievalsPerMonth: number;
  financeRetrievalsPerMonth: number;
  proprietaryRetrievalsPerMonth: number;
  [key: string]: unknown;
}

export interface ValyuBudgetStatus {
  tier: ValyuSourceTier;
  used: number;
  limit: number;
  remaining: number;
  resetDate: Date;
  lastCallTime: number | null;
}

export interface ValyuBudgetCheckResult {
  allowed: boolean;
  tier: ValyuSourceTier;
  reason?: string;
  used: number;
  limit: number;
  remaining: number;
}

const DEFAULT_CONFIG: ValyuBudgetConfig = {
  webRetrievalsPerMonth: 2000,
  financeRetrievalsPerMonth: 500,
  proprietaryRetrievalsPerMonth: 100,
};

const MAX_PRICE_BY_TIER: Record<ValyuSourceTier, number> = {
  web: 6.00,
  finance: 12.00,
  proprietary: 15.00,
};

let currentConfig: ValyuBudgetConfig = { ...DEFAULT_CONFIG };
const lastCallTimeByTier: Map<ValyuSourceTier, number> = new Map();

function getCurrentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function getNextMonthResetDate(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth() + 1, 1, 0, 0, 0, 0);
}

function getLimitForTier(tier: ValyuSourceTier): number {
  switch (tier) {
    case "web":
      return currentConfig.webRetrievalsPerMonth;
    case "finance":
      return currentConfig.financeRetrievalsPerMonth;
    case "proprietary":
      return currentConfig.proprietaryRetrievalsPerMonth;
  }
}

export function classifySourceTier(sources?: string[]): ValyuSourceTier {
  if (!sources || sources.length === 0) {
    return "web";
  }

  for (const source of sources) {
    const lowerSource = source.toLowerCase();
    if (lowerSource.includes("proprietary")) {
      return "proprietary";
    }
  }

  for (const source of sources) {
    if (source.startsWith("valyu/")) {
      return "finance";
    }
  }

  return "web";
}

export function getMaxPriceForTier(tier: ValyuSourceTier): number {
  return MAX_PRICE_BY_TIER[tier];
}

async function getOrCreateCounter(tier: ValyuSourceTier, monthKey: string): Promise<{ id: string; retrievalCount: number }> {
  try {
    const existing = await db
      .select()
      .from(valyuRetrievalCounters)
      .where(
        and(
          eq(valyuRetrievalCounters.sourceTier, tier),
          eq(valyuRetrievalCounters.monthKey, monthKey)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return { id: existing[0].id, retrievalCount: existing[0].retrievalCount };
    }

    const inserted = await db
      .insert(valyuRetrievalCounters)
      .values({
        sourceTier: tier,
        monthKey,
        retrievalCount: 0,
      })
      .returning();

    return { id: inserted[0].id, retrievalCount: 0 };
  } catch (error) {
    log.error("ValyuBudget", "Failed to get/create counter", { tier, monthKey, error });
    return { id: "", retrievalCount: 0 };
  }
}

export async function checkValyuBudget(tier: ValyuSourceTier): Promise<ValyuBudgetCheckResult> {
  const monthKey = getCurrentMonthKey();
  const limit = getLimitForTier(tier);

  try {
    const counter = await getOrCreateCounter(tier, monthKey);
    const used = counter.retrievalCount;
    const remaining = Math.max(0, limit - used);

    if (used >= limit) {
      return {
        allowed: false,
        tier,
        reason: `Valyu ${tier} tier budget exhausted: ${used}/${limit} retrievals this month`,
        used,
        limit,
        remaining: 0,
      };
    }

    return {
      allowed: true,
      tier,
      used,
      limit,
      remaining,
    };
  } catch (error) {
    log.warn("ValyuBudget", "Budget check failed, allowing request", { tier, error });
    return {
      allowed: true,
      tier,
      used: 0,
      limit,
      remaining: limit,
    };
  }
}

export async function recordValyuRetrievals(
  tier: ValyuSourceTier,
  retrievalCount: number
): Promise<void> {
  if (retrievalCount <= 0) return;

  const monthKey = getCurrentMonthKey();
  lastCallTimeByTier.set(tier, Date.now());

  try {
    const existing = await db
      .select()
      .from(valyuRetrievalCounters)
      .where(
        and(
          eq(valyuRetrievalCounters.sourceTier, tier),
          eq(valyuRetrievalCounters.monthKey, monthKey)
        )
      )
      .limit(1);

    if (existing.length > 0) {
      await db
        .update(valyuRetrievalCounters)
        .set({
          retrievalCount: existing[0].retrievalCount + retrievalCount,
          lastUpdated: new Date(),
        })
        .where(eq(valyuRetrievalCounters.id, existing[0].id));
    } else {
      await db.insert(valyuRetrievalCounters).values({
        sourceTier: tier,
        monthKey,
        retrievalCount,
      });
    }

    log.info("ValyuBudget", "Recorded retrievals", {
      tier,
      count: retrievalCount,
      monthKey,
    });
  } catch (error) {
    log.error("ValyuBudget", "Failed to record retrievals", { tier, retrievalCount, error });
  }
}

export async function getValyuBudgetStatus(): Promise<ValyuBudgetStatus[]> {
  const monthKey = getCurrentMonthKey();
  const resetDate = getNextMonthResetDate();
  const tiers: ValyuSourceTier[] = ["web", "finance", "proprietary"];
  const statuses: ValyuBudgetStatus[] = [];

  for (const tier of tiers) {
    const limit = getLimitForTier(tier);
    let used = 0;

    try {
      const counter = await getOrCreateCounter(tier, monthKey);
      used = counter.retrievalCount;
    } catch (error) {
      log.warn("ValyuBudget", "Failed to get usage for tier", { tier, error });
    }

    statuses.push({
      tier,
      used,
      limit,
      remaining: Math.max(0, limit - used),
      resetDate,
      lastCallTime: lastCallTimeByTier.get(tier) ?? null,
    });
  }

  return statuses;
}

export function getValyuBudgetConfig(): ValyuBudgetConfig {
  return { ...currentConfig };
}

export function updateValyuBudgetConfig(updates: Partial<ValyuBudgetConfig>): ValyuBudgetConfig {
  if (updates.webRetrievalsPerMonth !== undefined) {
    currentConfig.webRetrievalsPerMonth = Math.max(0, updates.webRetrievalsPerMonth);
  }
  if (updates.financeRetrievalsPerMonth !== undefined) {
    currentConfig.financeRetrievalsPerMonth = Math.max(0, updates.financeRetrievalsPerMonth);
  }
  if (updates.proprietaryRetrievalsPerMonth !== undefined) {
    currentConfig.proprietaryRetrievalsPerMonth = Math.max(0, updates.proprietaryRetrievalsPerMonth);
  }

  log.info("ValyuBudget", "Config updated", currentConfig);
  return { ...currentConfig };
}

export async function resetValyuBudget(tier?: ValyuSourceTier): Promise<void> {
  const monthKey = getCurrentMonthKey();

  try {
    if (tier) {
      await db
        .update(valyuRetrievalCounters)
        .set({ retrievalCount: 0, lastUpdated: new Date() })
        .where(
          and(
            eq(valyuRetrievalCounters.sourceTier, tier),
            eq(valyuRetrievalCounters.monthKey, monthKey)
          )
        );
      log.info("ValyuBudget", "Reset budget for tier", { tier });
    } else {
      await db
        .update(valyuRetrievalCounters)
        .set({ retrievalCount: 0, lastUpdated: new Date() })
        .where(eq(valyuRetrievalCounters.monthKey, monthKey));
      log.info("ValyuBudget", "Reset all budgets for month", { monthKey });
    }
  } catch (error) {
    log.error("ValyuBudget", "Failed to reset budget", { tier, error });
  }
}
