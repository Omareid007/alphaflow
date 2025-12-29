"use client";

import { useSettings, useUpdateSettings } from "@/lib/api/hooks";
import { UserSettings } from "@/lib/types";
import { toast } from "sonner";
import { AppearanceCard } from "./AppearanceCard";
import { NotificationsCard } from "./NotificationsCard";
import { RiskGuardrailsCard } from "./RiskGuardrailsCard";
import { ConnectionsCard } from "./ConnectionsCard";

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
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage your account and preferences
        </p>
      </div>

      <AppearanceCard />

      <NotificationsCard
        settings={settings}
        onNotificationChange={handleNotificationChange}
      />

      <RiskGuardrailsCard
        settings={settings}
        onGuardrailChange={handleGuardrailChange}
      />

      <ConnectionsCard />
    </div>
  );
}
