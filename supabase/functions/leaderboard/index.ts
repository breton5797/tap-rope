// GET /leaderboard?board=endless|endless-week|daily:YYYY-MM-DD — optional header x-device-secret adds `mine`/`me`.
import { accept, error, json } from '../_shared/http.ts';
import { playerFromRequest, sql } from '../_shared/db.ts';
import { resolveBoard } from '../_shared/rules.ts';

const M = 'GET';
const TOP = 50;

interface Row { rank: string | number; player_id: string; nickname: string; score: number }

Deno.serve(async (req) => {
  const start = await accept(req, M, 1024);
  if (start instanceof Response) return start;
  const board = resolveBoard(new URL(req.url).searchParams.get('board'), Date.now());
  if (!board) return error(req, M, 400, 'bad_board');
  try {
    const hasSecret = req.headers.has('x-device-secret');
    const player = hasSecret ? await playerFromRequest(req) : null;
    const top = await sql<Row[]>`select * from game.leaderboard(${board}, ${TOP})`;
    const mineRows = player ? await sql<Row[]>`select * from game.leaderboard_row(${board}, ${player.id})` : [];
    const view = (r: Row) => ({ rank: Number(r.rank), nickname: r.nickname, score: r.score, me: r.player_id === player?.id });
    return json(req, M, 200, { board, top: top.map(view), mine: mineRows[0] ? view(mineRows[0]) : null }, {
      // per-caller rows (me/mine) must not land in a shared cache
      'Cache-Control': `${hasSecret ? 'private' : 'public'}, max-age=30`,
    });
  } catch (e) {
    console.error('leaderboard', e);
    return error(req, M, 500, 'server_error');
  }
});
