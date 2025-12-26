"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Bell } from "lucide-react";
import { UserSettings } from "@/lib/types";

interface NotificationsCardProps {
  settings: UserSettings;
  onNotificationChange: (key: keyof UserSettings["notifications"], value: boolean) => void;
}

export function NotificationsCard({ settings, onNotificationChange }: NotificationsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-lg">Notifications</CardTitle>
            <CardDescription>Configure alert preferences</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Label>Trade Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Receive alerts for order executions
            </p>
          </div>
          <Switch
            checked={settings.notifications.trades}
            onCheckedChange={v => onNotificationChange("trades", v)}
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <Label>AI Alerts</Label>
            <p className="text-sm text-muted-foreground">
              Receive AI-generated signals and insights
            </p>
          </div>
          <Switch
            checked={settings.notifications.aiAlerts}
            onCheckedChange={v => onNotificationChange("aiAlerts", v)}
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <Label>Risk Warnings</Label>
            <p className="text-sm text-muted-foreground">
              Get notified about risk threshold breaches
            </p>
          </div>
          <Switch
            checked={settings.notifications.riskWarnings}
            onCheckedChange={v => onNotificationChange("riskWarnings", v)}
          />
        </div>
        <Separator />
        <div className="flex items-center justify-between">
          <div>
            <Label>Daily Digest</Label>
            <p className="text-sm text-muted-foreground">
              Receive a daily summary email
            </p>
          </div>
          <Switch
            checked={settings.notifications.dailyDigest}
            onCheckedChange={v => onNotificationChange("dailyDigest", v)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
