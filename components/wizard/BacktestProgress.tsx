"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { motion, type Variants } from "framer-motion";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";
import { LoadingDots } from "./loading-dots";

interface BacktestProgressProps {
  progress: number;
}

export function BacktestProgress({ progress }: BacktestProgressProps) {
  const prefersReducedMotion = useReducedMotion();

  // Spinner rotation variants
  const spinnerVariants: Variants = prefersReducedMotion
    ? {
        rotate: {},
      }
    : {
        rotate: {
          rotate: 360,
          transition: {
            duration: 1,
            repeat: Infinity,
            ease: "linear",
          },
        },
      };

  // Pulse animation for the card
  const cardVariants: Variants = prefersReducedMotion
    ? {
        initial: {},
        animate: {},
      }
    : {
        initial: { opacity: 0, scale: 0.95 },
        animate: {
          opacity: 1,
          scale: 1,
          transition: {
            duration: 0.3,
          },
        },
      };

  // Progress text animation
  const textVariants: Variants = prefersReducedMotion
    ? {
        initial: {},
        animate: {},
      }
    : {
        initial: { opacity: 0 },
        animate: {
          opacity: 1,
          transition: {
            delay: 0.2,
          },
        },
      };

  return (
    <motion.div variants={cardVariants} initial="initial" animate="animate">
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            {/* Animated spinner */}
            <motion.div
              className="mx-auto h-12 w-12 rounded-full border-4 border-primary border-t-transparent"
              variants={spinnerVariants}
              animate="rotate"
            />

            {/* Title with fade-in */}
            <motion.h3
              variants={textVariants}
              initial="initial"
              animate="animate"
              className="mt-4 text-xl font-semibold"
            >
              Running Backtest
            </motion.h3>

            {/* Description with loading dots */}
            <motion.div
              variants={textVariants}
              initial="initial"
              animate="animate"
              className="mt-2 flex items-center justify-center gap-2"
            >
              <p className="text-muted-foreground">
                Simulating your strategy across historical data
              </p>
              <LoadingDots size="sm" variant="muted" />
            </motion.div>

            {/* Progress bar */}
            <motion.div
              variants={textVariants}
              initial="initial"
              animate="animate"
              className="mx-auto mt-6 max-w-sm space-y-2"
            >
              <Progress value={progress} />
              <p className="text-sm font-medium text-muted-foreground">
                {progress}% Complete
              </p>
            </motion.div>

            {/* Status messages based on progress */}
            <motion.p
              variants={textVariants}
              initial="initial"
              animate="animate"
              className="mt-4 text-xs text-muted-foreground"
            >
              {progress < 25 && "Initializing backtest environment..."}
              {progress >= 25 &&
                progress < 50 &&
                "Processing historical data..."}
              {progress >= 50 &&
                progress < 75 &&
                "Executing strategy signals..."}
              {progress >= 75 &&
                progress < 100 &&
                "Calculating performance metrics..."}
              {progress === 100 && "Backtest complete!"}
            </motion.p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
