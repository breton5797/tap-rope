// POST /submit-run RunRecord — header x-device-secret.
// Validates limits → rate limit (6/min) → re-simulates with the bundled game code → stores the
// server score → upserts best_scores if higher. Responds { score, rank, best, board, status }.
import { accept, error, json } from '../_shared/http.ts';
import { playerFromRequest, sql } from '../_shared/db.ts';
import { boardsFor, checkRecord, RATE_LIMIT_PER_MIN } from '../_shared/rules.ts';
// @ts-ignore generated ESM bundle (see vite.sim.config.ts)
import * as sim from './sim.js';

const M = 'POST';
const MAX_BODY = 600_000; // 20k inputs × ~25 bytes + slack

interface SimResult { score: number; endTime: number; status: 'playing' | 'cleared' | 'failed' }
const SIM_VERSION: string = sim.SIM_VERSION;
const simulateRun: (record: unknown) => SimResult = sim.simulateRun;

/** Records the attempt and reports whether it is within the per-player limit. Every well-formed attempt
 *  counts (before simulating), so junk can't burn simulator CPU; the per-player advisory lock serialises
 *  concurrent submits so parallel requests can't slip past the count. */
const withinRateLimit = (playerId: string): Promise<boolean> =>
  sql.begin(async (tx) => {
    await tx`select pg_advisory_xact_lock(hashtext(${playerId}::text))`;
    const [{ recent }] = await tx<{ recent: number }[]>`
      select count(*)::int as recent from game.submissions
      where player_id = ${playerId} and created_at > now() - interval '60 seconds'`;
    if (recent >= RATE_LIMIT_PER_MIN) return false;
    await tx`insert into game.submissions (player_id) values (${playerId})`;
    await tx`delete from game.submissions where player_id = ${playerId} and created_at < now() - interval '1 day'`;
    return true;
  });

Deno.serve(async (req) => {
  const start = await accept(req, M, MAX_BODY);
  if (start instanceof Response) return start;
  if (SIM_VERSION === 'unavailable') return error(req, M, 503, 'sim_unavailable');
  try {
    const player = await playerFromRequest(req);
    if (!player) return error(req, M, 401, 'bad_secret');
    const now = Date.now();
    const checked = checkRecord(start.body, now);
    if (!checked.ok) return error(req, M, 400, checked.error);
    const record = checked.value;
    if (record.sim !== SIM_VERSION) return error(req, M, 409, 'sim_version', { expected: SIM_VERSION });
    if (!(await withinRateLimit(player.id))) return error(req, M, 429, 'rate_limited');

    let result: SimResult;
    try {
      result = simulateRun(record);
    } catch (e) {
      console.error('simulate', e);
      return error(req, M, 422, 'sim_failed');
    }
    const score = Math.max(0, Math.floor(result.score));
    if (!Number.isFinite(score)) return error(req, M, 422, 'sim_failed');
    if (score !== record.clientScore) console.warn('score mismatch', { player: player.id, client: record.clientScore, server: score });

    const boards = boardsFor(record, now);
    const best = await sql.begin(async (tx) => {
      const [run] = await tx<{ id: string }[]>`
        insert into game.runs (player_id, board, score, client_score, sim, inputs, end_time)
        values (${player.id}, ${boards[0]}, ${score}, ${record.clientScore}, ${record.sim}, ${tx.json(record.inputs as never)}, ${record.endTime})
        returning id`;
      if (score <= 0) return false; // kept for audit, but zero runs never enter a board
      let improved = false;
      for (const board of boards) {
        const updated = await tx`
          insert into game.best_scores (player_id, board, score, run_id)
          values (${player.id}, ${board}, ${score}, ${run.id})
          on conflict (player_id, board) do update
            set score = excluded.score, run_id = excluded.run_id, updated_at = now()
            where game.best_scores.score < excluded.score
          returning 1`;
        if (board === boards[0]) improved = updated.length > 0;
      }
      return improved;
    });
    const [mine] = await sql<{ rank: string }[]>`select rank from game.leaderboard_row(${boards[0]}, ${player.id})`;
    return json(req, M, 200, { score, rank: mine ? Number(mine.rank) : null, best, board: boards[0], status: result.status }, {
      'Cache-Control': 'no-store',
    });
  } catch (e) {
    console.error('submit-run', e);
    return error(req, M, 500, 'server_error');
  }
});
