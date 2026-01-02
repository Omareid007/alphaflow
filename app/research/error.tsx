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
    console.error("Research page error:", error);
  }, [error]);

  return (
    <DataLoadError
      error={error}
      reset={reset}
      title="Research error"
      description="Failed to load research and market data. Please try again."
    />
  );
}
