/**
 * React Hook for Server-Sent Events (SSE)
 *
 * Provides real-time updates from server via EventSource API
 * Auto-reconnects on disconnect with exponential backoff
 */

import { useEffect, useRef, useState, useCallback } from 'react';

export type SSEEventType =
  | 'order:update'
  | 'order:fill'
  | 'position:update'
  | 'trade:new'
  | 'price:update'
  | 'ai:decision'
  | 'agent:status'
  | 'strategy:update'
  | 'alert:new';

export interface SSEEvent<T = any> {
  type: SSEEventType;
  data: T;
  timestamp: string;
  userId?: string;
}

export interface SSEHookOptions {
  /** Whether to automatically connect on mount (default: true) */
  autoConnect?: boolean;
  /** Maximum number of reconnection attempts (default: Infinity) */
  maxReconnectAttempts?: number;
  /** Initial reconnection delay in ms (default: 1000) */
  reconnectDelay?: number;
  /** Maximum reconnection delay in ms (default: 30000) */
  maxReconnectDelay?: number;
  /** Event handlers */
  onEvent?: (event: SSEEvent) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Event) => void;
}

export interface SSEHookReturn {
  /** Current connection status */
  connected: boolean;
  /** Connection error if any */
  error: Event | null;
  /** Manually connect to SSE endpoint */
  connect: () => void;
  /** Manually disconnect */
  disconnect: () => void;
  /** Subscribe to specific event type */
  on: <T = any>(eventType: SSEEventType, handler: (data: T) => void) => () => void;
  /** Current reconnection attempt count */
  reconnectAttempts: number;
}

/**
 * Hook to connect to SSE endpoint and receive real-time updates
 */
export function useSSE(
  endpoint: string = '/api/events',
  options: SSEHookOptions = {}
): SSEHookReturn {
  const {
    autoConnect = true,
    maxReconnectAttempts = Infinity,
    reconnectDelay = 1000,
    maxReconnectDelay = 30000,
    onEvent,
    onConnect,
    onDisconnect,
    onError,
  } = options;

  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<Event | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const eventHandlersRef = useRef<Map<SSEEventType, Set<(data: any) => void>>>(new Map());

  /**
   * Calculate reconnection delay with exponential backoff
   */
  const getReconnectDelay = useCallback((attempts: number): number => {
    const delay = Math.min(reconnectDelay * Math.pow(2, attempts), maxReconnectDelay);
    return delay;
  }, [reconnectDelay, maxReconnectDelay]);

  /**
   * Connect to SSE endpoint
   */
  const connect = useCallback(() => {
    // Clean up existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    try {
      console.log('[SSE] Connecting to', endpoint);
      const eventSource = new EventSource(endpoint);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        console.log('[SSE] Connected');
        setConnected(true);
        setError(null);
        setReconnectAttempts(0);
        onConnect?.();
      };

      eventSource.onerror = (err) => {
        console.error('[SSE] Connection error:', err);
        setConnected(false);
        setError(err);
        onError?.(err);

        // Attempt reconnection
        if (reconnectAttempts < maxReconnectAttempts) {
          const delay = getReconnectDelay(reconnectAttempts);
          console.log(`[SSE] Reconnecting in ${delay}ms (attempt ${reconnectAttempts + 1})`);

          reconnectTimeoutRef.current = setTimeout(() => {
            setReconnectAttempts(prev => prev + 1);
            connect();
          }, delay);
        } else {
          console.error('[SSE] Max reconnection attempts reached');
        }
      };

      // Listen for all event types
      const eventTypes: SSEEventType[] = [
        'order:update',
        'order:fill',
        'position:update',
        'trade:new',
        'price:update',
        'ai:decision',
        'agent:status',
        'strategy:update',
        'alert:new',
      ];

      eventTypes.forEach(eventType => {
        eventSource.addEventListener(eventType, (event: MessageEvent) => {
          try {
            const data = JSON.parse(event.data);
            const sseEvent: SSEEvent = {
              type: eventType,
              data,
              timestamp: new Date().toISOString(),
            };

            // Call global handler
            onEvent?.(sseEvent);

            // Call specific event handlers
            const handlers = eventHandlersRef.current.get(eventType);
            if (handlers) {
              handlers.forEach(handler => handler(data));
            }
          } catch (parseError) {
            console.error('[SSE] Failed to parse event data:', parseError);
          }
        });
      });

    } catch (err) {
      console.error('[SSE] Failed to create EventSource:', err);
      setError(err as Event);
    }
  }, [endpoint, reconnectAttempts, maxReconnectAttempts, getReconnectDelay, onEvent, onConnect, onError]);

  /**
   * Disconnect from SSE endpoint
   */
  const disconnect = useCallback(() => {
    console.log('[SSE] Disconnecting');

    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setConnected(false);
    setReconnectAttempts(0);
    onDisconnect?.();
  }, [onDisconnect]);

  /**
   * Subscribe to specific event type
   */
  const on = useCallback(<T = any>(
    eventType: SSEEventType,
    handler: (data: T) => void
  ): (() => void) => {
    if (!eventHandlersRef.current.has(eventType)) {
      eventHandlersRef.current.set(eventType, new Set());
    }

    const handlers = eventHandlersRef.current.get(eventType)!;
    handlers.add(handler);

    // Return unsubscribe function
    return () => {
      handlers.delete(handler);
      if (handlers.size === 0) {
        eventHandlersRef.current.delete(eventType);
      }
    };
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }

    // Cleanup on unmount
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    connected,
    error,
    connect,
    disconnect,
    on,
    reconnectAttempts,
  };
}

/**
 * Example usage:
 *
 * const { connected, on } = useSSE('/api/events');
 *
 * useEffect(() => {
 *   const unsubscribe = on('order:update', (data) => {
 *     console.log('Order updated:', data);
 *   });
 *
 *   return unsubscribe;
 * }, [on]);
 */
