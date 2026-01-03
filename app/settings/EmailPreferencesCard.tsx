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
import { Button } from "@/components/ui/button";
import { FloatingInput } from "@/components/ui/input";
import {
  Mail,
  Bell,
  TrendingDown,
  AlertOctagon,
  Calendar,
  FileText,
  Loader2,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import {
  useNotificationPreferences,
  useUpdateNotificationPreferences,
  useUpdateEmail,
} from "@/lib/api/hooks/useNotificationPreferences";
import { useAuth } from "@/components/providers/auth-provider";

interface PreferenceItemProps {
  icon: React.ElementType;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  delay?: number;
  iconColor: string;
  iconBg: string;
}

function PreferenceItem({
  icon: Icon,
  label,
  description,
  checked,
  onCheckedChange,
  delay = 0,
  iconColor,
  iconBg,
}: PreferenceItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className={cn(
        "flex items-center justify-between rounded-xl border p-4 transition-all",
        checked ? "border-primary/30 bg-primary/5" : "border-border/50 bg-secondary/20"
      )}
    >
      <div className="flex items-center gap-3 flex-1">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg transition-colors",
            checked ? iconBg : "bg-secondary/50"
          )}
        >
          <Icon
            className={cn(
              "h-4 w-4 transition-colors",
              checked ? iconColor : "text-muted-foreground"
            )}
          />
        </div>
        <div className="flex-1 min-w-0">
          <Label className="text-base font-medium cursor-pointer">
            {label}
          </Label>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </motion.div>
  );
}

export function EmailPreferencesCard() {
  const { user } = useAuth();
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePreferences = useUpdateNotificationPreferences();
  const updateEmailMutation = useUpdateEmail();

  const [email, setEmail] = useState(user?.email || "");
  const [emailChanged, setEmailChanged] = useState(false);

  useEffect(() => {
    if (user?.email) {
      setEmail(user.email);
    }
  }, [user?.email]);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setEmailChanged(value !== (user?.email || ""));
  };

  const handleSaveEmail = async () => {
    if (email && email !== user?.email) {
      await updateEmailMutation.mutateAsync(email);
      setEmailChanged(false);
    }
  };

  const handleToggle = async (
    key:
      | "emailOrderFills"
      | "emailLargeLosses"
      | "emailCircuitBreaker"
      | "emailDailySummary"
      | "emailWeeklyReport",
    value: boolean
  ) => {
    if (!preferences) return;
    await updatePreferences.mutateAsync({ [key]: value });
  };

  if (isLoading || !preferences) {
    return (
      <Card variant="glass">
        <CardContent className="flex h-48 items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading preferences...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const isSaving = updatePreferences.isPending || updateEmailMutation.isPending;

  return (
    <Card variant="glass">
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
            <Mail className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">Email Notifications</CardTitle>
            <CardDescription>
              Choose which trading events trigger email alerts
            </CardDescription>
          </div>
          <AnimatePresence mode="wait">
            {isSaving && (
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
          </AnimatePresence>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email Address */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-3"
        >
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Email Address</Label>
            {emailChanged && (
              <Button
                size="sm"
                onClick={handleSaveEmail}
                disabled={!email || updateEmailMutation.isPending}
                className="h-8"
              >
                {updateEmailMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-3 w-3" />
                    Save Email
                  </>
                )}
              </Button>
            )}
          </div>
          <FloatingInput
            type="email"
            label="Email address"
            value={email}
            onChange={(e) => handleEmailChange(e.target.value)}
            placeholder="your.email@example.com"
            variant="glow"
            disabled={updateEmailMutation.isPending}
          />
          <p className="text-xs text-muted-foreground">
            Notifications will be sent to this email address
          </p>
        </motion.div>

        {/* Divider */}
        <div className="h-px bg-border/50" />

        {/* Trading Events */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Trading Events</h3>
          </div>

          <PreferenceItem
            icon={Check}
            label="Order Fills"
            description="Get notified when your orders are executed"
            checked={preferences.emailOrderFills}
            onCheckedChange={(v) => handleToggle("emailOrderFills", v)}
            delay={0.05}
            iconColor="text-gain"
            iconBg="bg-gain/10"
          />

          <PreferenceItem
            icon={TrendingDown}
            label="Large Losses"
            description="Alert me when a position loses significant value"
            checked={preferences.emailLargeLosses}
            onCheckedChange={(v) => handleToggle("emailLargeLosses", v)}
            delay={0.1}
            iconColor="text-loss"
            iconBg="bg-loss/10"
          />

          <PreferenceItem
            icon={AlertOctagon}
            label="Circuit Breaker"
            description="Notify when trading is paused due to risk limits"
            checked={preferences.emailCircuitBreaker}
            onCheckedChange={(v) => handleToggle("emailCircuitBreaker", v)}
            delay={0.15}
            iconColor="text-amber-500"
            iconBg="bg-amber-500/10"
          />
        </div>

        {/* Divider */}
        <div className="h-px bg-border/50" />

        {/* Reports & Summaries */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold">Reports & Summaries</h3>
          </div>

          <PreferenceItem
            icon={Calendar}
            label="Daily Summary"
            description="Receive a daily recap of your trading activity"
            checked={preferences.emailDailySummary}
            onCheckedChange={(v) => handleToggle("emailDailySummary", v)}
            delay={0.2}
            iconColor="text-blue-500"
            iconBg="bg-blue-500/10"
          />

          <PreferenceItem
            icon={FileText}
            label="Weekly Report"
            description="Get a comprehensive weekly performance report"
            checked={preferences.emailWeeklyReport}
            onCheckedChange={(v) => handleToggle("emailWeeklyReport", v)}
            delay={0.25}
            iconColor="text-primary"
            iconBg="bg-primary/10"
          />
        </div>
      </CardContent>
    </Card>
  );
}
