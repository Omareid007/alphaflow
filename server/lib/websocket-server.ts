/**
 * @module server/lib/websocket-server
 * @description WebSocket server for real-time client updates
 *
 * Broadcasts events to connected clients:
 * - Trade updates (fills, cancellations, rejections)
 * - AI decision updates
 * - Portfolio changes
 * - Market alerts
 *
 * Uses ws library (same as Alpaca stream)
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server as HttpServer } from "http";
import { log } from "../utils/logger";
import { getSession } from "./session";
import type { IncomingMessage } from "http";

// ============================================================================
// Types
// ============================================================================

export type BroadcastEventType =
  | "trade_update"
  | "ai_decision"
  | "portfolio_update"
  | "market_alert"
  | "sentiment_update"
  | "feed_status"
  | "ping";

export interface BroadcastEvent {
  type: BroadcastEventType;
  data: unknown;
  timestamp: string;
}

interface AuthenticatedClient {
  ws: WebSocket;
  userId: string;
  subscribedChannels: Set<BroadcastEventType>;
  lastPing: number;
}

// ============================================================================
// WebSocket Broadcast Server
// ============================================================================

class WebSocketBroadcastServer {
  private wss: WebSocketServer | null = null;
  private clients: Map<WebSocket, AuthenticatedClient> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private isRunning = false;

  /**
   * Initialize WebSocket server attached to HTTP server
   */
  initialize(httpServer: HttpServer): void {
    if (this.wss) {
      log.warn("WebSocketServer", "Already initialized");
      return;
    }

    this.wss = new WebSocketServer({
      server: httpServer,
      path: "/ws",
      verifyClient: async (info, callback) => {
        try {
          // Extract session from cookie
          const cookies = this.parseCookies(info.req.headers.cookie || "");
          const sessionId = cookies.session;

          if (!sessionId) {
            log.debug("WebSocketServer", "No session cookie, rejecting");
            callback(false, 401, "Unauthorized");
            return;
          }

          const session = await getSession(sessionId);
          if (!session) {
            log.debug("WebSocketServer", "Invalid session, rejecting");
            callback(false, 401, "Unauthorized");
            return;
          }

          // Attach userId to request for later use
          (info.req as IncomingMessage & { userId?: string }).userId =
            session.userId;
          callback(true);
        } catch (error) {
          log.error("WebSocketServer", "Auth error", { error });
          callback(false, 500, "Internal Server Error");
        }
      },
    });

    this.wss.on("connection", (ws, req) => {
      const userId = (req as IncomingMessage & { userId?: string }).userId;
      if (!userId) {
        ws.close(1008, "Unauthorized");
        return;
      }

      this.handleConnection(ws, userId);
    });

    this.wss.on("error", (error) => {
      log.error("WebSocketServer", "Server error", { error });
    });

    // Start heartbeat to detect dead connections
    this.startHeartbeat();
    this.isRunning = true;

    log.info("WebSocketServer", "Initialized on /ws path");
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, userId: string): void {
    const client: AuthenticatedClient = {
      ws,
      userId,
      subscribedChannels: new Set([
        "trade_update",
        "ai_decision",
        "portfolio_update",
      ]),
      lastPing: Date.now(),
    };

    this.clients.set(ws, client);

    log.info("WebSocketServer", "Client connected", {
      userId,
      totalClients: this.clients.size,
    });

    // Send welcome message
    this.sendToClient(ws, {
      type: "ping",
      data: { message: "Connected to AlphaFlow real-time updates" },
      timestamp: new Date().toISOString(),
    });

    ws.on("message", (data) => {
      this.handleMessage(ws, data.toString());
    });

    ws.on("close", () => {
      this.clients.delete(ws);
      log.info("WebSocketServer", "Client disconnected", {
        userId,
        totalClients: this.clients.size,
      });
    });

    ws.on("error", (error) => {
      log.error("WebSocketServer", "Client error", { userId, error });
      this.clients.delete(ws);
    });

    ws.on("pong", () => {
      const client = this.clients.get(ws);
      if (client) {
        client.lastPing = Date.now();
      }
    });
  }

  /**
   * Handle incoming message from client
   */
  private handleMessage(ws: WebSocket, message: string): void {
    try {
      const parsed = JSON.parse(message);
      const client = this.clients.get(ws);

      if (!client) return;

      switch (parsed.type) {
        case "subscribe":
          if (Array.isArray(parsed.channels)) {
            parsed.channels.forEach((ch: BroadcastEventType) => {
              client.subscribedChannels.add(ch);
            });
          }
          break;

        case "unsubscribe":
          if (Array.isArray(parsed.channels)) {
            parsed.channels.forEach((ch: BroadcastEventType) => {
              client.subscribedChannels.delete(ch);
            });
          }
          break;

        case "ping":
          this.sendToClient(ws, {
            type: "ping",
            data: { pong: true },
            timestamp: new Date().toISOString(),
          });
          break;
      }
    } catch {
      // Ignore invalid JSON
    }
  }

  /**
   * Broadcast event to all connected clients
   */
  broadcast(event: BroadcastEvent): void {
    if (!this.isRunning) return;

    let sentCount = 0;
    for (const [ws, client] of this.clients.entries()) {
      if (
        ws.readyState === WebSocket.OPEN &&
        client.subscribedChannels.has(event.type)
      ) {
        this.sendToClient(ws, event);
        sentCount++;
      }
    }

    log.debug("WebSocketServer", "Broadcast sent", {
      type: event.type,
      recipients: sentCount,
    });
  }

  /**
   * Broadcast to specific user
   */
  broadcastToUser(userId: string, event: BroadcastEvent): void {
    if (!this.isRunning) return;

    for (const [ws, client] of this.clients.entries()) {
      if (
        client.userId === userId &&
        ws.readyState === WebSocket.OPEN &&
        client.subscribedChannels.has(event.type)
      ) {
        this.sendToClient(ws, event);
      }
    }
  }

  /**
   * Send message to specific client
   */
  private sendToClient(ws: WebSocket, event: BroadcastEvent): void {
    try {
      ws.send(JSON.stringify(event));
    } catch (error) {
      log.error("WebSocketServer", "Failed to send to client", { error });
    }
  }

  /**
   * Parse cookies from header string
   */
  private parseCookies(cookieHeader: string): Record<string, string> {
    const cookies: Record<string, string> = {};
    if (!cookieHeader) return cookies;

    cookieHeader.split(";").forEach((cookie) => {
      const [name, value] = cookie.trim().split("=");
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });

    return cookies;
  }

  /**
   * Start heartbeat to detect dead connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 60 seconds

      for (const [ws, client] of this.clients.entries()) {
        if (now - client.lastPing > timeout) {
          log.debug("WebSocketServer", "Terminating stale connection", {
            userId: client.userId,
          });
          ws.terminate();
          this.clients.delete(ws);
        } else if (ws.readyState === WebSocket.OPEN) {
          ws.ping();
        }
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Get connected client count
   */
  getClientCount(): number {
    return this.clients.size;
  }

  /**
   * Get clients by user
   */
  getClientsByUser(userId: string): number {
    let count = 0;
    for (const client of this.clients.values()) {
      if (client.userId === userId) count++;
    }
    return count;
  }

  /**
   * Shutdown WebSocket server
   */
  shutdown(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    if (this.wss) {
      // Close all connections
      for (const ws of this.clients.keys()) {
        ws.close(1001, "Server shutting down");
      }
      this.clients.clear();

      this.wss.close();
      this.wss = null;
    }

    this.isRunning = false;
    log.info("WebSocketServer", "Shutdown complete");
  }
}

