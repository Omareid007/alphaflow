/**
 * useRealtimeOrders - Real-Time Order Updates via WebSocket
 *
 * @module hooks/useRealtimeOrders
 * @description React hook that subscribes to real-time order status updates via WebSocket
 * and syncs with TanStack Query cache. Provides callbacks for order fills and status changes.
 *
 * This hook:
 * - Subscribes to 'orders' WebSocket channel
 * - Updates TanStack Query cache on order_update events
 * - Handles batch events with multiple order updates
 * - Detects order fills and triggers callbacks
 * - Tracks last update timestamp
 *
 * @see openspec/changes/realtime-portfolio-streaming/design.md
 * @see hooks/usePortfolioStream.ts - Base WebSocket connection hook
 * @see lib/api/hooks/useOrders.ts - Existing order fetching hook
 *
 * @example Basic usage with existing useOrders hook
 * ```typescript
 * import { useOrders } from '@/lib/api/hooks/useOrders';
 * import { useRealtimeOrders } from '@/hooks/useRealtimeOrders';
 *
 * function OrdersPage() {
 *   const { data: orders } = useOrders(); // Existing hook
 *   const { connectionStatus, isConnected } = useRealtimeOrders({
 *     onOrderFilled: (order) => {
 *       toast.success(`Order filled: ${order.symbol} ${order.side}`);
 *     }
 *   });
 *
 *   // orders array now updates in real-time!
 *   return (
 *     <div>
 *       {isConnected && <Badge>Live Updates</Badge>}
 *       {orders.map(order => <OrderRow key={order.id} order={order} />)}
 *     </div>
 *   );
 * }
 * ```
 */

import { useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePortfolioStream,
  type PortfolioEvent,
  type ConnectionStatus,
} from "./usePortfolioStream";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Order update data from WebSocket event
 *
 * Matches OrderUpdate interface from server/lib/portfolio-events.ts
 */
export interface OrderUpdateData {
  orderId: string;
  brokerOrderId: string;
  symbol: string;
  side: "buy" | "sell";
  type: string;
  status: string;
  qty?: string;
  filledQty?: string;
  filledAvgPrice?: string;
  submittedAt: string;
  filledAt?: string;
}

/**
 * Batch event data with orders
 */
interface BatchEventData {
  positions?: unknown[];
  orders?: OrderUpdateData[];
  account?: unknown;
  trades?: unknown[];
}

/**
 * Order interface (matches existing API format)
 *
 * Compatible with lib/api/hooks/useOrders.ts Order type
 */
export interface Order {
  id: string;
  brokerOrderId?: string;
  symbol: string;
  side: "buy" | "sell";
  type: string;
  status: string;
  qty?: number;
  filledQty?: number;
  filledAvgPrice?: number;
  submittedAt: string;
  filledAt?: string;
  updatedAt?: string;
}

/**
 * Hook configuration options
 */
export interface UseRealtimeOrdersOptions {
  /**
   * Enable real-time updates
   * @default true
   */
  enabled?: boolean;

  /**
   * Called when any order is updated
   * @param order - Updated order data from WebSocket
   */
  onOrderUpdate?: (order: OrderUpdateData) => void;

  /**
   * Called when an order is filled (status: 'filled' or 'partially_filled')
   * @param order - Filled order data
   */
  onOrderFilled?: (order: OrderUpdateData) => void;

  /**
   * Called when connection status changes
   * @param status - New connection status
   */
  onStatusChange?: (status: ConnectionStatus) => void;
}

/**
 * Hook return value
 */
export interface UseRealtimeOrdersReturn {
  /**
   * Current WebSocket connection status
   */
  connectionStatus: ConnectionStatus;

  /**
   * Whether WebSocket is connected
   */
  isConnected: boolean;

  /**
   * Timestamp of last order update (null if never updated)
   */
  lastUpdateTime: Date | null;

  /**
   * WebSocket connection error (null if none)
   */
  error: Error | null;
}

// ============================================================================
// QUERY KEY
// ============================================================================

/**
 * TanStack Query key for orders
 *
 * Must match the key used in lib/api/hooks/useOrders.ts
 */
export const ORDERS_QUERY_KEY = ["orders"] as const;

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * useRealtimeOrders - Real-time order status updates via WebSocket
 *
 * This hook enhances the existing useOrders() hook by keeping its TanStack Query
 * cache up-to-date via WebSocket events. It does NOT fetch orders itself.
 *
 * Usage pattern:
 * 1. Component calls useOrders() to get order data (existing hook)
 * 2. Component calls useRealtimeOrders() to enable real-time updates (this hook)
 * 3. WebSocket events update the Query cache, triggering useOrders() to re-render
 *
 * @param options - Configuration options
 * @returns Hook interface with connection status
 */
