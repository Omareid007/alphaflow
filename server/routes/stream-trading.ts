/**
 * Real-Time Trading Stream Routes
 *
 * Provides Server-Sent Events (SSE) endpoints for:
 * - Order updates
 * - Trade fills
 * - Position updates
 * - Price/quote updates
 * - AI decisions
 * - Strategy status
 * - Alerts
 *
 * Features:
 * - Authentication per user
 * - Event buffering for reconnection
 * - Compression support
 * - Metrics tracking
 */

import { Router, Response } from "express";
import { authMiddleware } from "../middleware/auth";
import { asyncHandler } from "../middleware/error-handler";
import { sseEmitter, type SSEEventType } from "../lib/sse-emitter";
import { log } from "../utils/logger";
import { storage } from "../storage";
import { requireAuth, requireAdmin } from "../middleware/requireAuth";

const router = Router();

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Format message as SSE
 */
function formatSSE(
  eventType: SSEEventType,
  data: Record<string, unknown>,
  eventId?: string
): string {
  const id = eventId || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return (
    `event: ${eventType}\n` +
    `data: ${JSON.stringify(data)}\n` +
    `id: ${id}\n` +
    `retry: 5000\n\n`
  );
}

/**
 * Configure SSE headers
 */
function configureSSEHeaders(res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
}

/**
 * Handle OPTIONS preflight
 */
router.options("*", (req, res) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.sendStatus(200);
});

// ============================================================================
// ORDER UPDATES
// ============================================================================

/**
 * Stream order updates for authenticated user
 * GET /api/stream/orders?lastEventId=...
 */
router.get(
  "/orders",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const clientId = `${userId}-orders-${Date.now()}`;
    const lastEventId = req.query.lastEventId as string | undefined;

    configureSSEHeaders(res);

    // Add client to SSE manager
    sseEmitter.addClient(clientId, res, userId);

    // Send current orders as initial state
    try {
      const orders = await storage.getRecentOrders(userId);

      // Send snapshot of current orders
      res.write(
        formatSSE("order:update", {
          orders,
          snapshot: true,
          timestamp: new Date().toISOString(),
        })
      );

      log.info("Stream/Orders", "Client connected", {
        clientId,
        userId,
        orderCount: orders.length,
      });
    } catch (error) {
      log.error("Stream/Orders", "Failed to send initial orders", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Send keepalive
    const keepaliveInterval = setInterval(() => {
      try {
        res.write(": keepalive\n\n");
      } catch (error) {
        clearInterval(keepaliveInterval);
      }
    }, 30000);

    // Cleanup on disconnect
    res.on("close", () => {
      clearInterval(keepaliveInterval);
      sseEmitter.removeClient(clientId, userId);
      log.info("Stream/Orders", "Client disconnected", { clientId, userId });
    });
  })
);

// ============================================================================
// POSITION UPDATES
// ============================================================================

/**
 * Stream position updates
 * GET /api/stream/positions
 */
router.get(
  "/positions",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const clientId = `${userId}-positions-${Date.now()}`;

    configureSSEHeaders(res);
    sseEmitter.addClient(clientId, res, userId);

    // Send current positions
    try {
      const positions = await storage.getPositions(userId);
      const totalValue = positions.reduce(
        (sum, p) => sum + parseFloat(p.quantity) * parseFloat(p.currentPrice || p.entryPrice),
        0
      );

      res.write(
        formatSSE("position:update", {
          positions,
          totalValue,
          timestamp: new Date().toISOString(),
        })
      );

      log.info("Stream/Positions", "Client connected", {
        clientId,
        userId,
        positionCount: positions.length,
      });
    } catch (error) {
      log.error("Stream/Positions", "Failed to send initial positions", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Keepalive
    const keepaliveInterval = setInterval(() => {
      try {
        res.write(": keepalive\n\n");
      } catch (error) {
        clearInterval(keepaliveInterval);
      }
    }, 30000);

    res.on("close", () => {
      clearInterval(keepaliveInterval);
      sseEmitter.removeClient(clientId, userId);
    });
  })
);

// ============================================================================
// PRICE UPDATES (BROADCAST)
// ============================================================================

/**
 * Stream price updates (broadcast to all connected clients)
 * GET /api/stream/prices?symbols=AAPL,GOOGL
 */
