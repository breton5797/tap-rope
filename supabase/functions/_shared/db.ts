// Direct Postgres access (the `game` schema is not exposed through the Data API).
import postgres from 'npm:postgres@3.4.5';
import { isSecret } from './rules.ts';

const url = Deno.env.get('SUPABASE_DB_URL');
if (!url) throw new Error('SUPABASE_DB_URL is not set');

// prepare:false keeps it compatible with the transaction pooler
export const sql = postgres(url, { prepare: false, max: 3, idle_timeout: 20, connect_timeout: 10 });

export interface Player {
  readonly id: string;
  readonly nickname: string | null;
}

export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

/** Constant-time comparison of two equal-length hex strings. */
export function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** The player owning the `x-device-secret` header, or null (missing/malformed/unknown secret). */
export async function playerFromRequest(req: Request): Promise<Player | null> {
  const secret = req.headers.get('x-device-secret');
  if (!isSecret(secret)) return null;
  const hash = await sha256Hex(secret);
  const rows = await sql<{ id: string; secret_hash: string; nickname: string | null }[]>`
    select id, secret_hash, nickname from game.players where secret_hash = ${hash}`;
  const row = rows[0];
  if (!row || !timingSafeEqual(row.secret_hash, hash)) return null;
  return { id: row.id, nickname: row.nickname };
}
