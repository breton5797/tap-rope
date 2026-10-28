# 칼퇴근 대작전 (Office Escape) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A 5-stage comic "clock out at 18:00" re-story of LASER ESCAPE v8, built from the same codebase into `dist/office/` and served at `/tap-rope/office/`, while v8 at `/tap-rope/` is unchanged.

**Architecture:** A second Vite build (`vite.office.config.ts`, entry `office.html`) uses a small resolver plugin that **swaps whole modules** (content, boss, cutscenes, boss-lines, flavor, player painter, hazard art, music) for office versions under `src/office/`. Office modules export the **same names and types** as the v8 module they replace. v8 gains only three seams in a new `src/flavor.ts` (copy strings, feature flags, per-run seed). Judge / physics / scoring / generator are untouched, so `tests/core/golden.test.ts` stays green.

**Tech Stack:** TypeScript 5.9, Vite 8, Vitest 5, Canvas 2D, Capacitor (not used for office), Higgsfield CLI (`higgsfield`) for art, Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-10-29-office-escape-design.md` (Korean; §13 holds the resolved builder questions — read it).

## Global Constraints

- v8 behaviour, URLs, save data and `tests/core/golden.test.ts` digest `d980adb3db083d46` must not change. Every existing test keeps passing.
- Do not edit `src/core/judge.ts`, `physics.ts`, `scoring.ts`, `levels.ts`, `spacing.ts`, `specs.ts`, `src/game/replay.ts`.
- Office build: `VITE_SUPABASE_URL=''` (offline), save prefix `officeescape` (keys `officeescape.save.v2`, device/queue keys likewise). Zero network requests to supabase.co.
- Every surprise/attack is a re-dress of a beat the existing generator + spacing produced; never insert or move beats. Warning lead ≥ existing `WARN_LEAD`.
- Per-run seed is chosen once at run start (`crypto.getRandomValues`), stored in the run; never changed by player input (P3).
- Fictional company "야근상사" only. No real brands/logos/real people likeness. No text baked into generated images.
- All player-facing copy Korean, comic tone, no harassment glorification, no gender/age put-downs.
- Characters: 칼퇴준 (남, SkinId `'kid'`), 정시원 (여, SkinId `'cat'`). Bosses reuse BossId slots: `warden`=김대리, `sewer-eye`=박과장, `lab-ai`=최팀장, `core`=오부장, `jailer`=한전무, `apc`=윤이사, `chimera`=사장님 (prototype shortcut, documented in `src/office/boss.ts` header; display never shows the slot id).
- Clock: stage n runs 17:30 + 6·(n−1) → +6 min; stage 5 ends 18:00:00.
- Out of scope: endless, daily, leaderboard, nickname, transfer, shop purchases, ads, iOS build.

## Review Focus

1. Opening `/tap-rope/office/` after having played v8 on the same browser: the v8 service worker must not serve v8 files for `/office/` and the two saves must not mix → Task 7 e2e step opens v8 first, then office, asserts office title + separate `officeescape.save.v2`.
2. Stage 5 section changes: boss id, gauge and exit line switch per section; gauge never shows a previous boss's value → Task 3 test `stage 5 gauge resets per section`.
3. Retry after failure mid-stage: new run seed, clock back to stage start, no leftover boss/event state → Task 3 test `restart uses stage start clock` + Task 7 e2e retry step.
4. Blackout event while a hazard is on screen: hazard outline stays visible → Task 5 test `blackout keeps hazard outline alpha ≥ 0.8`.
5. First launch with no save: picker shows before op-start cutscene, and choosing either character persists across reload → Task 6 test + Task 7 e2e.

---

### Task 1: Module-swap build + flavor seams

**Files:**
- Create: `src/flavor.ts` (v8 defaults), `src/office/flavor.ts`, `office.html`, `vite.office.config.ts`, `.env.office`, `build/swap-modules.ts`
- Modify: `src/core/storage.ts` (key prefix from flavor), `src/platform/online.ts` (key prefix), `src/game/app.ts` (run seed + feature flags), `src/ui/title.ts` (hide disabled features), `package.json` (`build:office`), `.github/workflows/pages.yml` (second build into `dist/office`), `sw/sw.template.js` (v8 SW ignores `/office/` requests)
- Test: `tests/office/swap.test.ts`, `tests/core/flavor.test.ts`

**Interfaces:**
- Produces `src/flavor.ts`:
  ```ts
  export interface Features { online: boolean; endless: boolean; daily: boolean; shop: boolean; leaderboard: boolean; transfer: boolean; firstRunPick: boolean }
  export const FEATURES: Features;            // v8: all true except firstRunPick=false
  export const SAVE_PREFIX: string;            // v8 'laserescape'
  export const COPY: Readonly<Record<CopyKey, string>>; // CopyKey = keyof typeof V8_COPY
  export function runSeedFor(stage: StageDef): number; // v8: stage.seed
  ```
- Produces `build/swap-modules.ts`: `export function swapModules(map: Record<string, string>): Plugin` — keys/values are repo-relative paths; redirects any import whose resolved id equals a key.
- Office swap map (single source of truth, exported as `OFFICE_SWAPS` from `vite.office.config.ts`): `src/flavor.ts`, `src/core/content.ts`, `src/core/boss.ts`, `src/core/cutscenes.ts`, `src/game/boss-lines.ts`, `src/render/agent.ts`, the hazard-drawing module(s) under `src/render/` (Task 5 names them), `src/audio/music.ts` → `src/office/<same relative path>`.

- [ ] Step 1: write `tests/office/swap.test.ts`: for each `OFFICE_SWAPS` pair, dynamically import both and assert `Object.keys(office).sort()` ⊇ `Object.keys(v8).sort()` (office may add, never drop). Write `tests/core/flavor.test.ts`: v8 `SAVE_PREFIX === 'laserescape'`, `SAVE_KEY === 'laserescape.save.v2'`, `runSeedFor(stage) === stage.seed`.
- [ ] Step 2: run `npx vitest run tests/office tests/core/flavor.test.ts` → FAIL (modules missing).
- [ ] Step 3: implement flavor seams; move the title/result/HUD/briefing/overlay/loading strings that the office build must change into `V8_COPY` (only strings, behaviour identical). Office flavor: `SAVE_PREFIX='officeescape'`, features off except `firstRunPick=true`, `runSeedFor` = fresh random uint32 per call (app calls it once per run start and keeps it on the session's stage copy).
- [ ] Step 4: office files that later tasks own start as re-exports of the v8 module (`export * from '../core/content'` etc.) so the build works from day one.
- [ ] Step 5: `npm test` (all pass, golden unchanged) · `npm run build` · `npm run build:office` → `dist/office/index.html` exists, `grep -r supabase.co dist/office` empty.
- [ ] Step 6: commit `feat: office build variant with module swaps and flavor seams`.

### Task 2: Office content — 5 stages, characters, scenes

**Files:**
- Modify: `src/core/campaign.ts` (export `designCustomStage`; v8 output unchanged)
- Create: `src/office/core/content.ts`
- Test: `tests/office/content.test.ts`, existing `tests/core/campaign*.test.ts` untouched and passing

**Interfaces:**
- Consumes `FEATURES`/`COPY` from Task 1.
- Produces `designCustomStage(s: StageShape, moves: readonly MoveId[], intro?: readonly MoveId[]): StageDef` — like `designStage` for kind `'boss'` but with an explicit move list; `intro` moves get `INTRO_FOCUS` shares.
- Produces from `src/office/core/content.ts` every export of `src/core/content.ts` (`WORLDS, DESIGNED_LOOKS, CHAPTERS, CHAPTER_SCENES, sceneFor, transitionFor, SKINS, STAGES, stageById, nextStageId, movesForMix`) plus `export const OFFICE_CLOCK: (stageIndex: number, progress01: number) => string` returning `"HH:MM"` (Task 6 adds seconds on the ending).

Values (from spec §4, §13):

| stage | id | chapter | name | world/variant | moves (new in **bold**) | d |
|---|---|---|---|---|---|---|
| 1 | `w1-s10` | 0 | 12층 기획팀 사무실 | 0 base | **jump, slide, lane** | 0.15 |
| 2 | `w2-s10` | 1 | 탕비실·복합기 복도 | 1 base | jump, slide, lane, **double, drone, drop** | 0.30 |
| 3 | `w3-s10` | 2 | 회의실 층 | 2 base | …, **chaser, high** (ceiling) | 0.45 |
| 4 | `w4-s10` | 3 | 엘리베이터홀·비상계단 | 3 base | …, **triple** | 0.58 |
| 5 | `w5-s10` | 4 | 1층 로비·회전문 | 3 dawn | …, **rear**, all mixed | 0.70 |

(ids keep the `w{n}-s10` form so `bossFor`, progress and stars keep working.) Kind `'boss'`, 3 sections each. SKINS: `{id:'kid',name:'칼퇴준',price:0}`, `{id:'cat',name:'정시원',price:0}`. Briefings = the spec §4 one-liners.

- [ ] Step 1: tests — `STAGES.length===5`; ids as table; each stage's `moves` ⊇ table moves and contains no move first introduced in a later stage; `kind==='boss' && sections===3`; `nextStageId('w5-s10')===null`; `OFFICE_CLOCK(0,0)==='17:30'`, `OFFICE_CLOCK(4,1)==='18:00'`; v8 `buildCampaign(CHAPTERS)` deep-equals a snapshot taken before the change.
- [ ] Step 2: run → FAIL. Step 3: implement. Step 4: run → PASS, `npm test` all green. Step 5: commit `feat(office): five-stage campaign and characters`.

### Task 3: Office bosses — 7 superiors, per-section boss on stage 5, attack variants, events

**Files:**
- Create: `src/office/core/boss.ts`, `src/office/core/events.ts`, `src/office/game/boss-lines.ts`, `src/office/core/cutscenes.ts`
- Test: `tests/office/boss.test.ts`, `tests/office/events.test.ts`, `tests/office/cutscenes.test.ts`

**Interfaces:**
- `src/office/core/boss.ts` exports the v8 surface (`INTRO_LEAD, STAGGER_TIME, ATTACK_LEAD, BOSSES, bossFor, bossView`) plus `OFFICE_BOSSES: readonly OfficeBoss[]` where `interface OfficeBoss { slot: BossId; title: string /*직급*/; name: string /*김대리*/; stage: number; section: 0|1|2|null; catchphrase: string; exitLine: string }`. `bossView` on stage 5 returns the section's boss id and `hp` = 1 − cleared/total **within the current section**.
- `src/office/core/events.ts`:
  ```ts
  export type OfficeEventKind = 'cart' | 'highfive' | 'blackout' | 'fire-drill' | 'broadcast';
  export interface OfficeEvent { kind: OfficeEventKind; beatIndex: number; time: number; duration: number }
  export function planEvents(beats: readonly Beat[], seed: number, stageIndex: number): OfficeEvent[];
  export function attackVariant(slot: BossId, kind: BossAttackKind, seed: number, beatIndex: number): string; // prop id, see Task 5 table
  ```
  Rules: 1–2 events per stage (stage 1: 1, others 2); `cart` only on an existing lane-hazard beat; `fire-drill` only on an existing rear beat (skip if none); `highfive` only on an existing coin pickup beat; `blackout` 1.5 s window starting ≥ `WARN_LEAD` after a hazard-free gap start; `broadcast` any time (copy only). Pure, deterministic in (beats, seed).
- `src/office/game/boss-lines.ts`: same exports as v8 (`BOSS_ATTACKS`, `FINISHER_SLOW`, `finisherStarts`, `phaseLineDue`, …) with office lines (spec §5 table).
- `src/office/core/cutscenes.ts`: same exports as v8; cutscenes `op-start` (2 shots), `boss-1`..`boss-5` (stage 5 = 3 shots 전무/이사/사장), `escape-end` (2 shots, last caption "내일 출근 09:00"); unused v8 ids map to empty/never-played. Images `./art/cut/{op-1,op-2,boss-1-a..boss-5-a,boss-5-b,boss-5-c,end-1,end-2,fail}.webp`.

- [ ] Step 1: tests — 7 bosses with distinct slots and names 김대리/박과장/최팀장/오부장/한전무/윤이사/사장님; `bossView` on stage 5 at a time in section 1 → `id==='apc'` and hp computed on section-1 hazards only (`stage 5 gauge resets per section`); `planEvents` same seed → equal, different seeds over 50 seeds → ≥3 distinct event layouts; every event's beat exists and kind matches its beat; no event when beats lack the required kind; event count per stage as above; blackout window does not start within `WARN_LEAD` of a hazard; `restart uses stage start clock` (OFFICE_CLOCK(n,0) for every n); cutscene images list matches spec.
- [ ] Step 2: run → FAIL. Step 3: implement. Step 4: PASS + `npm test`. Step 5: commit `feat(office): superiors, surprise events, story`.

### Task 4: Higgsfield art (runs in parallel with Tasks 2–3)

**Files:** Create `public-office/art/**` (office `publicDir`), `public-office/art/SOURCES.md`, `public-office/manifest.webmanifest`, icons.

Style prefix for every prompt (spec §8): bright Korean webtoon comic, chibi 2–2.5 head-tall, bold clean outlines, pastel base with neon accents, exaggerated expressions, manga speed lines, no text, fictional company "야근상사", no real logos. Characters: generate one approved reference per character with `nano_banana_flash`, then derive every other frame by image-reference editing for consistency; remove backgrounds with `image_background_remover`; convert to webp (≤ 200 KB each, `cwebp -q 82`).

File contract (names are what the code loads — match `src/render/art.ts`, `boss-art.ts`, `zone-art.ts`, `shop.ts` exactly; check those files for the precise wall/floor/ceiling list):

| group | files |
|---|---|
| heroes | `hero-kid-{run1,run2,run3,run4,jump,slide,hit,win}.webp`, `hero-cat-…` same; portraits `op-kid.webp`, `op-cat.webp` |
| bosses | `boss-{warden,sewer-eye,lab-ai,core,jailer,apc,chimera}.webp` (idle), `…-attack.webp`, `…-tired.webp` |
| scenes | every wall/floor/ceiling/exterior file `art.ts` loads for worlds 0–3 (0 사무실, 1 탕비실·복도, 2 회의실, 3 엘리베이터홀; world 3 dawn exterior = 노을 로비 유리창) |
| cut | `cut/op-1, op-2, boss-1-a … boss-5-a, boss-5-b, boss-5-c, end-1, end-2, fail` |
| cards/title | `zone-1..5.webp`, `title.webp`, `select.webp` |
| props | `prop-{postit,papers,coffee-tray,paper-plane,clipboard,paper-jam,door,whiteboard,pointer,golf,latte-bubble,elevator,doc-tornado,necktie,corp-card,ceo-screen,revolving-door,envelope,cart,robot}.webp` |

- [ ] Step 1: `higgsfield account status` (record balance); `higgsfield generate cost` for the two models; abort and report if projected spend > 300 credits.
- [ ] Step 2: generate character references; save; art-director check (style, cuteness, readable at 120 px).
- [ ] Step 3: generate the rest; record model + prompt per file in SOURCES.md.
- [ ] Step 4: `node -e` check script: every contract file exists, is webp, ≤ 200 KB; heroes/bosses/props have alpha.
- [ ] Step 5: commit `art(office): higgsfield comic set`.

### Task 5: Office rendering — sprite heroes, prop hazards, surprise FX

**Files:**
- Create: `src/office/render/agent.ts` (same exports as `src/render/agent.ts`), office versions of the hazard-drawing module(s) (read `src/render/index.ts`, `hazards.ts`, `lasers.ts` first; swap the smallest module set that draws hazard visuals; add them to `OFFICE_SWAPS`), `src/office/render/surprise.ts`, `src/office/render/clock.ts`
- Test: `tests/office/render-logic.test.ts` (pure helpers only)

**Interfaces:**
- Consumes `attackVariant`, `planEvents`, `OFFICE_BOSSES` (Task 3), `OFFICE_CLOCK` (Task 2), art files (Task 4).
- Produces pure helpers: `heroFrame(state: PlayerState, t: number): HeroFrameId` (run cycles run1–4 at 10 fps; airborne → jump; sliding → slide; hit window → hit; lean ±8° during lane change), `blackoutAlpha(t, event): { scene: number; outline: number }` (scene ≥ 0.75 dark, outline ≥ 0.8), `surpriseKick(t, attackTime): { zoom: number; shake: number }` (0.15 s, peak zoom 1.06).
- Behaviour: hazard geometry and hit boxes unchanged; the prop sprite is drawn over/instead of the laser at the same position and size; the existing "!" warning is still drawn on top. Boss speech bubble shows `catchphrase` at intro and exitLine at defeat. Clock drawn in the top band.

- [ ] Step 1: tests for `heroFrame`, `blackoutAlpha` (`blackout keeps hazard outline alpha ≥ 0.8`), `surpriseKick`.
- [ ] Step 2: FAIL → implement → PASS. Step 3: `npm run build:office`, open in Playwright, screenshot stages 1–5 at mid-run (phone 390×844 and iPad 1024×1366) into the job tmp dir; inspect.
- [ ] Step 4: commit `feat(office): sprite heroes, prop hazards, surprise fx`.

### Task 6: Office UI flow, copy, audio

**Files:**
- Create: `src/office/flavor.ts` (fill COPY), `src/office/audio/music.ts`, `src/office/ui/picker.ts` if the shop screen cannot serve as picker
- Modify: `src/game/app.ts` only through `FEATURES.firstRunPick` (show picker before the first cutscene)
- Test: `tests/office/flavor.test.ts`

**Interfaces:** consumes everything above. Copy (spec §4/§7): start button "퇴근 시작!", result win "퇴근 성공!" (stage 5: "칼퇴 성공! 18:00:00"), fail stamp "야근 확정", retry "내일은 꼭…!", pickups 칼퇴 포인트 / 노캔 이어폰 / 아이스 아메리카노 / 삼각김밥, tutorial lines spoken by 김대리 ("점프는 화면 탭!", "숙이기는 아래로 쓱!", "옆으로 피하기는 좌우로 쓱!").
Music: same synth engine, major key, ~1.15× tempo, bouncy bass; comic sfx via existing synth (boing, thud, elevator ding, stamp).

- [ ] Step 1: tests — every `CopyKey` has a non-empty office value; no office copy contains '작전'/'요원'/'MISSION'.
- [ ] Step 2: FAIL → implement → PASS → `npm test`. Step 3: commit `feat(office): comic copy, picker, music`.

### Task 7: Verification, review, ship

- [ ] Step 1: `tests/office/bot.test.ts` — for each office stage and each of 50 seeds, run `botAction` to the end of the session: all clear (both skins share physics, run once per seed).
- [ ] Step 2: `npm test` (report counts), `npm run build`, `npm run build:office`, golden digest unchanged.
- [ ] Step 3: Playwright e2e (block `supabase.co`, assert 0 requests): open v8 `/` first then `/office/`; picker → 정시원 → op-start → stage 1 tutorial → autoplay stages 1–5 → ending; reload keeps character; fail stage 3 once and retry (clock resets). Screenshots phone + iPad.
- [ ] Step 4: independent code review + art-director review; fix until no findings.
- [ ] Step 5: push branch, open PR (user merges); after merge verify `/tap-rope/` (v8 bundle unchanged behaviour) and `/tap-rope/office/` live.
