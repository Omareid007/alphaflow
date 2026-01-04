/**
 * useRealtimeAccount - Real-Time Account Balance Updates via WebSocket
 *
 * @module hooks/useRealtimeAccount
 * @description React hook that subscribes to real-time account balance updates via WebSocket
 * and syncs with TanStack Query cache. Provides instant updates for equity, buying power,
 * cash balance, and day P&L.
 *
 * This hook:
 * - Subscribes to 'account' WebSocket channel
 * - Updates TanStack Query cache on account_update events
 * - Handles batch events with account data
 * - Provides connection status
 * - Transforms string values to numbers
 *
 * @see openspec/changes/realtime-portfolio-streaming/design.md
 * @see hooks/usePortfolioStream.ts - Base WebSocket connection hook
 * @see lib/api/hooks/usePortfolio.ts - Portfolio snapshot with account data
 *
 * @example Basic usage with portfolio snapshot
 * ```typescript
 * import { usePortfolioSnapshot } from '@/lib/api/hooks/usePortfolio';
 * import { useRealtimeAccount } from '@/hooks/useRealtimeAccount';
 *
 * function AccountBalance() {
 *   const { data: snapshot } = usePortfolioSnapshot(); // Includes account data
 *   const { isConnected } = useRealtimeAccount({
 *     onAccountUpdate: (account) => {
 *       console.log('Balance updated:', account.equity);
 *     }
 *   });
 *
 *   // snapshot.buyingPower, snapshot.equity now update in real-time!
 *   return (
 *     <div>
 *       {isConnected && <Badge>Live</Badge>}
 *       <div>Equity: ${snapshot.totalEquity.toLocaleString()}</div>
 *       <div>Buying Power: ${snapshot.buyingPower.toLocaleString()}</div>
 *       <div>Day P/L: ${snapshot.dailyPl.toFixed(2)} ({snapshot.dailyPlPct.toFixed(2)}%)</div>
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
 * Account update data from WebSocket event
 *
 * Matches AccountUpdate interface from server/lib/portfolio-events.ts
 */
export interface AccountUpdateData {
  equity: string;
  buyingPower: string;
  cash: string;
  portfolioValue: string;
  dayPnl: string;
  dayPnlPercent: string;
  timestamp: string;
}

/**
 * Batch event data with account
 */
interface BatchEventData {
  positions?: unknown[];
  orders?: unknown[];
  account?: AccountUpdateData;
  trades?: unknown[];
}

/**
 * Hook configuration options
 */
export interface UseRealtimeAccountOptions {
  /**
   * Enable real-time updates
   * @default true
   */
  enabled?: boolean;

  /**
   * Called when account is updated via WebSocket
   * @param account - Updated account data
   */
  onAccountUpdate?: (account: AccountUpdateData) => void;

  /**
   * Called when connection status changes
   * @param status - New connection status
   */
  onStatusChange?: (status: ConnectionStatus) => void;
}

/**
 * Hook return value
 */
export interface UseRealtimeAccountReturn {
  /**
   * Current WebSocket connection status
   */
  connectionStatus: ConnectionStatus;

  /**
   * Whether WebSocket is connected
   */
  isConnected: boolean;

  /**
   * Timestamp of last account update (null if never updated)
   */
  lastUpdateTime: Date | null;

  /**
   * WebSocket connection error (null if none)
   */
  error: Error | null;
}

// ============================================================================
// QUERY KEYS
// ============================================================================

/**
 * TanStack Query key for portfolio snapshot (includes account data)
 *
 * Must match the key used in lib/api/hooks/usePortfolio.ts usePortfolioSnapshot() hook
 */
export const PORTFOLIO_SNAPSHOT_QUERY_KEY = ["portfolio", "snapshot"] as const;

/**
 * TanStack Query key for standalone account data (if used)
 */
export const ACCOUNT_QUERY_KEY = ["account"] as const;

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * useRealtimeAccount - Real-time account balance updates via WebSocket
 *
 * This hook enhances existing account/portfolio hooks by keeping their TanStack Query
 * cache up-to-date via WebSocket events. It does NOT fetch account data itself.
 *
 * Usage pattern:
 * 1. Component calls usePortfolioSnapshot() to get account data (existing hook)
 * 2. Component calls useRealtimeAccount() to enable real-time updates (this hook)
 * 3. WebSocket events update the Query cache, triggering re-render
 *
 * @param options - Configuration options
 * @returns Hook interface with connection status
 */
