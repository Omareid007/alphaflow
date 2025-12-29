"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorStateProps {
  title?: string;
  message?: string;
  error?: Error | unknown;
  onRetry?: () => void;
  showRetry?: boolean;
}

export function ErrorState({
  title = "Something went wrong",
  message,
  error,
  onRetry,
  showRetry = true,
}: ErrorStateProps) {
  // Parse error message
  const errorMessage =
    message || (error instanceof Error ? error.message : String(error));

  // Check if it's an auth error
  const isAuthError =
    errorMessage?.toLowerCase().includes("401") ||
    errorMessage?.toLowerCase().includes("unauthorized") ||
    errorMessage?.toLowerCase().includes("not authenticated");

  const finalTitle = isAuthError ? "Authentication Required" : title;
  const finalMessage = isAuthError
    ? "Please log in to view this content. You may need to configure your authentication settings."
    : errorMessage || "An unexpected error occurred. Please try again.";

  return (
    <Card className="border-destructive/50">
      <CardContent className="flex flex-col items-center justify-center py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <AlertTriangle className="h-8 w-8 text-destructive" />
        </div>
        <h3 className="mt-4 text-lg font-semibold">{finalTitle}</h3>
        <p className="mt-2 max-w-md text-sm text-muted-foreground">
          {finalMessage}
        </p>
        {showRetry && onRetry && !isAuthError && (
          <Button onClick={onRetry} variant="outline" className="mt-6 gap-2">
            <RefreshCw className="h-4 w-4" />
            Try Again
          </Button>
        )}
        {isAuthError && (
          <div className="mt-6 rounded-lg bg-muted p-4 text-left text-sm">
            <p className="font-medium">Troubleshooting steps:</p>
            <ul className="mt-2 list-inside list-disc space-y-1 text-muted-foreground">
              <li>Check if the backend server is running</li>
              <li>Verify your API credentials are configured</li>
              <li>Check your authentication settings</li>
              <li>Contact support if the issue persists</li>
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface InlineErrorProps {
  message?: string;
  error?: Error | unknown;
  className?: string;
}

export function InlineError({ message, error, className }: InlineErrorProps) {
  const errorMessage =
    message || (error instanceof Error ? error.message : String(error));

  return (
    <div
      className={`flex items-center gap-2 rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm ${className}`}
    >
      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
      <p className="text-destructive">{errorMessage}</p>
    </div>
  );
}
