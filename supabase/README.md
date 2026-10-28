# LASER ESCAPE online backend

Supabase project `laser-escape` (ref `bmstuotifpmaspszrgyi`, ap-northeast-2). Design: `docs/GDD-v7.md` §3.3.

- `migrations/` — schema in the private `game` schema (not exposed through the Data API; RLS on, client roles revoked).
- `functions/` — `register`, `nickname`, `submit-run`, `achievements`, `leaderboard` (+ `_shared/`). All run with
  `verify_jwt = false` (see `config.toml`); callers authenticate with the `x-device-secret` header.
- `functions/submit-run/sim.js` — **generated** bundle of `src/game/replay.ts`. Commit it; don't edit it.
- Client: `src/platform/online.ts`; public URL + publishable key in `.env.production`. The service role / secret
  key is never in the repo — functions reach Postgres through the platform's `SUPABASE_DB_URL`.

## Redeploy

```bash
npm run build:sim            # rebuild functions/submit-run/sim.js from src/game/replay.ts
npm test                     # tests/supabase/sim-bundle.test.ts fails if sim.js is stale
supabase login               # once per machine
supabase functions deploy --project-ref bmstuotifpmaspszrgyi              # all functions
supabase functions deploy submit-run --project-ref bmstuotifpmaspszrgyi   # just the simulator
```

Schema changes: add a new file under `migrations/` and apply it (`supabase db push`, or the MCP `apply_migration`),
then check the security and performance advisors.

## SIM_VERSION rule

`SIM_VERSION` in `src/game/replay.ts` must be bumped whenever anything that affects a replayed score changes
(gameplay, generation, scoring, timing). Then rebuild `sim.js` and redeploy `submit-run` **together with the
client release**: the server rejects records from any other version (`409 sim_version`), so an old client's runs
are refused until players update, and a new client's runs are refused until the function is redeployed.

## Known limits

- Re-simulation stops forged scores and an inflated `clientScore`, but it cannot tell a human from a bot that
  generates a valid input sequence offline.
- `register` has no IP-based rate limit: anyone can create many device identities (each still limited to
  6 well-formed submissions per minute).
- The daily-operation date must be within ±1 day of the server's Korea (UTC+9) date.
- Layouts are generated client-side from public inputs: the endless seed is chosen by the client (a player can
  hunt for an easy seed and submit only that), and daily layouts are a pure function of the date, so with the
  ±1 day window tomorrow's daily can be practised (or solved offline) before it opens.
- Runs scoring 0 are stored for audit but never enter a board.

## Leaderboard seasons

`SEASON` in `functions/_shared/rules.ts` prefixes every board key (`s8:endless`, `s8:endless-week:<week>`,
`s8:daily:<date>`). When judging/scoring changes (a new `SIM_VERSION` that scores differently), bump the season with
it so new scores never rank against old ones. Older rows stay in `game.runs` / `game.best_scores` under their old keys.
