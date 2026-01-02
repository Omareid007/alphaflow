"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useStrategy,
  useStrategyOrders,
  useExecutionContext,
  usePauseStrategy,
  useResumeStrategy,
  useStopStrategy,
  type Strategy,
  type StrategyOrder,
  type StrategyExecutionContext,
} from "@/lib/api/hooks";
import {
  Play,
  Pause,
  Square,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Clock,
  DollarSign,
  AlertCircle,
  CheckCircle,
  ArrowUp,
  ArrowDown,
  Zap,
} from "lucide-react";
import { useAuth } from "@/components/providers/auth-provider";
import { useRealTimeTrading } from "@/lib/hooks/useRealTimeTrading";
import { ConnectionStatus } from "@/components/trading/ConnectionStatus";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { Confetti } from "@/lib/animations/confetti";
import { motion, AnimatePresence } from "framer-motion";

// ============================================================================
// TYPES
// ============================================================================

interface StrategyExecutionDashboardProps {
  strategyId: string;
  showActions?: boolean;
  compact?: boolean;
}

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

function StatusBadge({ status }: { status: Strategy["status"] }) {
  const variants: Record<
    string,
    {
      variant: BadgeProps["variant"];
      label: string;
      animate?: BadgeProps["animate"];
      icon?: React.ReactNode;
    }
  > = {
    draft: { variant: "secondary", label: "Draft" },
    backtesting: { variant: "outline", label: "Backtesting", animate: "pulse" },
    backtested: { variant: "outline", label: "Backtested" },
    paper: {
      variant: "gain-subtle",
      label: "Paper Trading",
      animate: "glow",
      icon: <Zap className="h-3 w-3" />,
    },
    live: {
      variant: "gain",
      label: "Live",
      animate: "glow",
      icon: <Zap className="h-3 w-3" />,
    },
    paused: {
      variant: "outline",
      label: "Paused",
      icon: <Pause className="h-3 w-3" />,
    },
    stopped: { variant: "loss-subtle", label: "Stopped" },
  };

  const config = variants[status] || { variant: "secondary", label: status };

  return (
    <Badge
      variant={config.variant}
      animate={config.animate}
      className="capitalize gap-1"
    >
      {config.icon}
      {config.label}
    </Badge>
  );
}

function OrderStatusIcon({ status }: { status: string }) {
  switch (status) {
    case "filled":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "partially_filled":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    case "pending_new":
    case "new":
    case "accepted":
      return <Clock className="h-4 w-4 text-blue-500" />;
    case "canceled":
    case "expired":
      return <AlertCircle className="h-4 w-4 text-gray-500" />;
    case "rejected":
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return <Clock className="h-4 w-4 text-gray-400" />;
  }
}

