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
    console.error("Admin page error:", error);
  }, [error]);

  return (
    <AdminError
      error={error}
      reset={reset}
      title="Admin dashboard error"
      description="Failed to load the admin dashboard. Please try again."
      showHomeButton={false}
    />
  );
}
