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
    console.error("Observability page error:", error);
  }, [error]);

  return (
    <AdminError
      error={error}
      reset={reset}
      title="Observability error"
      description="Failed to load observability dashboard. Please try again."
    />
  );
}
