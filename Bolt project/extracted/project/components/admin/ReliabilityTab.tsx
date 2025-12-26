"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

interface ReliabilityTabProps {
  formData: {
    retryEnabled: boolean;
    retryMaxAttempts: number;
    retryBackoffMs: number;
    retryBackoffMultiplier: number;
    timeoutConnectMs: number;
    timeoutRequestMs: number;
    timeoutTotalMs: number;
  };
  updateField: (field: string, value: any) => void;
}

export function ReliabilityTab({ formData, updateField }: ReliabilityTabProps) {
  return (
    <div className="space-y-4 mt-4">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label>Retry Policy</Label>
            <p className="text-sm text-muted-foreground">Automatically retry failed requests</p>
          </div>
          <Switch
            checked={formData.retryEnabled}
            onCheckedChange={(checked) => updateField('retryEnabled', checked)}
          />
        </div>

        {formData.retryEnabled && (
          <div className="grid gap-4 md:grid-cols-2 pl-6">
            <div className="space-y-2">
              <Label htmlFor="retryMaxAttempts">Max Attempts</Label>
              <Input
                id="retryMaxAttempts"
                type="number"
                value={formData.retryMaxAttempts}
                onChange={(e) => updateField('retryMaxAttempts', parseInt(e.target.value))}
                min="1"
                max="10"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="retryBackoffMs">Initial Backoff (ms)</Label>
              <Input
                id="retryBackoffMs"
                type="number"
                value={formData.retryBackoffMs}
                onChange={(e) => updateField('retryBackoffMs', parseInt(e.target.value))}
                min="100"
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="retryBackoffMultiplier">Backoff Multiplier</Label>
              <Input
                id="retryBackoffMultiplier"
                type="number"
                step="0.1"
                value={formData.retryBackoffMultiplier}
                onChange={(e) => updateField('retryBackoffMultiplier', parseFloat(e.target.value))}
                min="1"
                max="10"
              />
              <p className="text-xs text-muted-foreground">Exponential backoff factor (e.g., 2.0 doubles wait time)</p>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 pt-4 border-t">
        <h4 className="font-medium">Timeout Configuration</h4>
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="timeoutConnectMs">Connect (ms)</Label>
            <Input
              id="timeoutConnectMs"
              type="number"
              value={formData.timeoutConnectMs}
              onChange={(e) => updateField('timeoutConnectMs', parseInt(e.target.value))}
              min="1000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timeoutRequestMs">Request (ms)</Label>
            <Input
              id="timeoutRequestMs"
              type="number"
              value={formData.timeoutRequestMs}
              onChange={(e) => updateField('timeoutRequestMs', parseInt(e.target.value))}
              min="1000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timeoutTotalMs">Total (ms)</Label>
            <Input
              id="timeoutTotalMs"
              type="number"
              value={formData.timeoutTotalMs}
              onChange={(e) => updateField('timeoutTotalMs', parseInt(e.target.value))}
              min="1000"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
