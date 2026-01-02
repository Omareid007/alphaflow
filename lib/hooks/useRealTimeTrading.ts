"use client";

import { useState, useEffect, useCallback, useRef } from "react";

export interface PriceUpdateData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export interface RealTimeTradingOptions {
  enabled?: boolean;
  userId?: string;
  onOrderUpdate?: (data: OrderUpdateData) => void;
  onOrderFill?: (data: OrderFillData) => void;
  onPositionUpdate?: (data: PositionUpdateData) => void;
  onPriceUpdate?: (data: PriceUpdateData) => void;
  onError?: (error: Error) => void;
}

export interface OrderUpdateData {
  orderId: string;
  symbol: string;
  side: "buy" | "sell";
  status: string;
  qty: number;
  filledQty?: number;
  avgPrice?: number;
}

export interface OrderFillData {
  orderId: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  filledQty?: number;
  price: number;
  timestamp: string;
}

export interface PositionUpdateData {
  symbol: string;
  qty: number;
  avgEntryPrice: number;
  currentPrice: number;
  unrealizedPl: number;
  totalPnL?: number;
  totalValue?: number;
}

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

/**
 * Hook for real-time trading updates via SSE
 * Connects to /api/sse/trading for live order and position updates
 */
export function useRealTimeTrading(options: RealTimeTradingOptions = {}) {
  const {
    enabled = true,
    userId,
    onOrderUpdate,
    onOrderFill,
    onPositionUpdate,
    onPriceUpdate,
    onError,
  } = options;

  const [isConnected, setIsConnected] = useState(false);
  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const connect = useCallback(() => {
    if (!enabled || !userId) return;

    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    setStatus("connecting");

    try {
      const url = `/api/sse/trading?userId=${encodeURIComponent(userId)}`;
      const eventSource = new EventSource(url);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        setIsConnected(true);
        setStatus("connected");
        reconnectAttemptsRef.current = 0;
      };

      eventSource.onerror = () => {
        setIsConnected(false);
        setStatus("error");
        eventSource.close();

        // Exponential backoff reconnect
        const delay = Math.min(
          1000 * Math.pow(2, reconnectAttemptsRef.current),
          30000
        );
        reconnectAttemptsRef.current++;

        reconnectTimeoutRef.current = setTimeout(() => {
          if (enabled) connect();
        }, delay);
      };

      // Listen for order updates
      eventSource.addEventListener("order:update", (event) => {
        try {
          const data = JSON.parse(event.data) as OrderUpdateData;
          onOrderUpdate?.(data);
        } catch (e) {
          console.error("Failed to parse order update:", e);
        }
      });

      // Listen for order fills
      eventSource.addEventListener("order:fill", (event) => {
        try {
          const data = JSON.parse(event.data) as OrderFillData;
          onOrderFill?.(data);
        } catch (e) {
          console.error("Failed to parse order fill:", e);
        }
      });

      // Listen for position updates
      eventSource.addEventListener("position:update", (event) => {
        try {
          const data = JSON.parse(event.data) as PositionUpdateData;
          onPositionUpdate?.(data);
        } catch (e) {
          console.error("Failed to parse position update:", e);
        }
      });

      // Listen for price updates
      eventSource.addEventListener("price:update", (event) => {
        try {
          const data = JSON.parse(event.data) as PriceUpdateData;
          onPriceUpdate?.(data);
        } catch (e) {
          console.error("Failed to parse price update:", e);
        }
      });

      // Heartbeat to keep connection alive
      eventSource.addEventListener("heartbeat", () => {
        // Connection is alive
      });
    } catch (error) {
      setStatus("error");
      onError?.(error instanceof Error ? error : new Error(String(error)));
    }
  }, [
    enabled,
    userId,
    onOrderUpdate,
    onOrderFill,
    onPositionUpdate,
    onPriceUpdate,
    onError,
  ]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    setIsConnected(false);
    setStatus("disconnected");
  }, []);

  useEffect(() => {
    if (enabled && userId) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [enabled, userId, connect, disconnect]);

  return {
    isConnected,
    status,
    connect,
    disconnect,
  };
}
