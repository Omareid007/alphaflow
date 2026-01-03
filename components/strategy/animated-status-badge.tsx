"use client";

import * as React from "react";
import { motion, AnimatePresence, type Variants } from "framer-motion";
import {
  CheckCircle,
  Pause,
  StopCircle,
  Clock,
  AlertTriangle,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

/**
 * Strategy status types
 */
export type StrategyStatus =
  | "active"
  | "paused"
  | "stopped"
  | "pending"
  | "error";

/**
 * Size variants for the badge
 */
export type StatusBadgeSize = "sm" | "md" | "lg";

/**
 * Status configuration mapping
 */
interface StatusConfig {
  icon: LucideIcon;
  label: string;
  colorClass: string;
  bgClass: string;
  glowClass: string;
  pulseClass: string;
}

const statusConfigs: Record<StrategyStatus, StatusConfig> = {
  active: {
    icon: CheckCircle,
    label: "Active",
    colorClass: "text-gain",
    bgClass: "bg-gain/10 border-gain/30",
    glowClass: "shadow-glow-gain",
    pulseClass: "animate-pulse-gain",
  },
  paused: {
    icon: Pause,
    label: "Paused",
    colorClass: "text-yellow-500",
    bgClass: "bg-yellow-500/10 border-yellow-500/30",
    glowClass: "shadow-[0_0_20px_hsl(45_100%_50%/0.3)]",
    pulseClass: "",
  },
  stopped: {
    icon: StopCircle,
    label: "Stopped",
    colorClass: "text-loss",
    bgClass: "bg-loss/10 border-loss/30",
    glowClass: "shadow-glow-loss",
    pulseClass: "",
  },
  pending: {
    icon: Clock,
    label: "Pending",
    colorClass: "text-blue-500",
    bgClass: "bg-blue-500/10 border-blue-500/30",
    glowClass: "shadow-[0_0_20px_hsl(210_100%_50%/0.3)]",
    pulseClass: "",
  },
  error: {
    icon: AlertTriangle,
    label: "Error",
    colorClass: "text-loss",
    bgClass: "bg-loss/10 border-loss/30",
    glowClass: "shadow-glow-loss",
    pulseClass: "animate-pulse-loss",
  },
};

const sizeClasses: Record<
  StatusBadgeSize,
  { container: string; icon: string; text: string }
> = {
  sm: {
    container: "px-2 py-0.5 gap-1",
    icon: "h-3 w-3",
    text: "text-xs",
  },
  md: {
    container: "px-2.5 py-1 gap-1.5",
    icon: "h-4 w-4",
    text: "text-sm",
  },
  lg: {
    container: "px-3 py-1.5 gap-2",
    icon: "h-5 w-5",
    text: "text-base",
  },
};

export interface AnimatedStatusBadgeProps {
  /** Current status of the strategy */
  status: StrategyStatus;
  /** Size variant */
  size?: StatusBadgeSize;
  /** Show text label alongside icon */
  showLabel?: boolean;
  /** Enable glow effect */
  showGlow?: boolean;
  /** Enable pulse animation for active/error states */
  enablePulse?: boolean;
  /** Additional CSS classes */
  className?: string;
  /**
   * Enable ARIA live region for status changes (WCAG 2.1 AA)
   * When true, status changes will be announced to screen readers
   */
  ariaLive?: boolean;
}

/**
 * Framer Motion variants for status transitions
 */
const badgeVariants: Variants = {
  initial: {
    opacity: 0,
    scale: 0.8,
  },
  animate: {
    opacity: 1,
    scale: 1,
    transition: {
      type: "spring",
      stiffness: 400,
      damping: 25,
    },
  },
  exit: {
    opacity: 0,
    scale: 0.8,
    transition: {
      duration: 0.15,
    },
  },
};

const iconVariants: Variants = {
  initial: {
    rotate: -180,
    opacity: 0,
  },
  animate: {
    rotate: 0,
    opacity: 1,
    transition: {
      type: "spring",
      stiffness: 300,
      damping: 20,
    },
  },
  exit: {
    rotate: 180,
    opacity: 0,
    transition: {
      duration: 0.15,
    },
  },
};

/**
 * AnimatedStatusBadge Component
 *
 * Displays strategy status with animated transitions and visual feedback.
 * Color-coded and icon-based for quick status recognition.
 * Respects user's prefers-reduced-motion accessibility setting.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <AnimatedStatusBadge status="active" />
 *
 * // With label and glow
 * <AnimatedStatusBadge
 *   status="active"
 *   showLabel
 *   showGlow
 *   size="md"
 * />
 *
 * // Error state with pulse
 * <AnimatedStatusBadge
 *   status="error"
 *   showLabel
 *   enablePulse
 * />
 * ```
 */
export function AnimatedStatusBadge({
  status,
  size = "md",
  showLabel = false,
  showGlow = false,
  enablePulse = true,
  className,
  ariaLive = false,
}: AnimatedStatusBadgeProps) {
  const prefersReducedMotion = useReducedMotion();
  const config = statusConfigs[status];
  const sizeConfig = sizeClasses[size];
  const Icon = config.icon;

  // Determine if pulse should be shown
  const shouldPulse = enablePulse && config.pulseClass && !prefersReducedMotion;

  // Generate accessible label
  const ariaLabel = `Strategy status: ${config.label}`;

  // Build class names
  const badgeClasses = cn(
    "inline-flex items-center rounded-full border font-medium transition-all duration-fast ease-out-expo",
    sizeConfig.container,
    config.bgClass,
    config.colorClass,
    showGlow && !prefersReducedMotion && config.glowClass,
    shouldPulse && config.pulseClass,
    className
  );

  // For reduced motion, render without animations
  if (prefersReducedMotion) {
    return (
      <span
        className={badgeClasses}
        role="status"
        aria-label={ariaLabel}
        aria-live={ariaLive ? "polite" : undefined}
      >
        <Icon className={sizeConfig.icon} aria-hidden="true" />
        {showLabel && <span className={sizeConfig.text}>{config.label}</span>}
      </span>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.span
        key={status}
        className={badgeClasses}
        variants={badgeVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        role="status"
        aria-label={ariaLabel}
        aria-live={ariaLive ? "polite" : undefined}
      >
        <motion.span variants={iconVariants} className="inline-flex">
          <Icon className={sizeConfig.icon} aria-hidden="true" />
        </motion.span>
        {showLabel && (
          <motion.span
            className={sizeConfig.text}
            initial={{ opacity: 0, x: -5 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            {config.label}
          </motion.span>
        )}
      </motion.span>
    </AnimatePresence>
  );
}

/**
 * Hook for programmatic status badge control
 *
 * @example
 * ```tsx
 * const { status, setStatus, isTransitioning } = useStrategyStatus('pending');
 *
 * // Update status with optional callback
 * setStatus('active', () => console.log('Status changed!'));
 * ```
 */
export function useStrategyStatus(initialStatus: StrategyStatus = "pending") {
  const [status, setStatusInternal] =
    React.useState<StrategyStatus>(initialStatus);
  const [isTransitioning, setIsTransitioning] = React.useState(false);

  const setStatus = React.useCallback(
    (newStatus: StrategyStatus, onComplete?: () => void) => {
      if (newStatus === status) return;

      setIsTransitioning(true);
      setStatusInternal(newStatus);

      // Simulate transition completion
      setTimeout(() => {
        setIsTransitioning(false);
        onComplete?.();
      }, 300);
    },
    [status]
  );

  return {
    status,
    setStatus,
    isTransitioning,
  };
}

export default AnimatedStatusBadge;
