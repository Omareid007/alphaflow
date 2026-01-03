import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  SelectNotificationPreferences,
  UpdateNotificationPreferences,
} from "@shared/schema";
import { toast } from "sonner";

const API_BASE = "/api/notifications/preferences";

/**
 * Hook to fetch notification preferences
 */
export function useNotificationPreferences() {
  return useQuery<SelectNotificationPreferences>({
    queryKey: ["notificationPreferences"],
    queryFn: async () => {
      const res = await fetch(API_BASE, {
        credentials: "include",
      });
      if (!res.ok) {
        throw new Error("Failed to fetch notification preferences");
      }
      return res.json();
    },
  });
}

/**
 * Hook to update notification preferences
 */
export function useUpdateNotificationPreferences() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (updates: UpdateNotificationPreferences) => {
      const res = await fetch(API_BASE, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(updates),
      });

      if (!res.ok) {
        throw new Error("Failed to update notification preferences");
      }

      return res.json();
    },
    onMutate: async (updates) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: ["notificationPreferences"] });

      // Snapshot previous value
      const previous = queryClient.getQueryData<SelectNotificationPreferences>([
        "notificationPreferences",
      ]);

      // Optimistically update
      if (previous) {
        queryClient.setQueryData<SelectNotificationPreferences>(
          ["notificationPreferences"],
          { ...previous, ...updates, updatedAt: new Date() }
        );
      }

      return { previous };
    },
    onError: (error, _variables, context) => {
      // Rollback on error
      if (context?.previous) {
        queryClient.setQueryData(
          ["notificationPreferences"],
          context.previous
        );
      }
      toast.error("Failed to save notification preferences");
    },
    onSuccess: () => {
      toast.success("Notification preferences saved");
    },
    onSettled: () => {
      // Refetch to ensure consistency
      queryClient.invalidateQueries({ queryKey: ["notificationPreferences"] });
    },
  });
}

/**
 * Hook to update user email
 */
export function useUpdateEmail() {
  return useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch("/api/auth/update-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update email");
      }

      return res.json();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
    onSuccess: () => {
      toast.success("Email updated successfully");
    },
  });
}
