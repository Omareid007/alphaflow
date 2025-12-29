/**
 * Alert Service - Manages alert rules and triggers
 *
 * Evaluates alert conditions and sends webhook notifications.
 */

import { db } from "../db";
import {
  alertRules,
  alertEvents,
  workItems,
  llmCalls,
  agentStatus,
} from "@shared/schema";
import { eq, desc, gte, sql, and, count } from "drizzle-orm";
import { log } from "../utils/logger";

export interface AlertCondition {
  metric: string;
  operator: ">" | "<" | ">=" | "<=" | "==";
  windowMinutes?: number;
}

export interface AlertRuleInput {
  name: string;
  description?: string;
  ruleType: string;
  condition: AlertCondition;
  threshold: number;
  enabled?: boolean;
  webhookUrl?: string;
}

interface MetricsSnapshot {
  deadLetterCount: number;
  pendingCount: number;
  runningCount: number;
  failedCount: number;
  succeededCount: number;
  oldestPendingAgeMinutes: number;
  llmCallsLastHour: number;
  llmErrorsLastHour: number;
  llmErrorRate: number;
  orchestratorLastRunMinutesAgo: number;
  retryRatePerMinute: number;
}

class AlertService {
  private evaluationInterval: ReturnType<typeof setInterval> | null = null;

  async getMetricsSnapshot(): Promise<MetricsSnapshot> {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    const [
      queueCounts,
      llmStats,
      orchestratorStatus,
      oldestPending,
      retryCount,
    ] = await Promise.all([
      db
        .select({
          status: workItems.status,
          count: count(),
        })
        .from(workItems)
        .groupBy(workItems.status),

      db
        .select({
          total: count(),
          errors: sql<number>`count(case when ${llmCalls.status} = 'error' then 1 end)`,
        })
        .from(llmCalls)
        .where(gte(llmCalls.createdAt, oneHourAgo)),

      db.select().from(agentStatus).limit(1),

      db
        .select({
          createdAt: workItems.createdAt,
        })
        .from(workItems)
        .where(eq(workItems.status, "PENDING"))
        .orderBy(workItems.createdAt)
        .limit(1),

      db
        .select({
          count: count(),
        })
        .from(workItems)
        .where(
          and(
            gte(workItems.attempts, 1),
            gte(workItems.updatedAt, new Date(now.getTime() - 60 * 1000))
          )
        ),
    ]);

    const counts: Record<string, number> = {};
    queueCounts.forEach((c) => {
      counts[c.status] = Number(c.count);
    });

    const llmTotal = Number(llmStats[0]?.total || 0);
    const llmErrors = Number(llmStats[0]?.errors || 0);
    const llmErrorRate = llmTotal > 0 ? (llmErrors / llmTotal) * 100 : 0;

    const lastHeartbeat = orchestratorStatus[0]?.lastHeartbeat;
    const orchestratorLastRunMinutesAgo = lastHeartbeat
      ? (now.getTime() - new Date(lastHeartbeat).getTime()) / 60000
      : Infinity;

    const oldestPendingAge = oldestPending[0]?.createdAt
      ? (now.getTime() - new Date(oldestPending[0].createdAt).getTime()) / 60000
      : 0;

    return {
      deadLetterCount: counts["DEAD_LETTER"] || 0,
      pendingCount: counts["PENDING"] || 0,
      runningCount: counts["RUNNING"] || 0,
      failedCount: counts["FAILED"] || 0,
      succeededCount: counts["SUCCEEDED"] || 0,
      oldestPendingAgeMinutes: oldestPendingAge,
      llmCallsLastHour: llmTotal,
      llmErrorsLastHour: llmErrors,
      llmErrorRate,
      orchestratorLastRunMinutesAgo,
      retryRatePerMinute: Number(retryCount[0]?.count || 0),
    };
  }

  async createRule(
    input: AlertRuleInput
  ): Promise<typeof alertRules.$inferSelect> {
    const [rule] = await db
      .insert(alertRules)
      .values({
        name: input.name,
        description: input.description || null,
        ruleType: input.ruleType,
        condition: input.condition,
        threshold: String(input.threshold),
        enabled: input.enabled ?? true,
        webhookUrl: input.webhookUrl || null,
      })
      .returning();

    log.info("AlertService", "Created alert rule", {
      ruleId: rule.id,
      name: rule.name,
    });
    return rule;
  }

  async getRules(): Promise<(typeof alertRules.$inferSelect)[]> {
    return db.select().from(alertRules).orderBy(desc(alertRules.createdAt));
  }

  async getRule(id: string): Promise<typeof alertRules.$inferSelect | null> {
    const [rule] = await db
      .select()
      .from(alertRules)
      .where(eq(alertRules.id, id));
    return rule || null;
  }

  async toggleRule(
    id: string,
    enabled: boolean
  ): Promise<typeof alertRules.$inferSelect | null> {
    const [rule] = await db
      .update(alertRules)
      .set({ enabled, updatedAt: new Date() })
      .where(eq(alertRules.id, id))
      .returning();
    return rule || null;
  }

  async deleteRule(id: string): Promise<boolean> {
    const result = await db.delete(alertRules).where(eq(alertRules.id, id));
    return true;
  }

