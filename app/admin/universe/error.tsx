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
    console.error("Universe management page error:", error);
  }, [error]);

  return (
    <AdminError
      error={error}
      reset={reset}
      title="Universe error"
      description="Failed to load universe management page. Please try again."
    />
  );
}
