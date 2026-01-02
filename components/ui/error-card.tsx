"use client";

import { AlertCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ErrorCardProps {
  title?: string;
  message?: string;
  error?: Error | string | null;
  details?: string;
  onRetry?: () => void;
  retryLabel?: string;
  className?: string;
}

export function ErrorCard({
  title = "Something went wrong",
  message,
  error,
  details,
  onRetry,
  retryLabel = "Try again",
  className,
}: ErrorCardProps) {
  const errorMessage =
    message ||
    (error instanceof Error
      ? error.message
      : String(error || "An unexpected error occurred"));

  return (
    <Card className={cn("border-destructive/50", className)}>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-destructive">
          <AlertCircle className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{errorMessage}</p>
        {details && (
          <p className="text-xs text-muted-foreground/70 font-mono">
            {details}
          </p>
        )}
        {onRetry && (
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            {retryLabel}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
