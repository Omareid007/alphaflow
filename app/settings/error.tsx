"use client";

import { useEffect } from "react";
import { FormError } from "@/components/error/error-boundary-templates";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Settings page error:", error);
  }, [error]);

  return (
    <FormError
      error={error}
      reset={reset}
      title="Settings error"
      description="Failed to load settings. Please try again."
    />
  );
}
