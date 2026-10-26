// HTTP plumbing shared by the Edge Functions: CORS, JSON responses, bounded body parsing.

const ALLOWED_ORIGINS = new Set(['https://breton5797.github.io', 'capacitor://localhost']);
const LOCALHOST_RE = /^http:\/\/(localhost|127\.0\.0\.1)(:\d{1,5})?$/;

export const isAllowedOrigin = (origin: string | null): boolean =>
  origin !== null && (ALLOWED_ORIGINS.has(origin) || LOCALHOST_RE.test(origin));

function corsHeaders(req: Request, methods: string): Record<string, string> {
  const origin = req.headers.get('origin');
  const base: Record<string, string> = { Vary: 'Origin' };
  if (!isAllowedOrigin(origin)) return base;
  return {
    ...base,
    'Access-Control-Allow-Origin': origin as string,
    'Access-Control-Allow-Methods': `${methods}, OPTIONS`,
    'Access-Control-Allow-Headers': 'content-type, x-device-secret, apikey, authorization, x-client-info',
    'Access-Control-Max-Age': '86400',
  };
}

export function json(req: Request, methods: string, status: number, body: unknown, extra: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req, methods), 'Content-Type': 'application/json; charset=utf-8', ...extra },
  });
}

export const error = (req: Request, methods: string, status: number, code: string, extra: Record<string, unknown> = {}): Response =>
  json(req, methods, status, { error: code, ...extra }, { 'Cache-Control': 'no-store' });

/** Handles the preflight and method check; returns a response to send, or null to continue. */
export function preflight(req: Request, methods: string): Response | null {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req, methods) });
  if (!methods.split(', ').includes(req.method)) return error(req, methods, 405, 'method_not_allowed');
  return null;
}

/**
 * Reads a JSON body of at most `maxBytes`. An oversized body is drained but not kept: the platform
 * gateway hangs if we answer (or cancel the stream) while the client is still uploading.
 */
export async function readJson(req: Request, maxBytes: number): Promise<{ ok: true; value: unknown } | { ok: false; error: string }> {
  if (!req.body) return { ok: false, error: 'bad_json' };
  const declared = Number(req.headers.get('content-length') ?? '0');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size <= maxBytes && declared <= maxBytes) chunks.push(value);
  }
  if (size > maxBytes || declared > maxBytes) return { ok: false, error: 'too_large' };
  const bytes = new Uint8Array(size);
  chunks.reduce((offset, c) => (bytes.set(c, offset), offset + c.byteLength), 0);
  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { ok: false, error: 'bad_json' };
  }
}
