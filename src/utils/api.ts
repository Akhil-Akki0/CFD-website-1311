/**
 * Enterprise Production Hardened API Client
 * 
 * DEVELOPED by Akhil.A gmail :- akkedu01@gmail.com
 * 
 * Features:
 * - Credentials: 'include' for HttpOnly refresh tokens
 * - Automatic X-CSRF-Token header injection from double-submit cookie
 * - In-Memory Bearer Token injection (Zero localStorage tokens)
 * - Automatic 401 retry via Silent Token Refresh
 * - Correlation ID tracking
 * - Safe client-side error normalization
 */

let inMemoryAccessToken: string | null = null;
let inMemoryCsrfToken: string | null = null;
let refreshPromise: Promise<string | null> | null = null;

type CachedResponse = {
  expiresAt: number;
  value: unknown;
};

const responseCache = new Map<string, CachedResponse>();

const viteEnv = (import.meta as ImportMeta & { env?: Record<string, string | undefined> }).env;
const API_BASE_URL = (viteEnv?.VITE_API_BASE_URL || '').replace(/\/$/, '');

function resolveApiUrl(endpoint: string) {
  if (!API_BASE_URL || /^https?:\/\//i.test(endpoint)) return endpoint;
  return `${API_BASE_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
}

export function setAccessToken(token: string | null) {
  inMemoryAccessToken = token;
}

export function getAccessToken(): string | null {
  return inMemoryAccessToken;
}

export function setCsrfToken(token: string | null) {
  inMemoryCsrfToken = token;
}

export function getCsrfToken(): string | null {
  if (inMemoryCsrfToken) return inMemoryCsrfToken;

  if (typeof document !== 'undefined') {
    const match = document.cookie.match(/(^|;\s*)cfd_csrf_token=([^;]+)/);
    if (match) {
      return decodeURIComponent(match[2]);
    }
  }
  return null;
}

export interface ApiRequestOptions extends RequestInit {
  skipAuth?: boolean;
  skipCsrf?: boolean;
  /** Cache this read-only request in memory for the given number of milliseconds. */
  cacheTtlMs?: number;
  /** Optional stable cache key when the endpoint contains equivalent query variants. */
  cacheKey?: string;
}

export async function apiClient<T = any>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
  const { skipAuth, skipCsrf, cacheTtlMs = 0, cacheKey, ...requestOptions } = options;
  const correlationId = crypto.randomUUID ? crypto.randomUUID() : `cid_${Date.now()}`;
  const requestUrl = resolveApiUrl(endpoint);
  const headers = new Headers(requestOptions.headers || {});
  const method = (requestOptions.method || 'GET').toUpperCase();
  const shouldCache = method === 'GET' && cacheTtlMs > 0;
  const resolvedCacheKey = cacheKey || `${method}:${endpoint}:${inMemoryAccessToken || 'anonymous'}`;

  if (shouldCache) {
    const cached = responseCache.get(resolvedCacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.value as T;
    }
    if (cached) responseCache.delete(resolvedCacheKey);
  }

  // 1. Content-Type default
  if (!headers.has('Content-Type') && requestOptions.body && typeof requestOptions.body === 'string') {
    headers.set('Content-Type', 'application/json');
  }

  // 2. Attach Correlation ID for end-to-end tracing
  headers.set('X-Correlation-ID', correlationId);

  // 3. Attach In-Memory Bearer Token
  if (!skipAuth && inMemoryAccessToken) {
    headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
  }

  // 4. Attach CSRF Token for mutation requests (POST, PUT, DELETE, PATCH)
  if (!skipCsrf && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) {
      headers.set('X-CSRF-Token', csrf);
    }
  }

  const config: RequestInit = {
    ...requestOptions,
    headers,
    credentials: 'include', // Enables httpOnly refresh cookie transmission
  };

  let response: Response;
  try {
    response = await fetch(requestUrl, config);
  } catch (netErr: any) {
    throw new Error(`Network connection error: ${netErr.message || 'Unable to connect to server'}`);
  }

  // 5. Handle Token Expiry (HTTP 401) with Automatic Silent Refresh
  if (response.status === 401 && !skipAuth && endpoint !== '/api/auth/refresh' && endpoint !== '/api/auth/login') {
    const refreshedToken = await attemptSilentRefresh();
    if (refreshedToken) {
      // Retry original request once with new access token
      headers.set('Authorization', `Bearer ${refreshedToken}`);
      const csrf = getCsrfToken();
      if (csrf) headers.set('X-CSRF-Token', csrf);

      const retryRes = await fetch(requestUrl, {
        ...requestOptions,
        headers,
        credentials: 'include',
      });

      if (!retryRes.ok) {
        const errorData = await retryRes.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP error ${retryRes.status}`);
      }
      const retryData = await retryRes.json();
      if (shouldCache) {
        responseCache.set(resolvedCacheKey, { value: retryData, expiresAt: Date.now() + cacheTtlMs });
      }
      return retryData;
    }
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const message = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
    const err: any = new Error(message);
    err.status = response.status;
    err.code = errorData.code;
    err.details = errorData.details;
    err.correlationId = correlationId;
    throw err;
  }

  // Check if JSON or text
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    const data = await response.json();
    if (shouldCache) {
      responseCache.set(resolvedCacheKey, { value: data, expiresAt: Date.now() + cacheTtlMs });
    } else if (method !== 'GET') {
      responseCache.clear();
    }
    return data;
  }
  const text = await response.text();
  if (method !== 'GET') responseCache.clear();
  return text as any;
}

