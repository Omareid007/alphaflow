/**
 * Email Queue Admin Routes
 *
 * Monitoring and management endpoints for the email queue.
 * Requires admin authentication.
 */

import express, { type Response } from "express";
import {
  requireAdmin,
  type AuthenticatedRequest,
} from "../middleware/requireAuth";
import {
  getQueueStats,
  getFailedJobs,
  retryFailedJob,
  pauseQueue,
  resumeQueue,
  cleanQueue,
  getRateLimitStatus,
} from "../lib/email-queue";
import { log } from "../utils/logger";

const router = express.Router();

/**
 * GET /api/admin/email-queue/status
 * Get current queue statistics
 */
router.get(
  "/status",
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const stats = await getQueueStats();

      log.info("EmailQueueAdmin", "Queue status requested", {
        admin: req.userId,
      });

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.error("EmailQueueAdmin", "Failed to get queue status", {
        error: errorMessage,
      });

      res.status(500).json({
        success: false,
        error: "Failed to get queue status",
      });
    }
  }
);

/**
 * GET /api/admin/email-queue/failed
 * Get list of failed jobs
 */
router.get(
  "/failed",
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const failedJobs = await getFailedJobs(limit);

      log.info("EmailQueueAdmin", "Failed jobs requested", {
        admin: req.userId,
        limit,
        count: failedJobs.length,
      });

      res.json({
        success: true,
        data: {
          jobs: failedJobs,
          count: failedJobs.length,
        },
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.error("EmailQueueAdmin", "Failed to get failed jobs", {
        error: errorMessage,
      });

      res.status(500).json({
        success: false,
        error: "Failed to get failed jobs",
      });
    }
  }
);

/**
 * POST /api/admin/email-queue/retry/:jobId
 * Retry a specific failed job
 */
router.post(
  "/retry/:jobId",
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { jobId } = req.params;
      const result = await retryFailedJob(jobId);

      if (result.success) {
        log.info("EmailQueueAdmin", "Job retry initiated", {
          admin: req.userId,
          jobId,
        });

        res.json({
          success: true,
          message: `Job ${jobId} queued for retry`,
        });
      } else {
        res.status(404).json({
          success: false,
          error: result.error || "Job not found",
        });
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.error("EmailQueueAdmin", "Failed to retry job", {
        error: errorMessage,
        jobId: req.params.jobId,
      });

      res.status(500).json({
        success: false,
        error: "Failed to retry job",
      });
    }
  }
);

/**
 * POST /api/admin/email-queue/pause
 * Pause email queue processing (emergency stop)
 */
router.post(
  "/pause",
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await pauseQueue();

      log.warn("EmailQueueAdmin", "Email queue paused", {
        admin: req.userId,
      });

      res.json({
        success: true,
        message: "Email queue paused",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.error("EmailQueueAdmin", "Failed to pause queue", {
        error: errorMessage,
      });

      res.status(500).json({
        success: false,
        error: "Failed to pause queue",
      });
    }
  }
);

/**
 * POST /api/admin/email-queue/resume
 * Resume email queue processing
 */
router.post(
  "/resume",
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      await resumeQueue();

      log.info("EmailQueueAdmin", "Email queue resumed", {
        admin: req.userId,
      });

      res.json({
        success: true,
        message: "Email queue resumed",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.error("EmailQueueAdmin", "Failed to resume queue", {
        error: errorMessage,
      });

      res.status(500).json({
        success: false,
        error: "Failed to resume queue",
      });
    }
  }
);

/**
 * POST /api/admin/email-queue/clean
 * Clean old completed/failed jobs
 */
router.post(
  "/clean",
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      // Clean jobs older than grace period (default: 24 hours)
      const gracePeriod = parseInt(req.body.gracePeriod as string) || 86400000;
      const result = await cleanQueue(gracePeriod);

      log.info("EmailQueueAdmin", "Queue cleaned", {
        admin: req.userId,
        cleaned: result.cleaned,
        gracePeriod,
      });

      res.json({
        success: true,
        message: `Cleaned ${result.cleaned} old jobs`,
        data: result,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.error("EmailQueueAdmin", "Failed to clean queue", {
        error: errorMessage,
      });

      res.status(500).json({
        success: false,
        error: "Failed to clean queue",
      });
    }
  }
);

/**
 * GET /api/admin/email-queue/rate-limits/:userId
 * Get rate limit status for a specific user
 */
router.get(
  "/rate-limits/:userId",
  requireAdmin,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { userId } = req.params;
      const status = await getRateLimitStatus(userId);

      log.info("EmailQueueAdmin", "Rate limit status requested", {
        admin: req.userId,
        targetUserId: userId,
      });

      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      log.error("EmailQueueAdmin", "Failed to get rate limit status", {
        error: errorMessage,
        userId: req.params.userId,
      });

      res.status(500).json({
        success: false,
        error: "Failed to get rate limit status",
      });
    }
  }
);

export default router;
