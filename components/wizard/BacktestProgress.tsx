"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface BacktestProgressProps {
  progress: number;
}

export function BacktestProgress({ progress }: BacktestProgressProps) {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <h3 className="mt-4 text-xl font-semibold">Running Backtest</h3>
          <p className="mt-2 text-muted-foreground">
            Simulating your strategy across historical data...
          </p>
          <Progress value={progress} className="mx-auto mt-6 max-w-sm" />
          <p className="mt-2 text-sm text-muted-foreground">{progress}%</p>
        </div>
      </CardContent>
    </Card>
  );
}
