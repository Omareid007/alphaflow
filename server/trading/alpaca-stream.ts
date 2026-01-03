import WebSocket from "ws";
import { log } from "../utils/logger";
import { storage } from "../storage";
import type { OrderStatus } from "@shared/schema";
import { hookIntoTradeUpdates } from "./order-retry-handler";
import { toDecimal, calculatePnL, formatPrice } from "../utils/money";
import { tradingConfig } from "../config/trading-config";
import { broadcastTradeUpdate } from "../lib/websocket-server";

// Use config-based URL that respects ALPACA_TRADING_MODE environment variable
const ALPACA_STREAM_URL =
  tradingConfig.alpaca.tradingMode === "live"
    ? "wss://api.alpaca.markets/stream"
    : "wss://paper-api.alpaca.markets/stream";

export interface AlpacaTradeUpdate {
  event: string;
  order: {
    id: string;
    client_order_id: string;
    created_at: string;
    updated_at: string;
    submitted_at: string;
    filled_at: string | null;
    expired_at: string | null;
    canceled_at: string | null;
    failed_at: string | null;
    asset_id: string;
    symbol: string;
    asset_class: string;
    notional: string | null;
    qty: string;
    filled_qty: string;
    filled_avg_price: string | null;
    order_class: string;
    order_type: string;
    type: string;
    side: string;
    time_in_force: string;
    limit_price: string | null;
    stop_price: string | null;
    status: string;
    extended_hours: boolean;
  };
  timestamp: string;
  position_qty?: string;
  price?: string;
  qty?: string;
  execution_id?: string;
}

function mapAlpacaStatusToOrderStatus(alpacaStatus: string): OrderStatus {
  const statusMap: Record<string, OrderStatus> = {
    new: "new",
    accepted: "accepted",
    pending_new: "pending_new",
    accepted_for_bidding: "accepted",
    stopped: "stopped",
    rejected: "rejected",
    suspended: "suspended",
    calculated: "calculated",
    partially_filled: "partially_filled",
    filled: "filled",
    done_for_day: "done_for_day",
    canceled: "canceled",
    expired: "expired",
    replaced: "replaced",
    pending_cancel: "pending_cancel",
    pending_replace: "pending_replace",
  };
  return statusMap[alpacaStatus.toLowerCase()] || "new";
}

class AlpacaStreamManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private isAuthenticated = false;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private lastPongTime = Date.now();

  private getCredentials(): { apiKey: string; secretKey: string } | null {
    const apiKey = process.env.ALPACA_API_KEY;
    const secretKey = process.env.ALPACA_SECRET_KEY;
    if (!apiKey || !secretKey) return null;
    return { apiKey, secretKey };
  }

  async connect(): Promise<void> {
    if (
      this.isConnecting ||
      (this.ws && this.ws.readyState === WebSocket.OPEN)
    ) {
      log.debug("AlpacaStream", "Already connected or connecting");
      return;
    }

    const credentials = this.getCredentials();
    if (!credentials) {
      log.warn(
        "AlpacaStream",
        "Alpaca credentials not configured, skipping stream connection"
      );
      return;
    }

    this.isConnecting = true;
    log.info("AlpacaStream", "Connecting to Alpaca trade updates stream...");

    try {
      this.ws = new WebSocket(ALPACA_STREAM_URL);

      this.ws.on("open", () => {
        log.info("AlpacaStream", "WebSocket connected, authenticating...");
        this.authenticate(credentials);
      });

      this.ws.on("message", (data: WebSocket.Data) => {
        this.handleMessage(data);
      });

      this.ws.on("close", (code, reason) => {
        log.warn(
          "AlpacaStream",
          `WebSocket closed: ${code} - ${reason.toString()}`
        );
        this.isAuthenticated = false;
        this.isConnecting = false;
        this.stopHeartbeat();
        this.scheduleReconnect();
      });

      this.ws.on("error", (error) => {
        log.error("AlpacaStream", `WebSocket error: ${error.message}`);
        this.isConnecting = false;
      });

      this.ws.on("pong", () => {
        this.lastPongTime = Date.now();
      });
    } catch (error) {
      log.error("AlpacaStream", `Failed to connect: ${error}`);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private authenticate(credentials: {
    apiKey: string;
    secretKey: string;
  }): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const authMessage = {
      action: "auth",
      key: credentials.apiKey,
      secret: credentials.secretKey,
    };

    this.ws.send(JSON.stringify(authMessage));
  }

  private subscribeToTradeUpdates(): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const subscribeMessage = {
      action: "listen",
      data: {
        streams: ["trade_updates"],
      },
    };

    this.ws.send(JSON.stringify(subscribeMessage));
    log.info("AlpacaStream", "Subscribed to trade_updates stream");
    this.startHeartbeat();
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.ping();
        if (Date.now() - this.lastPongTime > 60000) {
          log.warn("AlpacaStream", "No pong received in 60s, reconnecting...");
          this.ws.terminate();
        }
      }
    }, 30000);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private async handleMessage(data: WebSocket.Data): Promise<void> {
    try {
      const message = JSON.parse(data.toString());

      if (message.stream === "authorization") {
        if (message.data?.status === "authorized") {
          log.info("AlpacaStream", "Authentication successful");
          this.isAuthenticated = true;
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.subscribeToTradeUpdates();
        } else {
          log.error(
            "AlpacaStream",
            `Authentication failed: ${JSON.stringify(message.data)}`
          );
          this.isConnecting = false;
        }
        return;
      }

      if (message.stream === "listening") {
        log.info(
          "AlpacaStream",
          `Now listening to: ${message.data?.streams?.join(", ")}`
        );
        return;
      }

      if (message.stream === "trade_updates") {
        await this.handleTradeUpdate(message.data as AlpacaTradeUpdate);
      }
    } catch (error) {
      log.error("AlpacaStream", `Failed to parse message: ${error}`);
    }
  }

  private async handleTradeUpdate(update: AlpacaTradeUpdate): Promise<void> {
    const { event, order, timestamp, price, qty, execution_id } = update;
    const brokerOrderId = order.id;

    log.info(
      "AlpacaStream",
      `Trade update: ${event} for order ${brokerOrderId} (${order.symbol})`
    );

    try {
      const existingOrder =
        await storage.getOrderByBrokerOrderId(brokerOrderId);
      const traceId = existingOrder?.traceId || `stream-${Date.now()}`;

      // Get userId from existing order, or fall back to admin user
      let userId = existingOrder?.userId;
      if (!userId) {
        const adminUser = await storage.getAdminUser();
        userId = adminUser?.id;
        if (!userId) {
          log.error(
            "AlpacaStream",
            `No userId available for order ${brokerOrderId}, skipping update`
          );
          return;
        }
      }

      const newStatus = mapAlpacaStatusToOrderStatus(order.status);

      await storage.upsertOrderByBrokerOrderId(brokerOrderId, {
        userId,
        broker: "alpaca",
        brokerOrderId,
        clientOrderId: order.client_order_id,
        symbol: order.symbol,
        side: order.side as "buy" | "sell",
        type: order.type as
          | "market"
          | "limit"
          | "stop"
          | "stop_limit"
          | "trailing_stop",
        timeInForce: order.time_in_force,
        qty: order.qty,
        notional: order.notional,
        limitPrice: order.limit_price,
        stopPrice: order.stop_price,
        status: newStatus,
        submittedAt: order.submitted_at
          ? new Date(order.submitted_at)
          : new Date(),
        updatedAt: new Date(order.updated_at),
        filledAt: order.filled_at ? new Date(order.filled_at) : undefined,
        filledQty: order.filled_qty,
        filledAvgPrice: order.filled_avg_price,
        traceId,
        rawJson: order,
      });

      // Broadcast trade update to connected WebSocket clients
      broadcastTradeUpdate({
        orderId: brokerOrderId,
        symbol: order.symbol,
        side: order.side,
        status: newStatus,
        filledQty: order.filled_qty,
        filledPrice: order.filled_avg_price || undefined,
      });

      if ((event === "fill" || event === "partial_fill") && price && qty) {
        const fillId =
          execution_id ||
          `${brokerOrderId}-${qty}-${price}-${Math.floor(new Date(timestamp).getTime() / 1000)}`;

        try {
          await storage.createFill({
            broker: "alpaca",
            brokerOrderId,
            brokerFillId: fillId,
            orderId: existingOrder?.id,
            symbol: order.symbol,
            side: order.side as "buy" | "sell",
            qty,
            price,
            occurredAt: new Date(timestamp),
            traceId,
            rawJson: update,
          });
          log.info(
            "AlpacaStream",
            `Created fill record: ${fillId} for ${qty} @ ${price}`
          );

          // Auto-create trade record when order is fully filled
          if (event === "fill" && existingOrder?.id) {
            try {
              // Calculate PnL if this is a closing trade
              let pnl = null;

              // Check if we have a position for this symbol to calculate PnL
              const positions = await storage.getPositions(userId);
              const position = positions.find((p) => p.symbol === order.symbol);

              if (position && order.side !== position.side) {
                // This is a closing trade - calculate PnL using Decimal.js for precision
                const side = order.side === "sell" ? "long" : "short";
                pnl = formatPrice(
                  calculatePnL(position.entryPrice, price, qty, side),
                  2
                );
              }

              await storage.createTrade({
                userId,
                orderId: existingOrder.id,
                symbol: order.symbol,
                side: order.side as "buy" | "sell",
                quantity: qty,
                price,
                pnl,
                status: "completed",
                traceId,
                notes: `Auto-created from fill ${fillId}`,
              });

              log.info(
                "AlpacaStream",
                `Auto-created trade record for filled order ${brokerOrderId}, symbol: ${order.symbol}, qty: ${qty}, price: ${price}${pnl ? `, pnl: ${pnl}` : ""}`
              );
            } catch (tradeError) {
              const errorMessage =
                tradeError instanceof Error
                  ? tradeError.message
                  : String(tradeError);
              log.error("AlpacaStream", "Failed to auto-create trade record", {
                error: errorMessage,
              });
            }
          }
        } catch (fillError) {
          const isDuplicate =
            (fillError instanceof Error &&
              fillError.message?.includes("duplicate")) ||
            (typeof fillError === "object" &&
              fillError !== null &&
              "code" in fillError &&
              fillError.code === "23505");

          if (isDuplicate) {
            log.debug("AlpacaStream", `Fill already exists: ${fillId}`);
          } else {
            throw fillError;
          }
        }
      }

      log.debug(
        "AlpacaStream",
        `Order ${brokerOrderId} updated to status: ${newStatus}`
      );

      // Emit SSE event for order update
      try {
        const {
          emitOrderUpdate,
          emitOrderFill,
        } = require("../lib/sse-emitter");

        // Emit order status update
        emitOrderUpdate(brokerOrderId, {
          status: newStatus,
          symbol: order.symbol,
          side: order.side,
          qty: order.qty,
          filledQty: order.filled_qty,
          filledAvgPrice: order.filled_avg_price,
          type: order.type,
          timeInForce: order.time_in_force,
        });

        // Emit fill event if order was filled
        if (event === "fill" || event === "partial_fill") {
          emitOrderFill(brokerOrderId, {
            symbol: order.symbol,
            side: order.side,
            qty,
            price,
            filledQty: order.filled_qty,
            filledAvgPrice: order.filled_avg_price,
            partial: event === "partial_fill",
          });
        }
      } catch (sseError) {
        log.error("AlpacaStream", `Failed to emit SSE event: ${sseError}`);
      }

      // Hook into order retry handler for rejected/canceled orders
      if (newStatus === "rejected" || newStatus === "canceled") {
        hookIntoTradeUpdates(update);
      }
    } catch (error) {
      log.error("AlpacaStream", `Failed to process trade update: ${error}`);
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      log.error("AlpacaStream", "Max reconnection attempts reached, giving up");
      return;
    }

    const delay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      60000
    );
    this.reconnectAttempts++;

    log.info(
      "AlpacaStream",
      `Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`
    );

    setTimeout(() => {
      this.connect();
    }, delay);
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isAuthenticated = false;
    this.isConnecting = false;
    log.info("AlpacaStream", "Disconnected from Alpaca stream");
  }

  isConnected(): boolean {
    return (
      this.ws !== null &&
      this.ws.readyState === WebSocket.OPEN &&
      this.isAuthenticated
    );
  }

  getStatus(): {
    connected: boolean;
    authenticated: boolean;
    reconnectAttempts: number;
  } {
    return {
      connected: this.ws?.readyState === WebSocket.OPEN,
      authenticated: this.isAuthenticated,
      reconnectAttempts: this.reconnectAttempts,
    };
  }
}

export const alpacaStream = new AlpacaStreamManager();
