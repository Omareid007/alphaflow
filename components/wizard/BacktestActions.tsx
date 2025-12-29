"use client";

import { Button } from "@/components/ui/button";
import { Play, Rocket, RefreshCw } from "lucide-react";

interface BacktestActionsProps {
  onRunAgain: () => void;
  onDeploy: (mode: "paper" | "live") => void;
}

export function BacktestActions({
  onRunAgain,
  onDeploy,
}: BacktestActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex gap-3">
        <Button variant="outline" onClick={onRunAgain}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Modify & Retest
        </Button>
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={() => onDeploy("paper")}>
          <Play className="mr-2 h-4 w-4" />
          Deploy Paper
        </Button>
        <Button onClick={() => onDeploy("live")}>
          <Rocket className="mr-2 h-4 w-4" />
          Deploy Live
        </Button>
      </div>
    </div>
  );
}
