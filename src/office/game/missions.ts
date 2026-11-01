/**
 * Office v2 mission tracker (spec §3.3), swapped in for src/game/missions.ts: per-section stats built from the
 * session's events (judge: dodged / hit / collected), a stamp per section when its door is passed (the last
 * one when a cleared run ends), the chase gauge, the stage outcome (grade, stars, stamp bonus) and the best
 * stamps per stage for the map (office-only localStorage key; the v8 save schema is untouched). Immutable:
 * every update returns a new run, so a retry (startMissions again) carries nothing over.
 */
import type { Beat, MissionOutcome, MissionView, StageDef } from '../../types';
import { HAZARD_KINDS } from '../../types';
import type { GameEvent } from '../../game/session';
import { SAVE_PREFIX } from '../../flavor';
import { STAGES } from '../../core/content';
import { bossForSection } from '../../core/boss';
import {
  MISSION_BONUS, STAGE_MISSIONS, missionProgress, stageGrade, starsFor, type MissionKind, type MissionSpec, type MissionStats,
} from '../core/missions';

export interface MissionRun {
  readonly stageId: string;
  readonly stageIndex: number;
  readonly specs: readonly MissionSpec[];
  /** beat id → its part, for hazard beats; pickups are found by their judged `collected` */
  readonly hazardPart: ReadonlyMap<number, number>;
  /** each part's last hazard (the finale's leap) */
  readonly lastHazard: readonly number[];
  readonly stats: readonly MissionStats[];
  readonly chase: readonly number[];
  readonly stamps: readonly (boolean | null)[];
  readonly section: number;
  readonly hits: number;
  /** bonus collectibles (a non-collect part with a collectible: stage 5's 금일봉) picked up */
  readonly items: number;
  readonly stampAt?: number;
  readonly stampOk?: boolean;
}

/** the slice of a session the tracker reads */
export interface MissionSession {
  readonly beats: readonly Beat[];
  readonly section: number;
  readonly time: number;
}

const STAMPS_KEY = `${SAVE_PREFIX}.stamps.v1`;
const CHASE_START = 0.5;
const CHASE_DODGE = 0.05;
const CHASE_HIT = 0.3;
/** 칼퇴 포인트 per bonus collectible (금일봉) */
export const ITEM_BONUS = 20;

const isHazard = (b: Beat): boolean => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const partOf = (b: Beat): number => b.part ?? b.section;

/** a run's missions, or null for stages without a mission script (endless, the menu demo) */
export function startMissions(stage: StageDef | null, beats: readonly Beat[]): MissionRun | null {
  const specs = stage ? STAGE_MISSIONS[stage.id] : undefined;
  if (!stage || !specs) return null;
  const hazards = beats.filter(isHazard);
  const stats = specs.map((_, k): MissionStats => ({
    hazardsTotal: hazards.filter((b) => partOf(b) === k).length, dodged: 0, hits: 0, collected: 0, finisherClean: false,
  }));
  return {
    stageId: stage.id, stageIndex: Math.max(0, STAGES.findIndex((s) => s.id === stage.id)), specs,
    hazardPart: new Map(hazards.map((b) => [b.id, partOf(b)])),
    lastHazard: specs.map((_, k) => hazards.filter((b) => partOf(b) === k).at(-1)?.id ?? -1),
    stats, chase: specs.map(() => CHASE_START), stamps: specs.map(() => null), section: 0, hits: 0, items: 0,
  };
}

function judged(run: MissionRun, ev: Extract<GameEvent, { type: 'judge' }>, section: number): MissionRun {
  const { result, shielded } = ev;
  const hit = result.hit && !shielded;
  const part = run.hazardPart.get(result.beatId);
  const coins = result.collected.filter((k) => k === 'coin').length;
  let stats = run.stats;
  let chase = run.chase;
  let items = run.items;
  const spec = run.specs[section];
  // a collect part's coins are its items; elsewhere a collectible (금일봉) is a bonus item
  if (coins > 0 && spec.kind === 'collect') stats = stats.map((s, k) => (k === section ? { ...s, collected: s.collected + coins } : s));
  else if (coins > 0 && spec.collectible) items += coins;
  if (part !== undefined) {
    stats = stats.map((s, k) => (k !== part ? s : {
      ...s,
      dodged: s.dodged + (hit ? 0 : 1),
      hits: s.hits + (hit ? 1 : 0),
      finisherClean: run.lastHazard[k] === result.beatId ? !hit : s.finisherClean,
    }));
    chase = chase.map((c, k) => (k === part ? clamp01(c + (hit ? -CHASE_HIT : CHASE_DODGE)) : c));
  }
  if (coins === 0 && part === undefined) return run;
  return { ...run, stats, chase, items, hits: run.hits + (hit ? 1 : 0) };
}

