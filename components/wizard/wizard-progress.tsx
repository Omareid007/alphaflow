"use client";

import { motion } from "framer-motion";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";
import { cn } from "@/lib/utils";

interface WizardProgressProps {
  /**
   * Current step (0-indexed)
   */
  currentStep: number;

  /**
   * Total number of steps
   */
  totalSteps: number;

  /**
   * Additional CSS classes
   */
  className?: string;

  /**
   * Show step labels
   * @default false
   */
  showLabels?: boolean;

  /**
   * Custom step labels
   */
  labels?: string[];
}

/**
 * Animated progress indicator for wizard steps
 * Shows progress through the wizard with smooth animations
 */
export function WizardProgress({
  currentStep,
  totalSteps,
  className,
  showLabels = false,
  labels,
}: WizardProgressProps) {
  const prefersReducedMotion = useReducedMotion();

  const progressPercentage = (currentStep / totalSteps) * 100;

  return (
    <div className={cn("space-y-2", className)}>
      {/* Progress bar */}
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
        <motion.div
          className="absolute inset-y-0 left-0 bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercentage}%` }}
          transition={
            prefersReducedMotion
              ? { duration: 0 }
              : {
                  duration: 0.4,
                  ease: [0.4, 0.0, 0.2, 1],
                }
          }
        />
      </div>

      {/* Step indicators */}
      <div className="flex items-center justify-between">
        {Array.from({ length: totalSteps }, (_, i) => {
          const isCompleted = i < currentStep;
          const isCurrent = i === currentStep;
          const stepNumber = i + 1;

          return (
            <div key={i} className="flex flex-col items-center gap-2">
              <motion.div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-medium transition-colors",
                  isCompleted && "border-primary bg-primary text-primary-foreground",
                  isCurrent && "border-primary bg-background text-primary",
                  !isCompleted && !isCurrent && "border-muted bg-background text-muted-foreground"
                )}
                initial={false}
                animate={
                  prefersReducedMotion
                    ? {}
                    : {
                        scale: isCurrent ? 1.1 : 1,
                        transition: {
                          duration: 0.2,
                          ease: "easeOut",
                        },
                      }
                }
              >
                {stepNumber}
              </motion.div>

              {showLabels && labels && labels[i] && (
                <span
                  className={cn(
                    "text-xs transition-colors",
                    isCurrent ? "font-medium text-foreground" : "text-muted-foreground"
                  )}
                >
                  {labels[i]}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
