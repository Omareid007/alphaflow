import { useQuery } from "@tanstack/react-query";
import { api } from "../client";

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

export function usePortfolioSnapshot() {
  return useQuery({
    queryKey: ["portfolio", "snapshot"],
    queryFn: () => api.get<PortfolioSnapshot>("/api/positions/snapshot"),
    refetchInterval: 60000, // Refresh every 60 seconds - reduced from 30s
  });
}

export function usePositions() {
  return useQuery({
    queryKey: ["positions"],
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
    refetchInterval: 60000, // Reduced from 30s
  });
}

export function useTrades(options?: { limit?: number; offset?: number }) {
  return useQuery({
    queryKey: ["trades", options],
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
    refetchInterval: 60000,
  });
}
