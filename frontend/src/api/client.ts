const API_BASE = '/api';

export class ApiError extends Error {
  statusCode: number;
  data: any;

  constructor(message: string, statusCode: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.data = data;
  }
}

function extractErrorMessage(data: any): string {
  if (!data) return 'An unexpected error occurred';
  if (typeof data === 'string') return data;
  if (typeof data.error === 'string') return data.error;
  if (typeof data.message === 'string') return data.message;
  if (data.error && typeof data.error === 'object') {
    const parts: string[] = [];
    if (Array.isArray(data.error._errors) && data.error._errors.length > 0) {
      parts.push(...data.error._errors);
    }
    for (const [key, val] of Object.entries(data.error)) {
      if (key !== '_errors' && val && typeof val === 'object') {
        const fieldObj = val as any;
        if (Array.isArray(fieldObj._errors) && fieldObj._errors.length > 0) {
          parts.push(`${key}: ${fieldObj._errors.join(', ')}`);
        }
      }
    }
    if (parts.length > 0) return parts.join(' | ');
    return JSON.stringify(data.error);
  }
  return typeof data === 'object' ? JSON.stringify(data) : String(data);
}

async function request<T = any>(
  endpoint: string,
  options: RequestInit & { params?: Record<string, any> } = {}
): Promise<T> {
  const token = localStorage.getItem('pos_token');

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  // Strip duplicate '/api' prefix if present so we never get '/api/api/...'
  let cleanEndpoint = endpoint.trim();
  if (cleanEndpoint.startsWith('/api/')) {
    cleanEndpoint = cleanEndpoint.substring(4);
  } else if (cleanEndpoint === '/api') {
    cleanEndpoint = '';
  }
  if (!cleanEndpoint.startsWith('/') && cleanEndpoint.length > 0) {
    cleanEndpoint = `/${cleanEndpoint}`;
  }

  // Handle query params object if provided
  if (options.params && typeof options.params === 'object') {
    const searchParams = new URLSearchParams();
    for (const [key, val] of Object.entries(options.params)) {
      if (val !== undefined && val !== null && val !== '') {
        searchParams.append(key, String(val));
      }
    }
    const q = searchParams.toString();
    if (q) {
      cleanEndpoint += (cleanEndpoint.includes('?') ? '&' : '?') + q;
    }
  }

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${cleanEndpoint}`, {
      ...options,
      headers,
    });
  } catch (err: any) {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('pos:connection-lost', { detail: { endpoint, error: err.message } }));
    }
    throw new ApiError(
      'Server Connection Lost: Could not communicate with central POS server. Please verify your internet connection.',
      0,
      { isNetworkError: true }
    );
  }

  const contentType = response.headers.get('content-type');
  let data: any;
  if (contentType && contentType.includes('application/json')) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    if (
      response.status === 401 &&
      !endpoint.includes('/auth/login') &&
      !endpoint.includes('/auth/platform/login') &&
      typeof window !== 'undefined'
    ) {
      window.dispatchEvent(new CustomEvent('pos:session-expired'));
    }
    const errorMsg = extractErrorMessage(data);
    throw new ApiError(errorMsg, response.status, data);
  }

  return data as T;
}

export const api = {
  get: <T = any>(endpoint: string, optionsOrHeaders?: any) => {
    if (optionsOrHeaders && (optionsOrHeaders.params || optionsOrHeaders.headers)) {
      return request<T>(endpoint, {
        method: 'GET',
        headers: optionsOrHeaders.headers,
        params: optionsOrHeaders.params,
      });
    }
    return request<T>(endpoint, { method: 'GET', headers: optionsOrHeaders });
  },

  post: <T = any>(endpoint: string, body?: any, headers?: Record<string, string>) =>
    request<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    }),

  put: <T = any>(endpoint: string, body?: any, headers?: Record<string, string>) =>
    request<T>(endpoint, {
      method: 'PUT',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    }),

  patch: <T = any>(endpoint: string, body?: any, headers?: Record<string, string>) =>
    request<T>(endpoint, {
      method: 'PATCH',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    }),

  delete: <T = any>(endpoint: string, body?: any, headers?: Record<string, string>) =>
    request<T>(endpoint, {
      method: 'DELETE',
      body: body ? JSON.stringify(body) : undefined,
      headers,
    }),
};
