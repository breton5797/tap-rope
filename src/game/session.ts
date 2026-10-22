/**
 * Pure game-session state machine: advances stage time, physics, judging, hearts,
 * power-ups and endless chunk generation. No DOM / audio — side effects are
 * described as GameEvents and performed by the app layer.
 */
import type {
  Beat, GameMode, JudgeResult, Mood, ObstacleKind, PhysicsConfig, PlayerState,
  RopeMode, ScoreState, StageDef, Swipe, WorldId,
} from '../types';
import { HAZARD_KINDS } from '../types';
import { initialPlayer, physicsForWorld, stepPlayer, swipePlayer, tapPlayer } from '../core/physics';
import { judgeBeat } from '../core/judge';
import { applyJudge, computeStars, initialScore, tickScore } from '../core/scoring';
import { dailyStage, endlessStage, generateBeats } from '../core/levels';

export const MAX_HEARTS = 3;
export const INVULN_TIME = 0.9;
export const SLOW_TIME = 5;
export const SLOW_SCALE = 0.7;
export const LEAD_IN = 2.0;
const END_GRACE = 0.7;
const ENDLESS_LOOKAHEAD = 8;
const MAX_STEP = 1 / 30;

export interface TempoChange {
  readonly at: number;
  readonly bpm: number;
  readonly world: WorldId;
  readonly ropeMode: RopeMode;
}

export type SessionStatus = 'playing' | 'cleared' | 'failed';

export interface Session {
  readonly mode: GameMode;
  readonly stage: StageDef;
  readonly world: WorldId;
  readonly bpm: number; // current music tempo (changes per endless chunk)
  readonly ropeMode: RopeMode; // long / solo (changes per endless chunk)
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
}

export type GameEvent =
  | { readonly type: 'tap'; readonly action: 'jump' | 'boost' | 'buffered' | 'none'; readonly level: number }
  | { readonly type: 'swipe'; readonly action: 'tumble' | 'side' | 'cross' | 'reverse' | 'none' }
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
  const beats = generateBeats(def, cfg, snapToBeat(LEAD_IN, def.bpm));
  return {
    mode, stage: def, world, bpm: def.bpm, ropeMode: def.ropeMode, tempoQueue: [], cfg, beats, cursor: 0, time: 0,
    player: initialPlayer(), score: initialScore(), hearts: MAX_HEARTS, hitsTaken: 0,
    shield: false, slowTime: 0, invulnTime: 0, mood: 'idle', moodTime: 0, status: 'playing',
    hazardTotal: mode === 'endless' ? Infinity : beats.filter(isHazardBeat).length,
    hazardDone: 0, endlessChunk: 0, seed,
  };
}

export function tap(s: Session): StepOutput {
  if (s.status !== 'playing') return { session: s, events: [] };
  const { player, action } = tapPlayer(s.player, s.cfg);
  return { session: { ...s, player }, events: [{ type: 'tap', action, level: player.level }] };
}

/** A swipe modifies the jump its touch just started (덤블링 / 옆 이동 / 엇걸어 / 뒤로넘기). */
export function swipe(s: Session, dir: Swipe): StepOutput {
  if (s.status !== 'playing') return { session: s, events: [] };
  const { player, action } = swipePlayer(s.player, dir, s.cfg, s.ropeMode);
  return { session: { ...s, player }, events: [{ type: 'swipe', action }] };
}

function extendEndless(s: Session): Session {
  const last = s.beats[s.beats.length - 1];
  if (s.mode !== 'endless' || !last || last.time - s.time > ENDLESS_LOOKAHEAD) return s;
  const chunk = s.endlessChunk + 1;
  const def = endlessStage(chunk, s.seed);
  const fresh = generateBeats(def, s.cfg, snapToBeat(last.time + 1.2, def.bpm));
  const offset = s.beats.length;
  const reIded = fresh.map((b, i) => ({ ...b, id: offset + i }));
  // switch tempo/world in the quiet gap after the previous chunk's last beat, not at generation time
  const change: TempoChange = { at: last.time + 0.3, bpm: def.bpm, world: def.world, ropeMode: def.ropeMode };
  return { ...s, beats: [...s.beats, ...reIded], endlessChunk: chunk, tempoQueue: [...s.tempoQueue, change] };
}

