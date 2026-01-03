"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Loader2 } from "lucide-react";
import { useDebouncedCallback } from "@/lib/utils/useDebounce";
import { cn } from "@/lib/utils";

interface BacktestPromptProps {
  strategyName: string;
  onStrategyNameChange: (name: string) => void;
  onRunBacktest: () => void;
}

export function BacktestPrompt({
  strategyName,
  onStrategyNameChange,
  onRunBacktest,
}: BacktestPromptProps) {
  const [isValidating, setIsValidating] = useState(false);
  const [localValue, setLocalValue] = useState(strategyName);

  // Debounced callback for updating strategy name (300ms for text input)
  const debouncedUpdate = useDebouncedCallback((value: string) => {
    setIsValidating(false);
    onStrategyNameChange(value);
  }, 300);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setLocalValue(value);
    setIsValidating(true);
    debouncedUpdate(value);
  };

  return (
    <Card>
      <CardContent className="py-12">
        <div className="text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Play className="h-8 w-8 text-primary" />
          </div>
          <h3 className="mt-4 text-xl font-semibold">Ready to Backtest</h3>
          <p className="mx-auto mt-2 max-w-md text-muted-foreground">
            Your strategy is configured. Run a backtest to see historical
            performance and get AI-powered insights.
          </p>
          <div className="mt-2 mb-6 relative">
            <input
              type="text"
              value={localValue}
              onChange={handleChange}
              className={cn(
                "mx-auto block w-full max-w-xs rounded-lg border border-border bg-background px-4 py-2 text-center pr-10",
                "transition-colors focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              )}
              placeholder="Strategy Name"
            />
            {isValidating && (
              <div className="absolute right-[calc(50%-10rem)] top-1/2 -translate-y-1/2">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
              </div>
            )}
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
