/**
 * Server-Sent Events (SSE) Emitter for Real-Time UI Updates
 *
 * Provides push-based updates to connected clients for:
 * - Order status changes
 * - Position updates
 * - Trade fills
 * - Price changes
 * - AI decisions
 */

import type { Response } from "express";
import { EventEmitter } from "node:events";
import { log } from "../utils/logger";

export type SSEEventType =
  | "order:update"
  | "order:fill"
  | "position:update"
  | "trade:new"
  | "price:update"
  | "ai:decision"
  | "agent:status"
  | "strategy:update"
  | "alert:new";

export interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  timestamp: string;
  userId?: string; // Optional user targeting
}

class SSEEmitter extends EventEmitter {
  private clients: Map<string, Response> = new Map();
  private userClients: Map<string, Set<string>> = new Map(); // userId -> Set<clientId>

  /**
   * Add a new SSE client connection
   */
  addClient(clientId: string, res: Response, userId?: string): void {
    // Configure SSE headers
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no"); // Disable nginx buffering

    // Send initial connection confirmation
    this.sendToClient(res, {
      type: "agent:status" as const,
      data: { connected: true, clientId },
      timestamp: new Date().toISOString(),
    });

    // Store client
    this.clients.set(clientId, res);

    // Track user association
    if (userId) {
      if (!this.userClients.has(userId)) {
        this.userClients.set(userId, new Set());
      }
      this.userClients.get(userId)!.add(clientId);
    }

    // Handle client disconnect
    res.on("close", () => {
      this.removeClient(clientId, userId);
    });

    log.info("SSE", "Client connected", {
      clientId,
      userId: userId || "anonymous",
    });
    log.debug("SSE", "Total clients", { count: this.clients.size });
  }

  /**
   * Remove a client connection
   */
  removeClient(clientId: string, userId?: string): void {
    this.clients.delete(clientId);

    if (userId) {
      const userSet = this.userClients.get(userId);
      if (userSet) {
        userSet.delete(clientId);
        if (userSet.size === 0) {
          this.userClients.delete(userId);
        }
      }
    }

    log.info("SSE", "Client disconnected", { clientId });
    log.debug("SSE", "Total clients", { count: this.clients.size });
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcast(event: Omit<SSEEvent, "timestamp">): void {
    const fullEvent: SSEEvent = {
      ...event,
      timestamp: new Date().toISOString(),
    };

    let successCount = 0;
    let errorCount = 0;

    for (const [clientId, res] of this.clients) {
      try {
        this.sendToClient(res, fullEvent);
        successCount++;
      } catch (error) {
        log.error("SSE", "Failed to send to client", {
          clientId,
          error: error instanceof Error ? error.message : String(error),
        });
        errorCount++;
        // Remove dead clients
        this.removeClient(clientId);
      }
    }

    if (this.clients.size > 0) {
      log.debug("SSE", "Broadcast complete", {
        eventType: event.type,
        successCount,
        errorCount,
      });
    }
  }

  /**
   * Send event to specific user's clients
   */
  sendToUser(
    userId: string,
    event: Omit<SSEEvent, "timestamp" | "userId">
  ): void {
    const clientIds = this.userClients.get(userId);
    if (!clientIds || clientIds.size === 0) {
      return;
    }

    const fullEvent: SSEEvent = {
      ...event,
      userId,
      timestamp: new Date().toISOString(),
    };

    let successCount = 0;
    const deadClients: string[] = [];

    for (const clientId of clientIds) {
      const res = this.clients.get(clientId);
      if (!res) {
        deadClients.push(clientId);
        continue;
      }

      try {
        this.sendToClient(res, fullEvent);
        successCount++;
      } catch (error) {
        log.error("SSE", "Failed to send to user client", {
          userId,
          clientId,
          error: error instanceof Error ? error.message : String(error),
        });
        deadClients.push(clientId);
      }
    }

    // Clean up dead clients
    for (const clientId of deadClients) {
      this.removeClient(clientId, userId);
    }

    if (successCount > 0) {
      log.debug("SSE", "Sent event to user", {
        eventType: event.type,
        userId,
        clientCount: successCount,
      });
    }
  }

  /**
   * Send SSE formatted message to a specific client
   */
  private sendToClient(res: Response, event: SSEEvent): void {
    const eventData = `event: ${event.type}\ndata: ${JSON.stringify(event.data)}\nid: ${Date.now()}\n\n`;
    res.write(eventData);
  }

  /**
   * Send keepalive ping to all clients
   */
  sendKeepalive(): void {
    for (const [clientId, res] of this.clients) {
      try {
        res.write(": keepalive\n\n");
      } catch (error) {
        log.error("SSE", "Keepalive failed for client", {
          clientId,
          error: error instanceof Error ? error.message : String(error),
        });
        this.removeClient(clientId);
      }
    }
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      totalClients: this.clients.size,
      totalUsers: this.userClients.size,
      clientsPerUser: Array.from(this.userClients.entries()).map(
        ([userId, clients]) => ({
          userId,
          clientCount: clients.size,
        })
      ),
    };
  }
}

