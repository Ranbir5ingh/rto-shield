export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

let csrfToken: string | null = null;

export function setCsrf(token: string | null) {
  csrfToken = token;
}

async function readJson(response: Response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text) as { error?: string; details?: unknown; csrfToken?: string };
  } catch {
    return { error: text };
  }
}

async function ensureCsrf() {
  if (csrfToken) return csrfToken;
  const response = await fetch('/api/auth/csrf', { credentials: 'include' });
  const body = await readJson(response);
  if (!response.ok || !body?.csrfToken) throw new ApiError('Could not start a secure session', response.status);
  csrfToken = body.csrfToken;
  return csrfToken;
}

export async function api<T>(path: string, init: RequestInit = {}, attempt = 0): Promise<T> {
  const method = (init.method || 'GET').toUpperCase();
  const headers = new Headers(init.headers);
  if (method !== 'GET' && method !== 'HEAD') {
    headers.set('x-csrf-token', await ensureCsrf());
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json');
  }
  const response = await fetch(`/api${path}`, { ...init, headers, credentials: 'include' });
  if (response.status === 401 && attempt < 1 && !path.startsWith('/auth/')) {
    const refreshed = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'content-type': 'application/json', 'x-csrf-token': await ensureCsrf() },
    });
    const refreshBody = await readJson(refreshed);
    if (refreshed.ok && refreshBody?.csrfToken) {
      csrfToken = refreshBody.csrfToken;
      return api<T>(path, init, attempt + 1);
    }
  }
  if (response.status === 403 && attempt < 1 && method !== 'GET') {
    csrfToken = null;
    await ensureCsrf();
    return api<T>(path, init, attempt + 1);
  }
  const data = await readJson(response);
  if (!response.ok) {
    throw new ApiError(data?.error || 'Request failed', response.status, data?.details);
  }
  if (data?.csrfToken) csrfToken = data.csrfToken;
  return data as T;
}

export async function downloadExport() {
  const response = await fetch('/api/account/export', { credentials: 'include' });
  if (!response.ok) throw new ApiError('Export failed', response.status);
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'rto-shield-export.csv';
  link.click();
  URL.revokeObjectURL(url);
}
