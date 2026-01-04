import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../client";
import { toast } from "sonner";

/**
 * User preferences types (matching server schema)
 */
export type ThemeValue = "dark" | "light" | "system";
export type AnimationLevel = "full" | "reduced" | "none";
export type ChartStyle = "area" | "candle" | "line";

export interface UserPreferences {
  id: string;
  userId: string;
  theme: ThemeValue;
  accentColor: string;
  animationLevel: AnimationLevel;
  chartStyle: ChartStyle;
  extras: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UpdatePreferencesPayload {
  theme?: ThemeValue;
  accentColor?: string;
  animationLevel?: AnimationLevel;
  chartStyle?: ChartStyle;
  extras?: Record<string, unknown>;
}

/**
 * Default preferences for new users
 */
export const defaultPreferences: Omit<
  UserPreferences,
  "id" | "userId" | "createdAt" | "updatedAt"
> = {
  theme: "dark",
  accentColor: "#00C805",
  animationLevel: "full",
  chartStyle: "area",
  extras: {},
};

/**
 * Query keys for React Query caching
 */
export const userPreferencesKeys = {
  all: ["user-preferences"] as const,
  current: () => [...userPreferencesKeys.all, "current"] as const,
};

/**
 * Hook to fetch current user's preferences
 */
export function useUserPreferences() {
  return useQuery({
    queryKey: userPreferencesKeys.current(),
    queryFn: async (): Promise<UserPreferences> => {
      const response = (await api.get("/api/user/preferences")) as {
        data: UserPreferences;
      };
      return response.data;
    },
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
    retry: 1,
  });
}

/**
 * Hook to update user preferences
 */
export function useUpdatePreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      updates: UpdatePreferencesPayload
    ): Promise<UserPreferences> => {
      const response = (await api.put("/api/user/preferences", updates)) as {
        data: UserPreferences;
      };
      return response.data;
    },
    onMutate: async (updates) => {
      // Cancel outgoing fetches
      await queryClient.cancelQueries({
        queryKey: userPreferencesKeys.current(),
      });

      // Snapshot previous value
      const previousPrefs = queryClient.getQueryData<UserPreferences>(
        userPreferencesKeys.current()
      );

      // Optimistically update
      if (previousPrefs) {
        queryClient.setQueryData<UserPreferences>(
          userPreferencesKeys.current(),
          {
            ...previousPrefs,
            ...updates,
            updatedAt: new Date().toISOString(),
          }
        );
      }

      return { previousPrefs };
    },
    onError: (error, _updates, context) => {
      // Rollback on error
      if (context?.previousPrefs) {
        queryClient.setQueryData(
          userPreferencesKeys.current(),
          context.previousPrefs
        );
      }
      toast.error("Failed to save preferences");
      console.error("Preferences update error:", error);
    },
    onSuccess: (data) => {
      // Update cache with server response (no need to invalidate, we have fresh data)
      queryClient.setQueryData(userPreferencesKeys.current(), data);
      toast.success("Preferences saved");
    },
  });
}

/**
 * Hook to reset preferences to defaults
 */
export function useResetPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (): Promise<UserPreferences> => {
      const response = (await api.delete("/user/preferences")) as {
        data: UserPreferences;
      };
      return response.data;
    },
    onSuccess: (data) => {
      queryClient.setQueryData(userPreferencesKeys.current(), data);
      toast.success("Preferences reset to defaults");
    },
    onError: (error) => {
      toast.error("Failed to reset preferences");
      console.error("Preferences reset error:", error);
    },
  });
}

/**
 * Helper hook for theme preference with system detection
 */
export function useThemePreference() {
  const { data: preferences, isLoading } = useUserPreferences();
  const updatePreferences = useUpdatePreferences();

  const theme = preferences?.theme ?? "dark";

  const effectiveTheme = (() => {
    if (theme === "system") {
      if (typeof window !== "undefined") {
        return window.matchMedia("(prefers-color-scheme: dark)").matches
          ? "dark"
          : "light";
      }
      return "dark";
    }
    return theme;
  })();

  const setTheme = (newTheme: ThemeValue) => {
    updatePreferences.mutate({ theme: newTheme });
  };

  return {
    theme,
    effectiveTheme,
    setTheme,
    isLoading,
    isPending: updatePreferences.isPending,
  };
}

/**
 * Helper hook for animation preference with reduced motion detection
 */
export function useAnimationPreference() {
  const { data: preferences, isLoading } = useUserPreferences();
  const updatePreferences = useUpdatePreferences();

  const animationLevel = preferences?.animationLevel ?? "full";

  // Check for system reduced motion preference
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Effective animation level respects system preference
  const effectiveLevel =
    prefersReducedMotion && animationLevel === "full"
      ? "reduced"
      : animationLevel;

  const setAnimationLevel = (level: AnimationLevel) => {
    updatePreferences.mutate({ animationLevel: level });
  };

  return {
    animationLevel,
    effectiveLevel,
    setAnimationLevel,
    isLoading,
    isPending: updatePreferences.isPending,
    prefersReducedMotion,
    shouldAnimate: effectiveLevel !== "none",
    shouldReduceMotion: effectiveLevel !== "full",
  };
}

/**
 * Helper hook for accent color with validation
 */
export function useAccentColor() {
  const { data: preferences, isLoading } = useUserPreferences();
  const updatePreferences = useUpdatePreferences();

  const accentColor = preferences?.accentColor ?? "#00C805";

  const setAccentColor = (color: string) => {
    // Validate hex color
    if (/^#[0-9A-Fa-f]{6}$/.test(color)) {
      updatePreferences.mutate({ accentColor: color });
    } else {
      toast.error("Invalid color format. Use hex format (e.g., #00C805)");
    }
  };

  return {
    accentColor,
    setAccentColor,
    isLoading,
    isPending: updatePreferences.isPending,
  };
}

/**
 * Helper hook for chart style preference
 */
export function useChartStyle() {
  const { data: preferences, isLoading } = useUserPreferences();
  const updatePreferences = useUpdatePreferences();

  const chartStyle = preferences?.chartStyle ?? "area";

  const setChartStyle = (style: ChartStyle) => {
    updatePreferences.mutate({ chartStyle: style });
  };

  return {
    chartStyle,
    setChartStyle,
    isLoading,
    isPending: updatePreferences.isPending,
  };
}
