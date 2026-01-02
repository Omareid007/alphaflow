import Link from "next/link";
import { AlgorithmTemplate } from "@/lib/types";
import { Strategy } from "@/lib/api/hooks";
import { Button } from "@/components/ui/button";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import {
  ArrowLeft,
  Play,
  Pause,
  Square,
  Pencil,
  Rocket,
  Activity,
  Zap,
} from "lucide-react";
import { motion } from "framer-motion";

// Status configuration with Robinhood-style variants
const statusConfig: Record<
  string,
  {
    variant: BadgeProps["variant"];
    label: string;
    animate?: BadgeProps["animate"];
    icon?: React.ReactNode;
  }
> = {
  draft: { variant: "secondary", label: "Draft", icon: null },
  backtesting: {
    variant: "outline",
    label: "Backtesting",
    animate: "pulse",
    icon: <Activity className="h-3 w-3" />,
  },
  paper: {
    variant: "gain-subtle",
    label: "Paper Trading",
    animate: "glow",
    icon: <Zap className="h-3 w-3" />,
  },
  live: {
    variant: "gain",
    label: "Live Trading",
    animate: "glow",
    icon: <Zap className="h-3 w-3" />,
  },
  paused: {
    variant: "outline",
    label: "Paused",
    icon: <Pause className="h-3 w-3" />,
  },
  stopped: {
    variant: "loss-subtle",
    label: "Stopped",
    icon: <Square className="h-3 w-3" />,
  },
};

const DEFAULT_STATUS = {
  variant: "secondary" as const,
  label: "Unknown",
};

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
  onDeploy,
}: StrategyHeaderProps) {
  const statusInfo = statusConfig[strategy.status] || DEFAULT_STATUS;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
      className="flex items-center gap-4"
    >
      <Link href="/strategies">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-xl hover:bg-secondary/80"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </Link>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-3xl font-semibold tracking-tight truncate">
            {strategy.name}
          </h1>
          <Badge
            variant={statusInfo.variant}
            animate={statusInfo.animate}
            className="gap-1.5"
          >
            {statusInfo.icon}
            {statusInfo.label}
          </Badge>
        </div>
        <p className="mt-1 text-muted-foreground text-sm">{template?.name}</p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        {(strategy.status === "paper" || strategy.status === "live") && (
          <Button variant="outline" onClick={onPause} className="rounded-xl">
            <Pause className="mr-2 h-4 w-4" />
            Pause
          </Button>
        )}
        {strategy.status === "paused" && (
          <>
            <Button variant="outline" onClick={onResume} className="rounded-xl">
              <Play className="mr-2 h-4 w-4" />
              Resume
            </Button>
            <Button variant="loss" onClick={onStop} className="rounded-xl">
              <Square className="mr-2 h-4 w-4" />
              Stop
            </Button>
          </>
        )}
        {(strategy.status === "draft" ||
          strategy.status === "stopped" ||
          strategy.status === "backtesting") && (
          <>
            <Button
              variant="outline"
              onClick={() => onDeploy("paper")}
              className="rounded-xl"
            >
              <Play className="mr-2 h-4 w-4" />
              Paper Trade
            </Button>
            <Button
              variant="gain"
              onClick={() => onDeploy("live")}
              className="rounded-xl"
            >
              <Rocket className="mr-2 h-4 w-4" />
              Go Live
            </Button>
          </>
        )}
        <Link href={`/strategies/${strategy.id}/edit`}>
          <Button variant="glass" className="rounded-xl">
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}
