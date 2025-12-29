import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Radio, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { FeedSource } from "@/lib/types";
import { cn } from "@/lib/utils";

const feedStatusConfig: Record<
  string,
  { icon: React.ElementType; color: string }
> = {
  active: { icon: CheckCircle, color: "text-success" },
  delayed: { icon: Clock, color: "text-warning" },
  offline: { icon: AlertCircle, color: "text-destructive" },
};

const DEFAULT_FEED_STATUS = {
  icon: AlertCircle,
  color: "text-muted-foreground",
};

interface DataSourcesCardProps {
  sources: FeedSource[];
}

export function DataSourcesCard({ sources }: DataSourcesCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Radio className="h-5 w-5" />
          Data Sources
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sources.map((source) => {
          const statusConfig =
            feedStatusConfig[source.status] || DEFAULT_FEED_STATUS;
          const StatusIcon = statusConfig.icon;
          return (
            <div
              key={source.id}
              className="flex items-center justify-between rounded-lg bg-secondary/50 p-3"
            >
              <div>
                <p className="text-sm font-medium">{source.name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {source.category}
                </p>
              </div>
              <StatusIcon className={cn("h-4 w-4", statusConfig.color)} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
