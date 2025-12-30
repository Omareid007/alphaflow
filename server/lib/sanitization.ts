import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitizes a single string input by stripping all HTML tags and attributes.
 * This prevents XSS attacks by removing any potentially malicious script tags or event handlers.
 *
 * @param input - The string to sanitize
 * @returns Sanitized string with all HTML tags removed
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== "string") {
    return input;
  }

  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [], // Strip ALL HTML tags
    ALLOWED_ATTR: [], // Strip ALL attributes
    KEEP_CONTENT: true, // Keep text content, just remove tags
  });
}

/**
 * Sanitizes all string values in an object recursively.
 * Useful for sanitizing request bodies with multiple fields.
 *
 * @param obj - The object to sanitize
 * @returns New object with all string values sanitized
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  if (!obj || typeof obj !== "object") {
    return obj;
  }

  const sanitized = { ...obj } as Record<string, unknown>;
  for (const key in sanitized) {
    if (Object.prototype.hasOwnProperty.call(sanitized, key)) {
      const value = sanitized[key];

      if (typeof value === "string") {
        sanitized[key] = sanitizeInput(value);
      } else if (Array.isArray(value)) {
        sanitized[key] = value.map((item: unknown) =>
          typeof item === "string"
            ? sanitizeInput(item)
            : typeof item === "object" && item !== null
              ? sanitizeObject(item as Record<string, unknown>)
              : item
        );
      } else if (value && typeof value === "object") {
        sanitized[key] = sanitizeObject(value as Record<string, unknown>);
      }
    }
  }
  return sanitized as T;
}

/**
 * Sanitizes an array of strings.
 *
 * @param arr - The array of strings to sanitize
 * @returns New array with all strings sanitized
 */
export function sanitizeArray(arr: string[]): string[] {
  if (!Array.isArray(arr)) {
    return arr;
  }
  return arr.map((item) =>
    typeof item === "string" ? sanitizeInput(item) : item
  );
}

/**
 * Sanitizes specific fields in a user input object.
 * This is specifically designed for user registration/profile data.
 *
 * @param user - User object with username, email, etc.
 * @returns Sanitized user object
 */
export function sanitizeUserInput(user: {
  username?: string;
  email?: string | null;
  displayName?: string;
  bio?: string;
  [key: string]: unknown;
}): typeof user {
  const sanitized = { ...user };

  if (sanitized.username) {
    sanitized.username = sanitizeInput(sanitized.username);
  }
  if (sanitized.email) {
    sanitized.email = sanitizeInput(sanitized.email);
  }
  if (sanitized.displayName) {
    sanitized.displayName = sanitizeInput(sanitized.displayName);
  }
  if (sanitized.bio) {
    sanitized.bio = sanitizeInput(sanitized.bio);
  }

  return sanitized;
}

/**
 * Sanitizes strategy-related input fields.
 *
 * @param strategy - Strategy object with name, description, etc.
 * @returns Sanitized strategy object
 */
export function sanitizeStrategyInput(strategy: {
  name?: string;
  description?: string | null;
  notes?: string | null;
  [key: string]: unknown;
}): typeof strategy {
  const sanitized = { ...strategy };

  if (sanitized.name) {
    sanitized.name = sanitizeInput(sanitized.name);
  }
  if (sanitized.description) {
    sanitized.description = sanitizeInput(sanitized.description);
  }
  if (sanitized.notes) {
    sanitized.notes = sanitizeInput(sanitized.notes);
  }

  return sanitized;
}

/**
 * Sanitizes backtest-related input fields.
 *
 * @param backtest - Backtest object with notes, description, etc.
 * @returns Sanitized backtest object
 */
export function sanitizeBacktestInput(backtest: {
  notes?: string;
  description?: string;
  name?: string;
  [key: string]: unknown;
}): typeof backtest {
  const sanitized = { ...backtest };

  if (sanitized.notes) {
    sanitized.notes = sanitizeInput(sanitized.notes);
  }
  if (sanitized.description) {
    sanitized.description = sanitizeInput(sanitized.description);
  }
  if (sanitized.name) {
    sanitized.name = sanitizeInput(sanitized.name);
  }

  return sanitized;
}
