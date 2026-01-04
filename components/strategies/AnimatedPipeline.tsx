"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  TrendingDown,
  BarChart3,
  Zap,
  CheckCircle,
} from "lucide-react";

interface PipelineStage {
  name: string;
  description: string;
  icon: React.ReactNode;
  details: string;
}

const stages: PipelineStage[] = [
  {
    name: "Market Data",
    description: "Real-time price feeds",
    icon: <TrendingDown className="w-6 h-6" />,
    details: "OHLCV candles from Alpaca Markets",
  },
  {
    name: "Bollinger Bands",
    description: "Calculate indicators",
    icon: <BarChart3 className="w-6 h-6" />,
    details: "SMA, Std Dev, upper/lower bands",
  },
  {
    name: "Signal Generation",
    description: "Detect entry/exit points",
    icon: <Zap className="w-6 h-6" />,
    details: "Z-score analysis for oversold conditions",
  },
  {
    name: "Risk Checks",
    description: "Validate trade rules",
    icon: <CheckCircle className="w-6 h-6" />,
    details: "Position sizing, stop loss, take profit",
  },
];

interface PipelineStepValues {
  price?: number;
  sma?: number;
  lowerBand?: number;
  zScore?: number;
  signal?: "buy" | "sell" | "hold";
  approved?: boolean;
}

interface AnimatedPipelineProps {
  values?: PipelineStepValues;
  isAnimating?: boolean;
}

export function AnimatedPipeline({
  values = {},
  isAnimating = true,
}: AnimatedPipelineProps) {
  const [activeStage, setActiveStage] = useState(0);

  useEffect(() => {
    if (!isAnimating) return;

    const interval = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % stages.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [isAnimating]);

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
      },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 },
  };

  const arrowVariants = {
    hidden: { opacity: 0, scaleX: 0 },
    visible: { opacity: 1, scaleX: 1 },
  };

  return (
    <Card className="w-full bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 border-slate-200 dark:border-slate-700">
      <CardHeader>
        <CardTitle className="text-lg">Strategy Pipeline</CardTitle>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Pipeline Flow */}
        <motion.div
          className="space-y-6"
          variants={containerVariants}
          initial="hidden"
          animate="visible"
        >
          <div className="flex flex-col gap-4">
            {stages.map((stage, idx) => (
              <motion.div
                key={stage.name}
                className="flex items-center gap-4"
                variants={itemVariants}
              >
                {/* Stage Box */}
                <motion.div
                  className={`flex-1 p-4 rounded-lg border-2 transition-all ${
                    activeStage === idx
                      ? "border-blue-500 bg-blue-50 dark:bg-blue-950 shadow-lg"
                      : "border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800"
                  }`}
                  animate={{
                    scale: activeStage === idx ? 1.02 : 1,
                    boxShadow:
                      activeStage === idx
                        ? "0 0 20px rgba(59, 130, 246, 0.3)"
                        : "none",
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`p-2 rounded-lg ${
                        activeStage === idx
                          ? "bg-blue-500 text-white"
                          : "bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300"
                      }`}
                    >
                      {stage.icon}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-semibold text-sm">{stage.name}</h4>
                      <p className="text-xs text-slate-600 dark:text-slate-400">
                        {stage.description}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                        {stage.details}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Arrow */}
                {idx < stages.length - 1 && (
                  <motion.div
                    variants={arrowVariants}
                    className="flex-shrink-0"
                  >
                    <ArrowRight className="w-5 h-5 text-slate-400" />
                  </motion.div>
                )}
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Stage Details */}
        {activeStage === 0 && values.price && (
          <motion.div
            className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-sm font-semibold mb-2">Current Price</p>
            <p className="text-2xl font-bold text-blue-600">
              ${values.price.toFixed(2)}
            </p>
          </motion.div>
        )}

        {activeStage === 1 && (values.sma || values.lowerBand) && (
          <motion.div
            className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 space-y-3"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-sm font-semibold">Bollinger Bands</p>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-600 dark:text-slate-400">SMA (20)</p>
                <p className="font-semibold">
                  ${values.sma?.toFixed(2) || "—"}
                </p>
              </div>
              <div>
                <p className="text-slate-600 dark:text-slate-400">Lower Band</p>
                <p className="font-semibold">
                  ${values.lowerBand?.toFixed(2) || "—"}
                </p>
              </div>
            </div>
          </motion.div>
        )}

        {activeStage === 2 && values.zScore !== undefined && (
          <motion.div
            className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-sm font-semibold mb-3">Signal Analysis</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Z-Score
                </span>
                <span
                  className={`font-semibold ${
                    values.zScore < -2 ? "text-red-600" : "text-slate-900"
                  }`}
                >
                  {values.zScore.toFixed(2)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-slate-600 dark:text-slate-400">
                  Signal
                </span>
                <span
                  className={`font-semibold px-2 py-1 rounded text-xs ${
                    values.signal === "buy"
                      ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-200"
                      : values.signal === "sell"
                        ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-200"
                        : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                  }`}
                >
                  {values.signal?.toUpperCase() || "HOLD"}
                </span>
              </div>
            </div>
          </motion.div>
        )}

        {activeStage === 3 && values.approved !== undefined && (
          <motion.div
            className="p-4 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <p className="text-sm font-semibold mb-2">Trade Approval</p>
            <p
              className={`text-sm font-medium ${
                values.approved
                  ? "text-green-600"
                  : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {values.approved ? "✓ Approved" : "Pending validation"}
            </p>
          </motion.div>
        )}
      </CardContent>
    </Card>
  );
}
