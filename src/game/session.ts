/**
 * Pure game-session state machine: advances stage time, physics, judging, hearts,
 * power-ups, section doors (v5: the scene switches at each door) and endless chunk
 * generation. No DOM / audio — side effects are described as GameEvents and performed
 * by the app layer.
 */
import type {
  Beat, Door, GameMode, JudgeResult, LaneDir, LaneId, Mood, ObstacleKind, PhysicsConfig, PlayerState,
  ScoreState, StageDef, Swipe, TransitionKind, Variant, WorldId,
} from '../types';
import { HAZARD_KINDS, WARN_LEAD } from '../types';
import { initialPlayer, moveLane, physicsForWorld, slidePlayer, stepPlayer, swipePlayer, tapPlayer } from '../core/physics';
import { judgeBeat } from '../core/judge';
import { applyJudge, computeStars, initialScore, tickScore } from '../core/scoring';
import { dailyStage, endlessStage, generateStage } from '../core/levels';
import { isSudden } from '../core/timeline';
import { beatShape, gapAfter } from '../core/spacing';

export const MAX_HEARTS = 3;
export const INVULN_TIME = 0.9;
export const SLOW_TIME = 5;
export const SLOW_SCALE = 0.7;
export const LEAD_IN = 2.0;
const END_GRACE = 0.7;
const ENDLESS_LOOKAHEAD = 8;
/**
 * v7 deterministic stepping (GDD-v7 §3.2): session time only ever stops on the TICK grid or on a beat
 * time, both assigned (never accumulated), so the same inputs at the same session times give the same
 * run regardless of frame timing. Inputs are applied between steps, i.e. always at such a boundary.
 */
export const TICK = 1 / 240;
const nextGrid = (t: number): number => (Math.floor(t / TICK + 1e-7) + 1) * TICK;
/** the security door slides open this long before the agent reaches it (GDD v5 §6) */
export const DOOR_OPEN_LEAD = 1.0;
/** endless chunks are joined by a door break at least this long */
const ENDLESS_DOOR_BREAK = 2.4;
const ENDLESS_TRANSITIONS: readonly TransitionKind[] = ['turn', 'stairs', 'elevator'];

export interface TempoChange {
  readonly at: number;
  readonly bpm: number;
  readonly world: WorldId;
  readonly variant: Variant;
}

export type SessionStatus = 'playing' | 'cleared' | 'failed';

export interface Session {
  readonly mode: GameMode;
  readonly stage: StageDef;
  readonly world: WorldId;
  readonly bpm: number; // current music tempo (changes per endless chunk)
  readonly variant: Variant; // look variant (changes per endless chunk)
  readonly tempoQueue: readonly TempoChange[]; // pending endless tempo/world switches
  readonly cfg: PhysicsConfig;
  readonly beats: readonly Beat[];
  readonly cursor: number; // index of the next beat to judge
  readonly time: number;
  readonly player: PlayerState;
  readonly score: ScoreState;
  readonly hearts: number;
  readonly hitsTaken: number;
  readonly shield: boolean;
  readonly slowTime: number;
  readonly invulnTime: number;
  readonly mood: Mood;
  readonly moodTime: number;
  readonly status: SessionStatus;
  readonly hazardTotal: number; // Infinity in endless
  readonly hazardDone: number;
  readonly endlessChunk: number;
  readonly seed: number;
  /** v5: section doors, in time order (endless appends one per chunk) */
  readonly doors: readonly Door[];
  /** v5: doors passed so far = current section (0-based) */
  readonly section: number;
  /** v5: next door whose opening cue has not fired yet */
  readonly doorCue: number;
  /** v5: next beat whose "!" alert cue has not been considered yet */
  readonly alertCue: number;
  /** v7: stage seconds owed to the next step (< TICK) — time is only advanced to whole boundaries */
  readonly lag: number;
}

export type GameEvent =
  | {
    readonly type: 'tap'; readonly action: 'jump' | 'boost' | 'buffered' | 'none'; readonly level: number;
    /** true when a tap during a slide was held back because a slide laser is about to arrive */
    readonly keptSlide?: boolean;
  }
  | { readonly type: 'move'; readonly action: 'slide' | 'dive' | 'none' }
  | { readonly type: 'lane'; readonly action: 'lane' | 'none'; readonly lane: LaneId }
  /** a sudden attack (drop / chaser / rear beam) is WARN_LEAD away */
  | { readonly type: 'alert'; readonly lanes: readonly LaneId[] }
  | { readonly type: 'door'; readonly transition: TransitionKind }
  | { readonly type: 'land' }
  | { readonly type: 'judge'; readonly result: JudgeResult; readonly shielded: boolean }
  | { readonly type: 'hit'; readonly shielded: boolean; readonly hearts: number }
  | { readonly type: 'pickup'; readonly kind: ObstacleKind }
  | { readonly type: 'fever' }
  | { readonly type: 'combo'; readonly combo: number }
  | { readonly type: 'end'; readonly cleared: boolean };

