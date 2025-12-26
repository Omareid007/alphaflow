import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { SentimentSignal } from "@/lib/types";
import { SentimentCard } from "./SentimentCard";

interface SentimentGaugesCardProps {
  sentiments: SentimentSignal[];
}

export function SentimentGaugesCard({ sentiments }: SentimentGaugesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Sentiment Gauges</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {sentiments.slice(0, 4).map(signal => (
          <SentimentCard key={signal.id} signal={signal} />
        ))}
      </CardContent>
    </Card>
  );
}
