"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ShoppingCart,
  Loader2,
  ArrowUp,
  ArrowDown,
  CheckCircle,
  Clock,
  XCircle,
} from "lucide-react";
import { useOrders } from "@/lib/api/hooks";
import { useAuth } from "@/components/providers/auth-provider";
import { useRealTimeTrading } from "@/lib/hooks/useRealTimeTrading";
import { ConnectionStatus } from "@/components/trading/ConnectionStatus";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Confetti } from "@/lib/animations/confetti";
import { PageTransition } from "@/lib/animations/page-transitions";
import { StaggerList, StaggerItem } from "@/lib/animations/stagger";
import { motion, AnimatePresence } from "framer-motion";

export default function OrdersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const recentFillsRef = useRef<Set<string>>(new Set());
  const [showConfetti, setShowConfetti] = useState(false);
  const [flashOrderId, setFlashOrderId] = useState<string | null>(null);

  const { data: orders = [], isLoading, error } = useOrders({ limit: 100 });

  // Real-time SSE connection for live order updates
  const { isConnected, status } = useRealTimeTrading({
    enabled: !!user?.id,
    userId: user?.id,
    onOrderUpdate: (data) => {
      // Invalidate queries to trigger refetch
      queryClient.invalidateQueries({ queryKey: ["orders"] });

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
      queryClient.invalidateQueries({ queryKey: ["orders"] });

      // Show toast notification for new fills (deduplicated)
      const fillKey = `${data.orderId}-${data.timestamp}`;
      if (!recentFillsRef.current.has(fillKey)) {
        recentFillsRef.current.add(fillKey);

        // Keep dedup set bounded
        if (recentFillsRef.current.size > 50) {
          const arr = Array.from(recentFillsRef.current);
          recentFillsRef.current = new Set(arr.slice(25));
        }

        // Trigger confetti for order fills!
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
      }
    },
  });

  const getStatusVariant = (
    status: string
  ): "gain" | "gain-subtle" | "loss-subtle" | "secondary" | "outline" => {
    const normalized = status.toLowerCase();
    if (normalized === "filled") return "gain";
    if (
      normalized === "pending" ||
      normalized === "pending_new" ||
      normalized === "new" ||
      normalized === "accepted"
    )
      return "gain-subtle";
    if (normalized === "canceled" || normalized === "cancelled")
      return "outline";
    if (normalized === "rejected" || normalized === "failed")
      return "loss-subtle";
    return "secondary";
  };

  const getStatusIcon = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === "filled") return <CheckCircle className="h-3 w-3" />;
    if (
      normalized === "pending" ||
      normalized === "pending_new" ||
      normalized === "new" ||
      normalized === "accepted"
    )
      return <Clock className="h-3 w-3" />;
    if (normalized === "rejected" || normalized === "failed")
      return <XCircle className="h-3 w-3" />;
    return null;
  };

  return (
    <PageTransition>
      {/* Confetti celebration for order fills */}
      <Confetti active={showConfetti} count={60} spread={350} />

      <div className="space-y-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
            <p className="mt-1 text-muted-foreground">
              Admin view of all order activity
            </p>
          </div>
          {user?.id && (
            <ConnectionStatus
              userId={user.id}
              compact={false}
              showStats={true}
            />
          )}
        </div>

        <Card variant="glass">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <ShoppingCart className="h-5 w-5 text-primary" />
              </div>
              Order History
              {orders.length > 0 && (
                <Badge variant="secondary" className="ml-auto">
                  {orders.length} orders
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">
                    Loading orders...
                  </p>
                </div>
              </div>
            ) : error ? (
              <div className="py-16 text-center space-y-4">
                <div className="mx-auto h-16 w-16 rounded-full bg-destructive/10 flex items-center justify-center">
                  <XCircle className="h-8 w-8 text-destructive" />
                </div>
                <p className="text-sm text-destructive">
                  Failed to load orders.{" "}
                  {error instanceof Error ? error.message : "Please try again."}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="rounded-xl"
                >
                  <Loader2 className="mr-2 h-4 w-4" />
                  Retry
                </Button>
              </div>
            ) : orders.length === 0 ? (
              <div className="py-16 text-center">
                <div className="mx-auto h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                  <ShoppingCart className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground">No orders found</p>
              </div>
            ) : (
              <div className="rounded-xl border border-border/50 overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-secondary/30 hover:bg-secondary/30">
                      <TableHead className="font-semibold">Symbol</TableHead>
                      <TableHead className="font-semibold">Side</TableHead>
                      <TableHead className="font-semibold">Type</TableHead>
                      <TableHead className="font-semibold">Quantity</TableHead>
                      <TableHead className="font-semibold">Filled</TableHead>
                      <TableHead className="font-semibold">Price</TableHead>
                      <TableHead className="font-semibold">Status</TableHead>
                      <TableHead className="font-semibold">Submitted</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence>
                      {orders.map((order, index) => (
                        <motion.tr
                          key={order.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{
                            opacity: 1,
                            y: 0,
                            backgroundColor:
                              flashOrderId === order.id
                                ? "hsl(var(--gain) / 0.1)"
                                : "transparent",
                          }}
                          transition={{
                            duration: 0.2,
                            delay: index * 0.02,
                            backgroundColor: { duration: 0.5 },
                          }}
                          className="border-b border-border/30 hover:bg-secondary/20 transition-colors"
                        >
                          <TableCell className="font-semibold">
                            {order.symbol}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={order.side === "buy" ? "gain" : "loss"}
                              className="gap-1"
                            >
                              {order.side === "buy" ? (
                                <ArrowUp className="h-3 w-3" />
                              ) : (
                                <ArrowDown className="h-3 w-3" />
                              )}
                              {order.side?.toUpperCase() || "N/A"}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs text-muted-foreground px-2 py-1 rounded-md bg-secondary/50">
                              {order.type?.toUpperCase() || "N/A"}
                            </span>
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {order.qty || order.notional || "-"}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {order.filledQty || "0"}
                          </TableCell>
                          <TableCell className="tabular-nums">
                            {order.filledAvgPrice
                              ? `$${Number(order.filledAvgPrice).toFixed(2)}`
                              : order.limitPrice
                                ? `$${Number(order.limitPrice).toFixed(2)}`
                                : "Market"}
                          </TableCell>
                          <TableCell>
                            <Badge
                              variant={getStatusVariant(order.status || "")}
                              className="gap-1"
                            >
                              {getStatusIcon(order.status || "")}
                              {order.status?.toUpperCase() || "UNKNOWN"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {new Date(order.submittedAt).toLocaleString()}
                          </TableCell>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageTransition>
  );
}
