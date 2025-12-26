import Link from "next/link";
import { AlgorithmTemplate } from "@/lib/types";
import { Strategy } from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  Pencil,
  Rocket
} from "lucide-react";

const statusConfig: Record<string, { color: string; label: string }> = {
  draft: { color: "bg-muted text-muted-foreground", label: "Draft" },
  backtesting: { color: "bg-blue-500/10 text-blue-500", label: "Backtesting" },
  paper: { color: "bg-blue-500/10 text-blue-500", label: "Paper Trading" },
  live: { color: "bg-success/10 text-success", label: "Live Trading" },
  paused: { color: "bg-warning/10 text-warning", label: "Paused" },
  stopped: { color: "bg-destructive/10 text-destructive", label: "Stopped" }
};

const DEFAULT_STATUS = { color: "bg-muted text-muted-foreground", label: "Unknown" };

interface StrategyHeaderProps {
  strategy: Strategy;
  template: AlgorithmTemplate | null;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onDeploy: (mode: "paper" | "live") => void;
}

export function StrategyHeader({
  strategy,
  template,
  onPause,
  onResume,
  onStop,
  onDeploy
}: StrategyHeaderProps) {
  const statusInfo = statusConfig[strategy.status] || DEFAULT_STATUS;

  return (
    <div className="flex items-center gap-4">
      <Link href="/strategies">
        <Button variant="ghost" size="icon">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </Link>
      <div className="flex-1">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-semibold tracking-tight">{strategy.name}</h1>
          <Badge variant="secondary" className={statusInfo.color}>
            {statusInfo.label}
          </Badge>
        </div>
        <p className="mt-1 text-muted-foreground">{template?.name}</p>
      </div>
      <div className="flex gap-2">
        {(strategy.status === "paper" || strategy.status === "live") && (
          <Button variant="outline" onClick={onPause}>
            <Pause className="mr-2 h-4 w-4" />
            Pause
          </Button>
        )}
        {strategy.status === "paused" && (
          <>
            <Button variant="outline" onClick={onResume}>
              <Play className="mr-2 h-4 w-4" />
              Resume
            </Button>
            <Button variant="outline" onClick={onStop}>
              <Square className="mr-2 h-4 w-4" />
              Stop
            </Button>
          </>
        )}
        {(strategy.status === "draft" || strategy.status === "stopped" || strategy.status === "backtesting") && (
          <>
            <Button variant="outline" onClick={() => onDeploy("paper")}>
              <Play className="mr-2 h-4 w-4" />
              Paper Trade
            </Button>
            <Button onClick={() => onDeploy("live")}>
              <Rocket className="mr-2 h-4 w-4" />
              Go Live
            </Button>
          </>
        )}
        <Link href={`/strategies/${strategy.id}/edit`}>
          <Button variant="outline">
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Link>
      </div>
    </div>
  );
}
