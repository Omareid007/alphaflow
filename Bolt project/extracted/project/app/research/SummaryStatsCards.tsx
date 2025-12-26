import { WatchlistItem } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  TrendingDown,
  CheckCircle
} from "lucide-react";

interface SummaryStatsCardsProps {
  items: WatchlistItem[];
}

export function SummaryStatsCards({ items }: SummaryStatsCardsProps) {
  const topGainer = items.length > 0
    ? items.sort((a, b) => b.changePercent - a.changePercent)[0]?.symbol
    : "-";

  const topLoser = items.length > 0
    ? items.sort((a, b) => a.changePercent - b.changePercent)[0]?.symbol
    : "-";

  const eligibleCount = items.filter(i => i.eligible).length;
  const totalCount = items.length;

  return (
    <div className="grid gap-6 md:grid-cols-3">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-success/10">
              <TrendingUp className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Top Gainer</p>
              <p className="text-xl font-semibold">{topGainer}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-destructive/10">
              <TrendingDown className="h-6 w-6 text-destructive" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Top Loser</p>
              <p className="text-xl font-semibold">{topLoser}</p>
            </div>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <CheckCircle className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Eligible for Trading</p>
              <p className="text-xl font-semibold">
                {eligibleCount}/{totalCount}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
