import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { UserSettings } from "@/lib/types";

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
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });
}
