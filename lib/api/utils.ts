/**
 * API Response Unwrapping Utilities
 * Provides defensive helpers for handling inconsistent API responses
 */

/**
 * Safely unwrap an API response that may be:
 * - A raw array
 * - An object with a data property containing an array
 * - An object with a named property containing an array
 */
export function unwrapArrayResponse<T>(
  response: unknown,
  possibleKeys: string[] = ['data', 'items', 'results', 'runs', 'trades', 'orders', 'positions', 'decisions']
): T[] {
  // Already an array
  if (Array.isArray(response)) {
    return response as T[];
  }

  // Object with array property
  if (response && typeof response === 'object') {
    for (const key of possibleKeys) {
      const value = (response as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        return value as T[];
      }
    }
  }

  // Fallback: warn and return empty array
  console.warn('[unwrapArrayResponse] Could not unwrap response:', response);
  return [];
}

/**
 * Type guard for checking if response has expected array property
 */
export function hasArrayProperty<T, K extends string>(
  response: unknown,
  key: K
): response is Record<K, T[]> {
  return (
    response !== null &&
    typeof response === 'object' &&
    key in response &&
    Array.isArray((response as Record<K, unknown>)[key])
  );
}

/**
 * Extract pagination metadata from response
 */
export interface PaginationMeta {
  total?: number;
  limit?: number;
  offset?: number;
  hasMore?: boolean;
}

export function extractPagination(response: unknown): PaginationMeta | null {
  if (!response || typeof response !== 'object') {
    return null;
  }

  const r = response as Record<string, unknown>;

  // Check for pagination object
  if (r.pagination && typeof r.pagination === 'object') {
    return r.pagination as PaginationMeta;
  }

  // Check for inline pagination fields
  if ('limit' in r || 'offset' in r || 'total' in r) {
    return {
      total: typeof r.total === 'number' ? r.total : undefined,
      limit: typeof r.limit === 'number' ? r.limit : undefined,
      offset: typeof r.offset === 'number' ? r.offset : undefined,
      hasMore: typeof r.hasMore === 'boolean' ? r.hasMore : undefined,
    };
  }

  return null;
}