export function useRealtimeAccount(
  options: UseRealtimeAccountOptions = {}
): UseRealtimeAccountReturn {
  const { enabled = true, onAccountUpdate, onStatusChange } = options;

  const queryClient = useQueryClient();

  // Track last update time
  const lastUpdateTime = useRef<Date | null>(null);

  // ============================================================================
  // EVENT HANDLERS
  // ============================================================================

  /**
   * Handle incoming WebSocket events
   *
   * Updates TanStack Query cache with account data from WebSocket.
   */
  const handleEvent = useCallback(
    (event: PortfolioEvent) => {
      // Handle single account update
      if (event.type === "account_update") {
        const accountData = event.data as AccountUpdateData;

        // Update timestamp
        lastUpdateTime.current = new Date();

        // Update portfolio snapshot cache (merges with existing snapshot)
        queryClient.setQueryData<any>(
          PORTFOLIO_SNAPSHOT_QUERY_KEY,
          (oldSnapshot) => {
            if (!oldSnapshot) {
              // No snapshot yet, create minimal one
              return {
                totalEquity: parseFloat(accountData.equity),
                buyingPower: parseFloat(accountData.buyingPower),
                cash: parseFloat(accountData.cash),
                portfolioValue: parseFloat(accountData.portfolioValue),
                dailyPl: parseFloat(accountData.dayPnl),
                dailyPlPct: parseFloat(accountData.dayPnlPercent),
                positions: [],
                timestamp: accountData.timestamp,
              };
            }

            // Merge with existing snapshot
            return {
              ...oldSnapshot,
              totalEquity: parseFloat(accountData.equity),
              buyingPower: parseFloat(accountData.buyingPower),
              cash: parseFloat(accountData.cash),
              portfolioValue: parseFloat(accountData.portfolioValue),
              dailyPl: parseFloat(accountData.dayPnl),
              dailyPlPct: parseFloat(accountData.dayPnlPercent),
              timestamp: accountData.timestamp,
            };
          }
        );

        // Also update standalone account cache if it exists
        queryClient.setQueryData<any>(ACCOUNT_QUERY_KEY, (oldAccount) => ({
          ...oldAccount,
          equity: parseFloat(accountData.equity),
          buyingPower: parseFloat(accountData.buyingPower),
          cash: parseFloat(accountData.cash),
          portfolioValue: parseFloat(accountData.portfolioValue),
          dayPnl: parseFloat(accountData.dayPnl),
          dayPnlPercent: parseFloat(accountData.dayPnlPercent),
          lastUpdated: new Date(),
        }));

        // Notify callback
        onAccountUpdate?.(accountData);
      }

      // Handle batch update (account in batch)
      if (event.type === "batch") {
        const batchData = event.data as BatchEventData;

        if (batchData.account) {
          lastUpdateTime.current = new Date();

          const accountData = batchData.account;

          // Update portfolio snapshot cache
          queryClient.setQueryData<any>(
            PORTFOLIO_SNAPSHOT_QUERY_KEY,
            (oldSnapshot) => {
              if (!oldSnapshot) {
                return {
                  totalEquity: parseFloat(accountData.equity),
                  buyingPower: parseFloat(accountData.buyingPower),
                  cash: parseFloat(accountData.cash),
                  portfolioValue: parseFloat(accountData.portfolioValue),
                  dailyPl: parseFloat(accountData.dayPnl),
                  dailyPlPct: parseFloat(accountData.dayPnlPercent),
                  positions: [],
                  timestamp: accountData.timestamp,
                };
              }

              return {
                ...oldSnapshot,
                totalEquity: parseFloat(accountData.equity),
                buyingPower: parseFloat(accountData.buyingPower),
                cash: parseFloat(accountData.cash),
                portfolioValue: parseFloat(accountData.portfolioValue),
                dailyPl: parseFloat(accountData.dayPnl),
                dailyPlPct: parseFloat(accountData.dayPnlPercent),
                timestamp: accountData.timestamp,
              };
            }
          );

          // Update standalone account cache
          queryClient.setQueryData<any>(ACCOUNT_QUERY_KEY, (oldAccount) => ({
            ...oldAccount,
            equity: parseFloat(accountData.equity),
            buyingPower: parseFloat(accountData.buyingPower),
            cash: parseFloat(accountData.cash),
            portfolioValue: parseFloat(accountData.portfolioValue),
            dayPnl: parseFloat(accountData.dayPnl),
            dayPnlPercent: parseFloat(accountData.dayPnlPercent),
            lastUpdated: new Date(),
          }));

          // Notify callback
          onAccountUpdate?.(accountData);
        }
      }
    },
    [queryClient, onAccountUpdate]
  );

  // ============================================================================
  // WEBSOCKET CONNECTION
  // ============================================================================

  /**
   * Connect to portfolio stream with account channel subscription
   */
  const { status, error } = usePortfolioStream({
    autoConnect: enabled,
    channels: ["account"], // Only subscribe to account channel
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

export default useRealtimeAccount;
