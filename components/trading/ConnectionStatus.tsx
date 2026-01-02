"use client";

import { cn } from "@/lib/utils";
import { Wifi, WifiOff, Loader2 } from "lucide-react";
import {
  useRealTimeTrading,
  type ConnectionStatus as ConnectionStatusType,
} from "@/lib/hooks/useRealTimeTrading";

interface ConnectionStatusProps {
  // Simple mode: pass status directly
  status?: ConnectionStatusType;
  isConnected?: boolean;
  // Auto mode: use built-in hook with userId
  userId?: string;
  // Display options
  className?: string;
  showLabel?: boolean;
  compact?: boolean;
  showStats?: boolean;
}

const statusConfig = {
  connected: {
    icon: Wifi,
    color: "text-green-500",
    bgColor: "bg-green-500",
    label: "Live",
  },
  connecting: {
    icon: Loader2,
    color: "text-yellow-500",
    bgColor: "bg-yellow-500",
    label: "Connecting...",
  },
  disconnected: {
    icon: WifiOff,
    color: "text-muted-foreground",
    bgColor: "bg-muted-foreground",
    label: "Offline",
  },
  error: {
    icon: WifiOff,
    color: "text-red-500",
    bgColor: "bg-red-500",
    label: "Error",
  },
};

export function ConnectionStatus({
  status: providedStatus,
  isConnected: providedIsConnected,
  userId,
  className,
  showLabel = true,
  compact = false,
  showStats = false,
}: ConnectionStatusProps) {
  // If userId is provided, use the hook internally
  const hookResult = useRealTimeTrading({
    enabled: !!userId,
    userId,
  });

  // Use provided values or fall back to hook values
  const status = providedStatus ?? hookResult.status;
  const isConnected = providedIsConnected ?? hookResult.isConnected;

  const config = statusConfig[status] || statusConfig.disconnected;
  const Icon = config.icon;

  if (compact) {
    return (
      <div className={cn("flex items-center gap-1", className)}>
        <div
          className={cn(
            "h-2 w-2 rounded-full",
            config.bgColor,
            isConnected && "animate-pulse"
          )}
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="relative flex items-center gap-1.5">
        <div
          className={cn(
            "h-2 w-2 rounded-full transition-colors duration-300",
            config.bgColor,
            isConnected && "animate-pulse"
          )}
        />
        {status === "connecting" && (
          <Icon className="h-3 w-3 animate-spin text-yellow-500" />
        )}
        {showLabel && (
          <span className={cn("text-xs font-medium", config.color)}>
            {config.label}
          </span>
        )}
      </div>
      {showStats && isConnected && (
        <span className="text-xs text-muted-foreground">Real-time updates</span>
      )}
    </div>
  );
}
