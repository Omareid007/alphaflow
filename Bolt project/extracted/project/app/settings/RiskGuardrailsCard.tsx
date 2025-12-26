"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Shield,
  AlertTriangle,
  Wallet,
  TrendingDown,
  Check
} from "lucide-react";
import { UserSettings } from "@/lib/types";

interface RiskGuardrailsCardProps {
  settings: UserSettings;
  onGuardrailChange: (key: keyof UserSettings["riskGuardrails"], value: number | boolean) => void;
}

export function RiskGuardrailsCard({ settings, onGuardrailChange }: RiskGuardrailsCardProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Shield className="h-5 w-5 text-muted-foreground" />
          <div>
            <CardTitle className="text-lg">Risk Guardrails</CardTitle>
            <CardDescription>Set safety limits for your strategies</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-8">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Wallet className="h-4 w-4 text-muted-foreground" />
              <Label>Max Position Size</Label>
            </div>
            <span className="rounded-md bg-secondary px-3 py-1 text-sm font-medium">
              {settings.riskGuardrails.maxPositionSize}%
            </span>
          </div>
          <Slider
            value={[settings.riskGuardrails.maxPositionSize]}
            onValueChange={([v]) => onGuardrailChange("maxPositionSize", v)}
            min={5}
            max={50}
            step={5}
          />
          <p className="text-xs text-muted-foreground">
            Maximum size of any single position as a percentage of portfolio
          </p>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingDown className="h-4 w-4 text-muted-foreground" />
              <Label>Max Drawdown</Label>
            </div>
            <span className="rounded-md bg-secondary px-3 py-1 text-sm font-medium">
              {settings.riskGuardrails.maxDrawdown}%
            </span>
          </div>
          <Slider
            value={[settings.riskGuardrails.maxDrawdown]}
            onValueChange={([v]) => onGuardrailChange("maxDrawdown", v)}
            min={5}
            max={50}
            step={5}
          />
          <p className="text-xs text-muted-foreground">
            Pause strategy if portfolio drawdown exceeds this threshold
          </p>
        </div>

        <Separator />

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-muted-foreground" />
              <Label>Max Daily Loss</Label>
            </div>
            <span className="rounded-md bg-secondary px-3 py-1 text-sm font-medium">
              {settings.riskGuardrails.maxDailyLoss}%
            </span>
          </div>
          <Slider
            value={[settings.riskGuardrails.maxDailyLoss]}
            onValueChange={([v]) => onGuardrailChange("maxDailyLoss", v)}
            min={1}
            max={20}
            step={1}
          />
          <p className="text-xs text-muted-foreground">
            Halt all trading for the day if losses exceed this amount
          </p>
        </div>

        <Separator />

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 text-muted-foreground" />
              <Label>Require Confirmation</Label>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Require manual confirmation before executing large trades
            </p>
          </div>
          <Switch
            checked={settings.riskGuardrails.requireConfirmation}
            onCheckedChange={v => onGuardrailChange("requireConfirmation", v)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
