import { SentimentSignal } from "@/lib/types";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

interface SentimentCardProps {
  signal: SentimentSignal;
}

export function SentimentCard({ signal }: SentimentCardProps) {
  const normalizedScore = ((signal.score + 1) / 2) * 100;
  const TrendIcon =
    signal.trend === "up"
      ? TrendingUp
      : signal.trend === "down"
        ? TrendingDown
        : Minus;

  return (
    <div className="rounded-xl border border-border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold">{signal.symbol}</span>
          <TrendIcon
            className={cn(
              "h-4 w-4",
              signal.trend === "up"
                ? "text-success"
                : signal.trend === "down"
                  ? "text-destructive"
                  : "text-muted-foreground"
            )}
          />
        </div>
        <span
          className={cn(
            "text-lg font-semibold",
            signal.score > 0.2
              ? "text-success"
              : signal.score < -0.2
                ? "text-destructive"
                : "text-muted-foreground"
          )}
        >
          {signal.score > 0 ? "+" : ""}
          {signal.score.toFixed(2)}
        </span>
      </div>
      <div className="mt-3">
        <div className="relative h-2 w-full rounded-full bg-secondary">
          <div
            className="absolute h-2 rounded-full bg-gradient-to-r from-destructive via-muted-foreground to-success"
            style={{ width: "100%" }}
          />
          <div
            className="absolute top-1/2 h-4 w-1 -translate-y-1/2 rounded-full bg-foreground"
            style={{ left: `${normalizedScore}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-xs text-muted-foreground">
          <span>Bearish</span>
          <span>Neutral</span>
          <span>Bullish</span>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted-foreground">{signal.explanation}</p>
      <p className="mt-2 text-xs text-muted-foreground">
        Source: {signal.sourceName}
      </p>
    </div>
  );
}
