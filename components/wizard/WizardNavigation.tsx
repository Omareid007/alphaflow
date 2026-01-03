"use client";

import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { motion, type Variants } from "framer-motion";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

interface WizardNavigationProps {
  currentStep: number;
  totalSteps: number;
  hasBacktest: boolean;
  onBack: () => void;
  onNext: () => void;
  /**
   * Loading state for navigation buttons
   */
  isLoading?: boolean;
  /**
   * Disable next button
   */
  disableNext?: boolean;
  /**
   * Custom next button text
   */
  nextLabel?: string;
}

export function WizardNavigation({
  currentStep,
  totalSteps,
  hasBacktest,
  onBack,
  onNext,
  isLoading = false,
  disableNext = false,
  nextLabel,
}: WizardNavigationProps) {
  const prefersReducedMotion = useReducedMotion();

  const buttonVariants: Variants = prefersReducedMotion
    ? {
        tap: {},
        hover: {},
      }
    : {
        tap: { scale: 0.95 },
        hover: { scale: 1.02 },
      };

  const defaultNextLabel =
    currentStep === totalSteps ? "Review & Backtest" : "Continue";

  return (
    <div className="flex items-center justify-between">
      <motion.div variants={buttonVariants} whileHover="hover" whileTap="tap">
        <Button variant="outline" onClick={onBack} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ChevronLeft className="mr-2 h-4 w-4" />
          )}
          Back
        </Button>
      </motion.div>

      {!hasBacktest && currentStep <= totalSteps && (
        <motion.div
          variants={buttonVariants}
          whileHover="hover"
          whileTap="tap"
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: prefersReducedMotion ? 0 : 0.3 }}
        >
          <Button onClick={onNext} disabled={isLoading || disableNext}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                {nextLabel || defaultNextLabel}
                <ChevronRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
