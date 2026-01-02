"use client";

import { useEffect } from "react";
import { AdminError } from "@/components/error/error-boundary-templates";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Enforcement page error:", error);
  }, [error]);

  return (
    <AdminError
      error={error}
      reset={reset}
      title="Enforcement error"
      description="Failed to load enforcement management page. Please try again."
    />
  );
}
