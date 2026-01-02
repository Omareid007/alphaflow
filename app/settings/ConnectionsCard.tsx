"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Link2,
  TrendingUp,
  Database,
  Check,
  Clock,
  ExternalLink,
} from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

// Connection status - in a real app this would come from API
const CONNECTIONS = [
  {
    id: "alpaca",
    name: "Alpaca Trading",
    description: "Paper & live trading via Alpaca Markets",
    icon: TrendingUp,
    status: "connected" as const,
    statusLabel: "Connected",
    color: "text-gain",
    bgColor: "bg-gain/10",
    borderColor: "border-gain/20",
  },
  {
    id: "market-data",
    name: "Market Data Feed",
    description: "Real-time quotes and historical data",
    icon: Database,
    status: "connected" as const,
    statusLabel: "Connected",
    color: "text-gain",
    bgColor: "bg-gain/10",
    borderColor: "border-gain/20",
  },
];

export function ConnectionsCard() {
  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Link2 className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">Connections</CardTitle>
            <CardDescription>Broker and data feed integrations</CardDescription>
          </div>
          <Badge variant="gain-subtle" className="gap-1.5">
            <Check className="h-3 w-3" />
            All connected
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {CONNECTIONS.map((connection, index) => {
          const Icon = connection.icon;
          const isConnected = connection.status === "connected";

          return (
            <motion.div
              key={connection.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "flex items-center justify-between rounded-xl border p-4 transition-all",
                isConnected
                  ? "border-gain/20 bg-gain/5"
                  : "border-border bg-secondary/20"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl",
                    isConnected ? connection.bgColor : "bg-secondary/50"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5",
                      isConnected ? connection.color : "text-muted-foreground"
                    )}
                  />
                </div>
                <div>
                  <p className="font-medium">{connection.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {connection.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant={isConnected ? "gain" : "secondary"}
                  className="gap-1.5"
                >
                  {isConnected ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Clock className="h-3 w-3" />
                  )}
                  {connection.statusLabel}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-lg"
                  title="View details"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          );
        })}

        {/* Future connections placeholder */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-xl border border-dashed border-border/50 bg-secondary/10 p-4 text-center"
        >
          <p className="text-sm text-muted-foreground">
            More integrations coming soon
          </p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Interactive Brokers, Polygon.io, and more
          </p>
        </motion.div>
      </CardContent>
    </Card>
  );
}
