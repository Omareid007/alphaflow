"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface MonitoringTabProps {
  formData: {
    healthCheckEnabled: boolean;
    healthCheckEndpoint: string;
    healthCheckIntervalSeconds: number;
    healthCheckTimeoutMs: number;
    webhookUrl: string;
    webhookSecret: string;
    webhookEvents: string[];
  };
  updateField: (field: string, value: any) => void;
}

export function MonitoringTab({ formData, updateField }: MonitoringTabProps) {
  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Health Checks</Label>
            <p className="text-sm text-muted-foreground">
              Monitor provider availability
            </p>
          </div>
          <Switch
            checked={formData.healthCheckEnabled}
            onCheckedChange={(checked) =>
              updateField("healthCheckEnabled", checked)
            }
          />
        </div>

        {formData.healthCheckEnabled && (
          <div className="grid gap-4 md:grid-cols-2 pl-6">
            <div className="space-y-2">
              <Label htmlFor="healthCheckEndpoint">Health Check Endpoint</Label>
              <Input
                id="healthCheckEndpoint"
                value={formData.healthCheckEndpoint}
                onChange={(e) =>
                  updateField("healthCheckEndpoint", e.target.value)
                }
                placeholder="/health or /status"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="healthCheckIntervalSeconds">
                Check Interval (seconds)
              </Label>
              <Input
                id="healthCheckIntervalSeconds"
                type="number"
                value={formData.healthCheckIntervalSeconds}
                onChange={(e) =>
                  updateField(
                    "healthCheckIntervalSeconds",
                    parseInt(e.target.value)
                  )
                }
                min="30"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="healthCheckTimeoutMs">
                Health Check Timeout (ms)
              </Label>
              <Input
                id="healthCheckTimeoutMs"
                type="number"
                value={formData.healthCheckTimeoutMs}
                onChange={(e) =>
                  updateField("healthCheckTimeoutMs", parseInt(e.target.value))
                }
                min="1000"
              />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h4 className="font-medium">Webhook Configuration</h4>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook URL</Label>
            <Input
              id="webhookUrl"
              type="url"
              value={formData.webhookUrl}
              onChange={(e) => updateField("webhookUrl", e.target.value)}
              placeholder="https://your-app.com/webhooks/provider"
            />
            <p className="text-xs text-muted-foreground">
              Receive events from the provider
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhookSecret">Webhook Secret</Label>
            <Input
              id="webhookSecret"
              type="password"
              value={formData.webhookSecret}
              onChange={(e) => updateField("webhookSecret", e.target.value)}
              placeholder="Secret for webhook signature verification"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="webhookEvents">
              Webhook Events (comma-separated)
            </Label>
            <Input
              id="webhookEvents"
              value={formData.webhookEvents.join(", ")}
              onChange={(e) =>
                updateField(
                  "webhookEvents",
                  e.target.value
                    .split(",")
                    .map((t: string) => t.trim())
                    .filter(Boolean)
                )
              }
              placeholder="order.created, trade.executed, alert.triggered"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
