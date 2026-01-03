/**
 * CANONICAL UI DATA CONTRACTS
 *
 * These types define the data structures used by the UI layer.
 * They map internal database state + broker state to display-ready view models.
 *
 * CRITICAL: Status enums must map to real Alpaca order statuses.
 * See: https://docs.alpaca.markets/docs/orders#order-status
 */

/**
 * Alpaca Order Status (broker source of truth)
 * These are the actual statuses returned by Alpaca API
 */
export type AlpacaOrderStatus =
  | "new" // Order submitted, not yet accepted
  | "accepted" // Broker accepted, awaiting fill
  | "pending_new" // Order queued for submission
  | "partially_filled" // Some qty filled
  | "filled" // Complete fill
  | "done_for_day" // No more fills today
  | "canceled" // User canceled
  | "expired" // Time expired
  | "replaced" // Replaced by another order
  | "pending_cancel" // Cancel request pending
  | "pending_replace" // Replace request pending
  | "stopped" // Order stopped
  | "rejected" // Broker rejected
  | "suspended" // Order suspended
  | "calculated"; // Calculated (rare)

/**
 * Timeline Event Categories
 * Maps to different event sources in the system
 */
export type TimelineEventCategory =
  | "decision" // AI decision generated
  | "order" // Order submitted/updated
  | "fill" // Trade executed/filled
  | "position" // Position opened/closed
  | "risk" // Risk control events (kill switch, limits)
  | "system" // System events (budget exhausted, errors)
  | "data_fetch"; // External data fetch events

/**
 * Timeline Event Status
 * Unified status for timeline display
 */
export type TimelineEventStatus =
  | "success" // Completed successfully
  | "pending" // In progress/waiting
  | "warning" // Needs attention
  | "error" // Failed
  | "info"; // Informational

/**
 * TimelineEvent - Unified activity event for timeline display
 */
export interface TimelineEvent {
  id: string;
  ts: string; // ISO timestamp
  category: TimelineEventCategory;
  title: string;
  subtitle: string | null;
  status: TimelineEventStatus;
  entityLinks: {
    decisionId?: string;
    brokerOrderId?: string;
    symbol?: string;
    strategyId?: string;
    tradeId?: string;
  };
  provenance: {
    provider: string; // "alpaca" | "openai" | "finnhub" | etc.
    cacheStatus: "fresh" | "stale" | "miss" | "unknown";
    latencyMs?: number;
  };
  details?: Record<string, unknown>; // JSON payload (trimmed for display)
}

/**
 * DecisionStatus - Maps internal decision state to broker lifecycle
 */
export type DecisionStatus =
  | "proposed" // AI suggested but not approved
  | "approved" // Approved for execution
  | "submitted" // Submitted to broker (pending_new/new)
  | "accepted" // Broker accepted, awaiting fill
  | "partially_filled" // Some quantity filled
  | "filled" // Fully filled
  | "canceled" // Canceled
  | "rejected" // Broker rejected
  | "skipped" // Skipped due to risk/limits
  | "expired"; // Time expired

/**
 * DecisionViewModel - AI decision with broker status
 */
export interface DecisionViewModel {
  decisionId: string;
  symbol: string;
  action: "buy" | "sell" | "hold";
  confidence: number;
  reasoningSnippet: string | null;
  status: DecisionStatus;
  brokerOrderId: string | null;
  brokerStatus: AlpacaOrderStatus | null;
  createdAt: string;
  filledAt: string | null;
  filledPrice: number | null;
  quantity: number | null;
  strategyId: string | null;
  strategyName: string | null;
  skipReason: string | null;
}

/**
 * LedgerItemStatus - Status for trade ledger entries
 */
export type LedgerItemStatus =
  | "pending" // Order pending (not yet filled)
  | "filled" // Fully executed
  | "partial" // Partially filled
  | "canceled" // Canceled
  | "rejected" // Rejected by broker
  | "expired"; // Order expired

/**
 * LedgerItem - Trade ledger entry
 */
export interface LedgerItem {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  filledQty: number;
  avgFillPrice: number | null;
  status: LedgerItemStatus;
  brokerOrderId: string;
  submittedAt: string;
  filledAt: string | null;
  strategyId: string | null;
  decisionId: string | null;
  pnl: number | null;
}

/**
 * TimelineResponse - API response for timeline endpoint
 */
export interface TimelineResponse {
  events: TimelineEvent[];
  hasMore: boolean;
  cursor: string | null;
  meta: {
    alpacaConnected: boolean;
    alpacaStatus: "live" | "stale" | "unavailable";
    totalEvents: number;
    fetchedAt?: string; // ISO timestamp of when data was fetched
  };
}

/**
 * LedgerResponse - API response for ledger endpoint
 */
export interface LedgerResponse {
  items: LedgerItem[];
  total: number;
  hasMore: boolean;
  source: "alpaca" | "database" | "merged";
  meta: {
    alpacaConnected: boolean;
    lastSyncAt: string | null;
  };
}

/**
 * DecisionHistoryResponse - API response for decision history
 */
export interface DecisionHistoryResponse {
  decisions: DecisionViewModel[];
  total: number;
  hasMore: boolean;
}

/**
 * Maps internal decision status to display-friendly labels
 */
export function getDecisionStatusLabel(status: DecisionStatus): string {
  const labels: Record<DecisionStatus, string> = {
    proposed: "PROPOSED",
    approved: "APPROVED",
    submitted: "SUBMITTED",
    accepted: "PENDING",
    partially_filled: "PARTIAL",
    filled: "FILLED",
    canceled: "CANCELED",
    rejected: "REJECTED",
    skipped: "SKIPPED",
    expired: "EXPIRED",
  };
  return labels[status] || status.toUpperCase();
}

/**
 * Maps Alpaca order status to unified DecisionStatus
 */
export function mapBrokerStatusToDecisionStatus(
  brokerStatus: AlpacaOrderStatus | null,
  internalStatus: string | null
): DecisionStatus {
  if (!brokerStatus) {
    if (internalStatus === "skipped") return "skipped";
    if (internalStatus === "pending" || internalStatus === "pending_execution")
      return "proposed";
    if (internalStatus === "executed" || internalStatus === "filled")
      return "filled";
    return "proposed";
  }

  switch (brokerStatus) {
    case "new":
    case "pending_new":
      return "submitted";
    case "accepted":
      return "accepted";
    case "partially_filled":
      return "partially_filled";
    case "filled":
      return "filled";
    case "canceled":
    case "pending_cancel":
      return "canceled";
    case "rejected":
      return "rejected";
    case "expired":
    case "done_for_day":
      return "expired";
    case "replaced":
    case "pending_replace":
      return "submitted";
    default:
      return "proposed";
  }
}

/**
 * Maps Alpaca order status to LedgerItemStatus
 */
export function mapBrokerStatusToLedgerStatus(
  brokerStatus: AlpacaOrderStatus
): LedgerItemStatus {
  switch (brokerStatus) {
    case "filled":
      return "filled";
    case "partially_filled":
      return "partial";
    case "canceled":
    case "pending_cancel":
      return "canceled";
    case "rejected":
      return "rejected";
    case "expired":
    case "done_for_day":
      return "expired";
    default:
      return "pending";
  }
}

/**
 * Maps timeline event status to display color category
 */
export function getTimelineStatusColor(
  status: TimelineEventStatus
): "success" | "warning" | "error" | "neutral" {
  switch (status) {
    case "success":
      return "success";
    case "pending":
    case "warning":
      return "warning";
    case "error":
      return "error";
    default:
      return "neutral";
  }
}
