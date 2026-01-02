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
    console.error("Login page error:", error);
  }, [error]);

  return (
    <FormError
      error={error}
      reset={reset}
      title="Login error"
      description="Unable to load the login page. Please try again."
      showHomeButton={false}
    />
  );
}
