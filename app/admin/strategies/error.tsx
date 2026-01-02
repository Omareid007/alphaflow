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
    console.error("Admin strategies page error:", error);
  }, [error]);

  return (
    <AdminError
      error={error}
      reset={reset}
      title="Strategy management error"
      description="Failed to load strategy management page. Please try again."
    />
  );
}
