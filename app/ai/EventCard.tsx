import Link from "next/link";
import { AiEvent } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Zap,
  Activity,
  AlertTriangle,
  Lightbulb,
  Newspaper,
} from "lucide-react";
import { cn } from "@/lib/utils";

const eventTypeConfig: Record<
  string,
  { icon: React.ElementType; color: string; label: string }
> = {
  signal: { icon: Zap, color: "text-primary bg-primary/10", label: "Signal" },
  sentiment: {
    icon: Activity,
    color: "text-blue-400 bg-blue-400/10",
    label: "Sentiment",
  },
  news: {
    icon: Newspaper,
    color: "text-muted-foreground bg-secondary",
    label: "News",
  },
  risk: {
    icon: AlertTriangle,
    color: "text-warning bg-warning/10",
    label: "Risk Alert",
  },
  suggestion: {
    icon: Lightbulb,
    color: "text-success bg-success/10",
    label: "Suggestion",
  },
};

interface EventCardProps {
  event: AiEvent;
}

export function EventCard({ event }: EventCardProps) {
  const config = eventTypeConfig[event.type] || eventTypeConfig.signal;
  const Icon = config.icon;

  return (
    <div className="border-b border-border py-4 last:border-0">
      <div className="flex gap-4">
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl",
            config.color
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs">
                  {config.label}
                </Badge>
                {event.symbol && (
                  <Badge variant="secondary" className="text-xs">
                    {event.symbol}
                  </Badge>
                )}
                {event.action && (
                  <Badge
                    variant="secondary"
                    className={cn(
                      "text-xs",
                      event.action === "BUY"
                        ? "bg-success/10 text-success"
                        : "bg-destructive/10 text-destructive"
                    )}
                  >
                    {event.action}
                  </Badge>
                )}
              </div>
              <h3 className="mt-2 font-medium">{event.headline}</h3>
              <p className="mt-1 text-sm text-muted-foreground line-clamp-2">
                {event.explanation}
              </p>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted-foreground">
                {new Date(event.time).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </div>
              <div className="mt-1 text-xs text-muted-foreground">
                {new Date(event.time).toLocaleDateString()}
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">Confidence</span>
              <Progress value={event.confidence * 100} className="h-1.5 w-20" />
              <span className="text-xs font-medium">
                {(event.confidence * 100).toFixed(0)}%
              </span>
            </div>
            {event.impactedStrategies.length > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Impacts:</span>
                {event.impactedStrategies.map((s) => (
                  <Link key={s.id} href={`/strategies/${s.id}`}>
                    <Badge
                      variant="outline"
                      className="text-xs hover:bg-secondary"
                    >
                      {s.name}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