export function clearApiCache() {
  responseCache.clear();
}

// Helper: Attempt silent refresh with single-flight mutex promise
async function attemptSilentRefresh(): Promise<string | null> {
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const res = await fetch(resolveApiUrl('/api/auth/refresh'), {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
      });

      if (res.ok) {
        const data = await res.json();
        setAccessToken(data.accessToken);
        if (data.csrfToken) {
          setCsrfToken(data.csrfToken);
        }
        return data.accessToken;
      }
      setAccessToken(null);
      return null;
    } catch {
      setAccessToken(null);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

export interface SimulationSseHandlers {
  onEvent: (eventType: string, payload: any) => void;
  onError?: (err: Error) => void;
}

/**
 * Connects to /api/simulation-stream/:caseId via fetch ReadableStream SSE so
 * in-memory Bearer authorization headers and credentials work seamlessly.
 */
export function openSimulationSseStream(caseId: string, handlers: SimulationSseHandlers): () => void {
  const controller = new AbortController();
  let stopped = false;

  (async () => {
    try {
      const headers = new Headers({
        Accept: 'text/event-stream',
        'Cache-Control': 'no-cache',
      });
      if (inMemoryAccessToken) {
        headers.set('Authorization', `Bearer ${inMemoryAccessToken}`);
      }

      const response = await fetch(resolveApiUrl(`/api/simulation-stream/${caseId}`), {
        method: 'GET',
        headers,
        credentials: 'include',
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`SSE stream failed with HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (!stopped) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split('\n\n');
        buffer = frames.pop() || '';

        for (const frame of frames) {
          const lines = frame.split('\n');
          let eventName = 'message';
          const dataLines: string[] = [];
          for (const line of lines) {
            if (!line || line.startsWith(':')) continue;
            if (line.startsWith('event:')) {
              eventName = line.slice(6).trim();
            } else if (line.startsWith('data:')) {
              dataLines.push(line.slice(5).trim());
            }
          }
          if (dataLines.length > 0) {
            try {
              const parsed = JSON.parse(dataLines.join('\n'));
              handlers.onEvent(eventName, parsed);
            } catch {
              // Ignore malformed partial frame
            }
          }
        }
      }
    } catch (err: any) {
      if (!stopped && err?.name !== 'AbortError') {
        handlers.onError?.(err instanceof Error ? err : new Error(String(err)));
      }
    }
  })();

  return () => {
    stopped = true;
    controller.abort();
  };
}
