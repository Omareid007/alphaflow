/**
 * Real-Time Portfolio UI Components
 *
 * @module components/ui/realtime
 * @description Barrel export for all real-time portfolio UI components.
 * Import from this file for organized imports.
 *
 * @example Clean imports
 * ```typescript
 * import {
 *   ConnectionStatus,
 *   AnimatedPnL,
 *   LiveBadge,
 *   StalenessWarning
 * } from '@/components/ui/realtime';
 * ```
 *
 * @see openspec/changes/realtime-portfolio-streaming/
 */

// ============================================================================
// CONNECTION & STATUS COMPONENTS
// ============================================================================

export {
  ConnectionStatus,
  type ConnectionStatusProps,
} from "../ConnectionStatus";

export {
  LiveBadge,
  type LiveBadgeProps,
  type FreshnessLevel,
} from "../LiveBadge";

export {
  StalenessWarning,
  LastUpdatedTimestamp,
  type StalenessWarningProps,
  type LastUpdatedTimestampProps,
} from "../StalenessWarning";

// ============================================================================
// ANIMATION COMPONENTS
// ============================================================================

export { AnimatedPnL, type AnimatedPnLProps } from "../AnimatedPnL";
