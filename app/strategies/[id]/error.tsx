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
    console.error("Strategy details page error:", error);
  }, [error]);

  return (
    <DataLoadError
      error={error}
      reset={reset}
      title="Strategy error"
      description="Failed to load strategy details. Please try again."
    />
  );
}
