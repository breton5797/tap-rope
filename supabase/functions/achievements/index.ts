// POST /achievements { unlocked: { [AchievementId]: unixMs } } — header x-device-secret. Keeps the earliest unlock time.
import { accept, error, json } from '../_shared/http.ts';
import { playerFromRequest, sql } from '../_shared/db.ts';
import { checkAchievements } from '../_shared/rules.ts';

const M = 'POST';

Deno.serve(async (req) => {
  const start = await accept(req, M, 4096);
  if (start instanceof Response) return start;
  try {
    const player = await playerFromRequest(req);
    if (!player) return error(req, M, 401, 'bad_secret');
    const checked = checkAchievements(start.body, Date.now());
    if (!checked.ok) return error(req, M, 400, checked.error);
    if (checked.value.length > 0) {
      const rows = checked.value.map(([id, ms]) => ({
        player_id: player.id, achievement_id: id, unlocked_at: new Date(ms).toISOString(),
      }));
      await sql`
        insert into game.achievements ${sql(rows, 'player_id', 'achievement_id', 'unlocked_at')}
        on conflict (player_id, achievement_id)
        do update set unlocked_at = least(game.achievements.unlocked_at, excluded.unlocked_at)`;
    }
    return json(req, M, 200, { synced: checked.value.length }, { 'Cache-Control': 'no-store' });
  } catch (e) {
    console.error('achievements', e);
    return error(req, M, 500, 'server_error');
  }
});
