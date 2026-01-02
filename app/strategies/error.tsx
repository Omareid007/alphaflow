"use client";

import { useEffect } from "react";
import { DataLoadError } from "@/components/error/error-boundary-templates";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Strategies page error:", error);
  }, [error]);

  return (
    <DataLoadError
      error={error}
      reset={reset}
      title="Strategies error"
      description="Failed to load strategies. Please try again."
    />
  );
}
