/**
 * useRealtimePositions - Real-Time Position Updates via WebSocket
 *
 * @module hooks/useRealtimePositions
 * @description React hook that subscribes to real-time position updates via WebSocket
 * and syncs with TanStack Query cache. Falls back to REST polling if WebSocket fails.
 *
 * This hook:
 * - Subscribes to 'positions' WebSocket channel
 * - Updates TanStack Query cache on position_update events
 * - Handles batch events with multiple position updates
 * - Tracks staleness per position (shows warning if > 60s old)
 * - Falls back to REST polling if WebSocket disconnects
 * - Provides connection status to UI components
 *
 * @see openspec/changes/realtime-portfolio-streaming/design.md
 * @see hooks/usePortfolioStream.ts - Base WebSocket connection hook
 * @see lib/api/hooks/usePortfolio.ts - Existing position fetching hook
 *
 * @example Basic usage (with existing usePositions hook)
 * ```typescript
 * import { usePositions } from '@/lib/api/hooks/usePortfolio';
 * import { useRealtimePositions } from '@/hooks/useRealtimePositions';
 *
 * function PortfolioDashboard() {
 *   const { data: positions } = usePositions(); // TanStack Query hook
 *   const { connectionStatus, hasStaleData } = useRealtimePositions(); // Real-time sync
 *
 *   // positions array is now updated in real-time via WebSocket!
 *   return (
 *     <div>
 *       {connectionStatus === 'connected' && <Badge>Live</Badge>}
 *       {hasStaleData && <Warning>Data may be outdated</Warning>}
 *       {positions.map(p => <PositionCard key={p.symbol} position={p} />)}
 *     </div>
 *   );
 * }
 * ```
 */

import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  usePortfolioStream,
  type PortfolioEvent,
  type ConnectionStatus,
} from "./usePortfolioStream";
import type { Position } from "../lib/api/hooks/usePortfolio";

// ============================================================================
// TYPES
// ============================================================================

/**
 * Position update data from WebSocket event
 *
 * Matches PositionUpdate interface from server/lib/portfolio-events.ts
 */
interface PositionUpdateData {
  symbol: string;
  quantity: string;
  currentPrice: string;
  entryPrice: string;
  unrealizedPnl: string;
  unrealizedPnlPercent: string;
  marketValue: string;
  side: "long" | "short";
  strategyId?: string;
  openedAt: string;
}

/**
 * Batch event data with positions
 */
interface BatchEventData {
  positions?: PositionUpdateData[];
  orders?: unknown[];
  account?: unknown;
  trades?: unknown[];
}

/**
 * Hook configuration options
 */
export interface UseRealtimePositionsOptions {
  /**
   * Enable real-time updates
   * @default true
   */
  enabled?: boolean;

  /**
   * Stale threshold in milliseconds (position is stale if not updated in this time)
   * @default 60000 (1 minute)
   */
  staleThreshold?: number;

  /**
   * Called when a position is updated via WebSocket
   * @param position - Updated position data
   */
  onPositionUpdate?: (position: PositionUpdateData) => void;

  /**
   * Called when connection status changes
   * @param status - New connection status
   */
  onStatusChange?: (status: ConnectionStatus) => void;
}

/**
 * Hook return value
 */
export interface UseRealtimePositionsReturn {
  /**
   * Current WebSocket connection status
   */
  connectionStatus: ConnectionStatus;

  /**
   * Whether WebSocket is connected
   */
  isConnected: boolean;

  /**
   * Whether any position data is stale (not updated in staleThreshold)
   */
  hasStaleData: boolean;

  /**
   * Timestamp of last position update (null if never updated)
   */
  lastUpdateTime: Date | null;

  /**
   * Map of symbol → last update timestamp (for per-position staleness)
   */
  positionUpdateTimes: Map<string, Date>;
}

// ============================================================================
// QUERY KEY
// ============================================================================

/**
 * TanStack Query key for positions
 *
 * Must match the key used in lib/api/hooks/usePortfolio.ts usePositions() hook
 */
export const POSITIONS_QUERY_KEY = ["positions"] as const;

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * useRealtimePositions - Real-time position updates via WebSocket
 *
 * This hook does NOT fetch positions itself - it enhances the existing usePositions()
 * hook by keeping its TanStack Query cache up-to-date via WebSocket events.
 *
 * Usage pattern:
 * 1. Component calls usePositions() to get position data (uses existing hook)
 * 2. Component calls useRealtimePositions() to enable real-time updates (this hook)
 * 3. WebSocket events update the Query cache, triggering usePositions() to re-render
 *
 * @param options - Configuration options
 * @returns Hook interface with connection status and staleness tracking
 */
