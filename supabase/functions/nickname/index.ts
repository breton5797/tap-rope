// POST /nickname { nickname } — header x-device-secret. 400 invalid | 400 banned | 409 taken.
import { accept, error, json } from '../_shared/http.ts';
import { playerFromRequest, sql } from '../_shared/db.ts';
import { checkNickname } from '../_shared/rules.ts';

const M = 'POST';

Deno.serve(async (req) => {
  const start = await accept(req, M, 1024);
  if (start instanceof Response) return start;
  try {
    const player = await playerFromRequest(req);
    if (!player) return error(req, M, 401, 'bad_secret');
    const name = checkNickname((start.body as { nickname?: unknown } | null)?.nickname);
    if (!name.ok) return error(req, M, 400, name.error);
    try {
      await sql`update game.players set nickname = ${name.value} where id = ${player.id}`;
    } catch (e) {
      if ((e as { code?: string }).code === '23505') return error(req, M, 409, 'taken');
      throw e;
    }
    return json(req, M, 200, { nickname: name.value }, { 'Cache-Control': 'no-store' });
  } catch (e) {
    console.error('nickname', e);
    return error(req, M, 500, 'server_error');
  }
});
