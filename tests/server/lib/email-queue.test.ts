/**
 * Email Queue Integration Tests
 *
 * Tests for email queue functionality including:
 * - Queue operations
 * - Rate limiting
 * - Retry logic
 * - Admin endpoints
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  queueEmail,
  getQueueStats,
  getFailedJobs,
  getRateLimitStatus,
  initEmailQueue,
  shutdownQueue,
  type QueueEmailOptions,
} from "../../../server/lib/email-queue";
import { setCache, incrementCounter } from "../../../server/lib/redis-cache";

describe("Email Queue", () => {
  afterEach(async () => {
    await shutdownQueue();
  });

  describe("queueEmail", () => {
    it("should queue email successfully", async () => {
      const emailOptions: QueueEmailOptions = {
        to: "test@example.com",
        from: "noreply@alphaflow.app",
        subject: "Test Email",
        text: "Test email body",
        html: "<p>Test email body</p>",
      };

      const result = await queueEmail(emailOptions);

      expect(result.queued).toBe(true);
      expect(result.jobId).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it("should enforce user hourly rate limit", async () => {
      const userId = "test-user-hourly";

      // Simulate 10 emails already sent this hour (at limit)
      const hourKey = getTestHourKey();
      await setCache(`email:rate:${userId}:${hourKey}`, 10, 3600);

      const emailOptions: QueueEmailOptions = {
        to: "test@example.com",
        from: "noreply@alphaflow.app",
        subject: "Test Email",
        text: "Test",
        html: "<p>Test</p>",
        userId,
      };

      const result = await queueEmail(emailOptions);

      expect(result.queued).toBe(false);
      expect(result.error).toContain("Hourly email limit reached");
    });

    it("should enforce user daily rate limit", async () => {
      const userId = "test-user-daily";

      // Simulate 50 emails already sent today (at limit)
      const dayKey = getTestDayKey();
      await setCache(`email:rate:${userId}:${dayKey}`, 50, 86400);

      const emailOptions: QueueEmailOptions = {
        to: "test@example.com",
        from: "noreply@alphaflow.app",
        subject: "Test Email",
        text: "Test",
        html: "<p>Test</p>",
        userId,
      };

      const result = await queueEmail(emailOptions);

      expect(result.queued).toBe(false);
      expect(result.error).toContain("Daily email limit reached");
    });

    it("should enforce global daily rate limit", async () => {
      const userId = "test-user-global";

      // Simulate 300 emails already sent globally today (at limit)
      const dayKey = getTestDayKey();
      await setCache(`email:rate:global:${dayKey}`, 300, 86400);

      const emailOptions: QueueEmailOptions = {
        to: "test@example.com",
        from: "noreply@alphaflow.app",
        subject: "Test Email",
        text: "Test",
        html: "<p>Test</p>",
        userId,
      };

      const result = await queueEmail(emailOptions);

      expect(result.queued).toBe(false);
      expect(result.error).toContain("System daily email limit reached");
    });

    it("should bypass rate limit for admin emails", async () => {
      const userId = "test-user-admin";

      // Simulate user at hourly limit
      const hourKey = getTestHourKey();
      await setCache(`email:rate:${userId}:${hourKey}`, 10, 3600);

      const emailOptions: QueueEmailOptions = {
        to: "test@example.com",
        from: "noreply@alphaflow.app",
        subject: "Admin Email",
        text: "Important admin notification",
        html: "<p>Important admin notification</p>",
        userId,
        bypassRateLimit: true, // Admin bypass
      };

      const result = await queueEmail(emailOptions);

      expect(result.queued).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should not rate limit emails without userId", async () => {
      const emailOptions: QueueEmailOptions = {
        to: "test@example.com",
        from: "noreply@alphaflow.app",
        subject: "System Email",
        text: "No user association",
        html: "<p>No user association</p>",
      };

      const result = await queueEmail(emailOptions);

      expect(result.queued).toBe(true);
      expect(result.error).toBeUndefined();
    });
  });

  describe("Queue Statistics", () => {
    it("should return queue status", async () => {
      const stats = await getQueueStats();

      expect(stats).toHaveProperty("waiting");
      expect(stats).toHaveProperty("active");
      expect(stats).toHaveProperty("completed");
      expect(stats).toHaveProperty("failed");
      expect(stats).toHaveProperty("delayed");
      expect(stats).toHaveProperty("paused");
      expect(typeof stats.waiting).toBe("number");
    });

    it("should list failed jobs", async () => {
      const failedJobs = await getFailedJobs(10);

      expect(Array.isArray(failedJobs)).toBe(true);
      // May be empty if no failed jobs
    });
  });

  describe("Rate Limit Status", () => {
    it("should return rate limit status for user", async () => {
      const userId = "test-user-status";

      const status = await getRateLimitStatus(userId);

      expect(status.userId).toBe(userId);
      expect(status.hourly).toHaveProperty("current");
      expect(status.hourly).toHaveProperty("limit");
      expect(status.hourly).toHaveProperty("remaining");
      expect(status.daily).toHaveProperty("current");
      expect(status.daily).toHaveProperty("limit");
      expect(status.daily).toHaveProperty("remaining");
      expect(status.global).toHaveProperty("current");
      expect(status.global).toHaveProperty("limit");
      expect(status.global).toHaveProperty("remaining");

      // Verify limits match configuration
      expect(status.hourly.limit).toBe(10);
      expect(status.daily.limit).toBe(50);
      expect(status.global.limit).toBe(300);
    });

    it("should calculate remaining correctly", async () => {
      const userId = "test-user-remaining";

      // Simulate 3 emails sent this hour
      const hourKey = getTestHourKey();
      await setCache(`email:rate:${userId}:${hourKey}`, 3, 3600);

      const status = await getRateLimitStatus(userId);

      expect(status.hourly.current).toBe(3);
      expect(status.hourly.remaining).toBe(7); // 10 - 3
    });
  });
});

describe("Trading Email Integration", () => {
  afterEach(async () => {
    await shutdownQueue();
  });

  it("should not block trading flow when queueing email", async () => {
    const startTime = Date.now();

    const emailOptions: QueueEmailOptions = {
      to: "trader@example.com",
      from: "noreply@alphaflow.app",
      subject: "Order Filled: BUY 100 AAPL",
      text: "Your order has been filled",
      html: "<p>Your order has been filled</p>",
    };

    await queueEmail(emailOptions);

    const elapsed = Date.now() - startTime;

    // Should complete in < 50ms (non-blocking)
    expect(elapsed).toBeLessThan(50);
  });

  it("should queue order fill notification", async () => {
    const emailOptions: QueueEmailOptions = {
      to: "trader@example.com",
      from: "noreply@alphaflow.app",
      subject: "Order Filled: BUY 100 AAPL @ $175.50",
      text: "Order filled: BUY 100 AAPL @ $175.50",
      html: "<p>Order filled: BUY 100 AAPL @ $175.50</p>",
      userId: "trader-123",
    };

    const result = await queueEmail(emailOptions);

    expect(result.queued).toBe(true);
    expect(result.jobId).toBeDefined();
  });

  it("should queue loss alert notification", async () => {
    const emailOptions: QueueEmailOptions = {
      to: "trader@example.com",
      from: "noreply@alphaflow.app",
      subject: "⚠️ Large Loss Alert: TSLA down 7.5%",
      text: "Loss alert: TSLA position down 7.5%",
      html: "<p>Loss alert: TSLA position down 7.5%</p>",
      userId: "trader-123",
    };

    const result = await queueEmail(emailOptions);

    expect(result.queued).toBe(true);
    expect(result.jobId).toBeDefined();
  });

  it("should queue circuit breaker notification", async () => {
    const emailOptions: QueueEmailOptions = {
      to: "trader@example.com",
      from: "noreply@alphaflow.app",
      subject: "🚨 Circuit Breaker Triggered - Trading Halted",
      text: "Circuit breaker triggered",
      html: "<p>Circuit breaker triggered</p>",
      userId: "trader-123",
      bypassRateLimit: true, // Critical notification
    };

    const result = await queueEmail(emailOptions);

    expect(result.queued).toBe(true);
    expect(result.jobId).toBeDefined();
  });
});

// Helper functions for testing
function getTestHourKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}-${String(now.getUTCHours()).padStart(2, "0")}`;
}

function getTestDayKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}