export interface StepOutput {
  readonly session: Session;
  readonly events: readonly GameEvent[];
}

const isHazardBeat = (b: Beat): boolean => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));

/** First downbeat at or after t, so beats line up with the music grid anchored at stage time 0. */
function snapToBeat(t: number, bpm: number): number {
  const beat = 60 / bpm;
  return Math.ceil(t / beat - 1e-9) * beat;
}

export function createSession(mode: GameMode, stage: StageDef | null, opts: { date?: string; seed?: number } = {}): Session {
  const seed = opts.seed ?? 1;
  const def =
    mode === 'stage' && stage ? stage
      : mode === 'daily' ? dailyStage(opts.date ?? '2026-01-01')
        : endlessStage(0, seed);
  const world: WorldId = def.world;
  const cfg = physicsForWorld(world);
  const { beats, doors } = generateStage(def, cfg, snapToBeat(LEAD_IN, def.bpm));
  // the scene switches when the agent passes each door; the music keeps the stage tempo
  const tempoQueue = doors.map((d): TempoChange => ({ at: d.time, bpm: def.bpm, world: d.to.world, variant: d.to.variant }));
  return {
    mode, stage: def, world, bpm: def.bpm, variant: def.variant, tempoQueue, cfg, beats, cursor: 0, time: 0,
    player: initialPlayer(), score: initialScore(), hearts: MAX_HEARTS, hitsTaken: 0,
    shield: false, slowTime: 0, invulnTime: 0, mood: 'idle', moodTime: 0, status: 'playing',
    hazardTotal: mode === 'endless' ? Infinity : beats.filter(isHazardBeat).length,
    hazardDone: 0, endlessChunk: 0, seed, doors, section: 0, doorCue: 0, alertCue: 0, lag: 0,
  };
}

/** a tap this close to a slide laser keeps an ongoing slide (it is the start of a ↓ swipe) */
const SLIDE_KEEP = 0.2;

export function tap(s: Session): StepOutput {
  if (s.status !== 'playing') return { session: s, events: [] };
  const next = s.beats[s.cursor];
  if (s.player.sliding && next?.needsSlide && next.time - s.time < SLIDE_KEEP) {
    return { session: s, events: [{ type: 'tap', action: 'none', level: 0, keptSlide: true }] };
  }
  const { player, action } = tapPlayer(s.player, s.cfg);
  return { session: { ...s, player }, events: [{ type: 'tap', action, level: player.level }] };
}

/** A swipe modifies the touch that started it: ↓ turns a fresh jump into a slide, or dives from the air. */
export function swipe(s: Session, dir: Swipe): StepOutput {
  if (s.status !== 'playing') return { session: s, events: [] };
  const { player, action } = swipePlayer(s.player, dir, s.cfg);
  return { session: { ...s, player }, events: [{ type: 'move', action }] };
}

/** Keyboard ↓: slide (or dive) without a preceding tap. */
export function slide(s: Session): StepOutput {
  if (s.status !== 'playing') return { session: s, events: [] };
  const { player, action } = slidePlayer(s.player, s.cfg);
  return { session: { ...s, player }, events: [{ type: 'move', action }] };
}

/** Left thumb / ↑↓: change lanes (allowed on the floor, in the air and while sliding). */
export function lane(s: Session, dir: LaneDir): StepOutput {
  if (s.status !== 'playing') return { session: s, events: [] };
  const { player, action } = moveLane(s.player, dir);
  return { session: { ...s, player }, events: [{ type: 'lane', action, lane: player.lane }] };
}

