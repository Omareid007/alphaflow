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
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import {
  Shield,
  AlertTriangle,
  Wallet,
  TrendingDown,
  Check,
  ShieldCheck,
  Loader2,
} from "lucide-react";
import { UserSettings } from "@/lib/types";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useDebouncedCallback } from "@/lib/utils/useDebounce";
import { useState } from "react";

interface RiskGuardrailsCardProps {
  settings: UserSettings;
  onGuardrailChange: (
    key: keyof UserSettings["riskGuardrails"],
    value: number | boolean
  ) => void;
}

// Risk level indicator based on settings
function getRiskLevel(settings: UserSettings["riskGuardrails"]) {
  const { maxPositionSize, maxDrawdown, maxDailyLoss } = settings;
  const score = (maxPositionSize + maxDrawdown + maxDailyLoss) / 3;

  if (score <= 15)
    return { label: "Conservative", color: "text-gain", bg: "bg-gain/10" };
  if (score <= 30)
    return { label: "Moderate", color: "text-primary", bg: "bg-primary/10" };
  return { label: "Aggressive", color: "text-loss", bg: "bg-loss/10" };
}

export function RiskGuardrailsCard({
  settings,
  onGuardrailChange,
}: RiskGuardrailsCardProps) {
  const riskLevel = getRiskLevel(settings.riskGuardrails);
  const [pendingChanges, setPendingChanges] = useState<Set<string>>(new Set());

  // Debounced callback for slider changes (500ms for number inputs)
  const debouncedGuardrailChange = useDebouncedCallback(
    (key: keyof UserSettings["riskGuardrails"], value: number | boolean) => {
      onGuardrailChange(key, value);
      setPendingChanges((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    },
    500
  );

  const handleSliderChange = (
    key: keyof UserSettings["riskGuardrails"],
    value: number
  ) => {
    setPendingChanges((prev) => new Set(prev).add(key));
    debouncedGuardrailChange(key, value);
  };

  const handleSwitchChange = (
    key: keyof UserSettings["riskGuardrails"],
    value: boolean
  ) => {
    // Switches don't need debouncing - immediate feedback is expected
    onGuardrailChange(key, value);
  };

  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">Risk Guardrails</CardTitle>
            <CardDescription>
              Set safety limits for your strategies
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            {pendingChanges.size > 0 && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 text-xs text-muted-foreground"
              >
                <Loader2 className="h-3 w-3 animate-spin" />
                Saving...
              </motion.div>
            )}
            <Badge
              variant="secondary"
              className={cn("gap-1.5", riskLevel.color)}
            >
              <ShieldCheck className="h-3 w-3" />
              {riskLevel.label}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Max Position Size */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="space-y-4 rounded-xl border border-border/50 bg-secondary/20 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10">
                <Wallet className="h-4 w-4 text-blue-500" />
              </div>
              <Label className="text-base font-medium">Max Position Size</Label>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums",
                  settings.riskGuardrails.maxPositionSize <= 15
                    ? "bg-gain/10 text-gain"
                    : settings.riskGuardrails.maxPositionSize <= 30
                      ? "bg-primary/10 text-primary"
                      : "bg-loss/10 text-loss"
                )}
              >
                {settings.riskGuardrails.maxPositionSize}%
              </span>
            </div>
          </div>
          <Slider
            value={[settings.riskGuardrails.maxPositionSize]}
            onValueChange={([v]) => handleSliderChange("maxPositionSize", v)}
            min={5}
            max={50}
            step={5}
            className="py-2"
          />
          <p className="text-xs text-muted-foreground">
            Maximum size of any single position as a percentage of portfolio
          </p>
        </motion.div>

        {/* Max Drawdown */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4 rounded-xl border border-border/50 bg-secondary/20 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10">
                <TrendingDown className="h-4 w-4 text-amber-500" />
              </div>
              <Label className="text-base font-medium">Max Drawdown</Label>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums",
                  settings.riskGuardrails.maxDrawdown <= 15
                    ? "bg-gain/10 text-gain"
                    : settings.riskGuardrails.maxDrawdown <= 30
                      ? "bg-primary/10 text-primary"
                      : "bg-loss/10 text-loss"
                )}
              >
                {settings.riskGuardrails.maxDrawdown}%
              </span>
            </div>
          </div>
          <Slider
            value={[settings.riskGuardrails.maxDrawdown]}
            onValueChange={([v]) => handleSliderChange("maxDrawdown", v)}
            min={5}
            max={50}
            step={5}
            className="py-2"
          />
          <p className="text-xs text-muted-foreground">
            Pause strategy if portfolio drawdown exceeds this threshold
          </p>
        </motion.div>

        {/* Max Daily Loss */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="space-y-4 rounded-xl border border-border/50 bg-secondary/20 p-4"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-loss/10">
                <AlertTriangle className="h-4 w-4 text-loss" />
              </div>
              <Label className="text-base font-medium">Max Daily Loss</Label>
            </div>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "rounded-lg px-3 py-1.5 text-sm font-semibold tabular-nums",
                  settings.riskGuardrails.maxDailyLoss <= 5
                    ? "bg-gain/10 text-gain"
                    : settings.riskGuardrails.maxDailyLoss <= 10
                      ? "bg-primary/10 text-primary"
                      : "bg-loss/10 text-loss"
                )}
              >
                {settings.riskGuardrails.maxDailyLoss}%
              </span>
            </div>
          </div>
          <Slider
            value={[settings.riskGuardrails.maxDailyLoss]}
            onValueChange={([v]) => handleSliderChange("maxDailyLoss", v)}
            min={1}
            max={20}
            step={1}
            className="py-2"
          />
          <p className="text-xs text-muted-foreground">
            Halt all trading for the day if losses exceed this amount
          </p>
        </motion.div>

        {/* Require Confirmation */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className={cn(
            "flex items-center justify-between rounded-xl border p-4 transition-all",
            settings.riskGuardrails.requireConfirmation
              ? "border-gain/30 bg-gain/5"
              : "border-border/50 bg-secondary/20"
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-xl transition-colors",
                settings.riskGuardrails.requireConfirmation
                  ? "bg-gain/10"
                  : "bg-secondary/50"
              )}
            >
              <Check
                className={cn(
                  "h-5 w-5 transition-colors",
                  settings.riskGuardrails.requireConfirmation
                    ? "text-gain"
                    : "text-muted-foreground"
                )}
              />
            </div>
            <div>
              <Label className="text-base font-medium">
                Require Confirmation
              </Label>
              <p className="text-sm text-muted-foreground">
                Require manual confirmation before executing large trades
              </p>
            </div>
          </div>
          <Switch
            checked={settings.riskGuardrails.requireConfirmation}
            onCheckedChange={(v) =>
              handleSwitchChange("requireConfirmation", v)
            }
          />
        </motion.div>
      </CardContent>
    </Card>
  );
}