  async evaluateRules(): Promise<{ triggered: string[]; checked: number }> {
    const enabledRules = await db
      .select()
      .from(alertRules)
      .where(eq(alertRules.enabled, true));
    const metrics = await this.getMetricsSnapshot();
    const triggered: string[] = [];

    for (const rule of enabledRules) {
      const condition = rule.condition as AlertCondition;
      const threshold = parseFloat(rule.threshold);
      let currentValue = 0;

      switch (rule.ruleType) {
        case "dead_letter_count":
          currentValue = metrics.deadLetterCount;
          break;
        case "retry_rate":
          currentValue = metrics.retryRatePerMinute;
          break;
        case "orchestrator_silent":
          currentValue = metrics.orchestratorLastRunMinutesAgo;
          break;
        case "llm_error_rate":
          currentValue = metrics.llmErrorRate;
          break;
        default:
          continue;
      }

      const shouldTrigger = this.evaluateCondition(
        currentValue,
        condition.operator,
        threshold
      );

      await db
        .update(alertRules)
        .set({ lastCheckedAt: new Date() })
        .where(eq(alertRules.id, rule.id));

      if (shouldTrigger) {
        triggered.push(rule.name);
        await this.triggerAlert(rule, currentValue);
      }
    }

    return { triggered, checked: enabledRules.length };
  }

  private evaluateCondition(
    value: number,
    operator: string,
    threshold: number
  ): boolean {
    switch (operator) {
      case ">":
        return value > threshold;
      case "<":
        return value < threshold;
      case ">=":
        return value >= threshold;
      case "<=":
        return value <= threshold;
      case "==":
        return value === threshold;
      default:
        return false;
    }
  }

  private async triggerAlert(
    rule: typeof alertRules.$inferSelect,
    triggeredValue: number
  ): Promise<void> {
    const [event] = await db
      .insert(alertEvents)
      .values({
        ruleId: rule.id,
        ruleName: rule.name,
        ruleType: rule.ruleType,
        triggeredValue: String(triggeredValue),
        threshold: rule.threshold,
        status: "triggered",
        webhookSent: false,
      })
      .returning();

    await db
      .update(alertRules)
      .set({ lastTriggeredAt: new Date() })
      .where(eq(alertRules.id, rule.id));

    log.warn("AlertService", "Alert triggered", {
      ruleName: rule.name,
      ruleType: rule.ruleType,
      triggeredValue,
      threshold: rule.threshold,
    });

    if (rule.webhookUrl) {
      await this.sendWebhook(rule, event, triggeredValue);
    }
  }

  private async sendWebhook(
    rule: typeof alertRules.$inferSelect,
    event: typeof alertEvents.$inferSelect,
    triggeredValue: number
  ): Promise<void> {
    if (!rule.webhookUrl) return;

    const payload = {
      alertId: event.id,
      ruleName: rule.name,
      ruleType: rule.ruleType,
      triggeredValue,
      threshold: parseFloat(rule.threshold),
      triggeredAt: event.createdAt.toISOString(),
      service: "ai-active-trader",
      severity: "warning",
    };

    try {
      const response = await fetch(rule.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      await db
        .update(alertEvents)
        .set({
          webhookSent: true,
          webhookResponse: `${response.status} ${response.statusText}`,
        })
        .where(eq(alertEvents.id, event.id));

      log.info("AlertService", "Webhook sent successfully", {
        ruleName: rule.name,
        webhookUrl: rule.webhookUrl,
        status: response.status,
      });
    } catch (error) {
      await db
        .update(alertEvents)
        .set({
          webhookSent: false,
          webhookResponse: String(error),
        })
        .where(eq(alertEvents.id, event.id));

      log.error("AlertService", "Webhook failed", {
        ruleName: rule.name,
        error: String(error),
      });
    }
  }

  async getRecentEvents(
    limit = 50
  ): Promise<(typeof alertEvents.$inferSelect)[]> {
    return db
      .select()
      .from(alertEvents)
      .orderBy(desc(alertEvents.createdAt))
      .limit(limit);
  }

  async testAlert(
    ruleId: string
  ): Promise<{ success: boolean; message: string }> {
    const rule = await this.getRule(ruleId);
    if (!rule) {
      return { success: false, message: "Rule not found" };
    }

    if (!rule.webhookUrl) {
      return { success: false, message: "No webhook URL configured" };
    }

    const testPayload = {
      alertId: "test-" + Date.now(),
      ruleName: rule.name + " (TEST)",
      ruleType: rule.ruleType,
      triggeredValue: parseFloat(rule.threshold),
      threshold: parseFloat(rule.threshold),
      triggeredAt: new Date().toISOString(),
      service: "ai-active-trader",
      severity: "test",
    };

    try {
      const response = await fetch(rule.webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testPayload),
      });

      return {
        success: response.ok,
        message: `Webhook returned ${response.status} ${response.statusText}`,
      };
    } catch (error) {
      return {
        success: false,
        message: String(error),
      };
    }
  }

  startEvaluationJob(intervalMs = 30000): void {
    if (this.evaluationInterval) {
      return;
    }

    log.info("AlertService", "Starting alert evaluation job", { intervalMs });

    this.evaluationInterval = setInterval(async () => {
      try {
        const result = await this.evaluateRules();
        if (result.triggered.length > 0) {
          log.warn("AlertService", "Alert evaluation complete", {
            checked: result.checked,
            triggered: result.triggered,
          });
        }
      } catch (error) {
        log.error("AlertService", "Alert evaluation failed", {
          error: String(error),
        });
      }
    }, intervalMs);
  }

  stopEvaluationJob(): void {
    if (this.evaluationInterval) {
      clearInterval(this.evaluationInterval);
      this.evaluationInterval = null;
      log.info("AlertService", "Stopped alert evaluation job");
    }
  }
}

export const alertService = new AlertService();