function ExecutionContextCard({
  context,
}: {
  context: StrategyExecutionContext;
}) {
  const { params } = context;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Execution Settings
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {/* Position Sizing */}
        <div>
          <div className="text-muted-foreground text-xs">Position Sizing</div>
          <div className="font-medium">
            {params.positionSizing.method === "percent"
              ? `${params.positionSizing.percentOfPortfolio || 5}% of portfolio`
              : params.positionSizing.method === "fixed"
                ? `$${params.positionSizing.fixedAmount || 0} fixed`
                : `${params.positionSizing.riskPerTradePercent || 1}% risk-based`}
          </div>
          <div className="text-muted-foreground text-xs">
            Max: {params.positionSizing.maxPositionPercent}% per position
          </div>
        </div>

        {/* Entry Rules */}
        <div>
          <div className="text-muted-foreground text-xs">Entry Rules</div>
          <div className="font-medium">
            Min confidence: {(params.entryRules.minConfidence * 100).toFixed(0)}
            %
          </div>
          <div className="text-muted-foreground text-xs">
            Max positions: {params.entryRules.maxPositions}
          </div>
        </div>

        {/* Bracket Orders */}
        <div>
          <div className="text-muted-foreground text-xs">Bracket Orders</div>
          {params.bracketOrders.enabled ? (
            <>
              <div className="font-medium text-green-600">Enabled</div>
              <div className="text-muted-foreground text-xs">
                TP: {params.bracketOrders.takeProfitPercent}% / SL:{" "}
                {params.bracketOrders.stopLossPercent}%
              </div>
            </>
          ) : (
            <div className="text-muted-foreground">Disabled</div>
          )}
        </div>

        {/* Order Execution */}
        <div>
          <div className="text-muted-foreground text-xs">Order Type</div>
          <div className="font-medium capitalize">
            {params.orderExecution.orderType} /{" "}
            {params.orderExecution.timeInForce.toUpperCase()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RecentOrdersTable({
  orders,
  isLoading,
  flashOrderId,
}: {
  orders: StrategyOrder[];
  isLoading: boolean;
  flashOrderId?: string | null;
}) {
  if (isLoading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="text-muted-foreground text-center py-6 text-sm">
        No orders yet
      </div>
    );
  }

  const getStatusVariant = (status: string): BadgeProps["variant"] => {
    const normalized = status.toLowerCase();
    if (normalized === "filled") return "gain";
    if (
      normalized === "pending_new" ||
      normalized === "new" ||
      normalized === "accepted"
    )
      return "gain-subtle";
    if (normalized === "canceled" || normalized === "expired") return "outline";
    if (normalized === "rejected") return "loss-subtle";
    return "secondary";
  };

  return (
    <div className="space-y-1">
      <AnimatePresence>
        {orders.slice(0, 10).map((order, index) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{
              opacity: 1,
              y: 0,
              backgroundColor:
                flashOrderId === order.id
                  ? "hsl(var(--gain) / 0.15)"
                  : "transparent",
            }}
            transition={{ duration: 0.2, delay: index * 0.03 }}
            className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <OrderStatusIcon status={order.status} />
              <div>
                <div className="font-medium text-sm">{order.symbol}</div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge
                    variant={
                      order.side === "buy" ? "gain-subtle" : "loss-subtle"
                    }
                    size="sm"
                    className="gap-0.5"
                  >
                    {order.side === "buy" ? (
                      <ArrowUp className="h-2.5 w-2.5" />
                    ) : (
                      <ArrowDown className="h-2.5 w-2.5" />
                    )}
                    {order.side.toUpperCase()}
                  </Badge>
                  <span>
                    {order.qty} @ {order.type}
                  </span>
                </div>
              </div>
            </div>
            <div className="text-right">
              <Badge
                variant={getStatusVariant(order.status)}
                size="sm"
                className="text-xs"
              >
                {order.status}
              </Badge>
              <div className="text-xs text-muted-foreground mt-1">
                {new Date(order.createdAt).toLocaleTimeString()}
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function StrategyExecutionDashboard({
  strategyId,
  showActions = true,
  compact = false,
}: StrategyExecutionDashboardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showConfetti, setShowConfetti] = useState(false);
  const [flashOrderId, setFlashOrderId] = useState<string | null>(null);

  const { data: strategy, isLoading: strategyLoading } =
    useStrategy(strategyId);
  const {
    data: ordersData,
    isLoading: ordersLoading,
    refetch: refetchOrders,
  } = useStrategyOrders(strategyId);
  const { data: context, isLoading: contextLoading } =
    useExecutionContext(strategyId);

  const pauseMutation = usePauseStrategy();
  const resumeMutation = useResumeStrategy();
  const stopMutation = useStopStrategy();

  // Real-time SSE connection for live strategy execution updates
  const { isConnected, status } = useRealTimeTrading({
    enabled: !!user?.id,
    userId: user?.id,
    onOrderUpdate: (data) => {
      // Invalidate queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["strategy", strategyId] });
      queryClient.invalidateQueries({
        queryKey: ["strategyOrders", strategyId],
      });

      // Show toast for important status changes
      if (data.status === "rejected" || data.status === "canceled") {
        toast({
          title: "Order Update",
          description: `${data.symbol} ${data.side} order ${data.status}`,
          variant: "destructive",
        });
      }
    },
    onOrderFill: (data) => {
      // Invalidate queries for fill updates
      queryClient.invalidateQueries({ queryKey: ["strategy", strategyId] });
      queryClient.invalidateQueries({
        queryKey: ["strategyOrders", strategyId],
      });
      queryClient.invalidateQueries({
        queryKey: ["executionContext", strategyId],
      });

      // Trigger confetti celebration!
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 2500);

      // Flash the filled order row
      setFlashOrderId(data.orderId);
      setTimeout(() => setFlashOrderId(null), 3000);

      toast({
        title: "🎉 Order Filled!",
        description: `${data.symbol} ${data.side} ${data.qty || data.filledQty} shares @ $${data.price}`,
        variant: "default",
      });
    },
    onPositionUpdate: (data) => {
      // Invalidate strategy and context queries for position count updates
      queryClient.invalidateQueries({ queryKey: ["strategy", strategyId] });
      queryClient.invalidateQueries({
        queryKey: ["executionContext", strategyId],
      });
    },
  });

  const isLoading = strategyLoading || contextLoading;
  const orders = ordersData || [];
  const isActive = strategy?.status === "paper" || strategy?.status === "live";
  const isPaused = strategy?.status === "paused";

  const handlePause = () => {
    if (strategy) {
      pauseMutation.mutate(strategy.id);
    }
  };

  const handleResume = () => {
    if (strategy) {
      resumeMutation.mutate(strategy.id);
    }
  };

  const handleStop = () => {
    if (strategy && confirm("Are you sure you want to stop this strategy?")) {
      stopMutation.mutate(strategy.id);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!strategy) {
    return (
      <Card>
        <CardContent className="py-6 text-center text-muted-foreground">
          Strategy not found
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Confetti celebration for order fills */}
      <Confetti active={showConfetti} count={50} spread={300} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">{strategy.name}</h2>
          <div className="flex items-center gap-2 mt-1">
            <StatusBadge status={strategy.status} />
            {strategy.mode && (
              <Badge variant="outline" className="capitalize">
                {strategy.mode} Mode
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {user?.id && (
            <ConnectionStatus
              userId={user.id}
              compact={true}
              showStats={false}
            />
          )}
          {showActions && (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchOrders()}
                disabled={ordersLoading}
              >
                <RefreshCw
                  className={`h-4 w-4 mr-1 ${ordersLoading ? "animate-spin" : ""}`}
                />
                Refresh
              </Button>
              {isActive && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePause}
                  disabled={pauseMutation.isPending}
                >
                  <Pause className="h-4 w-4 mr-1" />
                  Pause
                </Button>
              )}
              {isPaused && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResume}
                  disabled={resumeMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Resume
                </Button>
              )}
              {(isActive || isPaused) && (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleStop}
                  disabled={stopMutation.isPending}
                >
                  <Square className="h-4 w-4 mr-1" />
                  Stop
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Performance Summary */}
      {strategy.performanceSummary && (
        <div
          className={`grid gap-4 ${compact ? "grid-cols-2" : "md:grid-cols-2 lg:grid-cols-4"}`}
        >
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  Total Return
                </div>
                {(strategy.performanceSummary.totalReturn ?? 0) >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-green-500" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-500" />
                )}
              </div>
              <div
                className={`text-2xl font-bold ${
                  (strategy.performanceSummary.totalReturn ?? 0) >= 0
                    ? "text-green-600"
                    : "text-red-600"
                }`}
              >
                {((strategy.performanceSummary.totalReturn ?? 0) * 100).toFixed(
                  2
                )}
                %
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Win Rate</div>
              <div className="text-2xl font-bold">
                {((strategy.performanceSummary.winRate ?? 0) * 100).toFixed(1)}%
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Sharpe Ratio</div>
              <div className="text-2xl font-bold">
                {(strategy.performanceSummary.sharpeRatio ?? 0).toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="text-sm text-muted-foreground">Total Trades</div>
              <div className="text-2xl font-bold">
                {strategy.performanceSummary.totalTrades ?? 0}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content */}
      <div className={`grid gap-6 ${compact ? "" : "lg:grid-cols-3"}`}>
        {/* Orders */}
        <Card className={compact ? "" : "lg:col-span-2"}>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Recent Orders
              </CardTitle>
              <Badge variant="outline">{orders.length} orders</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <RecentOrdersTable
              orders={orders}
              isLoading={ordersLoading}
              flashOrderId={flashOrderId}
            />
          </CardContent>
        </Card>

        {/* Execution Context */}
        {context && !compact && <ExecutionContextCard context={context} />}
      </div>
    </div>
  );
}

export default StrategyExecutionDashboard;
