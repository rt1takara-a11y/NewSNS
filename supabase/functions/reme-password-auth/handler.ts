type Options = {
  url: string;
  serviceKey: string;
  publicKey: string;
  allowedOrigins: string[];
  fetcher?: typeof fetch;
  minimumFailureMs?: number;
};

export function normalizeLoginId(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 64) return null;
  const id = value.trim().toLowerCase();
  return /^[a-z][a-z0-9_-]{3,23}$/.test(id) ? id : null;
}
export function validPassword(value: unknown): value is string {
  // ASCII avoids bcrypt's 72-byte truncation, including multibyte ambiguity.
  return typeof value === 'string' && /^[\x20-\x7e]{15,72}$/.test(value) && value.trim().length > 0;
}
async function readInput(req: Request) {
  if (!req.headers.get('content-type')?.toLowerCase().startsWith('application/json')) throw new Error('INPUT');
  const reader = req.body?.getReader();
  if (!reader) throw new Error('INPUT');
  let total = 0, text = '';
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 2048) { await reader.cancel(); throw new Error('INPUT'); }
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode());
  } finally { reader.releaseLock(); }
}
async function hash(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), b => b.toString(16).padStart(2, '0')).join('');
}

export function createHandler(options: Options) {
  const fetcher = options.fetcher ?? fetch;
  const base = options.url.replace(/\/$/, '');
  // There is deliberately no shared mutable auth client / session between requests.
  async function api(path: string, key: string, body: unknown, token = key) {
    const response = await fetcher(base + path, {
      method: 'POST', signal: AbortSignal.timeout(10000),
      headers: { apikey: key, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: response.ok, status: response.status, data: await response.json() };
  }
  return async (req: Request): Promise<Response> => {
    const started = Date.now();
    const origin = req.headers.get('origin') ?? '';
    const allowed = options.allowedOrigins.includes(origin);
    const headers: Record<string, string> = {
      'Content-Type': 'application/json', 'Cache-Control': 'no-store', Vary: 'Origin',
      'X-Content-Type-Options': 'nosniff',
      ...(allowed ? { 'Access-Control-Allow-Origin': origin } : {}),
    };
    const reply = (status: number, data: unknown) => new Response(JSON.stringify(data), { status, headers });
    const failLogin = async () => {
      await new Promise(resolve => setTimeout(resolve, Math.max(0, (options.minimumFailureMs ?? 500) - (Date.now() - started))));
      return reply(401, { error: 'INVALID_CREDENTIALS' });
    };
    if (!allowed) return reply(403, { error: 'ORIGIN_NOT_ALLOWED' });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: {
      ...headers, 'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
    } });
    if (req.method !== 'POST') return reply(405, { error: 'METHOD_NOT_ALLOWED' });
    if (!base.startsWith('https://') || !options.serviceKey || !options.publicKey) return reply(503, { error: 'UNAVAILABLE' });
    let input;
    try { input = await readInput(req); } catch { return reply(400, { error: 'INVALID_INPUT' }); }
    const loginId = normalizeLoginId(input?.loginId);
    if (!loginId || !validPassword(input?.password) || !['register', 'login'].includes(input?.action)) {
      return reply(400, { error: 'INVALID_INPUT' });
    }
    const registering = input.action === 'register';
    if (registering && input.noRecoveryAccepted !== true) return reply(400, { error: 'RECOVERY_ACK_REQUIRED' });
    try {
      // Forwarded IP is a best-effort extra limit, never the sole abuse boundary.
      // Neither raw IPs nor passwords are logged or stored in application tables.
      const client = (req.headers.get('x-forwarded-for') ?? 'unknown').slice(0, 256);
      const limited = await api('/rest/v1/rpc/reme_auth_attempt', options.serviceKey, {
        client_hash: await hash(client), login_hash: await hash(loginId), registering,
      });
      if (!limited.ok) return reply(503, { error: 'UNAVAILABLE' });
      if (limited.data !== true) return reply(429, { error: 'RATE_LIMITED' });
      const identity = await api('/rest/v1/rpc/reme_login_identity', options.serviceKey, {
        login_id: loginId, create_if_missing: registering,
      });
      if (!identity.ok) return reply(503, { error: 'UNAVAILABLE' });
      const email = identity.data;
      if (typeof email !== 'string' || !/^[a-f0-9-]{36}@login\.reme\.invalid$/.test(email)) return await failLogin();
      if (registering) {
        // A random non-deliverable alias is only an Auth identifier. No real email
        // is collected, confirmed, sent to, or used for recovery. No user_metadata ID.
        const created = await api('/auth/v1/admin/users', options.serviceKey, {
          email, password: input.password, email_confirm: true,
          app_metadata: { reme_login_method: 'login_id' },
        });
        if (!created.ok) return reply(created.status >= 500 ? 503 : 409, {
          error: created.status >= 500 ? 'UNAVAILABLE' : 'REGISTRATION_UNAVAILABLE',
        });
      }
      const session = await api('/auth/v1/token?grant_type=password', options.publicKey, { email, password: input.password });
      if (!session.ok) {
        if (session.status >= 500) return reply(503, { error: 'UNAVAILABLE' });
        return await failLogin();
      }
      const { access_token, refresh_token } = session.data;
      if (typeof access_token !== 'string' || typeof refresh_token !== 'string') return reply(503, { error: 'UNAVAILABLE' });
      // The existing DB authorization also enforces persistent suspension on login.
      const authorized = await api('/rest/v1/rpc/reme_state', options.publicKey, {}, access_token);
      if (!authorized.ok) {
        if (String(authorized.data?.message).includes('ACCOUNT_SUSPENDED')) return await failLogin();
        return reply(503, { error: 'UNAVAILABLE' });
      }
      // Credentials go only to their authenticated owner, never into public profiles.
      // Do not return the login ID, synthetic alias, user object or admin response.
      return reply(200, { access_token, refresh_token });
    } catch {
      // Never serialize exceptions: upstream errors may contain credentials.
      return reply(503, { error: 'UNAVAILABLE' });
    }
  };
}
