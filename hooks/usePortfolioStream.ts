/**
 * usePortfolioStream - Base WebSocket Hook for Real-Time Portfolio Updates
 *
 * @module hooks/usePortfolioStream
 * @description Manages WebSocket connection to /ws/portfolio endpoint with automatic
 * reconnection, authentication via session cookies, and message parsing.
 *
 * Features:
 * - Automatic connection on mount (configurable)
 * - Session cookie authentication (automatic)
 * - Exponential backoff reconnection (1s → 30s, max 10 attempts)
 * - Channel-based subscriptions (positions, orders, account, trades)
 * - Message parsing and validation
 * - Connection state exposure
 * - Cleanup on unmount
 *
 * @see openspec/changes/realtime-portfolio-streaming/design.md
 * @see server/lib/portfolio-stream.ts - Server-side WebSocket manager
 *
 * @example Basic usage
 * ```typescript
 * const { status, lastMessageTime } = usePortfolioStream({
 *   onEvent: (event) => {
 *     if (event.type === 'position_update') {
 *       console.log('Position updated:', event.data);
 *     }
 *   }
 * });
 * ```
 *
 * @example Manual connection control
 * ```typescript
 * const { status, connect, disconnect } = usePortfolioStream({ autoConnect: false });
 *
 * // Connect when needed
 * useEffect(() => {
 *   if (someCondition) {
 *     connect();
 *   }
 * }, [someCondition, connect]);
 * ```
 */

import { useEffect, useRef, useState, useCallback } from "react";

// ============================================================================
// TYPES
// ============================================================================

/**
 * WebSocket connection status states
 */
export type ConnectionStatus =
  | "disconnected" // Not connected
  | "connecting" // Initial connection in progress
  | "connected" // Connected and authenticated
  | "reconnecting" // Reconnection in progress after disconnect
  | "error"; // Failed to connect after max attempts

/**
 * Portfolio event types from server
 *
 * Must match PortfolioEventType from server/lib/portfolio-events.ts
 */
export type PortfolioEventType =
  | "position_update"
  | "order_update"
  | "account_update"
  | "trade_executed"
  | "batch"
  | "pong"
  | "error";

/**
 * Channel types for subscriptions
 */
export type ChannelType = "positions" | "orders" | "account" | "trades";

/**
 * Portfolio event from server
 *
 * @property {PortfolioEventType} type - Event type discriminator
 * @property {string} timestamp - ISO timestamp when event was created
 * @property {string} userId - User ID for event isolation
 * @property {unknown} data - Event-specific payload
 */
export interface PortfolioEvent {
  type: PortfolioEventType;
  timestamp: string;
  userId: string;
  data: unknown;
}

/**
 * Hook configuration options
 */
export interface UsePortfolioStreamOptions {
  /**
   * Automatically connect on mount
   * @default true
   */
  autoConnect?: boolean;

  /**
   * Initial channels to subscribe to
   * @default ['positions', 'orders', 'account', 'trades']
   */
  channels?: ChannelType[];

  /**
   * Called when any event is received (except pong and error)
   * @param event - The portfolio event
   */
  onEvent?: (event: PortfolioEvent) => void;

  /**
   * Called when connection status changes
   * @param status - New connection status
   */
  onStatusChange?: (status: ConnectionStatus) => void;

  /**
   * Called when an error occurs
   * @param error - The error
   */
  onError?: (error: Error) => void;
}

/**
 * Hook return value
 */
export interface UsePortfolioStreamReturn {
  /**
   * Current WebSocket connection status
   */
  status: ConnectionStatus;

  /**
   * Last error encountered (null if none)
   */
  error: Error | null;

  /**
   * Timestamp of last received message (null if none)
   */
  lastMessageTime: Date | null;

  /**
   * Manually initiate connection
   */
  connect: () => void;

  /**
   * Manually close connection
   */
  disconnect: () => void;

