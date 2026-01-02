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
    console.error("LLM Router page error:", error);
  }, [error]);

  return (
    <AdminError
      error={error}
      reset={reset}
      title="LLM router error"
      description="Failed to load LLM router configuration page. Please try again."
    />
  );
}
