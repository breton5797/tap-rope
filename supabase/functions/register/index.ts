// POST /register — header x-device-secret (64 hex). Idempotent: returns the existing player for a known secret.
import { accept, error, json } from '../_shared/http.ts';
import { sha256Hex, sql } from '../_shared/db.ts';
import { isSecret } from '../_shared/rules.ts';

const M = 'POST';

Deno.serve(async (req) => {
  const start = await accept(req, M, 1024);
  if (start instanceof Response) return start;
  const secret = req.headers.get('x-device-secret');
  if (!isSecret(secret)) return error(req, M, 401, 'bad_secret');
  try {
    const hash = await sha256Hex(secret);
    const [row] = await sql<{ id: string; nickname: string | null }[]>`
      insert into game.players (secret_hash) values (${hash})
      on conflict (secret_hash) do update set secret_hash = excluded.secret_hash
      returning id, nickname`;
    return json(req, M, 200, { playerId: row.id, nickname: row.nickname }, { 'Cache-Control': 'no-store' });
  } catch (e) {
    console.error('register', e);
    return error(req, M, 500, 'server_error');
  }
});
