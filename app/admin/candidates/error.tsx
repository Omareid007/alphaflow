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
    console.error("Candidates page error:", error);
  }, [error]);

  return (
    <AdminError
      error={error}
      reset={reset}
      title="Candidates error"
      description="Failed to load candidates page. Please try again."
    />
  );
}
