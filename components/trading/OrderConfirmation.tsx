"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Clock,
  ArrowUp,
  ArrowDown,
  Sparkles,
} from "lucide-react";
import { Confetti, useConfetti } from "@/lib/animations/confetti";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/lib/animations/hooks/useReducedMotion";

export type OrderStatus = "success" | "pending" | "error";

interface OrderDetails {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price?: number;
  status: OrderStatus;
  message?: string;
}

interface OrderConfirmationProps {
  order: OrderDetails | null;
  onClose: () => void;
}

/**
 * Full-screen order confirmation overlay with animations
 */
export function OrderConfirmation({ order, onClose }: OrderConfirmationProps) {
  const prefersReducedMotion = useReducedMotion();
  const { isActive: showConfetti, trigger: triggerConfetti } = useConfetti();

  React.useEffect(() => {
    if (order?.status === "success") {
      triggerConfetti();
    }
  }, [order?.status, triggerConfetti]);

  // Auto-close after delay for success
  React.useEffect(() => {
    if (order?.status === "success") {
      const timer = setTimeout(onClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [order?.status, onClose]);

  if (!order) return null;

  const isBuy = order.side === "buy";
  const statusConfig = {
    success: {
      icon: CheckCircle,
      title: "Order Filled",
      color: "text-gain",
      bgColor: "bg-gain/10",
      borderColor: "border-gain/20",
    },
    pending: {
      icon: Clock,
      title: "Order Pending",
      color: "text-primary",
      bgColor: "bg-primary/10",
      borderColor: "border-primary/20",
    },
    error: {
      icon: XCircle,
      title: "Order Failed",
      color: "text-loss",
      bgColor: "bg-loss/10",
      borderColor: "border-loss/20",
    },
  };

  const config = statusConfig[order.status];
  const Icon = config.icon;

  return (
    <>
      {/* Confetti for successful orders */}
      <Confetti active={showConfetti} count={80} spread={400} />

      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.9, y: 20 }
            }
            animate={
              prefersReducedMotion
                ? { opacity: 1 }
                : { opacity: 1, scale: 1, y: 0 }
            }
            exit={
              prefersReducedMotion
                ? { opacity: 0 }
                : { opacity: 0, scale: 0.9, y: 20 }
            }
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className={cn(
              "relative mx-4 w-full max-w-md rounded-2xl border p-8 shadow-2xl",
              config.bgColor,
              config.borderColor,
              "bg-card"
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Success glow effect */}
            {order.status === "success" && !prefersReducedMotion && (
              <motion.div
                className="absolute inset-0 rounded-2xl bg-gain/5"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.5, 0] }}
                transition={{ duration: 1.5, repeat: 2 }}
              />
            )}

            <div className="relative flex flex-col items-center text-center">
              {/* Status Icon */}
              <motion.div
                initial={prefersReducedMotion ? {} : { scale: 0 }}
                animate={prefersReducedMotion ? {} : { scale: 1 }}
                transition={{
                  delay: 0.1,
                  type: "spring",
                  stiffness: 200,
                  damping: 15,
                }}
                className={cn(
                  "mb-4 flex h-20 w-20 items-center justify-center rounded-full",
                  config.bgColor
                )}
              >
                <Icon className={cn("h-10 w-10", config.color)} />
              </motion.div>

              {/* Title */}
              <motion.h2
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className={cn("text-2xl font-bold", config.color)}
              >
                {config.title}
              </motion.h2>

              {/* Order Details */}
              <motion.div
                initial={prefersReducedMotion ? {} : { opacity: 0, y: 10 }}
                animate={prefersReducedMotion ? {} : { opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="mt-4 space-y-3"
              >
                {/* Symbol and Side */}
                <div className="flex items-center justify-center gap-3">
                  <span className="text-3xl font-bold tracking-tight">
                    {order.symbol}
                  </span>
                  <Badge
                    variant={isBuy ? "gain" : "loss"}
                    className="gap-1 px-3 py-1"
                  >
                    {isBuy ? (
                      <ArrowUp className="h-3 w-3" />
                    ) : (
                      <ArrowDown className="h-3 w-3" />
                    )}
                    {order.side.toUpperCase()}
                  </Badge>
                </div>

                {/* Quantity and Price */}
                <div className="space-y-1 text-muted-foreground">
                  <p className="text-lg">
                    <span className="font-medium text-foreground">
                      {order.quantity}
                    </span>{" "}
                    shares
                  </p>
                  {order.price && (
                    <p className="text-lg">
                      @{" "}
                      <span className="font-medium text-foreground">
                        ${order.price.toFixed(2)}
                      </span>
                    </p>
                  )}
                </div>

                {/* Total Value */}
                {order.price && (
                  <motion.div
                    initial={
                      prefersReducedMotion ? {} : { opacity: 0, scale: 0.9 }
                    }
                    animate={
                      prefersReducedMotion ? {} : { opacity: 1, scale: 1 }
                    }
                    transition={{ delay: 0.4 }}
                    className="mt-4 rounded-xl bg-secondary/50 p-4"
                  >
                    <p className="text-sm text-muted-foreground">Total Value</p>
                    <p className="text-2xl font-bold tabular-nums">
                      $
                      {(order.quantity * order.price).toLocaleString(
                        undefined,
                        {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        }
                      )}
                    </p>
                  </motion.div>
                )}

                {/* Message */}
                {order.message && (
                  <p className="text-sm text-muted-foreground mt-2">
                    {order.message}
                  </p>
                )}
              </motion.div>

              {/* Close Button */}
              <motion.div
                initial={prefersReducedMotion ? {} : { opacity: 0 }}
                animate={prefersReducedMotion ? {} : { opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="mt-6"
              >
                <Button
                  variant={order.status === "success" ? "gain" : "outline"}
                  className="rounded-xl px-8"
                  onClick={onClose}
                >
                  {order.status === "success" ? (
                    <>
                      <Sparkles className="mr-2 h-4 w-4" />
                      Awesome!
                    </>
                  ) : order.status === "pending" ? (
                    "Got it"
                  ) : (
                    "Try Again"
                  )}
                </Button>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </>
  );
}

/**
 * Hook for managing order confirmation state
 */
export function useOrderConfirmation() {
  const [order, setOrder] = React.useState<OrderDetails | null>(null);

  const showConfirmation = React.useCallback((details: OrderDetails) => {
    setOrder(details);
  }, []);

  const hideConfirmation = React.useCallback(() => {
    setOrder(null);
  }, []);

  return {
    order,
    showConfirmation,
    hideConfirmation,
  };
}

/**
 * Compact order toast with animation - for use with existing toast system
 */
export function OrderToastContent({
  symbol,
  side,
  quantity,
  price,
  status,
}: {
  symbol: string;
  side: "buy" | "sell";
  quantity: number;
  price?: number;
  status: OrderStatus;
}) {
  const isBuy = side === "buy";
  const statusConfig = {
    success: { icon: CheckCircle, color: "text-gain" },
    pending: { icon: Clock, color: "text-primary" },
    error: { icon: XCircle, color: "text-loss" },
  };

  const config = statusConfig[status];
  const Icon = config.icon;

  return (
    <div className="flex items-center gap-3">
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-full",
          status === "success"
            ? "bg-gain/10"
            : status === "error"
              ? "bg-loss/10"
              : "bg-primary/10"
        )}
      >
        <Icon className={cn("h-5 w-5", config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-semibold">{symbol}</span>
          <Badge
            variant={isBuy ? "gain-subtle" : "loss-subtle"}
            size="sm"
            className="gap-1"
          >
            {isBuy ? (
              <ArrowUp className="h-3 w-3" />
            ) : (
              <ArrowDown className="h-3 w-3" />
            )}
            {side.toUpperCase()}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {quantity} shares{price ? ` @ $${price.toFixed(2)}` : ""}
        </p>
      </div>
    </div>
  );
}

export default OrderConfirmation;
