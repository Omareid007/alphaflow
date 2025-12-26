"use client";

import { useAiEvents, useFeedSources, useSentiment } from "@/lib/api";
import { FeedSource, SentimentSignal } from "@/lib/types";
import { EventCard } from "./EventCard";
import { SentimentCard } from "./SentimentCard";
import { StatsCards } from "./StatsCards";
import { EventsTabs } from "./EventsTabs";
import { DataSourcesCard } from "./DataSourcesCard";
import { SentimentGaugesCard } from "./SentimentGaugesCard";

export default function AiPulsePage() {
  const { data: apiEvents = [], isLoading: loading } = useAiEvents({ limit: 100 });
  const { data: sourcesData = [] } = useFeedSources();
  const { data: sentimentsData = [] } = useSentiment();

  // Use real data from API
  const sources: FeedSource[] = sourcesData;
  const sentiments: SentimentSignal[] = (Array.isArray(sentimentsData) ? sentimentsData : []) as unknown as SentimentSignal[];

  // Convert API events to expected format
  const events = apiEvents.map(e => ({
    id: e.id,
    time: e.createdAt || e.time || new Date().toISOString(),
    type: e.type,
    headline: e.title || e.headline || '',
    explanation: e.description || e.explanation || '',
    confidence: e.confidence || 0,
    impactedStrategies: e.impactedStrategies || [],
    symbol: e.symbol,
    action: e.action,
  }));

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  const signalEvents = events.filter(e => e.type === "signal");
  const riskEvents = events.filter(e => e.type === "risk");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">AI Pulse</h1>
        <p className="mt-1 text-muted-foreground">
          Real-time AI activity, signals, and market sentiment
        </p>
      </div>

      <StatsCards
        sources={sources}
        signalEvents={signalEvents}
        riskEvents={riskEvents}
        sentiments={sentiments}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <EventsTabs
            events={events}
            signalEvents={signalEvents}
            riskEvents={riskEvents}
          />
        </div>

        <div className="space-y-6">
          <DataSourcesCard sources={sources} />
          <SentimentGaugesCard sentiments={sentiments} />
        </div>
      </div>
    </div>
  );
}
