import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { UserSettings } from "@/lib/types";
import { toast } from "sonner";

// Default settings when API is unavailable
const defaultSettings: UserSettings = {
  theme: "dark",
  notifications: {
    trades: true,
    aiAlerts: true,
    riskWarnings: true,
    dailyDigest: false,
  },
  riskGuardrails: {
    maxPositionSize: 0.1,
    maxDrawdown: 0.2,
    maxDailyLoss: 0.05,
    requireConfirmation: true,
  },
};

export function useSettings() {
  return useQuery({
    queryKey: ["settings"],
    queryFn: async () => {
      try {
        return await api.get<UserSettings>("/api/settings");
      } catch {
        // Return default settings if endpoint unavailable
        return defaultSettings;
      }
    },
  });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: Partial<UserSettings>) => {
      return await api.put<UserSettings>("/api/settings", data);
    },

    onMutate: async (updates) => {
      // Cancel outgoing queries
      await queryClient.cancelQueries({ queryKey: ["settings"] });

      // Snapshot previous state
      const previousSettings = queryClient.getQueryData<UserSettings>([
        "settings",
      ]);

      // Optimistically update settings
      queryClient.setQueryData<UserSettings>(["settings"], (old) => ({
        ...(old ?? defaultSettings),
        ...updates,
      }));

      return { previousSettings };
    },

    onError: (err, updates, context) => {
      // Rollback on error
      if (context?.previousSettings) {
        queryClient.setQueryData(["settings"], context.previousSettings);
      }
      toast.error("Failed to update settings");
      console.error("Failed to update settings:", err);
    },

    onSuccess: () => {
      // Only invalidate settings (not user preferences or other queries)
      queryClient.invalidateQueries({ queryKey: ["settings"], exact: true });
      toast.success("Settings updated successfully");
    },
  });
}