// Singleton instance
export const wsServer = new WebSocketBroadcastServer();

// ============================================================================
// Convenience broadcast functions
// ============================================================================

/**
 * Broadcast a trade update to all clients
 */
export function broadcastTradeUpdate(data: {
  orderId: string;
  symbol: string;
  side: string;
  status: string;
  filledQty?: string;
  filledPrice?: string;
}): void {
  wsServer.broadcast({
    type: "trade_update",
    data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast an AI decision to all clients
 */
export function broadcastAiDecision(data: {
  id: string;
  action: string;
  symbol: string;
  confidence: number;
  reasoning?: string;
}): void {
  wsServer.broadcast({
    type: "ai_decision",
    data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast portfolio update to specific user
 */
export function broadcastPortfolioUpdate(
  userId: string,
  data: {
    totalValue: number;
    cashBalance: number;
    positionCount: number;
    dayPnL: number;
  }
): void {
  wsServer.broadcastToUser(userId, {
    type: "portfolio_update",
    data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast market alert to all clients
 */
export function broadcastMarketAlert(data: {
  symbol: string;
  alertType: string;
  message: string;
  severity: "info" | "warning" | "critical";
}): void {
  wsServer.broadcast({
    type: "market_alert",
    data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Broadcast sentiment update
 */
export function broadcastSentimentUpdate(data: {
  symbol: string;
  score: number;
  trend: string;
  sources: number;
}): void {
  wsServer.broadcast({
    type: "sentiment_update",
    data,
    timestamp: new Date().toISOString(),
  });
}