// Global SSE emitter instance
export const sseEmitter = new SSEEmitter();

// Send keepalive every 30 seconds to prevent connection timeout
setInterval(() => {
  sseEmitter.sendKeepalive();
}, 30000);

// Convenience functions for common events
export const emitOrderUpdate = (
  orderId: string,
  orderData: Record<string, unknown>,
  userId?: string
) => {
  const event = {
    type: "order:update" as const,
    data: { orderId, ...orderData },
  };
  if (userId) {
    sseEmitter.sendToUser(userId, event);
  } else {
    sseEmitter.broadcast(event);
  }
};

export const emitOrderFill = (
  orderId: string,
  fillData: Record<string, unknown>,
  userId?: string
) => {
  const event = { type: "order:fill" as const, data: { orderId, ...fillData } };
  if (userId) {
    sseEmitter.sendToUser(userId, event);
  } else {
    sseEmitter.broadcast(event);
  }
};

export const emitPositionUpdate = (positionData: unknown, userId?: string) => {
  const event = { type: "position:update" as const, data: positionData };
  if (userId) {
    sseEmitter.sendToUser(userId, event);
  } else {
    sseEmitter.broadcast(event);
  }
};

export const emitTradeNew = (tradeData: unknown, userId?: string) => {
  const event = { type: "trade:new" as const, data: tradeData };
  if (userId) {
    sseEmitter.sendToUser(userId, event);
  } else {
    sseEmitter.broadcast(event);
  }
};

export const emitPriceUpdate = (
  symbol: string,
  priceData: Record<string, unknown>
) => {
  const event = {
    type: "price:update" as const,
    data: { symbol, ...priceData },
  };
  sseEmitter.broadcast(event);
};

export const emitAIDecision = (decisionData: unknown, userId?: string) => {
  const event = { type: "ai:decision" as const, data: decisionData };
  if (userId) {
    sseEmitter.sendToUser(userId, event);
  } else {
    sseEmitter.broadcast(event);
  }
};

export const emitAgentStatus = (statusData: unknown) => {
  const event = { type: "agent:status" as const, data: statusData };
  sseEmitter.broadcast(event);
};

export const emitStrategyUpdate = (
  strategyId: string,
  statusData: Record<string, unknown>,
  userId?: string
) => {
  const event = {
    type: "strategy:update" as const,
    data: { strategyId, ...statusData },
  };
  if (userId) {
    sseEmitter.sendToUser(userId, event);
  } else {
    sseEmitter.broadcast(event);
  }
};

export const emitAlert = (alertData: unknown, userId?: string) => {
  const event = { type: "alert:new" as const, data: alertData };
  if (userId) {
    sseEmitter.sendToUser(userId, event);
  } else {
    sseEmitter.broadcast(event);
  }
};
