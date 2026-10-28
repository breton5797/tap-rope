# 칼퇴근 대작전 v2 (미션 퇴근 + 필 팩) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Turn each office stage into three authored missions (dodge / collect / chase / finale) with visible progress, stamps and grades, and make running, jumping, throwing and props look natural.

**Architecture:** Office-only via the existing build-time module swaps (`build/office-swaps.ts`). New swap `src/office/core/levels.ts` composes a stage from three separately generated parts (the endless-mode stitching pattern). Mission rules are pure functions in `src/office/core/missions.ts`; per-run mission stats live in `src/office/game/missions.ts` and reach the UI/renderer through optional snapshot fields that v8 ignores. Feel fixes live in `src/office/render/*`.

**Tech Stack:** TypeScript 5.9, Vite 8, Vitest 5 (projects v8 / parity / office), Canvas 2D, Playwright, Higgsfield CLI (+ Ludo MCP if chosen).

**Spec:** `docs/superpowers/specs/2026-10-29-office-v2-missions-design.md`

## Global Constraints
- v8 behaviour identical: `tests/core/golden.test.ts` digest unchanged, v8 CSS/bundle free of office strings, every seam defaults to v8 values.
- Do not edit `src/core/judge.ts`, `physics.ts`, `scoring.ts`, `levels.ts`, `spacing.ts`, `specs.ts`, `src/game/replay.ts`.
- One bpm per stage (music anchoring). Parts stitched with a door + the standard break; spacing between the last beat of part k and the first of part k+1 ≥ the generator's minimum gap; a shield pickup before each door as in v8 (`doorSupply`).
- Mission completion never fails a stage; only 체력 0 does. Per-run seed stays fixed at run start; part seeds derive from it.
- Korean comic copy; no spy vocabulary (vocabulary test stays green).
- Art budget this round ≤ 400 Higgsfield credits (+ Ludo if used, report balance).

## Review Focus
1. A collect section with fewer than N+2 collectibles reachable (lane blocked at the pickup beat, level > 1) → mission impossible → Task B test `collect sections place ≥ target+2 level-1 pickups on free lanes`.
2. Retry after failing mid-stage: mission stats and stamps reset; stage result after a later clear shows only that run's stamps → Task B test + Task D e2e.
3. Stage 5: three bosses × three missions — mission card names the right superior; `-tired` frame of the previous boss never lingers into the next section → Task C visual check + Task B test on `missionCardFor(stage, section)`.
4. Throw arc when a hazard is a lane (guard/drop/chaser) or rear beat: no prop should visibly fly from the boss for rear/chaser (they come from behind) → Task C test `launchFor(kind)` returns null for rear/chaser/drop.
5. Low-end frame cost: 8-frame cycle + arcs + confetti must not allocate per frame → Task C: cache frames/paths, reviewer checks.

---

### Task A: Mission composer (core) — owner: foundation

**Files:** Create `src/office/core/missions.ts`, `src/office/core/levels.ts` (swap; add to `build/office-swaps.ts`), `tests/office/missions.test.ts`, `tests/office/levels-parts.test.ts`. Modify `src/office/core/content.ts` (per-part `designCustomStage` inputs), `src/types.ts` (optional fields only).

**Interfaces (produces):**
```ts
export type MissionKind = 'dodge' | 'collect' | 'chase' | 'finale';
export type CollectibleId = 'coupon' | 'docs' | 'cookie' | 'badge' | 'envelope';
export interface MissionSpec { readonly kind: MissionKind; readonly title: string; readonly target: number;
  readonly hazards: number; readonly moves: readonly MoveId[]; readonly focus?: readonly MoveId[];
  readonly density: number; readonly pickupRate: number; readonly collectible?: CollectibleId; readonly line: string /* boss line at start */ }
export const STAGE_MISSIONS: Readonly<Record<string /* stage id */, readonly [MissionSpec, MissionSpec, MissionSpec]>>;
export interface MissionStats { hazardsTotal: number; dodged: number; hits: number; collected: number; finisherClean: boolean }
export function missionProgress(spec: MissionSpec, s: MissionStats): { readonly value: number; readonly target: number; readonly complete: boolean };
export function stageGrade(stamps: readonly boolean[], hits: number): 'S' | 'A' | 'B' | 'C';
export function starsFor(stamps: readonly boolean[]): 1 | 2 | 3;
export const MISSION_BONUS = (stageIndex: number) => 150 * (stageIndex + 1);
```
`src/office/core/levels.ts` exports exactly what `src/core/levels.ts` exports; its `generateStage(stage, cfg, startTime)` builds 3 parts (`designCustomStage` per mission spec, `sections: 1`, seed `hashString(\`${stage.seed}:part${k}\`)`), post-processes collect parts (all pickups → `coin` at level 1 on a free lane; ensure ≥ target+2), forces the finale's last hazard beat to a jump kind (floor/beam), stitches with doors (+ shield before each door), and tags each beat with `part: 0|1|2` (new optional `Beat.part`).

