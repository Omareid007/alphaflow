/**
 * Email Queue Service
 *
 * Background job queue for email delivery using Bull + Redis.
 * Decouples email sending from trading flow to prevent order delays.
 *
 * Features:
 * - Asynchronous email processing (non-blocking)
 * - Automatic retry with exponential backoff (1min, 5min, 15min)
 * - Dead letter queue for failed emails after 3 attempts
 * - Monitoring endpoints for queue health
 *
 * Critical: Trading operations must NEVER wait for email delivery.
 */

import Bull, { Job, Queue } from "bull";
import { log } from "../utils/logger";
import {
  sendEmail as sendEmailDirect,
  type EmailOptions,
  type EmailResult,
} from "./email-service";
import { getCache, incrementCounter } from "./redis-cache";

// Queue configuration
const QUEUE_NAME = "email-notifications";
const REDIS_CONFIG = {
  host: process.env.REDIS_HOST || "localhost",
  port: parseInt(process.env.REDIS_PORT || "6379", 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || "0", 10),
};

// Retry strategy: 3 attempts with exponential backoff
const DEFAULT_JOB_OPTIONS: Bull.JobOptions = {
  attempts: 3,
  backoff: {
    type: "exponential",
    delay: 60000, // 1 minute initial delay, then 5min, 15min
  },
  removeOnComplete: 100, // Keep last 100 successful jobs for audit
  removeOnFail: 200, // Keep last 200 failed jobs for debugging
};

// Rate limiting configuration
const RATE_LIMITS = {
  perUserPerHour: 10, // Max 10 emails per user per hour
  perUserPerDay: 50, // Max 50 emails per user per day
  globalPerDay: 300, // Max 300 emails total per day (Brevo free tier)
};

/**
 * Get current hour key for rate limiting (format: YYYY-MM-DD-HH)
 */
function getHourKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}-${String(now.getUTCHours()).padStart(2, "0")}`;
}

/**
 * Get current day key for rate limiting (format: YYYY-MM-DD)
 */
function getDayKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
}

/**
 * Check if user has exceeded rate limits
 */
async function checkRateLimits(
  userId: string
): Promise<{ allowed: boolean; reason?: string }> {
  const hourKey = `email:rate:${userId}:${getHourKey()}`;
  const dayKey = `email:rate:${userId}:${getDayKey()}`;
  const globalKey = `email:rate:global:${getDayKey()}`;

  try {
    const [hourCount, dayCount, globalCount] = await Promise.all([
      getCache<number>(hourKey),
      getCache<number>(dayKey),
      getCache<number>(globalKey),
    ]);

    if ((hourCount || 0) >= RATE_LIMITS.perUserPerHour) {
      return {
        allowed: false,
        reason: `Hourly email limit reached (${RATE_LIMITS.perUserPerHour}/hour)`,
      };
    }

    if ((dayCount || 0) >= RATE_LIMITS.perUserPerDay) {
      return {
        allowed: false,
        reason: `Daily email limit reached (${RATE_LIMITS.perUserPerDay}/day)`,
      };
    }

    if ((globalCount || 0) >= RATE_LIMITS.globalPerDay) {
      return {
        allowed: false,
        reason: "System daily email limit reached (300/day)",
      };
    }

    return { allowed: true };
  } catch (error) {
    log.error("EmailQueue", "Rate limit check failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    // Fail open - allow email if rate limit check fails
    return { allowed: true };
  }
}

/**
 * Increment rate limit counters after successful queue
 */
async function incrementRateLimits(userId: string): Promise<void> {
  const hourKey = `email:rate:${userId}:${getHourKey()}`;
  const dayKey = `email:rate:${userId}:${getDayKey()}`;
  const globalKey = `email:rate:global:${getDayKey()}`;

  try {
    await Promise.all([
      incrementCounter(hourKey, 3600), // 1 hour TTL
      incrementCounter(dayKey, 86400), // 24 hours TTL
      incrementCounter(globalKey, 86400), // 24 hours TTL
    ]);
  } catch (error) {
    log.error("EmailQueue", "Rate limit increment failed", {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// Initialize email queue
let emailQueue: Queue<EmailOptions> | null = null;

/**
 * Initialize the email queue
 * Safe to call multiple times - only creates queue once
 */
export function initEmailQueue(): Queue<EmailOptions> {
  if (emailQueue) {
    return emailQueue;
  }

  emailQueue = new Bull<EmailOptions>(QUEUE_NAME, {
    redis: REDIS_CONFIG,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  // Job processor - handles actual email sending
  emailQueue.process(async (job: Job<EmailOptions>) => {
    const { to, from, subject, text, html, replyTo } = job.data;

    log.info("EmailQueue", "Processing email job", {
      jobId: job.id,
      to: Array.isArray(to) ? to.length : 1,
      subject: subject.substring(0, 50),
      attempt: job.attemptsMade + 1,
    });

    try {
      const result: EmailResult = await sendEmailDirect({
        to,
        from,
        subject,
        text,
        html,
        replyTo,
      });

      if (!result.success) {
        throw new Error(result.error || "Email send failed");
      }

      log.info("EmailQueue", "Email sent successfully", {
        jobId: job.id,
        provider: result.provider,
        messageId: result.messageId,
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      log.error("EmailQueue", "Email job failed", {
        jobId: job.id,
        attempt: job.attemptsMade + 1,
        maxAttempts: job.opts.attempts,
        error: errorMessage,
      });

      throw error; // Re-throw to trigger retry
    }
  });

  // Event handlers for monitoring
  emailQueue.on("completed", (job: Job, result: EmailResult) => {
    log.info("EmailQueue", "Job completed", {
      jobId: job.id,
      provider: result.provider,
      duration: Date.now() - job.timestamp,
    });
  });

  emailQueue.on("failed", (job: Job, error: Error) => {
    log.error("EmailQueue", "Job failed permanently", {
      jobId: job.id,
      attempts: job.attemptsMade,
      error: error.message,
      to: job.data.to,
      subject: job.data.subject.substring(0, 50),
    });
  });

  emailQueue.on("stalled", (job: Job) => {
    log.warn("EmailQueue", "Job stalled (worker died?)", {
      jobId: job.id,
      to: job.data.to,
    });
  });

  emailQueue.on("error", (error: Error) => {
    log.error("EmailQueue", "Queue error", { error: error.message });
  });

  log.info("EmailQueue", "Email queue initialized", {
    queue: QUEUE_NAME,
    redis: `${REDIS_CONFIG.host}:${REDIS_CONFIG.port}`,
  });

  return emailQueue;
}

/**
 * Extended email options with rate limiting support
 */
export interface QueueEmailOptions extends EmailOptions {
  /** User ID for rate limiting (if applicable) */
  userId?: string;
  /** Bypass rate limiting (for admin/system emails) */
  bypassRateLimit?: boolean;
}

/**
 * Add email to background queue (non-blocking)
 * Returns immediately with job ID - email sent asynchronously
 *
 * @param options Email options with optional userId for rate limiting
 * @returns Result with job ID or error message
 */
export async function queueEmail(
  options: QueueEmailOptions
): Promise<{ jobId?: string; queued: boolean; error?: string }> {
  // Rate limit check (skip for system/admin emails)
  if (options.userId && !options.bypassRateLimit) {
    const rateCheck = await checkRateLimits(options.userId);
    if (!rateCheck.allowed) {
      log.warn("EmailQueue", "Rate limit exceeded", {
        userId: options.userId,
        reason: rateCheck.reason,
      });
      return {
        queued: false,
        error: rateCheck.reason,
      };
    }
  }

  try {
    const queue = initEmailQueue();
    const job = await queue.add(options);

    log.debug("EmailQueue", "Email queued", {
      jobId: job.id,
      userId: options.userId,
      to: Array.isArray(options.to) ? options.to.length : 1,
      subject: options.subject.substring(0, 50),
    });

    // Increment rate limit counters after successful queue
    if (options.userId && !options.bypassRateLimit) {
      await incrementRateLimits(options.userId);
    }

    return {
      jobId: job.id.toString(),
      queued: true,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);

    log.error("EmailQueue", "Failed to queue email", {
      error: errorMessage,
      to: options.to,
      subject: options.subject.substring(0, 50),
    });

    // Fallback: Try sending directly (degraded mode)
    log.warn("EmailQueue", "Attempting direct send as fallback");
    const result = await sendEmailDirect(options);

    return {
      jobId: "direct-fallback",
      queued: false,
    };
  }
}

/**
 * Get queue statistics for monitoring
 */
export async function getQueueStats(): Promise<{
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
}> {
  const queue = initEmailQueue();

  const [waiting, active, completed, failed, delayed, isPaused] =
    await Promise.all([
      queue.getWaitingCount(),
      queue.getActiveCount(),
      queue.getCompletedCount(),
      queue.getFailedCount(),
      queue.getDelayedCount(),
      queue.isPaused(),
    ]);

  return {
    waiting,
    active,
    completed,
    failed,
    delayed,
    paused: isPaused,
  };
}

/**
 * Get failed jobs for debugging
 * @param limit Maximum number of failed jobs to return (default: 20)
 */
export async function getFailedJobs(limit: number = 20): Promise<
  Array<{
    jobId: string;
    timestamp: number;
    attempts: number;
    error: string;
    data: {
      to: string | string[];
      subject: string;
    };
  }>
> {
  const queue = initEmailQueue();
  const failedJobs = await queue.getFailed(0, limit - 1);

  return failedJobs.map((job) => ({
    jobId: job.id.toString(),
    timestamp: job.timestamp,
    attempts: job.attemptsMade,
    error: job.failedReason || "Unknown error",
    data: {
      to: job.data.to,
      subject: job.data.subject,
    },
  }));
}

/**
 * Retry a specific failed job
 * @param jobId Job ID to retry
 */
export async function retryFailedJob(
  jobId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const queue = initEmailQueue();
    const job = await queue.getJob(jobId);

    if (!job) {
      return { success: false, error: "Job not found" };
    }

    await job.retry();
    log.info("EmailQueue", "Job retry initiated", { jobId });

    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, error: errorMessage };
  }
}

/**
 * Pause email queue (emergency stop)
 */
export async function pauseQueue(): Promise<void> {
  const queue = initEmailQueue();
  await queue.pause();
  log.warn("EmailQueue", "Email queue paused");
}

/**
 * Resume email queue
 */
export async function resumeQueue(): Promise<void> {
  const queue = initEmailQueue();
  await queue.resume();
  log.info("EmailQueue", "Email queue resumed");
}

/**
 * Clean up old completed/failed jobs
 */
export async function cleanQueue(
  grace: number = 86400000
): Promise<{ cleaned: number }> {
  const queue = initEmailQueue();

  // Remove jobs older than grace period (default: 24 hours)
  const [cleanedCompleted, cleanedFailed] = await Promise.all([
    queue.clean(grace, "completed"),
    queue.clean(grace, "failed"),
  ]);

  const totalCleaned = cleanedCompleted.length + cleanedFailed.length;

  log.info("EmailQueue", "Queue cleaned", {
    completed: cleanedCompleted.length,
    failed: cleanedFailed.length,
    total: totalCleaned,
  });

  return { cleaned: totalCleaned };
}

/**
 * Graceful shutdown - wait for active jobs to complete
 */
export async function shutdownQueue(): Promise<void> {
  if (!emailQueue) return;

  log.info("EmailQueue", "Shutting down email queue...");
  await emailQueue.close();
  emailQueue = null;
  log.info("EmailQueue", "Email queue shut down gracefully");
}

/**
 * Get rate limit status for a user
 * @param userId User ID to check
 * @returns Current usage vs limits
 */
export async function getRateLimitStatus(userId: string): Promise<{
  userId: string;
  hourly: { current: number; limit: number; remaining: number };
  daily: { current: number; limit: number; remaining: number };
  global: { current: number; limit: number; remaining: number };
}> {
  const hourKey = `email:rate:${userId}:${getHourKey()}`;
  const dayKey = `email:rate:${userId}:${getDayKey()}`;
  const globalKey = `email:rate:global:${getDayKey()}`;

  try {
    const [hourCount, dayCount, globalCount] = await Promise.all([
      getCache<number>(hourKey),
      getCache<number>(dayKey),
      getCache<number>(globalKey),
    ]);

    const hourlyCurrent = hourCount || 0;
    const dailyCurrent = dayCount || 0;
    const globalCurrent = globalCount || 0;

    return {
      userId,
      hourly: {
        current: hourlyCurrent,
        limit: RATE_LIMITS.perUserPerHour,
        remaining: Math.max(0, RATE_LIMITS.perUserPerHour - hourlyCurrent),
      },
      daily: {
        current: dailyCurrent,
        limit: RATE_LIMITS.perUserPerDay,
        remaining: Math.max(0, RATE_LIMITS.perUserPerDay - dailyCurrent),
      },
      global: {
        current: globalCurrent,
        limit: RATE_LIMITS.globalPerDay,
        remaining: Math.max(0, RATE_LIMITS.globalPerDay - globalCurrent),
      },
    };
  } catch (error) {
    log.error("EmailQueue", "Failed to get rate limit status", {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
}

// Export types
export type { EmailOptions };