function extendEndless(s: Session): Session {
  const last = s.beats[s.beats.length - 1];
  if (s.mode !== 'endless' || !last || last.time - s.time > ENDLESS_LOOKAHEAD) return s;
  const chunk = s.endlessChunk + 1;
  const def = endlessStage(chunk, s.seed);
  const after = last.time + gapAfter(beatShape(last), s.cfg);
  const start = snapToBeat(after + ENDLESS_DOOR_BREAK, def.bpm);
  const fresh = generateStage(def, s.cfg, start).beats;
  const offset = s.beats.length;
  const section = last.section + 1;
  const reIded = fresh.map((b, i) => ({ ...b, id: offset + i, section }));
  // a door in the break between chunks: tempo and look switch when the agent passes it
  const at = (after + start) / 2;
  const prev = s.tempoQueue[s.tempoQueue.length - 1];
  const door: Door = {
    time: at, section, transition: ENDLESS_TRANSITIONS[chunk % ENDLESS_TRANSITIONS.length],
    from: prev ? { world: prev.world, variant: prev.variant } : { world: s.world, variant: s.variant },
    to: { world: def.world, variant: def.variant },
  };
  const change: TempoChange = { at, bpm: def.bpm, world: def.world, variant: def.variant };
  return {
    ...s, beats: [...s.beats, ...reIded], endlessChunk: chunk, tempoQueue: [...s.tempoQueue, change],
    doors: [...s.doors, door],
  };
}

function applyTempo(s: Session): Session {
  const due = s.tempoQueue.filter((c) => c.at <= s.time);
  if (due.length === 0) return s;
  const latest = due[due.length - 1];
  return {
    ...s, bpm: latest.bpm, world: latest.world, variant: latest.variant,
    tempoQueue: s.tempoQueue.filter((c) => c.at > s.time),
    section: s.doors.filter((d) => d.time <= s.time).length,
  };
}

/** Door-opening and sudden-attack "!" cues that became due at the current time. */
function cues(s: Session): Applied {
  const events: GameEvent[] = [];
  let doorCue = s.doorCue;
  while (doorCue < s.doors.length && s.doors[doorCue].time - DOOR_OPEN_LEAD <= s.time + 1e-9) {
    events.push({ type: 'door', transition: s.doors[doorCue].transition });
    doorCue++;
  }
  let alertCue = Math.max(s.alertCue, s.cursor);
  while (alertCue < s.beats.length && s.beats[alertCue].time - WARN_LEAD <= s.time + 1e-9) {
    const sudden = s.beats[alertCue].obstacles.filter(isSudden);
    if (sudden.length > 0) {
      const lanes = [...new Set(sudden.flatMap((o) => o.lanes ?? []))].sort() as LaneId[];
      events.push({ type: 'alert', lanes });
    }
    alertCue++;
  }
  return { s: doorCue === s.doorCue && alertCue === s.alertCue ? s : { ...s, doorCue, alertCue }, events };
}

interface Applied { readonly s: Session; readonly events: GameEvent[] }

function applyPickups(s: Session, kinds: readonly ObstacleKind[]): Applied {
  const events: GameEvent[] = kinds.map((kind) => ({ type: 'pickup', kind }));
  const shield = s.shield || kinds.includes('shield');
  const slowTime = kinds.includes('slow') ? SLOW_TIME : s.slowTime;
  const hearts = kinds.includes('heart') ? Math.min(MAX_HEARTS, s.hearts + 1) : s.hearts;
  return { s: { ...s, shield, slowTime, hearts }, events };
}

function resolveHit(s: Session, raw: JudgeResult): { s: Session; result: JudgeResult; events: GameEvent[] } {
  if (s.invulnTime > 0) {
    return { s, result: { ...raw, grade: 'none', hit: false }, events: [] };
  }
  if (s.shield) {
    const result: JudgeResult = { ...raw, grade: 'good', hit: false };
    return { s: { ...s, shield: false, invulnTime: INVULN_TIME }, result, events: [{ type: 'hit', shielded: true, hearts: s.hearts }] };
  }
  const hearts = s.hearts - 1;
  const next: Session = {
    ...s, hearts, hitsTaken: s.hitsTaken + 1, invulnTime: INVULN_TIME, mood: 'hurt', moodTime: 0.7,
  };
  return { s: next, result: raw, events: [{ type: 'hit', shielded: false, hearts }] };
}