export function useRealtimeOrders(
  options: UseRealtimeOrdersOptions = {}
): UseRealtimeOrdersReturn {
  const {
    enabled = true,
    onOrderUpdate,
    onOrderFilled,
    onStatusChange,
  } = options;

  const queryClient = useQueryClient();

  // Track last update time
  const lastUpdateTime = useRef<Date | null>(null);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * Handle incoming WebSocket events
   *
   * Updates TanStack Query cache with order data from WebSocket.
   */
  const handleEvent = useCallback(
    (event: PortfolioEvent) => {
      // Handle single order update
      if (event.type === "order_update") {
        const orderData = event.data as OrderUpdateData;

        // Update timestamp
        lastUpdateTime.current = new Date();

        // Transform WebSocket order data to match Order interface
        const order = transformOrderData(orderData);

        // Update TanStack Query cache
        queryClient.setQueryData<Order[]>(ORDERS_QUERY_KEY, (oldOrders) => {
          if (!oldOrders) {
            return [order];
          }

          // Find existing order by ID or broker order ID
          const index = oldOrders.findIndex(
            (o) =>
              o.id === order.id ||
              (o.brokerOrderId && o.brokerOrderId === order.brokerOrderId)
          );

          if (index === -1) {
            // New order - add to beginning (most recent first)
            return [order, ...oldOrders];
          }

          // Update existing order
          const updated = [...oldOrders];
          updated[index] = {
            ...updated[index], // Preserve extra fields
            ...order, // Merge WebSocket update
          };
          return updated;
        });

        // Notify callbacks
        onOrderUpdate?.(orderData);

        // Detect fills
        if (
          orderData.status === "filled" ||
          orderData.status === "partially_filled"
        ) {
          onOrderFilled?.(orderData);
        }
      }

      // Handle batch update (multiple orders at once)
      if (event.type === "batch") {
        const batchData = event.data as BatchEventData;

        if (batchData.orders && batchData.orders.length > 0) {
          lastUpdateTime.current = new Date();

          // Transform all orders in batch
          const batchOrders: Order[] = batchData.orders.map(transformOrderData);

          // Batch update TanStack Query cache
          queryClient.setQueryData<Order[]>(ORDERS_QUERY_KEY, (oldOrders) => {
            const updated = oldOrders ? [...oldOrders] : [];

            for (const order of batchOrders) {
              const index = updated.findIndex(
                (o) =>
                  o.id === order.id ||
                  (o.brokerOrderId && o.brokerOrderId === order.brokerOrderId)
              );

              if (index === -1) {
                // New order
                updated.unshift(order);
              } else {
                // Update existing
                updated[index] = {
                  ...updated[index],
                  ...order,
                };
              }
            }

            return updated;
          });

          // Notify callbacks for each order
          batchData.orders.forEach((orderData) => {
            onOrderUpdate?.(orderData);

            if (
              orderData.status === "filled" ||
              orderData.status === "partially_filled"
            ) {
              onOrderFilled?.(orderData);
            }
          });
        }
      }
    },
    [queryClient, onOrderUpdate, onOrderFilled]
  );

  // ============================================================================
  // WEBSOCKET CONNECTION
  // ============================================================================

  /**
   * Connect to portfolio stream with orders channel subscription
   */
  const { status, error } = usePortfolioStream({
    autoConnect: enabled,
    channels: ["orders"], // Only subscribe to orders channel
    onEvent: handleEvent,
    onStatusChange,
  });

  // ============================================================================
  // RETURN INTERFACE
  // ============================================================================

  return {
    connectionStatus: status,
    isConnected: status === "connected",
    lastUpdateTime: lastUpdateTime.current,
    error,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Transform WebSocket order data to match Order interface
 *
 * Converts string fields to numbers and maps field names.
 *
 * @param wsOrder - Order data from WebSocket
 * @returns Order object matching existing API format
 */
function transformOrderData(wsOrder: OrderUpdateData): Order {
  return {
    id: wsOrder.orderId,
    brokerOrderId: wsOrder.brokerOrderId,
    symbol: wsOrder.symbol,
    side: wsOrder.side,
    type: wsOrder.type,
    status: wsOrder.status,
    qty: wsOrder.qty ? parseFloat(wsOrder.qty) : undefined,
    filledQty: wsOrder.filledQty ? parseFloat(wsOrder.filledQty) : undefined,
    filledAvgPrice: wsOrder.filledAvgPrice
      ? parseFloat(wsOrder.filledAvgPrice)
      : undefined,
    submittedAt: wsOrder.submittedAt,
    filledAt: wsOrder.filledAt,
    updatedAt: new Date().toISOString(),
  };
}

export default useRealtimeOrders;
