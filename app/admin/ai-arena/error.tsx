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
    console.error("AI Arena page error:", error);
  }, [error]);

  return (
    <AdminError
      error={error}
      reset={reset}
      title="AI Arena error"
      description="Failed to load AI Arena page. Please try again."
    />
  );
}