  /**
   * Subscribe to additional channels
   * @param channels - Channel names to subscribe to
   */
  subscribe: (channels: ChannelType[]) => void;

  /**
   * Unsubscribe from channels
   * @param channels - Channel names to unsubscribe from
   */
  unsubscribe: (channels: ChannelType[]) => void;

  /**
   * Send ping to server (for testing heartbeat)
   */
  ping: () => void;
}

// ============================================================================
// CONFIGURATION
// ============================================================================

/** Base delay for exponential backoff (1 second) */
const RECONNECT_BASE_DELAY = 1000;

/** Maximum delay between reconnection attempts (30 seconds) */
const RECONNECT_MAX_DELAY = 30000;

/** Maximum number of reconnection attempts before giving up */
const RECONNECT_MAX_ATTEMPTS = 10;

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * usePortfolioStream - React hook for WebSocket portfolio streaming
 *
 * @param options - Configuration options
 * @returns Hook interface with connection state and controls
 */
export function usePortfolioStream(
  options: UsePortfolioStreamOptions = {}
): UsePortfolioStreamReturn {
  const {
    autoConnect = true,
    channels = ["positions", "orders", "account", "trades"],
    onEvent,
    onStatusChange,
    onError,
  } = options;

  // ============================================================================
  // STATE
  // ============================================================================

  const [status, setStatus] = useState<ConnectionStatus>("disconnected");
  const [error, setError] = useState<Error | null>(null);
  const [lastMessageTime, setLastMessageTime] = useState<Date | null>(null);

  // ============================================================================
  // REFS (persist across renders without causing re-renders)
  // ============================================================================

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const subscribedChannels = useRef<Set<ChannelType>>(new Set(channels));
  const isIntentionalDisconnect = useRef(false);

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Update connection status and notify listener
   */
  const updateStatus = useCallback(
    (newStatus: ConnectionStatus) => {
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    },
    [onStatusChange]
  );

  /**
   * Get WebSocket URL based on current page protocol and host
   */
  const getWsUrl = useCallback(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    return `${protocol}//${host}/ws/portfolio`;
  }, []);

  /**
   * Send message to WebSocket if connection is open
   */
  const sendMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify(message));
      } catch (err) {
        console.error("[PortfolioStream] Failed to send message:", err);
      }
    } else {
      console.warn("[PortfolioStream] Cannot send message - not connected");
    }
  }, []);

  // ============================================================================
  // PUBLIC METHODS
  // ============================================================================

  /**
   * Subscribe to channels
   */
  const subscribe = useCallback(
    (channelsToSubscribe: ChannelType[]) => {
      channelsToSubscribe.forEach((ch) => subscribedChannels.current.add(ch));
      sendMessage({ type: "subscribe", channels: channelsToSubscribe });
    },
    [sendMessage]
  );

  /**
   * Unsubscribe from channels
   */
  const unsubscribe = useCallback(
    (channelsToUnsubscribe: ChannelType[]) => {
      channelsToUnsubscribe.forEach((ch) =>
        subscribedChannels.current.delete(ch)
      );
      sendMessage({ type: "unsubscribe", channels: channelsToUnsubscribe });
    },
    [sendMessage]
  );

  /**
   * Send ping to server (for testing)
   */
  const ping = useCallback(() => {
    sendMessage({ type: "ping" });
  }, [sendMessage]);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    // Don't connect if already connected or connecting
    if (
      wsRef.current?.readyState === WebSocket.OPEN ||
      wsRef.current?.readyState === WebSocket.CONNECTING
    ) {
      console.log("[PortfolioStream] Already connected or connecting");
      return;
    }

    // Clear any pending reconnect timeout
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }

    isIntentionalDisconnect.current = false;
    updateStatus("connecting");
    setError(null);

    try {
      const wsUrl = getWsUrl();
      console.log("[PortfolioStream] Connecting to:", wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      // Connection opened
      ws.onopen = () => {
        console.log("[PortfolioStream] Connected successfully");
        updateStatus("connected");
        reconnectAttempts.current = 0;

        // Subscribe to initial channels
        if (subscribedChannels.current.size > 0) {
          const channelArray = Array.from(subscribedChannels.current);
          subscribe(channelArray);
          console.log(
            "[PortfolioStream] Subscribed to channels:",
            channelArray
          );
        }
      };

      // Message received
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as PortfolioEvent;
          setLastMessageTime(new Date());

          // Handle pong (heartbeat response) - don't notify
          if (data.type === "pong") {
            return;
          }

          // Handle error from server - log but don't notify as normal event
          if (data.type === "error") {
            const errorData = data.data as { code?: string; message?: string };
            console.log("[PortfolioStream] Server message:", errorData.message);
            return;
          }

          // Notify listener of portfolio event
          onEvent?.(data);
        } catch (parseError) {
          console.error(
            "[PortfolioStream] Failed to parse message:",
            parseError
          );
        }
      };

      // WebSocket error
      ws.onerror = () => {
        console.error("[PortfolioStream] WebSocket connection error");
        const err = new Error("WebSocket connection error");
        setError(err);
        onError?.(err);
      };

      // Connection closed
      ws.onclose = (event) => {
        console.log(
          "[PortfolioStream] Disconnected:",
          event.code,
          event.reason || "No reason"
        );
        wsRef.current = null;

        // Don't reconnect on intentional disconnect
        if (isIntentionalDisconnect.current) {
          updateStatus("disconnected");
          return;
        }

        // Don't reconnect on normal closure (1000) or auth failure (1008)
        if (event.code === 1000 || event.code === 1008) {
          updateStatus("disconnected");
          if (event.code === 1008) {
            const err = new Error("Authentication failed - session expired");
            setError(err);
            onError?.(err);
          }
          return;
        }

        // Attempt reconnection with exponential backoff
        if (reconnectAttempts.current < RECONNECT_MAX_ATTEMPTS) {
          updateStatus("reconnecting");

          const delay = Math.min(
            RECONNECT_BASE_DELAY * Math.pow(2, reconnectAttempts.current),
            RECONNECT_MAX_DELAY
          );

          const attempt = reconnectAttempts.current + 1;
          console.log(
            `[PortfolioStream] Reconnecting in ${delay}ms (attempt ${attempt}/${RECONNECT_MAX_ATTEMPTS})`
          );

          reconnectTimeout.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else {
          console.error(
            "[PortfolioStream] Max reconnection attempts reached - giving up"
          );
          updateStatus("error");
          const err = new Error(
            "Failed to connect after maximum reconnection attempts"
          );
          setError(err);
          onError?.(err);
        }
      };
    } catch (err) {
      console.error("[PortfolioStream] Failed to create WebSocket:", err);
      updateStatus("error");
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
    }
  }, [getWsUrl, updateStatus, subscribe, onEvent, onError]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    isIntentionalDisconnect.current = true;

    // Clear reconnect timeout
    if (reconnectTimeout.current) {
      clearTimeout(reconnectTimeout.current);
      reconnectTimeout.current = null;
    }

    // Close WebSocket connection
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.close(1000, "Client initiated disconnect");
      }
      wsRef.current = null;
    }

    updateStatus("disconnected");
    reconnectAttempts.current = 0;
    setError(null);

    console.log("[PortfolioStream] Disconnected by client");
  }, [updateStatus]);

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  /**
   * Auto-connect on mount if enabled
   * Cleanup on unmount
   */
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Cleanup function - runs on unmount
    return () => {
      disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps - only run on mount/unmount

  // ============================================================================
  // RETURN INTERFACE
  // ============================================================================

  return {
    status,
    error,
    lastMessageTime,
    connect,
    disconnect,
    subscribe,
    unsubscribe,
    ping,
  };
}

export default usePortfolioStream;
