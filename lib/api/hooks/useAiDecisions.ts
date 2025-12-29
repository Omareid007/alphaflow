import { useQuery } from "@tanstack/react-query";
import { api } from "../client";
import { AiEvent as AiEventType } from "@/lib/types";

export interface AiDecision {
  id: string;
  symbol?: string;
  action: "buy" | "sell" | "hold" | "wait";
  confidence: number;
  reasoning: string;
  signals?: string[];
  riskAssessment?: string;
  strategyId?: string;
  createdAt: string;
}

export interface SentimentData {
  symbol: string;
  sentiment: "bullish" | "bearish" | "neutral";
  score: number;
  sources: string[];
  updatedAt: string;
}

// Use AiEvent from lib/types but with compatible fields
export interface AiEvent {
  id: string;
  type: "signal" | "risk" | "sentiment" | "news" | "suggestion";
  title?: string;
  description?: string;
  headline?: string;
  explanation?: string;
  time?: string;
  createdAt?: string;
  confidence?: number;
  severity?: "low" | "medium" | "high" | "critical";
  symbol?: string;
  metadata?: Record<string, unknown>;
  impactedStrategies?: { id: string; name: string }[];
  action?: string;
}

export function useAiDecisions(options?: {
  limit?: number;
  strategyId?: string;
}) {
  return useQuery({
    queryKey: ["ai", "decisions", options],
    queryFn: () =>
      api.get<AiDecision[]>("/api/ai-decisions", {
        params: options,
      }),
  });
}

export function useAiEvents(options?: { limit?: number; type?: string }) {
  return useQuery({
    queryKey: ["ai", "events", options],
    queryFn: () =>
      api.get<AiEvent[]>("/api/ai/events", {
        params: options,
      }),
    refetchInterval: 60000, // Reduced from 30s
  });
}

// Removed duplicate useSentiment - use /lib/api/hooks/useSentiment.ts instead
// export function useSentiment(symbol?: string) {
//   return useQuery({
//     queryKey: ['ai', 'sentiment', symbol],
//     queryFn: () => api.get<SentimentData | SentimentData[]>(
//       symbol ? `/api/ai/sentiment/${symbol}` : '/api/ai/sentiment'
//     ),
//     enabled: true,
//     refetchInterval: 60000,
//   });
// }

export function useMarketCondition() {
  return useQuery({
    queryKey: ["ai", "market-condition"],
    queryFn: () =>
      api.get<{
        regime: "bullish" | "bearish" | "neutral" | "volatile";
        confidence: number;
        indicators: Record<string, number>;
        updatedAt: string;
      }>("/api/ai/market-condition"),
    refetchInterval: 60000,
  });
}
