// Create API Client

import axios, { AxiosError, AxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const CSRF_COOKIE = 'casino_csrf';
const CSRF_HEADER = 'X-CSRF-Token';
const UNSAFE_METHODS = new Set(['post', 'put', 'patch', 'delete']);

// Endpoints that must never trigger a refresh-retry cycle.
const AUTH_ENDPOINTS = ['/auth/refresh', '/auth/signin', '/auth/signup', '/auth/verify-email'];

type RetriableConfig = AxiosRequestConfig & { _retried?: boolean };

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const prefix = `${name}=`;
  const match = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : null;
}

export const apiClient = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // Auth lives in HttpOnly cookies, so every request must send credentials.
  withCredentials: true,
});

// Echo the double-submit CSRF token on state-changing requests.
apiClient.interceptors.request.use((config) => {
  if (typeof window !== 'undefined' && UNSAFE_METHODS.has(config.method?.toLowerCase() ?? '')) {
    const csrfToken = readCookie(CSRF_COOKIE);
    if (csrfToken) {
      config.headers[CSRF_HEADER] = csrfToken;
    }
  }
  return config;
});

let refreshPromise: Promise<boolean> | null = null;

/**
 * Rotate the refresh cookie once, even when several requests get a 401 at the
 * same time. The backend replaces both the access and CSRF cookies.
 */
function refreshSession(): Promise<boolean> {
  if (!refreshPromise) {
    refreshPromise = apiClient
      .post('/auth/refresh')
      .then(() => true)
      .catch(() => false)
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

function isAuthEndpoint(url: string | undefined): boolean {
  return AUTH_ENDPOINTS.some((endpoint) => (url ?? '').includes(endpoint));
}

function redirectToLogin() {
  if (typeof window === 'undefined') {
    return;
  }
  const { pathname } = window.location;
  if (pathname === '/login' || pathname === '/register') {
    return;
  }
  // The interceptor lives outside the React tree, so a full navigation is
  // intentional. Resolve to an absolute URL so the destination cannot be
  // mistaken for an in-app relative navigation.
  window.location.href = new URL('/login', window.location.origin).href;
}

// On 401, try one silent refresh (rotation), then retry the original request.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const config = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const authCall = isAuthEndpoint(config?.url);

    if (status === 401 && config && !config._retried && !authCall) {
      config._retried = true;
      if (await refreshSession()) {
        return apiClient(config);
      }
    }

    if (status === 401 && !authCall) {
      redirectToLogin();
    }

    return Promise.reject(error);
  },
);
