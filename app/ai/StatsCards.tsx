import { Card, CardContent } from "@/components/ui/card";
import { Brain, Zap, Activity, AlertTriangle } from "lucide-react";
import { FeedSource, AiEvent, SentimentSignal } from "@/lib/types";

interface StatsCardsProps {
  sources: FeedSource[];
  signalEvents: AiEvent[];
  riskEvents: AiEvent[];
  sentiments: SentimentSignal[];
}

export function StatsCards({
  sources,
  signalEvents,
  riskEvents,
  sentiments,
}: StatsCardsProps) {
  const activeSources = sources.filter((s) => s.status === "active").length;
  const avgSentiment =
    sentiments.length > 0
      ? (
          sentiments.reduce((sum, s) => sum + s.score, 0) / sentiments.length
        ).toFixed(2)
      : "0.00";

  return (
    <div className="grid gap-4 md:grid-cols-4">
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <Brain className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Active Sources</p>
              <p className="text-2xl font-semibold">
                {activeSources}/{sources.length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-success/10">
              <Zap className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Signals Today</p>
              <p className="text-2xl font-semibold">{signalEvents.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-warning/10">
              <AlertTriangle className="h-5 w-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Risk Alerts</p>
              <p className="text-2xl font-semibold">{riskEvents.length}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-400/10">
              <Activity className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Sentiment</p>
              <p className="text-2xl font-semibold">{avgSentiment}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
