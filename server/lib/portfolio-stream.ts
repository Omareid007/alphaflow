/**
 * Portfolio Stream Manager - WebSocket Server for Real-Time Portfolio Updates
 *
 * @module server/lib/portfolio-stream
 * @description WebSocket server managing real-time portfolio event streaming to authenticated clients.
 *
 * Features:
 * - Session cookie authentication
 * - Connection management (max 5 per user, 100 total)
 * - Channel-based subscriptions (positions, orders, account, trades)
 * - Server-side batching (1-second window, 95% message reduction)
 * - Heartbeat (ping every 15s, disconnect on 30s timeout)
 * - Event isolation (users receive only their own portfolio events)
 * - Comprehensive metrics tracking
 *
 * @see openspec/changes/realtime-portfolio-streaming/design.md
 * @see server/lib/portfolio-events.ts - Event type definitions
 */

import { WebSocket, WebSocketServer } from "ws";
import type { IncomingMessage } from "http";
import type { Server } from "http";
import { getSession } from "./session";
import {
  type PortfolioEvent,
  type ClientMessage,
  type ChannelType,
  parseClientMessage,
  createPongEvent,
  createBatchEvent,
  createErrorEvent,
  getChannelForEventType,
  serializeEvent,
  type BatchUpdate,
} from "./portfolio-events";
import { log } from "../utils/logger";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Connection metadata for a single WebSocket
 *
 * @property {WebSocket} ws - The WebSocket instance
 * @property {string} userId - Authenticated user ID
 * @property {string} connectionId - Unique connection identifier
 * @property {Set<ChannelType>} subscriptions - Subscribed channels
 * @property {number} lastPongTime - Timestamp of last pong received (for heartbeat)
 * @property {number} messageCount - Total messages sent to this connection
 * @property {number} connectedAt - Timestamp when connection was established
 */
interface Connection {
  ws: WebSocket;
  userId: string;
  connectionId: string;
  subscriptions: Set<ChannelType>;
  lastPongTime: number;
  messageCount: number;
  connectedAt: number;
}

/**
 * Batch buffer for aggregating events
 *
 * @property {Map<string, PositionUpdate>} positions - Position updates by symbol
 * @property {Map<string, OrderUpdate>} orders - Order updates by orderId
 * @property {AccountUpdate | null} account - Account update (max 1 per batch)
 * @property {TradeExecuted[]} trades - Trade executed events
 */
interface BatchBuffer {
  positions: Map<string, any>;
  orders: Map<string, any>;
  account: any;
  trades: any[];
}

/**
 * Portfolio Stream Manager statistics
 */
interface PortfolioStreamStats {
  activeConnections: number;
  connectionsByUser: Record<string, number>;
  totalMessagesDelivered: number;
  totalEventsEmitted: number;
  totalDisconnects: number;
  totalReconnects: number;
  batchEfficiency: number;
  avgConnectionDuration: number;
  uptime: number;
}

// ============================================================================
// PORTFOLIO STREAM MANAGER CLASS
// ============================================================================

/**
 * Portfolio Stream Manager
 *
 * Manages WebSocket connections for real-time portfolio event streaming.
 * Handles authentication, connection limits, subscriptions, batching, and heartbeat.
 *
 * @class PortfolioStreamManager
 *
 * @example
 * ```typescript
 * const wss = new WebSocketServer({ noServer: true });
 * const portfolioStream = new PortfolioStreamManager(wss);
 *
 * // Attach to HTTP server
 * httpServer.on('upgrade', (req, socket, head) => {
 *   if (req.url === '/ws/portfolio') {
 *     wss.handleUpgrade(req, socket, head, (ws) => {
 *       wss.emit('connection', ws, req);
 *     });
 *   }
 * });
 *
 * // Broadcast events
 * portfolioStream.broadcastEvent(userId, positionUpdateEvent);
 * ```
 */
