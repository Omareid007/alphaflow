"use client";

import { useSettings, useUpdateSettings } from "@/lib/api/hooks";
import { UserSettings } from "@/lib/types";
import { toast } from "sonner";
import { AppearanceCard } from "./AppearanceCard";
import { NotificationsCard } from "./NotificationsCard";
import { RiskGuardrailsCard } from "./RiskGuardrailsCard";
import { ConnectionsCard } from "./ConnectionsCard";
import {
  PageTransition,
  SectionTransition,
} from "@/lib/animations/page-transitions";
import { Settings, Loader2 } from "lucide-react";

export default function SettingsPage() {
  const { data: settings, isLoading: loading } = useSettings();
  const updateSettings = useUpdateSettings();

  const handleNotificationChange = async (
    key: keyof UserSettings["notifications"],
    value: boolean
  ) => {
    if (!settings) return;
    const updated = {
      ...settings,
      notifications: { ...settings.notifications, [key]: value },
    };
    try {
      await updateSettings.mutateAsync(updated);
      toast.success("Settings saved");
    } catch (error) {
      toast.error("Failed to save settings");
    }
  };

  const handleGuardrailChange = async (
    key: keyof UserSettings["riskGuardrails"],
    value: number | boolean
  ) => {
    if (!settings) return;
    const updated = {
      ...settings,
      riskGuardrails: { ...settings.riskGuardrails, [key]: value },
    };
    try {
      await updateSettings.mutateAsync(updated);
      toast.success("Settings saved");
    } catch (error) {
      toast.error("Failed to save settings");
    }
  };

  if (loading || !settings) {
    return (
      <PageTransition>
        <div className="flex h-96 flex-col items-center justify-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
          <p className="text-sm text-muted-foreground">Loading settings...</p>
        </div>
      </PageTransition>
    );
  }

  return (
    <PageTransition>
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Header */}
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
            <Settings className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
            <p className="mt-1 text-muted-foreground">
              Manage your account and preferences
            </p>
          </div>
        </div>

        {/* Appearance Card (enhanced with theme preview) */}
        <SectionTransition delay={0.1}>
          <AppearanceCard />
        </SectionTransition>

        {/* Notifications Card */}
        <SectionTransition delay={0.2}>
          <NotificationsCard
            settings={settings}
            onNotificationChange={handleNotificationChange}
          />
        </SectionTransition>

        {/* Risk Guardrails Card */}
        <SectionTransition delay={0.3}>
          <RiskGuardrailsCard
            settings={settings}
            onGuardrailChange={handleGuardrailChange}
          />
        </SectionTransition>

        {/* Connections Card */}
        <SectionTransition delay={0.4}>
          <ConnectionsCard />
        </SectionTransition>
      </div>
    </PageTransition>
  );
}
