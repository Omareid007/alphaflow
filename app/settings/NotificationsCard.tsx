"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Bell, TrendingUp, Brain, AlertTriangle, Mail } from "lucide-react";
import { UserSettings } from "@/lib/types";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface NotificationsCardProps {
  settings: UserSettings;
  onNotificationChange: (
    key: keyof UserSettings["notifications"],
    value: boolean
  ) => void;
}

// Notification item config
const NOTIFICATION_ITEMS = [
  {
    key: "trades" as const,
    icon: TrendingUp,
    label: "Trade Notifications",
    description: "Receive alerts for order executions",
    iconColor: "text-gain",
    bgColor: "bg-gain/10",
  },
  {
    key: "aiAlerts" as const,
    icon: Brain,
    label: "AI Alerts",
    description: "Receive AI-generated signals and insights",
    iconColor: "text-primary",
    bgColor: "bg-primary/10",
  },
  {
    key: "riskWarnings" as const,
    icon: AlertTriangle,
    label: "Risk Warnings",
    description: "Get notified about risk threshold breaches",
    iconColor: "text-loss",
    bgColor: "bg-loss/10",
  },
  {
    key: "dailyDigest" as const,
    icon: Mail,
    label: "Daily Digest",
    description: "Receive a daily summary email",
    iconColor: "text-blue-500",
    bgColor: "bg-blue-500/10",
  },
];

export function NotificationsCard({
  settings,
  onNotificationChange,
}: NotificationsCardProps) {
  const enabledCount = Object.values(settings.notifications).filter(
    Boolean
  ).length;

  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">Notifications</CardTitle>
            <CardDescription>Configure alert preferences</CardDescription>
          </div>
          <Badge variant="secondary" className="ml-auto">
            {enabledCount}/{NOTIFICATION_ITEMS.length} active
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {NOTIFICATION_ITEMS.map((item, index) => {
          const Icon = item.icon;
          const isEnabled = settings.notifications[item.key];

          return (
            <motion.div
              key={item.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={cn(
                "flex items-center justify-between rounded-xl border p-4 transition-all",
                isEnabled
                  ? "border-border bg-secondary/30"
                  : "border-transparent bg-secondary/10"
              )}
            >
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                    isEnabled ? item.bgColor : "bg-secondary/50"
                  )}
                >
                  <Icon
                    className={cn(
                      "h-5 w-5 transition-colors",
                      isEnabled ? item.iconColor : "text-muted-foreground"
                    )}
                  />
                </div>
                <div>
                  <Label
                    className={cn(
                      "transition-colors",
                      isEnabled ? "text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {item.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {item.description}
                  </p>
                </div>
              </div>
              <Switch
                checked={isEnabled}
                onCheckedChange={(v) => onNotificationChange(item.key, v)}
              />
            </motion.div>
          );
        })}
      </CardContent>
    </Card>
  );
}
