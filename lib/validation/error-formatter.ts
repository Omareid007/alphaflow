/**
 * Form Error Formatting Utilities
 * Converts Zod validation errors to user-friendly messages
 */

import { ZodError, ZodIssue } from "zod";

export interface FormError {
  field: string;
  message: string;
  code: string;
}

export interface FormErrors {
  errors: FormError[];
  hasErrors: boolean;
  getError: (field: string) => string | undefined;
  getErrors: (field: string) => string[];
}

/**
 * Format a single Zod issue to user-friendly message
 */
function formatZodIssue(issue: ZodIssue): FormError {
  const field = issue.path.join(".");
  let message = issue.message;

  // Improve common error messages
  switch (issue.code) {
    case "invalid_type":
      if (issue.received === "undefined") {
        message = "This field is required";
      } else {
        message = `Expected ${issue.expected}, received ${issue.received}`;
      }
      break;
    case "too_small":
      if (issue.type === "string") {
        message = `Must be at least ${issue.minimum} characters`;
      } else if (issue.type === "number") {
        message = `Must be at least ${issue.minimum}`;
      } else if (issue.type === "array") {
        message = `Must have at least ${issue.minimum} items`;
      }
      break;
    case "too_big":
      if (issue.type === "string") {
        message = `Must be at most ${issue.maximum} characters`;
      } else if (issue.type === "number") {
        message = `Must be at most ${issue.maximum}`;
      } else if (issue.type === "array") {
        message = `Must have at most ${issue.maximum} items`;
      }
      break;
    case "invalid_string":
      if (issue.validation === "email") {
        message = "Please enter a valid email address";
      } else if (issue.validation === "url") {
        message = "Please enter a valid URL";
      } else if (issue.validation === "uuid") {
        message = "Invalid identifier format";
      }
      break;
    case "invalid_enum_value":
      message = `Must be one of: ${issue.options.join(", ")}`;
      break;
    case "custom":
      // Keep custom messages as-is
      break;
  }

  return {
    field,
    message,
    code: issue.code,
  };
}

/**
 * Format Zod errors to FormErrors object
 */
export function formatZodErrors(error: ZodError): FormErrors {
  const errors = error.issues.map(formatZodIssue);

  return {
    errors,
    hasErrors: errors.length > 0,
    getError: (field: string) => errors.find((e) => e.field === field)?.message,
    getErrors: (field: string) =>
      errors.filter((e) => e.field === field).map((e) => e.message),
  };
}

/**
 * Format API error response to FormErrors
 */
export function formatApiErrors(
  apiError: {
    error?: string;
    details?: Array<{ field?: string; message?: string }>;
  } | null
): FormErrors {
  if (!apiError) {
    return {
      errors: [],
      hasErrors: false,
      getError: () => undefined,
      getErrors: () => [],
    };
  }

  const errors: FormError[] = [];

  // Handle general error
  if (apiError.error && !apiError.details?.length) {
    errors.push({
      field: "_root",
      message: apiError.error,
      code: "api_error",
    });
  }

  // Handle field-specific errors
  if (apiError.details) {
    for (const detail of apiError.details) {
      errors.push({
        field: detail.field || "_root",
        message: detail.message || "Validation error",
        code: "validation_error",
      });
    }
  }

  return {
    errors,
    hasErrors: errors.length > 0,
    getError: (field: string) => errors.find((e) => e.field === field)?.message,
    getErrors: (field: string) =>
      errors.filter((e) => e.field === field).map((e) => e.message),
  };
}

/**
 * Get the first error message (useful for toast notifications)
 */
export function getFirstError(formErrors: FormErrors): string | undefined {
  return formErrors.errors[0]?.message;
}

/**
 * Get root-level error (not field-specific)
 */
export function getRootError(formErrors: FormErrors): string | undefined {
  return formErrors.getError("_root");
}

/**
 * Combine multiple FormErrors objects
 */
export function combineErrors(...errorSets: FormErrors[]): FormErrors {
  const allErrors = errorSets.flatMap((set) => set.errors);

  return {
    errors: allErrors,
    hasErrors: allErrors.length > 0,
    getError: (field: string) =>
      allErrors.find((e) => e.field === field)?.message,
    getErrors: (field: string) =>
      allErrors.filter((e) => e.field === field).map((e) => e.message),
  };
}