function judgeNext(s0: Session): Applied {
  const beat = s0.beats[s0.cursor];
  const raw = judgeBeat(beat, s0.player);
  const events: GameEvent[] = [];
  const hitRes = raw.hit ? resolveHit(s0, raw) : { s: s0, result: raw, events: [] };
  let s = hitRes.s;
  events.push(...hitRes.events);
  const pick = applyPickups(s, hitRes.result.collected);
  s = pick.s;
  events.push(...pick.events);
  const scored = applyJudge(s.score, hitRes.result);
  if (scored.feverStarted) events.push({ type: 'fever' });
  if (scored.comboMilestone !== null) events.push({ type: 'combo', combo: scored.comboMilestone });
  const shielded = hitRes.events.some((e) => e.type === 'hit' && e.shielded);
  events.push({ type: 'judge', result: hitRes.result, shielded });
  const happy = hitRes.result.grade === 'perfect' && s.mood !== 'hurt';
  s = {
    ...s,
    score: scored.score,
    cursor: s.cursor + 1,
    hazardDone: s.hazardDone + (isHazardBeat(beat) ? 1 : 0),
    mood: happy ? 'happy' : s.mood,
    moodTime: happy ? 0.45 : s.moodTime,
  };
  if (s.hearts <= 0) {
    s = { ...s, status: 'failed', mood: 'hurt', moodTime: 99 };
    events.push({ type: 'end', cleared: false });
  }
  return { s, events };
}

function advance(s: Session, dt: number): Applied {
  const stepped = stepPlayer(s.player, dt, s.cfg);
  const player: PlayerState = stepped.player;
  const events: GameEvent[] = [
    ...(stepped.landed ? [{ type: 'land' } as const] : []),
    ...(stepped.slideStarted ? [{ type: 'move', action: 'slide' } as const] : []),
  ];
  const moodTime = Math.max(0, s.moodTime - dt);
  return {
    s: {
      ...s, player, time: s.time + dt, score: tickScore(s.score, dt),
      invulnTime: Math.max(0, s.invulnTime - dt), slowTime: Math.max(0, s.slowTime - dt),
      moodTime, mood: moodTime > 0 ? s.mood : ambientMood(s),
    },
    events,
  };
}

function ambientMood(s: Session): Mood {
  if (s.score.feverTime > 0) return 'cheer';
  const next = s.beats[s.cursor];
  if (next && next.time - s.time < 0.9 && next.obstacles.some((o) => o.kind === 'drone')) return 'worried';
  return 'idle';
}

function checkClear(s: Session): Applied {
  if (s.mode === 'endless' || s.status !== 'playing' || s.cursor < s.beats.length) return { s, events: [] };
  const last = s.beats[s.beats.length - 1];
  if (last && s.time < last.time + END_GRACE) return { s, events: [] };
  return { s: { ...s, status: 'cleared', mood: 'cheer', moodTime: 99 }, events: [{ type: 'end', cleared: true }] };
}

/**
 * Advance to the last boundary (TICK grid point or beat time) at or before `target` stage time.
 * Judges beats at their exact times. Pure function of (session, target) at boundary granularity.
 */
export function advanceTo(s0: Session, target: number): StepOutput {
  const events: GameEvent[] = [];
  let s = s0;
  while (s.status === 'playing') {
    s = extendEndless(s);
    const beat = s.beats[s.cursor];
    const grid = nextGrid(s.time);
    const boundary = beat && beat.time > s.time && beat.time < grid ? beat.time : grid;
    const due = beat !== undefined && beat.time <= s.time + 1e-12;
    if (!due && boundary > target + 1e-12) break;
    if (!due) {
      const adv = advance(s, boundary - s.time);
      s = applyTempo({ ...adv.s, time: boundary });
      events.push(...adv.events);
      const cue = cues(s);
      s = cue.s;
      events.push(...cue.events);
    }
    const next = s.beats[s.cursor];
    if (next && next.time <= s.time + 1e-12) {
      const j = judgeNext(s);
      s = j.s;
      events.push(...j.events);
    }
    const c = checkClear(s);
    s = c.s;
    events.push(...c.events);
  }
  return { session: s, events };
}

/** Advance by real-time dt (slow-mo is applied here); the remainder below one boundary carries over. */
export function step(s0: Session, realDt: number): StepOutput {
  if (s0.status !== 'playing') return { session: s0, events: [] };
  const scale = s0.slowTime > 0 ? SLOW_SCALE : 1;
  const target = s0.time + s0.lag + Math.min(realDt, 0.1) * scale;
  const out = advanceTo(s0, target);
  const lag = out.session.status === 'playing' ? Math.max(0, target - out.session.time) : 0;
  return { session: { ...out.session, lag }, events: out.events };
}

export function sessionStars(s: Session): number {
  return computeStars(s.score, s.hitsTaken, s.status === 'cleared');
}

export function sessionProgress(s: Session): number {
  if (!Number.isFinite(s.hazardTotal) || s.hazardTotal <= 0) return 0;
  return Math.min(1, s.hazardDone / s.hazardTotal);
}