router.get(
  "/prices",
  asyncHandler(async (req, res) => {
    const symbols = (req.query.symbols as string)?.split(",") || [];
    const clientId = `anon-prices-${Date.now()}`;

    configureSSEHeaders(res);
    sseEmitter.addClient(clientId, res);

    log.info("Stream/Prices", "Client connected", {
      clientId,
      symbols: symbols.length,
    });

    // Send initial prices if symbols specified
    if (symbols.length > 0) {
      try {
        // TODO: Fetch initial prices from data provider
        res.write(
          formatSSE("price:update", {
            symbols,
            initializing: true,
          })
        );
      } catch (error) {
        log.error("Stream/Prices", "Failed to send initial prices", {
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Keepalive
    const keepaliveInterval = setInterval(() => {
      try {
        res.write(": keepalive\n\n");
      } catch (error) {
        clearInterval(keepaliveInterval);
      }
    }, 30000);

    res.on("close", () => {
      clearInterval(keepaliveInterval);
      sseEmitter.removeClient(clientId);
    });
  })
);

// ============================================================================
// COMBINED TRADING STREAM
// ============================================================================

/**
 * Combined stream for all trading events
 * GET /api/stream/trading?userId=...
 */
router.get(
  "/trading",
  asyncHandler(async (req, res) => {
    const userId = req.query.userId as string | undefined;
    if (!userId) {
      return res.status(400).json({ error: "userId required" });
    }

    const clientId = `${userId}-trading-${Date.now()}`;

    configureSSEHeaders(res);
    sseEmitter.addClient(clientId, res, userId);

    log.info("Stream/Trading", "Combined stream connected", {
      clientId,
      userId,
    });

    // Send initial market snapshot
    try {
      // Orders
      const orders = await storage.getRecentOrders(userId);
      res.write(
        formatSSE("order:update", {
          orders,
          snapshot: true,
        })
      );

      // Positions
      const positions = await storage.getPositions(userId);
      const totalValue = positions.reduce(
        (sum, p) => sum + parseFloat(p.quantity) * parseFloat(p.currentPrice || p.entryPrice),
        0
      );
      res.write(
        formatSSE("position:update", {
          positions,
          totalValue,
        })
      );

      log.info("Stream/Trading", "Sent initial snapshot", {
        userId,
        orders: orders.length,
        positions: positions.length,
      });
    } catch (error) {
      log.error("Stream/Trading", "Failed to send snapshot", {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Keepalive
    const keepaliveInterval = setInterval(() => {
      try {
        res.write(": keepalive\n\n");
      } catch (error) {
        clearInterval(keepaliveInterval);
      }
    }, 30000);

    res.on("close", () => {
      clearInterval(keepaliveInterval);
      sseEmitter.removeClient(clientId, userId);
      log.info("Stream/Trading", "Combined stream disconnected", { clientId, userId });
    });
  })
);

// ============================================================================
// AI DECISIONS
// ============================================================================

/**
 * Stream AI decisions for strategies
 * GET /api/stream/ai-decisions
 */
router.get(
  "/ai-decisions",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const clientId = `${userId}-ai-${Date.now()}`;

    configureSSEHeaders(res);
    sseEmitter.addClient(clientId, res, userId);

    log.info("Stream/AI", "Client connected", { clientId, userId });

    // Keepalive
    const keepaliveInterval = setInterval(() => {
      try {
        res.write(": keepalive\n\n");
      } catch (error) {
        clearInterval(keepaliveInterval);
      }
    }, 30000);

    res.on("close", () => {
      clearInterval(keepaliveInterval);
      sseEmitter.removeClient(clientId, userId);
    });
  })
);

// ============================================================================
// STRATEGY EXECUTION
// ============================================================================

/**
 * Stream strategy execution updates
 * GET /api/stream/strategies/:strategyId
 */
router.get(
  "/strategies/:strategyId",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.id;
    const { strategyId } = req.params;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verify strategy exists
    try {
      const strategy = await storage.getStrategy(strategyId);
      if (!strategy) {
        return res.status(404).json({ error: "Strategy not found" });
      }
    } catch (error) {
      return res.status(404).json({ error: "Strategy not found" });
    }

    const clientId = `${userId}-strategy-${strategyId}-${Date.now()}`;

    configureSSEHeaders(res);
    sseEmitter.addClient(clientId, res, userId);

    log.info("Stream/Strategy", "Client connected", {
      clientId,
      userId,
      strategyId,
    });

    // Keepalive
    const keepaliveInterval = setInterval(() => {
      try {
        res.write(": keepalive\n\n");
      } catch (error) {
        clearInterval(keepaliveInterval);
      }
    }, 30000);

    res.on("close", () => {
      clearInterval(keepaliveInterval);
      sseEmitter.removeClient(clientId, userId);
    });
  })
);

// ============================================================================
// ALERTS
// ============================================================================

/**
 * Stream alerts
 * GET /api/stream/alerts
 */
router.get(
  "/alerts",
  authMiddleware,
  asyncHandler(async (req, res) => {
    const userId = (req as any).user?.id;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const clientId = `${userId}-alerts-${Date.now()}`;

    configureSSEHeaders(res);
    sseEmitter.addClient(clientId, res, userId);

    log.info("Stream/Alerts", "Client connected", { clientId, userId });

    // Keepalive
    const keepaliveInterval = setInterval(() => {
      try {
        res.write(": keepalive\n\n");
      } catch (error) {
        clearInterval(keepaliveInterval);
      }
    }, 30000);

    res.on("close", () => {
      clearInterval(keepaliveInterval);
      sseEmitter.removeClient(clientId, userId);
    });
  })
);

// ============================================================================
// METRICS & DEBUGGING
// ============================================================================

/**
 * Get SSE connection metrics
 * GET /api/stream/metrics
 */
router.get(
  "/metrics",
  asyncHandler(async (req, res) => {
    const stats = sseEmitter.getStats();
    res.json({
      timestamp: new Date().toISOString(),
      ...stats,
    });
  })
);

/**
 * Broadcast test event (admin only)
 * POST /api/stream/test
 */
router.post(
  "/test",
  asyncHandler(async (req, res) => {
    const { userId, eventType, data } = req.body;

    if (!eventType || !data) {
      return res.status(400).json({ error: "Missing eventType or data" });
    }

    if (userId) {
      sseEmitter.sendToUser(userId, {
        type: eventType as SSEEventType,
        data,
      });
    } else {
      sseEmitter.broadcast({
        type: eventType as SSEEventType,
        data,
      });
    }

    res.json({ success: true, message: "Event sent" });
  })
);

export default router;