/** stamps every unstamped section before `upTo` (exclusive) at `time` */
function stampThrough(run: MissionRun, upTo: number, time: number): MissionRun {
  let stamps = run.stamps;
  let last: boolean | undefined;
  for (let k = 0; k < Math.min(upTo, run.specs.length); k += 1) {
    if (stamps[k] !== null) continue;
    last = missionProgress(run.specs[k], run.stats[k]).complete;
    stamps = stamps.map((v, j) => (j === k ? last ?? false : v));
  }
  return last === undefined ? run : { ...run, stamps, stampAt: time, stampOk: last };
}

/** folds one frame's events in; a passed door stamps the section behind it, a cleared end the last one */
export function trackMissions(run: MissionRun | null, s: MissionSession, events: readonly GameEvent[]): MissionRun | null {
  if (!run) return null;
  let next = run;
  for (const ev of events) {
    if (ev.type === 'judge') next = judged(next, ev, Math.min(s.section, next.specs.length - 1));
    if (ev.type === 'end' && ev.cleared) next = stampThrough(next, next.specs.length, s.time);
  }
  if (s.section > next.section) next = { ...stampThrough(next, s.section, s.time), section: s.section };
  return next;
}

let viewOf: { readonly run: MissionRun; readonly view: MissionView } | null = null;

/** the HUD / renderer view; the same object while the run is unchanged (runs are immutable) */
export function missionView(run: MissionRun | null, _time: number): MissionView | undefined {
  if (!run) return undefined;
  if (viewOf?.run === run) return viewOf.view;
  const view = buildView(run);
  viewOf = { run, view };
  return view;
}

function buildView(run: MissionRun): MissionView {
  const index = Math.min(run.section, run.specs.length - 1);
  const spec = run.specs[index];
  const p = missionProgress(spec, run.stats[index]);
  return {
    index, kind: spec.kind, title: spec.title, value: p.value, target: p.target, complete: p.complete,
    ...(run.stampAt !== undefined ? { stampAt: run.stampAt, stampOk: run.stampOk } : {}),
    ...(spec.kind === 'chase' ? { chase: run.chase[index] } : {}),
    stamps: run.stamps,
  };
}

/** best stamps per stage (map dots), office-only storage */
export function loadStamps(): Record<string, boolean[]> {
  try {
    const raw: unknown = JSON.parse(globalThis.localStorage?.getItem(STAMPS_KEY) ?? '{}');
    if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) return {};
    return Object.fromEntries(Object.entries(raw).filter(([, v]) => Array.isArray(v) && v.every((x) => typeof x === 'boolean'))) as Record<string, boolean[]>;
  } catch {
    return {};
  }
}

function saveBest(stageId: string, stamps: readonly boolean[]): void {
  const all = loadStamps();
  const prev = all[stageId] ?? [];
  const best = stamps.map((v, k) => v || Boolean(prev[k]));
  try {
    globalThis.localStorage?.setItem(STAMPS_KEY, JSON.stringify({ ...all, [stageId]: best }));
  } catch {
    // storage refused (private mode, quota): the map just shows fewer dots
  }
}

/** the run's outcome; a cleared, recorded run also keeps its best stamps for the map */
export function commitMissions(run: MissionRun | null, cleared: boolean, record: boolean): MissionOutcome | null {
  if (!run) return null;
  const done = run.stamps.map((v) => v === true);
  if (cleared && record) saveBest(run.stageId, done);
  // the bonus is given at each door (spec §3.3): stamps already earned are paid on a failed run too
  const stampBonus = done.filter(Boolean).length * MISSION_BONUS(run.stageIndex);
  return {
    stamps: run.stamps.map((v, k) => (k < run.section || v !== null ? v ?? false : null)),
    grade: stageGrade(done, run.hits),
    stars: starsFor(done),
    stampBonus,
    items: run.items,
    bonus: stampBonus + run.items * ITEM_BONUS,
  };
}

export interface MissionCard {
  readonly index: number;
  readonly total: number;
  readonly kind: MissionKind;
  readonly title: string;
  readonly target: number;
  readonly line: string;
  readonly superior: string;
}

/** the card shown as a section starts: which mission, its goal and the section's superior */
export function missionCardFor(stage: StageDef, section: number): MissionCard | null {
  const specs = STAGE_MISSIONS[stage.id];
  const spec = specs?.[section];
  if (!specs || !spec) return null;
  return {
    index: section, total: specs.length, kind: spec.kind, title: spec.title, target: spec.target, line: spec.line,
    superior: bossForSection(stage, section)?.name ?? '',
  };
}
