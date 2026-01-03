import { useQuery } from "@tanstack/react-query";
import { api } from "../client";

export interface MarketQuote {
  symbol: string;
  price: number | null;
  change: number | null;
  changePercent: number | null;
  volume?: number;
  high?: number;
  low?: number;
  open?: number;
}

export function useMarketQuotes(symbols: string[]) {
  return useQuery({
    queryKey: ["market", "quotes", symbols.join(",")],
    queryFn: () =>
      api.get<MarketQuote[]>("/api/market/quotes", {
        params: { symbols: symbols.join(",") },
      }),
    enabled: symbols.length > 0,
    // Inherits staleTime: 5s, refetchInterval: 30s from QueryProvider defaults
    initialData: [] as MarketQuote[],
  });
}