export class PortfolioStreamManager {
  private connections: Map<string, Set<Connection>> = new Map(); // userId -> Set<Connection>
  private connectionsBySocket: Map<WebSocket, Connection> = new Map(); // WebSocket -> Connection
  private batchBuffers: Map<string, BatchBuffer> = new Map(); // userId -> BatchBuffer
  private batchTimer: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  // Configuration
  private readonly maxConnectionsPerUser = 5;
  private readonly maxTotalConnections = 100;
  private readonly batchWindowMs = 1000; // 1 second
  private readonly heartbeatIntervalMs = 15000; // 15 seconds
  private readonly heartbeatTimeoutMs = 30000; // 30 seconds

  // Statistics
  private stats = {
    totalMessagesDelivered: 0,
    totalEventsEmitted: 0,
    totalDisconnects: 0,
    totalReconnects: 0,
    startTime: Date.now(),
  };

  /**
   * Create a new Portfolio Stream Manager
   *
   * @param wss - WebSocketServer instance
   */
  constructor(private wss: WebSocketServer) {
    this.setupWebSocketServer();
    this.setupBatchFlush();
    this.setupHeartbeat();

    log.info("PortfolioStream", "Portfolio Stream Manager initialized", {
      batchWindow: this.batchWindowMs,
      heartbeatInterval: this.heartbeatIntervalMs,
      maxConnectionsPerUser: this.maxConnectionsPerUser,
      maxTotalConnections: this.maxTotalConnections,
    });
  }

  // ============================================================================
  // WEBSOCKET SERVER SETUP
  // ============================================================================