function applyTempo(s: Session): Session {
  const due = s.tempoQueue.filter((c) => c.at <= s.time);
  if (due.length === 0) return s;
  const latest = due[due.length - 1];
  // 뒤로넘기 only exists on a solo rope: a mode switch starts the new chunk turning forwards
  const player = latest.ropeMode === s.ropeMode ? s.player : { ...s.player, backward: false };
  return {
    ...s, player, bpm: latest.bpm, world: latest.world, ropeMode: latest.ropeMode,
    tempoQueue: s.tempoQueue.filter((c) => c.at > s.time),
  };
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
  const raw = judgeBeat(beat, s0.player, s0.ropeMode);
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

/** A swipe made during a buffered tap modifies the jump that fires on landing. */
function applyPendingSwipe(player: PlayerState, s: Session): { player: PlayerState; events: GameEvent[] } {
  if (!player.pendingSwipe || player.grounded) return { player, events: [] };
  const out = swipePlayer({ ...player, pendingSwipe: null }, player.pendingSwipe, s.cfg, s.ropeMode);
  return { player: out.player, events: [{ type: 'swipe', action: out.action }] };
}

function advance(s: Session, dt: number): Applied {
  const stepped = stepPlayer(s.player, dt, s.cfg);
  const pending = stepped.autoJumped ? applyPendingSwipe(stepped.player, s) : { player: stepped.player, events: [] };
  const player = pending.player;
  const events: GameEvent[] = stepped.landed ? [{ type: 'land' }, ...pending.events] : pending.events;
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
  if (next && next.time - s.time < 0.9 && next.obstacles.some((o) => o.kind === 'bird')) return 'worried';
  return 'idle';
}

function checkClear(s: Session): Applied {
  if (s.mode === 'endless' || s.status !== 'playing' || s.cursor < s.beats.length) return { s, events: [] };
  const last = s.beats[s.beats.length - 1];
  if (last && s.time < last.time + END_GRACE) return { s, events: [] };
  return { s: { ...s, status: 'cleared', mood: 'cheer', moodTime: 99 }, events: [{ type: 'end', cleared: true }] };
}

/** Advance by real-time dt (slow-mo is applied here). Judges beats at their exact times. */
export function step(s0: Session, realDt: number): StepOutput {
  if (s0.status !== 'playing') return { session: s0, events: [] };
  const scale = s0.slowTime > 0 ? SLOW_SCALE : 1;
  const target = s0.time + Math.min(realDt, 0.1) * scale;
  const events: GameEvent[] = [];
  let s = extendEndless(s0);
  while (s.status === 'playing' && s.time < target) {
    const beat = s.beats[s.cursor];
    const until = beat ? Math.min(target, beat.time) : target;
    const dt = Math.min(MAX_STEP, Math.max(0, until - s.time));
    const adv = advance(s, dt > 0 ? dt : 0);
    s = dt > 0 ? applyTempo(adv.s) : s;
    events.push(...(dt > 0 ? adv.events : []));
    if (beat && s.time >= beat.time - 1e-9) {
      const j = judgeNext(s);
      s = j.s;
      events.push(...j.events);
    } else if (dt <= 0) {
      break;
    }
  }
  const c = checkClear(s);
  return { session: c.s, events: [...events, ...c.events] };
}

export function sessionStars(s: Session): number {
  return computeStars(s.score, s.hitsTaken, s.status === 'cleared');
}

export function sessionProgress(s: Session): number {
  if (!Number.isFinite(s.hazardTotal) || s.hazardTotal <= 0) return 0;
  return Math.min(1, s.hazardDone / s.hazardTotal);
}
