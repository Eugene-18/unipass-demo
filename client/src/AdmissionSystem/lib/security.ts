import type { PortalRole } from '../types';

export const AUTH_TOKEN_STORAGE_KEY = 'portal-auth-token';
export const DEMO_AUTH_TOKEN = 'ntub-demo-access-token';

export function getStoredAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY) ?? null;
}

export function setStoredAuthToken(token: string) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, token);
}

export function clearStoredAuthToken() {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
}

export function isPrivilegedDocumentRole(role?: PortalRole): boolean {
  return role === 'reviewer';
}

export function buildAuthHeaders(headers: HeadersInit = {}): Record<string, string> {
  const token = getStoredAuthToken();
  const merged = new Headers(headers);

  if (!token) {
    throw new Error('Authentication required: missing bearer token');
  }

  merged.set('Authorization', `Bearer ${token}`);
  return Object.fromEntries(merged.entries());
}

export async function secureFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = getStoredAuthToken();
  if (!token) {
    throw new Error('Authentication required: missing bearer token');
  }

  const headers = new Headers(init.headers ?? {});
  headers.set('Authorization', `Bearer ${token}`);

  return fetch(input, {
    ...init,
    headers,
  });
}
