"use client";

import { StrategyWizard } from "@/components/wizard/strategy-wizard";

export default function CreatePage() {
  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-semibold tracking-tight">Create Strategy</h1>
        <p className="mt-1 text-muted-foreground">
          Build and backtest your AI-powered trading strategy
        </p>
      </div>
      <StrategyWizard />
    </div>
  );
}
