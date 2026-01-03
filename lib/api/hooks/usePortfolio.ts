import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { toast } from "sonner";

export interface Position {
  id: string;
  symbol: string;
  side: "long" | "short";
  qty: number;
  entryPrice: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPl: number;
  unrealizedPlPct: number;
  costBasis: number;
  assetClass: "us_equity" | "crypto";
}

export interface PortfolioSnapshot {
  totalEquity: number;
  buyingPower: number;
  cash: number;
  portfolioValue: number;
  dailyPl: number;
  dailyPlPct: number;
  totalPl: number;
  totalPlPct: number;
  positions: Position[];
  timestamp: string;
}

export interface Trade {
  id: string;
  symbol: string;
  side: "buy" | "sell";
  qty: number;
  price: number;
  totalValue: number;
  fee?: number;
  pnl?: number; // Realized P&L from the trade
  strategyId?: string;
  strategyName?: string;
  executedAt: string;
}

// Default empty portfolio snapshot to prevent undefined errors
const EMPTY_PORTFOLIO_SNAPSHOT: PortfolioSnapshot = {
  totalEquity: 0,
  buyingPower: 0,
  cash: 0,
  portfolioValue: 0,
  dailyPl: 0,
  dailyPlPct: 0,
  totalPl: 0,
  totalPlPct: 0,
  positions: [],
  timestamp: new Date().toISOString(),
};

export function usePortfolioSnapshot() {
  return useQuery({
    queryKey: ["portfolio", "snapshot"],
    queryFn: () => api.get<PortfolioSnapshot>("/api/positions/snapshot"),
    // Inherits staleTime: 5s, refetchInterval: 30s from QueryProvider defaults
    initialData: EMPTY_PORTFOLIO_SNAPSHOT,
  });
}

export function usePositions() {
  return useQuery({
    queryKey: ["positions"],
    initialData: [] as Position[],
    queryFn: async () => {
      const response = await api.get<{ positions: any[] } | any[]>(
        "/api/positions"
      );
      // Handle both wrapped and unwrapped response formats
      const rawPositions = Array.isArray(response)
        ? response
        : response.positions || [];

      // Map API field names to interface field names
      // SYNC FIX: Handle both EnrichedPosition (quantity, unrealizedPnl) and simple Position (qty, unrealizedPl) formats
      return rawPositions.map(
        (p: any): Position => ({
          id: p.id || p.asset_id || "",
          symbol: p.symbol || "",
          side: p.side || (p.quantity > 0 || p.qty > 0 ? "long" : "short"),
          qty: p.qty ?? p.quantity ?? 0,
          entryPrice: p.entryPrice ?? p.avg_entry_price ?? 0,
          currentPrice: p.currentPrice ?? p.current_price ?? 0,
          marketValue: p.marketValue ?? p.market_value ?? 0,
          // CRITICAL FIX: Handle unrealizedPnl (from EnrichedPosition) and unrealizedPl (from snapshot)
          unrealizedPl:
            p.unrealizedPl ?? p.unrealizedPnl ?? p.unrealized_pl ?? 0,
          // CRITICAL FIX: Handle unrealizedPnlPercent (from EnrichedPosition, already in %) and unrealized_plpc (from Alpaca, needs *100)
          unrealizedPlPct:
            p.unrealizedPlPct ??
            p.unrealizedPnlPercent ??
            (p.unrealized_plpc ? p.unrealized_plpc * 100 : 0),
          costBasis: p.costBasis ?? p.cost_basis ?? 0,
          assetClass: p.assetClass ?? p.asset_class ?? "us_equity",
        })
      );
    },
    // Inherits staleTime: 5s, refetchInterval: 30s from QueryProvider defaults
  });
}

export function useTrades(options?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["trades", options],
    initialData: [] as Trade[],
    queryFn: async () => {
      const response = await api.get<any[]>("/api/trades", {
        params: options,
      });
      // Map API response to Trade interface, handling different field naming conventions
      return response.map(
        (t: any): Trade => ({
          id: t.id || "",
          symbol: t.symbol || "",
          side: t.side || "buy",
          qty: parseFloat(t.quantity) || parseFloat(t.qty) || 0,
          price: parseFloat(t.price) || 0,
          totalValue:
            (parseFloat(t.quantity) || parseFloat(t.qty) || 0) *
            (parseFloat(t.price) || 0),
          fee: parseFloat(t.fee) || 0,
          pnl: t.pnl != null ? parseFloat(t.pnl) : undefined, // Map P&L from database
          strategyId: t.strategyId || t.strategy_id,
          strategyName: t.strategyName || t.strategy_name,
          executedAt: t.executedAt || t.executed_at || new Date().toISOString(),
        })
      );
    },
  });
}

export function useTradesBySymbol(symbol: string) {
  return useQuery({
    queryKey: ["trades", "symbol", symbol],
    queryFn: () => api.get<Trade[]>(`/api/trades/symbol/${symbol}`),
    enabled: !!symbol,
    initialData: [] as Trade[],
  });
}

export function useAccountInfo() {
  return useQuery({
    queryKey: ["account"],
    queryFn: () =>
      api.get<{
        id: string;
        status: string;
        currency: string;
        buyingPower: number;
        cash: number;
        portfolioValue: number;
        tradingBlocked: boolean;
        accountBlocked: boolean;
      }>("/api/alpaca/account"),
    // Inherits staleTime: 5s, refetchInterval: 30s from QueryProvider defaults
  });
}

/**
 * Hook to execute a trade order
 * Automatically invalidates portfolio, positions, and account data after successful execution
 */
export function useExecuteTrade() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (orderData: {
      symbol: string;
      qty: number;
      side: "buy" | "sell";
      type?: "market" | "limit";
      limitPrice?: number;
    }) => api.post<Trade>("/api/orders", orderData),

    onSuccess: () => {
      // Smart invalidation: Only invalidate portfolio-related queries
      // This ensures fresh data after trade execution without over-fetching
      queryClient.invalidateQueries({ queryKey: ["portfolio"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["positions"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["account"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["trades"], exact: false });
      queryClient.invalidateQueries({ queryKey: ["orders"], exact: false });

      toast.success("Trade executed successfully");
    },

    onError: (error) => {
      toast.error("Failed to execute trade");
      console.error("Trade execution error:", error);
    },
  });
}
