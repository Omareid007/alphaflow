/**
 * Real-Time Portfolio Streaming - Public API
 *
 * @module hooks/realtime
 * @description Barrel export for all real-time portfolio hooks.
 * Import from this file for clean, organized imports throughout the application.
 *
 * @example Clean imports
 * ```typescript
 * import {
 *   usePortfolioStream,
 *   useRealtimePositions,
 *   useRealtimeOrders,
 *   useRealtimeAccount
 * } from '@/hooks/realtime';
 * ```
 *
 * @see openspec/changes/realtime-portfolio-streaming/
 */

// ============================================================================
// BASE WEBSOCKET HOOK
// ============================================================================

export {
  usePortfolioStream,
  type ConnectionStatus,
  type PortfolioEvent,
  type PortfolioEventType,
  type ChannelType,
  type UsePortfolioStreamOptions,
  type UsePortfolioStreamReturn,
} from "../usePortfolioStream";

// ============================================================================
// DATA SYNC HOOKS
// ============================================================================

export {
  useRealtimePositions,
  POSITIONS_QUERY_KEY,
  type UseRealtimePositionsOptions,
  type UseRealtimePositionsReturn,
} from "../useRealtimePositions";

export {
  useRealtimeOrders,
  ORDERS_QUERY_KEY,
  type OrderUpdateData,
  type Order,
  type UseRealtimeOrdersOptions,
  type UseRealtimeOrdersReturn,
} from "../useRealtimeOrders";

export {
  useRealtimeAccount,
  PORTFOLIO_SNAPSHOT_QUERY_KEY,
  ACCOUNT_QUERY_KEY,
  type AccountUpdateData,
  type UseRealtimeAccountOptions,
  type UseRealtimeAccountReturn,
} from "../useRealtimeAccount";
