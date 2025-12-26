"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play } from "lucide-react";

interface BacktestPromptProps {
  strategyName: string;
  onStrategyNameChange: (name: string) => void;
  onRunBacktest: () => void;
}

export function BacktestPrompt({
  strategyName,
  onStrategyNameChange,
  onRunBacktest
}: BacktestPromptProps) {
  return (
    <Card>
      <CardContent className="py-12">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Play className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mt-4 text-xl font-semibold">Ready to Backtest</h3>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            Your strategy is configured. Run a backtest to see historical performance
            and get AI-powered insights.
          </p>
          <div className="mt-2 mb-6">
            <input
              type="text"
              value={strategyName}
              onChange={e => onStrategyNameChange(e.target.value)}
              className="mx-auto block w-full max-w-xs rounded-lg border border-border bg-background px-4 py-2 text-center"
              placeholder="Strategy Name"
            />
          </div>
          <Button size="lg" onClick={onRunBacktest}>
            <Play className="mr-2 h-5 w-5" />
            Run Backtest
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
