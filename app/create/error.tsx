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
    console.error("Strategy creation page error:", error);
  }, [error]);

  return (
    <FormError
      error={error}
      reset={reset}
      title="Strategy creation error"
      description="Failed to load the strategy creation wizard. Please try again."
    />
  );
}