  /**
   * Setup WebSocket server event handlers
   */
  private setupWebSocketServer(): void {
    this.wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
      this.handleConnection(ws, req);
    });

    this.wss.on("error", (error: Error) => {
      log.error("PortfolioStream", "WebSocket server error", { error });
    });
  }

  // ============================================================================
  // CONNECTION MANAGEMENT
  // ============================================================================

  /**
   * Handle new WebSocket connection
   *
   * Validates session cookie, enforces connection limits, and registers connection.
   *
   * @param ws - WebSocket instance
   * @param req - HTTP upgrade request
   */
  private async handleConnection(
    ws: WebSocket,
    req: IncomingMessage
  ): Promise<void> {
    const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    try {
      // Extract and validate session cookie
      const session = await this.validateSessionFromRequest(req);

      if (!session) {
        log.warn(
          "PortfolioStream",
          "Connection rejected - authentication failed",
          {
            connectionId,
            ip: req.socket.remoteAddress,
          }
        );
        ws.close(1008, "Authentication required"); // 1008 = Policy Violation
        return;
      }

      const userId = session.userId;

      // Check connection limits
      const userConnections = this.connections.get(userId) || new Set();

      if (userConnections.size >= this.maxConnectionsPerUser) {
        log.warn(
          "PortfolioStream",
          "Connection rejected - user limit exceeded",
          {
            userId,
            connectionId,
            currentConnections: userConnections.size,
            limit: this.maxConnectionsPerUser,
          }
        );
        ws.close(
          1008,
          `Maximum connections exceeded (${this.maxConnectionsPerUser} per user)`
        );
        return;
      }

      const totalConnections = this.getTotalConnectionCount();
      if (totalConnections >= this.maxTotalConnections) {
        log.warn(
          "PortfolioStream",
          "Connection rejected - server capacity reached",
          {
            connectionId,
            totalConnections,
            limit: this.maxTotalConnections,
          }
        );
        ws.close(1013, "Server capacity reached - try again later"); // 1013 = Try Again Later
        return;
      }

      // Create connection metadata
      const connection: Connection = {
        ws,
        userId,
        connectionId,
        subscriptions: new Set(), // No channels subscribed initially
        lastPongTime: Date.now(),
        messageCount: 0,
        connectedAt: Date.now(),
      };

      // Store connection in both maps
      userConnections.add(connection);
      this.connections.set(userId, userConnections);
      this.connectionsBySocket.set(ws, connection);

      // Initialize batch buffer for this user
      if (!this.batchBuffers.has(userId)) {
        this.batchBuffers.set(userId, this.createEmptyBatchBuffer());
      }

      log.info("PortfolioStream", "Client connected", {
        userId,
        connectionId,
        totalUserConnections: userConnections.size,
        totalServerConnections: this.getTotalConnectionCount(),
      });

      // Setup WebSocket event handlers for this connection
      this.setupConnectionHandlers(ws, connection);

      // Send welcome message
      this.sendWelcomeMessage(connection);
    } catch (error) {
      log.error("PortfolioStream", "Error handling new connection", {
        connectionId,
        error,
      });
      ws.close(1011, "Internal server error"); // 1011 = Internal Error
    }
  }

  /**
   * Setup event handlers for a WebSocket connection
   *
   * @param ws - WebSocket instance
   * @param connection - Connection metadata
   */
  private setupConnectionHandlers(ws: WebSocket, connection: Connection): void {
    // Handle incoming messages
    ws.on("message", (data: Buffer) => {
      this.handleMessage(ws, data);
    });

    // Handle pong responses (heartbeat)
    ws.on("pong", () => {
      const conn = this.connectionsBySocket.get(ws);
      if (conn) {
        conn.lastPongTime = Date.now();
      }
    });

    // Handle disconnection
    ws.on("close", (code: number, reason: Buffer) => {
      this.handleDisconnection(ws, code, reason.toString());
    });

    // Handle errors
    ws.on("error", (error: Error) => {
      log.error("PortfolioStream", "WebSocket connection error", {
        userId: connection.userId,
        connectionId: connection.connectionId,
        error,
      });
    });
  }

  /**
   * Validate session from HTTP upgrade request
   *
   * @param req - HTTP upgrade request
   * @returns Session data if valid, null otherwise
   */
  private async validateSessionFromRequest(
    req: IncomingMessage
  ): Promise<{ userId: string } | null> {
    try {
      // Extract session cookie from request
      const cookieHeader = req.headers.cookie;
      if (!cookieHeader) {
        return null;
      }

      // Parse session ID from cookies
      const sessionId = this.parseCookie(cookieHeader, "session");
      if (!sessionId) {
        return null;
      }

      // Validate session
      const session = await getSession(sessionId);
      if (!session) {
        return null;
      }

      return { userId: session.userId };
    } catch (error) {
      log.error("PortfolioStream", "Session validation error", { error });
      return null;
    }
  }

  /**
   * Parse a specific cookie value from cookie header
   *
   * @param cookieHeader - Cookie header string
   * @param name - Cookie name to extract
   * @returns Cookie value if found, null otherwise
   */
  private parseCookie(cookieHeader: string, name: string): string | null {
    const cookies = cookieHeader.split(";").map((c) => c.trim());
    const cookie = cookies.find((c) => c.startsWith(`${name}=`));
    return cookie ? cookie.substring(name.length + 1) : null;
  }

  /**
   * Send welcome message to newly connected client
   *
   * @param connection - Connection to send welcome message to
   */
  private sendWelcomeMessage(connection: Connection): void {
    const welcomeEvent = createErrorEvent(
      connection.userId,
      "CONNECTED",
      "WebSocket connection established. Subscribe to channels to receive events.",
      {
        connectionId: connection.connectionId,
        availableChannels: ["positions", "orders", "account", "trades"],
      }
    );

    this.sendToConnection(connection, welcomeEvent);
  }

  // ============================================================================
  // MESSAGE HANDLING
  // ============================================================================

  /**
   * Handle incoming message from client
   *
   * @param ws - WebSocket that sent the message
   * @param data - Raw message data
   */
  private handleMessage(ws: WebSocket, data: Buffer): void {
    const connection = this.connectionsBySocket.get(ws);
    if (!connection) {
      log.warn("PortfolioStream", "Message from unknown connection");
      return;
    }

    try {
      // Parse message as JSON
      const rawMessage = data.toString();
      const message = parseClientMessage(JSON.parse(rawMessage));

      if (!message) {
        log.warn("PortfolioStream", "Invalid client message format", {
          userId: connection.userId,
          connectionId: connection.connectionId,
        });
        this.sendError(
          connection,
          "INVALID_MESSAGE",
          "Message format invalid. Expected {type: 'subscribe'|'unsubscribe'|'ping', channels?: string[]}"
        );
        return;
      }

      // Handle message by type
      switch (message.type) {
        case "subscribe":
          this.handleSubscribe(connection, message.channels || []);
          break;

        case "unsubscribe":
          this.handleUnsubscribe(connection, message.channels || []);
          break;

        case "ping":
          this.handlePing(connection);
          break;

        default:
          log.warn("PortfolioStream", "Unknown message type", {
            userId: connection.userId,
            messageType: (message as any).type,
          });
      }
    } catch (error) {
      log.error("PortfolioStream", "Error handling client message", {
        userId: connection.userId,
        connectionId: connection.connectionId,
        error,
      });
    }
  }

  /**
   * Handle subscribe request
   *
   * @param connection - Connection requesting subscription
   * @param channels - Channels to subscribe to
   */
  private handleSubscribe(
    connection: Connection,
    channels: ChannelType[]
  ): void {
    if (channels.length === 0) {
      this.sendError(
        connection,
        "INVALID_SUBSCRIPTION",
        "No channels specified. Available: positions, orders, account, trades"
      );
      return;
    }

    for (const channel of channels) {
      connection.subscriptions.add(channel);
    }

    log.info("PortfolioStream", "Client subscribed to channels", {
      userId: connection.userId,
      connectionId: connection.connectionId,
      channels: Array.from(connection.subscriptions),
    });

    // Send confirmation
    const confirmEvent = createErrorEvent(
      connection.userId,
      "SUBSCRIBED",
      `Subscribed to channels: ${channels.join(", ")}`,
      { channels }
    );
    this.sendToConnection(connection, confirmEvent);
  }

  /**
   * Handle unsubscribe request
   *
   * @param connection - Connection requesting unsubscription
   * @param channels - Channels to unsubscribe from
   */
  private handleUnsubscribe(
    connection: Connection,
    channels: ChannelType[]
  ): void {
    for (const channel of channels) {
      connection.subscriptions.delete(channel);
    }

    log.info("PortfolioStream", "Client unsubscribed from channels", {
      userId: connection.userId,
      connectionId: connection.connectionId,
      channels,
      remainingChannels: Array.from(connection.subscriptions),
    });

    // Send confirmation
    const confirmEvent = createErrorEvent(
      connection.userId,
      "UNSUBSCRIBED",
      `Unsubscribed from channels: ${channels.join(", ")}`,
      { channels }
    );
    this.sendToConnection(connection, confirmEvent);
  }

  /**
   * Handle ping request (respond with pong)
   *
   * @param connection - Connection that sent ping
   */
  private handlePing(connection: Connection): void {
    const pongEvent = createPongEvent(connection.userId);
    this.sendToConnection(connection, pongEvent);
  }

  /**
   * Handle WebSocket disconnection
   *
   * @param ws - WebSocket that disconnected
   * @param code - Close code
   * @param reason - Close reason
   */
  private handleDisconnection(
    ws: WebSocket,
    code: number,
    reason: string
  ): void {
    const connection = this.connectionsBySocket.get(ws);
    if (!connection) {
      return; // Already cleaned up or never registered
    }

    const duration = Date.now() - connection.connectedAt;

    log.info("PortfolioStream", "Client disconnected", {
      userId: connection.userId,
      connectionId: connection.connectionId,
      code,
      reason: reason || "No reason provided",
      duration: `${Math.round(duration / 1000)}s`,
      messagesSent: connection.messageCount,
    });

    // Remove from tracking maps
    this.connectionsBySocket.delete(ws);

    const userConnections = this.connections.get(connection.userId);
    if (userConnections) {
      userConnections.delete(connection);

      if (userConnections.size === 0) {
        // Last connection for this user - clean up batch buffer
        this.connections.delete(connection.userId);
        this.batchBuffers.delete(connection.userId);
      }
    }

    // Update stats
    this.stats.totalDisconnects++;
  }

  // ============================================================================
  // BROADCASTING
  // ============================================================================

  /**
   * Broadcast an event to all of a user's connections subscribed to the event's channel
   *
   * This is the main entry point for emitting events to clients.
   * Events are added to the batch buffer and sent in 1-second intervals.
   *
   * @param userId - User ID to broadcast to
   * @param event - Portfolio event to broadcast
   *
   * @example
   * portfolioStream.broadcastEvent(userId, createPositionUpdateEvent(userId, positionData));
   */
  public broadcastEvent(userId: string, event: PortfolioEvent): void {
    // Add to batch buffer (will be flushed by batch timer)
    this.addToBatchBuffer(userId, event);
    this.stats.totalEventsEmitted++;
  }

  /**
   * Add event to batch buffer for aggregation
   *
   * @param userId - User ID
   * @param event - Event to add to buffer
   */
  private addToBatchBuffer(userId: string, event: PortfolioEvent): void {
    let buffer = this.batchBuffers.get(userId);
    if (!buffer) {
      buffer = this.createEmptyBatchBuffer();
      this.batchBuffers.set(userId, buffer);
    }

    // Add event to appropriate buffer based on type
    if (event.type === "position_update") {
      // Use symbol as key to deduplicate position updates in same window
      const data = event.data as any;
      buffer.positions.set(data.symbol, data);
    } else if (event.type === "order_update") {
      // Use orderId as key to deduplicate order updates
      const data = event.data as any;
      buffer.orders.set(data.orderId, data);
    } else if (event.type === "account_update") {
      // Only one account update per batch (latest wins)
      buffer.account = event.data;
    } else if (event.type === "trade_executed") {
      // Accumulate all trade events
      buffer.trades.push(event.data);
    } else {
      // For other event types (error, pong), send immediately without batching
      this.sendToUserConnections(userId, event);
    }
  }

  /**
   * Create an empty batch buffer
   */
  private createEmptyBatchBuffer(): BatchBuffer {
    return {
      positions: new Map(),
      orders: new Map(),
      account: null,
      trades: [],
    };
  }

  /**
   * Send event to all of a user's connections (immediate, no batching)
   *
   * @param userId - User ID
   * @param event - Event to send
   */
  private sendToUserConnections(userId: string, event: PortfolioEvent): void {
    const userConnections = this.connections.get(userId);
    if (!userConnections || userConnections.size === 0) {
      return;
    }

    const channel = getChannelForEventType(event.type);

    for (const connection of userConnections) {
      // Check subscription (null channel = always send, like error/pong)
      if (channel && !connection.subscriptions.has(channel)) {
        continue; // Client not subscribed to this channel
      }

      this.sendToConnection(connection, event);
    }
  }

  /**
   * Send event to a specific connection
   *
   * @param connection - Connection to send to
   * @param event - Event to send
   */
  private sendToConnection(
    connection: Connection,
    event: PortfolioEvent
  ): void {
    if (connection.ws.readyState !== WebSocket.OPEN) {
      return; // Connection not open, skip
    }

    try {
      const message = serializeEvent(event);
      connection.ws.send(message);
      connection.messageCount++;
      this.stats.totalMessagesDelivered++;
    } catch (error) {
      log.error("PortfolioStream", "Error sending message to connection", {
        userId: connection.userId,
        connectionId: connection.connectionId,
        eventType: event.type,
        error,
      });
    }
  }

  /**
   * Send error message to connection
   *
   * @param connection - Connection to send error to
   * @param code - Error code
   * @param message - Error message
   */
  private sendError(
    connection: Connection,
    code: string,
    message: string
  ): void {
    const errorEvent = createErrorEvent(connection.userId, code, message);
    this.sendToConnection(connection, errorEvent);
  }

  // ============================================================================
  // BATCHING
  // ============================================================================

  /**
   * Setup batch flush timer
   */
  private setupBatchFlush(): void {
    this.batchTimer = setInterval(() => {
      this.flushBatches();
    }, this.batchWindowMs);
  }

  /**
   * Flush all batched events to clients
   *
   * Called every 1 second by the batch timer.
   * Aggregates all buffered events into batch messages and sends to subscribed clients.
   */
  private flushBatches(): void {
    for (const [userId, buffer] of this.batchBuffers.entries()) {
      // Check if there are any events to send
      if (
        buffer.positions.size === 0 &&
        buffer.orders.size === 0 &&
        !buffer.account &&
        buffer.trades.length === 0
      ) {
        continue; // Nothing to send for this user
      }

      // Create batch data
      const batchData: BatchUpdate = {};

      if (buffer.positions.size > 0) {
        batchData.positions = Array.from(buffer.positions.values());
      }

      if (buffer.orders.size > 0) {
        batchData.orders = Array.from(buffer.orders.values());
      }

      if (buffer.account) {
        batchData.account = buffer.account;
      }

      if (buffer.trades.length > 0) {
        batchData.trades = buffer.trades;
      }

      // Create and send batch event
      const batchEvent = createBatchEvent(userId, batchData);
      this.sendToUserConnections(userId, batchEvent);

      // Clear buffer for next window
      this.batchBuffers.set(userId, this.createEmptyBatchBuffer());

      // Log batch stats
      const eventCount =
        buffer.positions.size +
        buffer.orders.size +
        (buffer.account ? 1 : 0) +
        buffer.trades.length;
      log.debug("PortfolioStream", "Batch flushed", {
        userId,
        positionUpdates: buffer.positions.size,
        orderUpdates: buffer.orders.size,
        accountUpdate: buffer.account ? 1 : 0,
        trades: buffer.trades.length,
        totalEvents: eventCount,
      });
    }
  }

  // ============================================================================
  // HEARTBEAT
  // ============================================================================

  /**
   * Setup heartbeat (ping/pong) mechanism
   */
  private setupHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      this.performHeartbeat();
    }, this.heartbeatIntervalMs);
  }

  /**
   * Perform heartbeat check on all connections
   *
   * Sends ping to all connections and disconnects those that haven't responded to pong.
   */
  private performHeartbeat(): void {
    const now = Date.now();
    const connectionsToClose: WebSocket[] = [];

    for (const [ws, connection] of this.connectionsBySocket.entries()) {
      // Check if pong timeout exceeded
      const timeSinceLastPong = now - connection.lastPongTime;

      if (timeSinceLastPong > this.heartbeatTimeoutMs) {
        log.warn("PortfolioStream", "Heartbeat timeout - closing connection", {
          userId: connection.userId,
          connectionId: connection.connectionId,
          timeSinceLastPong: `${Math.round(timeSinceLastPong / 1000)}s`,
        });
        connectionsToClose.push(ws);
        continue;
      }

      // Send ping
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      }
    }

    // Close timed-out connections
    for (const ws of connectionsToClose) {
      ws.close(1000, "Heartbeat timeout"); // 1000 = Normal Closure
    }
  }

  // ============================================================================
  // UTILITY METHODS
  // ============================================================================

  /**
   * Get total connection count across all users
   */
  private getTotalConnectionCount(): number {
    let total = 0;
    for (const userConnections of this.connections.values()) {
      total += userConnections.size;
    }
    return total;
  }

  /**
   * Get active connections count
   */
  public getActiveConnectionsCount(): number {
    return this.getTotalConnectionCount();
  }

  /**
   * Get connections for a specific user
   *
   * @param userId - User ID
   * @returns Set of connections for the user
   */
  public getUserConnections(userId: string): Set<Connection> | undefined {
    return this.connections.get(userId);
  }

  /**
   * Check if a user is connected
   *
   * @param userId - User ID
   * @returns True if user has at least one active connection
   */
  public isUserConnected(userId: string): boolean {
    const userConnections = this.connections.get(userId);
    return userConnections ? userConnections.size > 0 : false;
  }

  /**
   * Get comprehensive statistics
   *
   * @returns Portfolio stream statistics
   */
  public getStats(): PortfolioStreamStats {
    const activeConnections = this.getTotalConnectionCount();
    const uptime = Date.now() - this.stats.startTime;

    // Calculate connections by user
    const connectionsByUser: Record<string, number> = {};
    for (const [userId, userConnections] of this.connections.entries()) {
      connectionsByUser[userId] = userConnections.size;
    }

    // Calculate average connection duration
    let totalDuration = 0;
    let connectionCount = 0;
    for (const userConnections of this.connections.values()) {
      for (const conn of userConnections) {
        totalDuration += Date.now() - conn.connectedAt;
        connectionCount++;
      }
    }
    const avgConnectionDuration =
      connectionCount > 0 ? totalDuration / connectionCount : 0;

    // Calculate batch efficiency (events emitted / messages delivered)
    const batchEfficiency =
      this.stats.totalMessagesDelivered > 0
        ? 1 - this.stats.totalMessagesDelivered / this.stats.totalEventsEmitted
        : 0;

    return {
      activeConnections,
      connectionsByUser,
      totalMessagesDelivered: this.stats.totalMessagesDelivered,
      totalEventsEmitted: this.stats.totalEventsEmitted,
      totalDisconnects: this.stats.totalDisconnects,
      totalReconnects: this.stats.totalReconnects,
      batchEfficiency,
      avgConnectionDuration: Math.round(avgConnectionDuration / 1000), // seconds
      uptime: Math.round(uptime / 1000), // seconds
    };
  }

  // ============================================================================
  // LIFECYCLE MANAGEMENT
  // ============================================================================

  /**
   * Shutdown the portfolio stream manager
   *
   * Closes all connections and clears timers.
   * Call this during server shutdown for graceful cleanup.
   */
  public shutdown(): void {
    log.info("PortfolioStream", "Shutting down portfolio stream manager...");

    // Clear timers
    if (this.batchTimer) {
      clearInterval(this.batchTimer);
      this.batchTimer = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    // Flush any remaining batches
    this.flushBatches();

    // Close all connections
    const totalConnections = this.getTotalConnectionCount();
    for (const [ws, connection] of this.connectionsBySocket.entries()) {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close(1001, "Server shutting down"); // 1001 = Going Away
      }
    }

    // Clear all maps
    this.connections.clear();
    this.connectionsBySocket.clear();
    this.batchBuffers.clear();

    log.info("PortfolioStream", "Portfolio stream manager shutdown complete", {
      connectionsClosed: totalConnections,
    });
  }
}