- [ ] Tests first: determinism (same seed → identical beats), stitching invariants (doors count 2, min gap, ascending times, hazardTotal = Σ hazards), collect invariant (Review Focus 1), finale last-beat kind, `missionProgress` for all four kinds at boundaries (dodge 6/8 complete, 5/8 not; collect N−1 not; chase hits 2 ok / 3 not; finale clean+hits≤2), `stageGrade`, `starsFor`.
- [ ] Implement; `npm test`; bot test (`tests/office/bot.test.ts`) still clears 5×50.
- [ ] Commit `feat(office): three-mission stage composer`.

### Task B: Mission state, HUD, stamps, result, map — owner: foundation (after A)

**Files:** Create `src/office/game/missions.ts`, `src/office/ui/mission.ts` (card + chip + stamp DOM), modify `src/office/ui/stages.ts` (stamp dots), `src/ui/result*.ts` via COPY/seams, `src/office/styles/office.css`, `src/game/snapshot.ts` (optional `mission?: MissionView` on RenderSnapshot/HudView; v8 undefined), `src/game/app.ts` only through a flavor hook (`FEATURES.missions`), `src/office/flavor.ts` copy, `src/office/core/achievements.ts` (도장 수집가 15), tests `tests/office/mission-state.test.ts`, `tests/office/result-stamps.test.ts`.

**Interfaces:** `MissionView { index: 0|1|2; kind; title; value; target; complete: boolean; stampAt?: number /* run time when a stamp fired, for FX */; chase?: number /* 0..1 distance */; stamps: readonly (boolean|null)[] }`; `RunSummary.stamps?: boolean[]`, `RunSummary.grade?: 'S'|'A'|'B'|'C'`. Stats derive from `StepOutput` events (hit / hazard resolved / pickup) and the section index.

- [ ] Tests: stats accumulate per section and reset on retry (Review Focus 2); stamp fires exactly once at the door; result grade/stars; `missionCardFor(stage, section)` names the section's superior (Review Focus 3).
- [ ] Mission card (1.6 s, top, non-blocking), HUD chip, chase meter, stamp overlay (「미션 완료!」/「다음 기회에」) with sfx + haptic + bonus points, result 3-stamp row + grade, map stamp dots, copy.
- [ ] Screenshots phone + iPad of card / chip / stamp / result / map; commit `feat(office): mission HUD, stamps, grades`.

### Task C: Feel pack (render) — owner: bosses (parallel with A/B)

**Files:** `src/office/render/{corridor-floor or photo,lasers,hero-frames,agent,props,boss-rigs,boss-throw (new),gadgets,surprise}.ts`, `src/office/render/images.ts` (load `-attack`/`-tired`, pickup + collectible sprites, new frame sets), tests `tests/office/render-logic.test.ts` (+ new pure helpers).

- [ ] F1 floor motion: scrolling textured apron + lane tape; speed lines in 칼퇴 모드 (pure helper for speed-line density).
- [ ] F2 centre flying props on the beam head (test: prop centre x == head x at judge time).
- [ ] F3 run cycle locked to scroll distance: `runFrame(scrollPx, strideLen, frameCount)` (test), supports 4 or 8 frames depending on art present.
- [ ] F4 takeoff stretch / landing squash / dust, jump-level frames (2단 spin, 3단 glide) when art present else rotation cue, slide enter/exit scale (`heroPose(state,t)` tested).
- [ ] F5 boss throws: `launchFor(kind)` (null for rear/chaser/drop), arc from boss hand to the prop's entry point over ATTACK_LEAD, `-attack` frame during wind-up, `-tired` on section end only for that section's boss (Review Focus 3/4 tests).
- [ ] F6 prop life per prop id (spin / glide / roll / wobble; pure `propMotion(id,t)` tested).
- [ ] F7 draw office pickup sprites and the stage collectible for coins in collect parts (`Beat.part` + `STAGE_MISSIONS` lookup), fallback to current icons.
- [ ] Build to tmp outDir; Playwright video → GIF + contact sheets for run / jump / slide / throw; look at them; commit `feat(office): feel pack — floor motion, throws, run cycle, prop life`.

### Task D: Art — owner: art (parallel)
- [ ] Decide tool from the test (autosprite vs Ludo). Produce hero sets (run 8, jump 4, slide 2, hit 2, win 2 ×2 heroes), boss sets (idle 2, throw 3 ×7), pickups 4, collectibles 5, all with the file contract agreed with Task C (names: `hero-<id>-run1..8`, `hero-<id>-jump-{launch,apex,spin,glide}`, `hero-<id>-slide-{in,hold}`, `boss-<slot>-idle2`, `boss-<slot>-throw1..3`, `pickup-{coin,shield,slow,heart}`, `collect-{coupon,docs,cookie,badge,envelope}`), ≤200 KB, alpha, feet bottom-centre. Floors regenerated with visible seams/tape (F1) if the renderer needs texture rather than procedural tape.
- [ ] Inspect every strip; update SOURCES.md; report credits.

### Task E: Verification & ship — lead + foundation
- [ ] `npm test` all projects; golden unchanged; bot 5×50.
- [ ] Full e2e phone + iPad incl. mission flow checks; GIF review by lead and art director.
- [ ] Independent code review → fix → re-review until APPROVE.
- [ ] PR → user merges → live check of both URLs.