export function useRealtimePositions(
  options: UseRealtimePositionsOptions = {}
): UseRealtimePositionsReturn {
  const {
    enabled = true,
    staleThreshold = 60000,
    onPositionUpdate,
    onStatusChange,
  } = options;

  const queryClient = useQueryClient();

  // ============================================================================
  // STATE TRACKING
  // ============================================================================

  // Track last update time per symbol for staleness detection
  const positionUpdateTimes = useRef<Map<string, Date>>(new Map());
  const lastUpdateTime = useRef<Date | null>(null);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * Handle incoming WebSocket events
   *
   * Updates TanStack Query cache with position data from WebSocket.
   */
  const handleEvent = useCallback(
    (event: PortfolioEvent) => {
      // Handle single position update
      if (event.type === "position_update") {
        const positionData = event.data as PositionUpdateData;

        // Update timestamp tracking
        const now = new Date();
        positionUpdateTimes.current.set(positionData.symbol, now);
        lastUpdateTime.current = now;

        // Transform WebSocket position data to match Position interface
        const position: Position = {
          id: positionData.symbol, // Use symbol as ID for cache merging
          symbol: positionData.symbol,
          side: positionData.side,
          qty: parseFloat(positionData.quantity),
          entryPrice: parseFloat(positionData.entryPrice),
          currentPrice: parseFloat(positionData.currentPrice),
          marketValue: parseFloat(positionData.marketValue),
          unrealizedPl: parseFloat(positionData.unrealizedPnl),
          unrealizedPlPct: parseFloat(positionData.unrealizedPnlPercent),
          costBasis:
            parseFloat(positionData.entryPrice) *
            parseFloat(positionData.quantity),
          assetClass: "us_equity", // Default to us_equity
        };

        // Update TanStack Query cache
        queryClient.setQueryData<Position[]>(
          POSITIONS_QUERY_KEY,
          (oldPositions) => {
            if (!oldPositions) {
              return [position];
            }

            const index = oldPositions.findIndex(
              (p) => p.symbol === position.symbol
            );

            if (index === -1) {
              // New position - add to array
              return [...oldPositions, position];
            }

            // Update existing position
            const updated = [...oldPositions];
            updated[index] = {
              ...updated[index], // Preserve any extra fields
              ...position, // Merge WebSocket update
            };
            return updated;
          }
        );

        // Notify callback
        onPositionUpdate?.(positionData);
      }

      // Handle batch update (multiple positions at once)
      if (event.type === "batch") {
        const batchData = event.data as BatchEventData;

        if (batchData.positions && batchData.positions.length > 0) {
          const now = new Date();

          // Update timestamps for all positions in batch
          batchData.positions.forEach((posData) => {
            positionUpdateTimes.current.set(posData.symbol, now);
          });
          lastUpdateTime.current = now;

          // Transform all positions in batch
          const batchPositions: Position[] = batchData.positions.map(
            (posData) => ({
              id: posData.symbol,
              symbol: posData.symbol,
              side: posData.side,
              qty: parseFloat(posData.quantity),
              entryPrice: parseFloat(posData.entryPrice),
              currentPrice: parseFloat(posData.currentPrice),
              marketValue: parseFloat(posData.marketValue),
              unrealizedPl: parseFloat(posData.unrealizedPnl),
              unrealizedPlPct: parseFloat(posData.unrealizedPnlPercent),
              costBasis:
                parseFloat(posData.entryPrice) * parseFloat(posData.quantity),
              assetClass: "us_equity",
            })
          );

          // Batch update TanStack Query cache
          queryClient.setQueryData<Position[]>(
            POSITIONS_QUERY_KEY,
            (oldPositions) => {
              if (!oldPositions) {
                return batchPositions;
              }

              const updated = [...oldPositions];

              for (const position of batchPositions) {
                const index = updated.findIndex(
                  (p) => p.symbol === position.symbol
                );

                if (index === -1) {
                  // New position
                  updated.push(position);
                } else {
                  // Update existing
                  updated[index] = {
                    ...updated[index],
                    ...position,
                  };
                }

                // Notify callback for each position
                const originalData = batchData.positions!.find(
                  (p) => p.symbol === position.symbol
                );
                if (originalData) {
                  onPositionUpdate?.(originalData);
                }
              }

              return updated;
            }
          );
        }
      }
    },
    [queryClient, onPositionUpdate]
  );

  // ============================================================================
  // WEBSOCKET CONNECTION
  // ============================================================================

  /**
   * Connect to portfolio stream with positions channel subscription
   */
  const { status, error, lastMessageTime } = usePortfolioStream({
    autoConnect: enabled,
    channels: ["positions"], // Only subscribe to positions channel
    onEvent: handleEvent,
    onStatusChange,
  });

  // ============================================================================
  // STALENESS DETECTION
  // ============================================================================

  /**
   * Check if any position is stale
   *
   * A position is stale if it hasn't been updated in staleThreshold milliseconds.
   */
  const hasStaleData = useCallback((): boolean => {
    const now = new Date().getTime();

    for (const [_symbol, lastUpdate] of positionUpdateTimes.current.entries()) {
      const age = now - lastUpdate.getTime();
      if (age > staleThreshold) {
        return true; // At least one position is stale
      }
    }

    return false;
  }, [staleThreshold]);

  // ============================================================================
  // RETURN INTERFACE
  // ============================================================================

  return {
    connectionStatus: status,
    isConnected: status === "connected",
    hasStaleData: hasStaleData(),
    lastUpdateTime: lastUpdateTime.current,
    positionUpdateTimes: positionUpdateTimes.current,
  };
}

export default useRealtimePositions;
