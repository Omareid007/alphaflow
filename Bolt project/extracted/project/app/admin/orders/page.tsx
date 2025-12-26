"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ShoppingCart, Loader2 } from "lucide-react";
import { useOrders } from "@/lib/api/hooks";

export default function OrdersPage() {
  const { data: orders = [], isLoading, error } = useOrders({ limit: 100 });

  const getStatusVariant = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === 'filled') return 'default';
    if (normalized === 'pending' || normalized === 'pending_new' || normalized === 'new') return 'secondary';
    if (normalized === 'canceled' || normalized === 'cancelled') return 'outline';
    if (normalized === 'rejected' || normalized === 'failed') return 'destructive';
    return 'secondary';
  };

  const getStatusColor = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === 'filled') return 'bg-success/10 text-success';
    if (normalized === 'pending' || normalized === 'pending_new' || normalized === 'new') return 'bg-blue-500/10 text-blue-500';
    if (normalized === 'canceled' || normalized === 'cancelled') return 'bg-muted text-muted-foreground';
    if (normalized === 'rejected' || normalized === 'failed') return 'bg-destructive/10 text-destructive';
    return 'bg-muted text-muted-foreground';
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Orders</h1>
        <p className="mt-1 text-muted-foreground">Admin view of all order activity</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5" />
            Order History
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-destructive">
              Failed to load orders. Please try again.
            </div>
          ) : orders.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No orders found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Symbol</TableHead>
                  <TableHead>Side</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Filled</TableHead>
                  <TableHead>Price</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Submitted</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders.map(order => (
                  <TableRow key={order.id}>
                    <TableCell className="font-medium">{order.symbol}</TableCell>
                    <TableCell>
                      <Badge variant={order.side === 'buy' ? 'default' : 'secondary'}>
                        {order.side.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs text-muted-foreground">
                        {order.type.toUpperCase()}
                      </span>
                    </TableCell>
                    <TableCell>{order.qty || order.notional || '-'}</TableCell>
                    <TableCell>{order.filledQty || '0'}</TableCell>
                    <TableCell>
                      {order.filledAvgPrice
                        ? `$${Number(order.filledAvgPrice).toFixed(2)}`
                        : order.limitPrice
                        ? `$${Number(order.limitPrice).toFixed(2)}`
                        : 'Market'}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getStatusColor(order.status)}>
                        {order.status.toUpperCase()}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(order.submittedAt).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
