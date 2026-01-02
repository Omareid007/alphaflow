"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertTriangle, RefreshCw, ArrowLeft, Database, Wifi } from "lucide-react";
import Link from "next/link";

interface ErrorTemplateProps {
  error: Error & { digest?: string };
  reset: () => void;
  title?: string;
  description?: string;
  showHomeButton?: boolean;
}

/**
 * Generic error boundary component for most pages
 * Use this for general page errors where the cause is unclear
 */
export function GenericError({
  error,
  reset,
  title = "Something went wrong",
  description = "An unexpected error occurred. Please try again.",
  showHomeButton = true,
}: ErrorTemplateProps) {
  return (
    <div className="flex h-[50vh] items-center justify-center p-4">
      <Card className="max-w-md p-6">
        <div className="flex flex-col items-center space-y-4 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            {error.digest && (
              <p className="mt-2 text-xs text-muted-foreground">
                Error ID: {error.digest}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={reset} variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            {showHomeButton && (
              <Button asChild variant="outline">
                <Link href="/home">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Go Home
                </Link>
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * Error boundary for form submission errors
 * Use this for pages with forms (login, signup, strategy creation, etc.)
 */
export function FormError({
  error,
  reset,
  title = "Form submission failed",
  description = "There was a problem submitting your request. Please check your input and try again.",
  showHomeButton = false,
}: ErrorTemplateProps) {
  return (
    <div className="flex h-[50vh] items-center justify-center p-4">
      <Card className="max-w-md p-6">
        <div className="flex flex-col items-center space-y-4 text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500" />
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            {error.message && (
              <p className="mt-2 text-xs font-mono text-muted-foreground bg-muted p-2 rounded">
                {error.message}
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={reset} variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            {showHomeButton && (
              <Button asChild variant="outline">
                <Link href="/home">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Go Home
                </Link>
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * Error boundary for data loading failures
 * Use this for pages that primarily fetch and display data (portfolio, strategies, backtests, etc.)
 */
export function DataLoadError({
  error,
  reset,
  title = "Failed to load data",
  description = "We couldn't load the requested data. This might be due to a network issue or server problem.",
  showHomeButton = true,
}: ErrorTemplateProps) {
  const isNetworkError = error.message?.toLowerCase().includes('network') ||
                         error.message?.toLowerCase().includes('fetch');
  const isServerError = error.message?.toLowerCase().includes('500') ||
                        error.message?.toLowerCase().includes('server');

  return (
    <div className="flex h-[50vh] items-center justify-center p-4">
      <Card className="max-w-md p-6">
        <div className="flex flex-col items-center space-y-4 text-center">
          {isNetworkError ? (
            <Wifi className="h-12 w-12 text-destructive" />
          ) : isServerError ? (
            <Database className="h-12 w-12 text-destructive" />
          ) : (
            <AlertTriangle className="h-12 w-12 text-destructive" />
          )}
          <div>
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>
            {isNetworkError && (
              <p className="mt-2 text-xs text-muted-foreground">
                Please check your internet connection and try again.
              </p>
            )}
            {isServerError && (
              <p className="mt-2 text-xs text-muted-foreground">
                Our servers are experiencing issues. Please try again in a moment.
              </p>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={reset} variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Reload Data
            </Button>
            {showHomeButton && (
              <Button asChild variant="outline">
                <Link href="/home">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Go Home
                </Link>
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}

/**
 * Error boundary for admin pages with additional diagnostic info
 * Use this for admin-only pages where more technical details are helpful
 */
export function AdminError({
  error,
  reset,
  title = "Admin page error",
  description = "An error occurred while loading this admin page.",
  showHomeButton = true,
}: ErrorTemplateProps) {
  return (
    <div className="flex h-[50vh] items-center justify-center p-4">
      <Card className="max-w-2xl p-6">
        <div className="flex flex-col items-center space-y-4 text-center">
          <AlertTriangle className="h-12 w-12 text-destructive" />
          <div className="w-full">
            <h2 className="text-xl font-semibold">{title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{description}</p>

            {/* Technical details for admins */}
            <div className="mt-4 text-left">
              <details className="text-xs">
                <summary className="cursor-pointer font-semibold text-muted-foreground hover:text-foreground">
                  Technical Details
                </summary>
                <div className="mt-2 space-y-2">
                  {error.message && (
                    <div>
                      <span className="font-semibold">Message:</span>
                      <pre className="mt-1 bg-muted p-2 rounded overflow-x-auto">
                        {error.message}
                      </pre>
                    </div>
                  )}
                  {error.digest && (
                    <div>
                      <span className="font-semibold">Error ID:</span>
                      <pre className="mt-1 bg-muted p-2 rounded">
                        {error.digest}
                      </pre>
                    </div>
                  )}
                  {error.stack && (
                    <div>
                      <span className="font-semibold">Stack Trace:</span>
                      <pre className="mt-1 bg-muted p-2 rounded overflow-x-auto text-[10px]">
                        {error.stack}
                      </pre>
                    </div>
                  )}
                </div>
              </details>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={reset} variant="default">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
            {showHomeButton && (
              <Button asChild variant="outline">
                <Link href="/admin">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Admin Home
                </Link>
              </Button>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
