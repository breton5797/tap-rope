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

/**
 * Reads the body, keeping at most `maxBytes`. It is always drained to the end before we answer: the platform
 * gateway hangs (~160 s) if a function responds — or cancels the stream — while the client is still
 * uploading (measured: cancel() on a 700 KB upload hangs; draining it answers in well under a second).
 * The drain itself is bounded: past DRAIN_LIMIT bytes or DRAIN_MS we cancel, so a huge or trickled upload
 * can't hold the isolate — only such an abusive client sees the gateway hang.
 */
const DRAIN_LIMIT = 4_000_000;
const DRAIN_MS = 10_000;

async function readBody(req: Request, maxBytes: number): Promise<{ ok: true; text: string } | { ok: false; error: 'too_large' | 'bad_body' }> {
  if (!req.body) return { ok: true, text: '' };
  const declared = Number(req.headers.get('content-length') ?? '0');
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  const deadline = Date.now() + DRAIN_MS;
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size <= maxBytes && declared <= maxBytes) chunks.push(value);
      if (size > DRAIN_LIMIT || Date.now() > deadline) {
        await reader.cancel().catch(() => {});
        return { ok: false, error: 'too_large' };
      }
    }
  } catch {
    return { ok: false, error: 'bad_body' }; // client aborted mid-upload
  }
  if (size > maxBytes || declared > maxBytes) return { ok: false, error: 'too_large' };
  const bytes = new Uint8Array(size);
  chunks.reduce((offset, c) => (bytes.set(c, offset), offset + c.byteLength), 0);
  return { ok: true, text: new TextDecoder().decode(bytes) };
}

/**
 * Entry point of every function: drains the body, answers the CORS preflight, rejects a body larger than
 * `maxBytes` (413), then checks the method (405) and parses JSON (400 bad_json). Returns the parsed body
 * (null when empty), or the response to send. Nothing may answer before this has run.
 */
export async function accept(req: Request, methods: string, maxBytes: number): Promise<{ body: unknown } | Response> {
  const raw = await readBody(req, maxBytes);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req, methods) });
  if (!raw.ok) return error(req, methods, raw.error === 'too_large' ? 413 : 400, raw.error);
  if (!methods.split(', ').includes(req.method)) return error(req, methods, 405, 'method_not_allowed');
  if (raw.text.trim() === '') return { body: null };
  try {
    return { body: JSON.parse(raw.text) };
  } catch {
    return error(req, methods, 400, 'bad_json');
  }
}
