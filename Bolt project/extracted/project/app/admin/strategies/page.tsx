"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { List, Loader2 } from "lucide-react";
import { useStrategies } from "@/lib/api/hooks";

export default function AdminStrategiesPage() {
  const { data: strategies = [], isLoading, error } = useStrategies();

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'live':
        return 'default';
      case 'paper':
        return 'secondary';
      case 'paused':
        return 'outline';
      case 'stopped':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Strategies (Admin)</h1>
        <p className="mt-1 text-muted-foreground">Global strategy management</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <List className="h-5 w-5" />
            All Strategies
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="py-8 text-center text-sm text-destructive">
              Failed to load strategies. Please try again.
            </div>
          ) : strategies.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              No strategies found
            </div>
          ) : (
            <div className="space-y-3">
              {strategies.map(strat => (
                <div key={strat.id} className="flex items-center justify-between rounded-lg border border-border p-3">
                  <div>
                    <p className="font-medium">{strat.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {strat.description || strat.templateId}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant={getStatusVariant(strat.status)}>
                      {strat.status.toUpperCase()}
                    </Badge>
                    {strat.performanceSummary?.totalReturn !== undefined && (
                      <span className={strat.performanceSummary.totalReturn >= 0 ? 'text-success' : 'text-destructive'}>
                        {strat.performanceSummary.totalReturn >= 0 ? '+' : ''}
                        {strat.performanceSummary.totalReturn.toFixed(2)}%
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
