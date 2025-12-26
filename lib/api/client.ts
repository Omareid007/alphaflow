// Determine API base URL
// In production/Replit: Use relative URLs (same origin) - Next.js rewrites handle proxying
// In development: Use localhost:5000 directly or rely on Next.js rewrites
const getApiBaseUrl = (): string => {
  // Check for explicit env var first
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL;
  }

  // For server-side rendering, we can't access window
  if (typeof window === 'undefined') {
    // During SSR, use empty string for relative URLs
    return '';
  }

  // For client-side, use same origin (Next.js rewrites handle /api/* -> backend)
  return window.location.origin;
};

const API_BASE_URL = getApiBaseUrl();

// Log the configuration on client-side only
if (typeof window !== 'undefined') {
  console.log('[API Client] Configuration:', {
    baseUrl: API_BASE_URL,
    origin: window.location.origin,
    env: process.env.NODE_ENV,
  });
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    message?: string
  ) {
    super(message || `API Error: ${status} ${statusText}`);
    this.name = 'ApiError';
  }
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | boolean | undefined>;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let errorText = '';
    let errorData: any = null;

    try {
      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        errorData = await response.json();
        errorText = errorData.message || errorData.error || JSON.stringify(errorData);
      } else {
        errorText = await response.text();
      }
    } catch (e) {
      errorText = response.statusText;
    }

    console.error('[API Client] Request failed:', {
      status: response.status,
      statusText: response.statusText,
      url: response.url,
      errorText,
      errorData,
    });

    throw new ApiError(response.status, response.statusText, errorText);
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }

  return response.text() as unknown as T;
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  // Ensure path starts with /
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;

  // Build full URL
  const baseUrl = API_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : '');
  const url = new URL(normalizedPath, baseUrl);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.append(key, String(value));
      }
    });
  }

  return url.toString();
}

export const api = {
  async get<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const url = buildUrl(path, params);

    console.log('[API Client] GET request:', { path, url, params });

    try {
      const response = await fetch(url, {
        method: 'GET',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
        ...fetchOptions,
      });

      console.log('[API Client] GET response:', {
        path,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      return handleResponse<T>(response);
    } catch (error) {
      console.error('[API Client] GET error:', { path, error });
      throw error;
    }
  },

  async post<T>(path: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const url = buildUrl(path, params);

    console.log('[API Client] POST request:', { path, url, params, data });

    try {
      const response = await fetch(url, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
        body: data ? JSON.stringify(data) : undefined,
        ...fetchOptions,
      });

      console.log('[API Client] POST response:', {
        path,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      return handleResponse<T>(response);
    } catch (error) {
      console.error('[API Client] POST error:', { path, error });
      throw error;
    }
  },

  async put<T>(path: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const url = buildUrl(path, params);

    console.log('[API Client] PUT request:', { path, url, params, data });

    try {
      const response = await fetch(url, {
        method: 'PUT',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
        body: data ? JSON.stringify(data) : undefined,
        ...fetchOptions,
      });

      console.log('[API Client] PUT response:', {
        path,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      return handleResponse<T>(response);
    } catch (error) {
      console.error('[API Client] PUT error:', { path, error });
      throw error;
    }
  },

  async delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const url = buildUrl(path, params);

    console.log('[API Client] DELETE request:', { path, url, params });

    try {
      const response = await fetch(url, {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
        ...fetchOptions,
      });

      console.log('[API Client] DELETE response:', {
        path,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      return handleResponse<T>(response);
    } catch (error) {
      console.error('[API Client] DELETE error:', { path, error });
      throw error;
    }
  },

  async patch<T>(path: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const url = buildUrl(path, params);

    console.log('[API Client] PATCH request:', { path, url, params, data });

    try {
      const response = await fetch(url, {
        method: 'PATCH',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...fetchOptions.headers,
        },
        body: data ? JSON.stringify(data) : undefined,
        ...fetchOptions,
      });

      console.log('[API Client] PATCH response:', {
        path,
        status: response.status,
        statusText: response.statusText,
        ok: response.ok
      });

      return handleResponse<T>(response);
    } catch (error) {
      console.error('[API Client] PATCH error:', { path, error });
      throw error;
    }
  },
};
