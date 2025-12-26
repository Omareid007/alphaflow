const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '';

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
    const errorText = await response.text().catch(() => '');
    throw new ApiError(response.status, response.statusText, errorText);
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json();
  }

  return response.text() as unknown as T;
}

function buildUrl(path: string, params?: Record<string, string | number | boolean | undefined>): string {
  const url = new URL(path, API_BASE_URL || window.location.origin);

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
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

    const response = await fetch(url, {
      method: 'GET',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
      ...fetchOptions,
    });

    return handleResponse<T>(response);
  },

  async post<T>(path: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const url = buildUrl(path, params);

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

    return handleResponse<T>(response);
  },

  async put<T>(path: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const url = buildUrl(path, params);

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

    return handleResponse<T>(response);
  },

  async delete<T>(path: string, options: RequestOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const url = buildUrl(path, params);

    const response = await fetch(url, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        ...fetchOptions.headers,
      },
      ...fetchOptions,
    });

    return handleResponse<T>(response);
  },

  async patch<T>(path: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
    const { params, ...fetchOptions } = options;
    const url = buildUrl(path, params);

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

    return handleResponse<T>(response);
  },
};
