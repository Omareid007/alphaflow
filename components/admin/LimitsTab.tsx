"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface LimitsTabProps {
  formData: {
    rateLimitRequests: number;
    rateLimitWindowSeconds: number;
    rateLimitPerKey: boolean;
    connectionPoolSize: number;
    connectionPoolTimeoutMs: number;
  };
  updateField: (field: string, value: any) => void;
}

export function LimitsTab({ formData, updateField }: LimitsTabProps) {
  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Rate Limiting</Label>
            <p className="text-sm text-muted-foreground">Control request rate to prevent overload</p>
          </div>
          <Switch
            checked={formData.rateLimitRequests > 0}
            onCheckedChange={(checked) => updateField('rateLimitRequests', checked ? 100 : 0)}
          />
        </div>

        {formData.rateLimitRequests > 0 && (
          <div className="grid gap-4 md:grid-cols-2 pl-6">
            <div className="space-y-2">
              <Label htmlFor="rateLimitRequests">Max Requests</Label>
              <Input
                id="rateLimitRequests"
                type="number"
                value={formData.rateLimitRequests}
                onChange={(e) => updateField('rateLimitRequests', parseInt(e.target.value))}
                min="1"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="rateLimitWindowSeconds">Time Window (seconds)</Label>
              <Input
                id="rateLimitWindowSeconds"
                type="number"
                value={formData.rateLimitWindowSeconds}
                onChange={(e) => updateField('rateLimitWindowSeconds', parseInt(e.target.value))}
                min="1"
              />
            </div>
            <div className="flex items-center space-x-2 md:col-span-2">
              <Switch
                checked={formData.rateLimitPerKey}
                onCheckedChange={(checked) => updateField('rateLimitPerKey', checked)}
              />
              <Label>Apply rate limit per API key</Label>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h4 className="font-medium">Connection Pool</h4>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="connectionPoolSize">Pool Size</Label>
            <Input
              id="connectionPoolSize"
              type="number"
              value={formData.connectionPoolSize}
              onChange={(e) => updateField('connectionPoolSize', parseInt(e.target.value))}
              min="1"
              max="1000"
            />
            <p className="text-xs text-muted-foreground">Max concurrent connections</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="connectionPoolTimeoutMs">Pool Timeout (ms)</Label>
            <Input
              id="connectionPoolTimeoutMs"
              type="number"
              value={formData.connectionPoolTimeoutMs}
              onChange={(e) => updateField('connectionPoolTimeoutMs', parseInt(e.target.value))}
              min="1000"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
