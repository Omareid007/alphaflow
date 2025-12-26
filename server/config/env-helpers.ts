/**
 * Environment Variable Helpers
 *
 * Centralized helper functions for reading environment variables
 * with type safety and default values.
 */

/**
 * Get a required string environment variable.
 * Throws an error if the variable is not set and no default is provided.
 */
export function getEnvString(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined || value === "") {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

/**
 * Get an optional string environment variable.
 * Returns undefined if not set (unless default is provided).
 */
export function getEnvStringOptional(
  key: string,
  defaultValue?: string
): string | undefined {
  return process.env[key] || defaultValue;
}

/**
 * Get an integer environment variable.
 * Throws an error if the value cannot be parsed as an integer.
 */
export function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined || value === "") {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const parsed = parseInt(value, 10);
  if (isNaN(parsed)) {
    throw new Error(
      `Environment variable ${key} must be an integer, got: ${value}`
    );
  }
  return parsed;
}

/**
 * Get a float environment variable.
 * Throws an error if the value cannot be parsed as a float.
 */
export function getEnvFloat(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined || value === "") {
    if (defaultValue !== undefined) return defaultValue;
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const parsed = parseFloat(value);
  if (isNaN(parsed)) {
    throw new Error(
      `Environment variable ${key} must be a number, got: ${value}`
    );
  }
  return parsed;
}

/**
 * Get a boolean environment variable.
 * Accepts 'true', '1', 'yes' (case-insensitive) as truthy.
 * All other values are considered falsy.
 */
export function getEnvBool(key: string, defaultValue: boolean = false): boolean {
  const value = process.env[key];
  if (value === undefined || value === "") return defaultValue;
  const lower = value.toLowerCase();
  return lower === "true" || lower === "1" || lower === "yes";
}

/**
 * Check if an environment variable is set (non-empty).
 */
export function hasEnv(key: string): boolean {
  const value = process.env[key];
  return value !== undefined && value !== "";
}
