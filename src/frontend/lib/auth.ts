// trigger-agents/src/frontend/lib/auth.ts
// Token stored in localStorage, passed as X-HQ-Token header or ?token= for SSE

const KEY = 'hq-token';

export function getToken(): string | null {
  return localStorage.getItem(KEY);
}

export function setToken(token: string | null): void {
  if (token) localStorage.setItem(KEY, token);
  else localStorage.removeItem(KEY);
}

export function authHeaders(): HeadersInit {
  const t = getToken();
  return t ? { 'x-hq-token': t } : {};
}

export async function checkAuth(): Promise<{ protected: boolean; valid: boolean }> {
  const r = await fetch('/api/auth/status');
  const { protected: isProtected } = await r.json() as { protected: boolean };
  if (!isProtected) return { protected: false, valid: true };
  // Check if existing token works
  const probe = await fetch('/api/stats', { headers: authHeaders() });
  return { protected: true, valid: probe.ok };
}

export async function login(password: string): Promise<string | null> {
  const r = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });
  if (!r.ok) return null;
  const { token } = await r.json() as { token: string | null };
  if (token) setToken(token);
  return token;
}

export async function setPassword(password: string): Promise<string | null> {
  const r = await fetch('/api/auth/set-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders() },
    body: JSON.stringify({ password }),
  });
  if (!r.ok) return null;
  const { token } = await r.json() as { token: string };
  setToken(token);
  return token;
}

export async function clearPassword(): Promise<boolean> {
  const r = await fetch('/api/auth/clear-password', {
    method: 'POST',
    headers: authHeaders(),
  });
  if (r.ok) setToken(null);
  return r.ok;
}

export function sseUrl(path: string): string {
  const t = getToken();
  return t ? `${path}?token=${encodeURIComponent(t)}` : path;
}