// ============================================================================
// SINGLETON INSTANCE (will be initialized in server/index.ts)
// ============================================================================

/**
 * Singleton instance of PortfolioStreamManager
 *
 * Initialized during server startup in server/index.ts
 * Use this instance to broadcast events throughout the application.
 *
 * @example
 * import { portfolioStreamManager } from './lib/portfolio-stream';
 *
 * // Broadcast position update
 * portfolioStreamManager.broadcastEvent(userId, positionUpdateEvent);
 */
export let portfolioStreamManager: PortfolioStreamManager | null = null;

/**
 * Initialize the portfolio stream manager
 *
 * Call this once during server startup to create the WebSocket server.
 *
 * @param httpServer - HTTP server instance to attach WebSocket server to
 * @returns Initialized PortfolioStreamManager instance
 *
 * @example
 * const httpServer = createServer(app);
 * initializePortfolioStream(httpServer);
 */
export function initializePortfolioStream(
  httpServer: Server
): PortfolioStreamManager {
  // Check feature flag
  const enabled = process.env.ENABLE_REALTIME_PORTFOLIO !== "false"; // Default: enabled
  if (!enabled) {
    log.info(
      "PortfolioStream",
      "Real-time portfolio streaming disabled via ENABLE_REALTIME_PORTFOLIO flag"
    );
    return null as any; // Return null when disabled
  }

  // Create WebSocketServer with noServer mode (manual upgrade handling)
  const wss = new WebSocketServer({ noServer: true });

  // Create PortfolioStreamManager
  portfolioStreamManager = new PortfolioStreamManager(wss);

  // Handle HTTP upgrade requests for /ws/portfolio path
  httpServer.on("upgrade", (req, socket, head) => {
    if (req.url === "/ws/portfolio") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    }
  });

  log.info(
    "PortfolioStream",
    "Portfolio stream manager initialized on /ws/portfolio"
  );

  return portfolioStreamManager;
}

/**
 * Get the portfolio stream manager instance
 *
 * @returns PortfolioStreamManager instance or null if not initialized
 */
export function getPortfolioStreamManager(): PortfolioStreamManager | null {
  return portfolioStreamManager;
}
