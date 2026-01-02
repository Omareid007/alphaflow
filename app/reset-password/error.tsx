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
    console.error("Reset password page error:", error);
  }, [error]);

  return (
    <FormError
      error={error}
      reset={reset}
      title="Page error"
      description="Unable to load the password reset page. Please try again."
      showHomeButton={false}
    />
  );
}
