/** Translates GameEvents into juice: particles, popups, sound and haptics. */
import type { AudioApi, Beat, EffectsApi, ImpactOpts, ObstacleKind, StageDef } from '../types';
import type { GameEvent, Session } from './session';

export interface Haptics {
  vibrate(p: number | number[]): void;
  setEnabled(on: boolean): void;
}

/** v7.1 game-clock warp (src/game/timewarp.ts, owned by the app loop) */
export interface TimeApi {
  hitStop(seconds: number): void;
  slowMo(seconds: number, factor: number): void;
}

/** the slice of the session feedback reads to place impacts (beat lookup, lane direction, slow-mo cooldown) */
export type FeedbackView = Pick<Session, 'beats' | 'time'> & {
  readonly stage: Pick<StageDef, 'kind'>;
  readonly player: Pick<Session['player'], 'lane' | 'laneFrom'>;
};

export interface FeedbackDeps {
  readonly fx: EffectsApi;
  readonly audio: AudioApi;
  readonly haptics: Haptics;
  readonly time?: TimeApi;
  readonly view?: () => FeedbackView;
}

const HIT_STOP = 0.07;
const SLOW = { seconds: 0.2, factor: 0.55, cooldown: 3 } as const;
const PAN = 0.6;
const LOW: readonly ObstacleKind[] = ['floor', 'beam'];
const HIGH: readonly ObstacleKind[] = ['high', 'ceiling'];
const SIDE: readonly ObstacleKind[] = ['guard', 'drop', 'chaser', 'drone'];

/** per-deps memory across event batches: level of the jump in the air, last slow motion (session time) */
interface Memo { air: number; lastSlow: number }
const memos = new WeakMap<FeedbackDeps, Memo>();
const memo = (d: FeedbackDeps): Memo => {
  let m = memos.get(d);
  if (!m) {
    m = { air: 1, lastSlow: -Infinity };
    memos.set(d, m);
  }
  return m;
};

function zoneOf(b: Beat): ImpactOpts['zone'] | null {
  const kinds = b.obstacles.map((o) => o.kind);
  if (kinds.some((k) => SIDE.includes(k))) return 'side';
  if (kinds.some((k) => HIGH.includes(k))) return 'high';
  if (kinds.some((k) => LOW.includes(k))) return 'low';
  return null;
}

const findBeat = (v: FeedbackView, id: number): Beat | undefined => (v.beats[id]?.id === id ? v.beats[id] : v.beats.find((b) => b.id === id));

const MISS_TEXT: Record<string, string> = {
  drone: 'DETECTED · 고도 낮춰',
  level: 'MISS · 고도 부족',
  low: 'MISS · 점프',
  slide: 'MISS · 점프 구간',
  standing: 'MISS · 슬라이딩',
  lane: 'MISS · 레인 이탈',
};

const PICKUP_TEXT: Partial<Record<ObstacleKind, string>> = {
  shield: '방탄 실드 확보',
  slow: '시간 감속',
  heart: '방탄판 +1',
};

function onTap(d: FeedbackDeps, e: Extract<GameEvent, { type: 'tap' }>): void {
  if (e.action === 'none' && e.keptSlide) {
    d.haptics.vibrate(6); // the tap was read as the start of a ↓ swipe: keep sliding
    return;
  }
  if (e.action === 'jump') {
    memo(d).air = 1;
    d.fx.impact('jump', { level: 1 });
    d.audio.sfx('jump', 1);
    d.haptics.vibrate(8);
  } else if (e.action === 'boost') {
    memo(d).air = e.level;
    d.fx.impact('boost', { level: e.level });
    d.audio.sfx('boost', e.level);
    d.fx.burst('sparkle');
    d.haptics.vibrate(14);
  }
}

/** landing: the impact (and its sound) scale with the level of the jump that ended */
function onLand(d: FeedbackDeps, quiet: boolean): void {
  const m = memo(d);
  const level = m.air;
  m.air = 1;
  d.fx.burst('dust');
  d.fx.impact('land', { level });
  if (!quiet) d.audio.sfx('land', level);
}

function onMove(d: FeedbackDeps, e: Extract<GameEvent, { type: 'move' }>): void {
  if (e.action === 'none') return;
  if (e.action === 'slide') {
    d.fx.impact('slide', {});
    d.audio.sfx('slide');
    d.fx.burst('dust');
    d.haptics.vibrate(12);
  } else {
    d.haptics.vibrate(8); // dive: the slide sfx plays when it lands
  }
}

/** pass / graze impact where the obstacle was, and slow motion for the showpiece dodges */
function onPass(d: FeedbackDeps, beatId: number, perfect: boolean): void {
  const v = d.view?.();
  const b = v ? findBeat(v, beatId) : undefined;
  if (!v || !b) return;
  const zone = zoneOf(b);
  if (!zone) return;
  d.fx.impact(perfect ? 'graze' : 'pass', { zone, level: b.requiredLevel });
  if (!perfect) return;
  d.audio.sfx('graze', Math.max(1, b.requiredLevel));
  const m = memo(d);
  if (v.time < m.lastSlow) m.lastSlow = -Infinity; // a new run started
  const showpiece = b.requiredLevel === 3 || (v.stage.kind === 'boss' && zone !== 'low');
  if (showpiece && v.time - m.lastSlow >= SLOW.cooldown) {
    m.lastSlow = v.time;
    d.time?.slowMo(SLOW.seconds, SLOW.factor);
  }
}

function onJudge(d: FeedbackDeps, e: Extract<GameEvent, { type: 'judge' }>): void {
  const g = e.result.grade;
  if (g === 'perfect' || (g === 'good' && !e.shielded)) onPass(d, e.result.beatId, g === 'perfect');
  if (g === 'perfect') {
    d.fx.popup('PERFECT', 'perfect');
    d.fx.burst('sparkle');
    d.audio.sfx('perfect');
  } else if (g === 'good') {
    d.fx.popup(e.shielded ? 'BLOCKED · 실드' : 'GOOD', e.shielded ? 'info' : 'good');
    d.audio.sfx('good');
  } else if (g === 'miss') {
    d.fx.popup(MISS_TEXT[e.result.reason ?? ''] ?? 'MISS', 'miss');
  }
}

function onHit(d: FeedbackDeps, e: Extract<GameEvent, { type: 'hit' }>): void {
  if (e.shielded) {
    d.fx.impact('shield', {});
    d.fx.flash('rgba(120,210,255,0.45)');
    d.fx.burst('powerup');
    d.audio.sfx('shield');
    d.haptics.vibrate(20);
    return;
  }
  d.fx.impact('hit', {});
  d.time?.hitStop(HIT_STOP);
  d.fx.shake(0.75);
  d.fx.flash('rgba(255,70,70,0.45)');
  d.fx.burst('hit');
  d.audio.sfx('zap');
  d.haptics.vibrate([40, 30, 70]);
}

function onPickup(d: FeedbackDeps, kind: ObstacleKind): void {
  if (kind === 'coin') {
    d.fx.burst('coin');
    d.audio.sfx('coin');
    return;
  }
  d.fx.burst('powerup');
  d.fx.popup(PICKUP_TEXT[kind] ?? '', 'info');
  d.audio.sfx('powerup');
  d.haptics.vibrate(25);
}

function laneDir(d: FeedbackDeps, e: Extract<GameEvent, { type: 'lane' }>): -1 | 1 {
  if (e.action !== 'lane') return e.lane === 0 ? -1 : 1; // bumped the edge it is standing on
  const from = d.view?.().player.laneFrom ?? 1;
  return e.lane < from ? -1 : 1;
}

function onLane(d: FeedbackDeps, e: Extract<GameEvent, { type: 'lane' }>, quiet: boolean): void {
  const dir = laneDir(d, e);
  if (e.action === 'lane') {
    d.fx.impact('lane', { dir });
    if (quiet) return;
    d.audio.sfx('lane', 1, dir * PAN);
    d.haptics.vibrate(6);
  } else {
    d.fx.impact('bump', { dir });
    if (quiet) return;
    d.fx.shake(0.12); // already at the edge lane: a tiny bump
    d.audio.sfx('bump', 1, dir * PAN);
    d.haptics.vibrate(3);
  }
}

/** `quiet` = attract-mode demo: visuals only, no sound/haptics/popups. */
export function playFeedback(d: FeedbackDeps, events: readonly GameEvent[], quiet = false): void {
  for (const e of events) {
    if (quiet) {
      // attract demo: the motion impacts only — no sound, haptics or popups
      if (e.type === 'land') onLand(d, true);
      else if (e.type === 'tap' && e.action === 'jump') { memo(d).air = 1; d.fx.impact('jump', { level: 1 }); }
      else if (e.type === 'tap' && e.action === 'boost') { memo(d).air = e.level; d.fx.impact('boost', { level: e.level }); }
      else if (e.type === 'move' && e.action === 'slide') d.fx.impact('slide', {});
      else if (e.type === 'lane') onLane(d, e, true);
      continue;
    }
    switch (e.type) {
      case 'tap': onTap(d, e); break;
      case 'move': onMove(d, e); break;
      case 'lane': onLane(d, e, false); break;
      case 'alert': d.audio.sfx('alert'); d.haptics.vibrate([8, 40, 8]); break;
      case 'door': d.audio.sfx('door'); break;
      case 'land': onLand(d, false); break;
      case 'judge': onJudge(d, e); break;
      case 'hit': onHit(d, e); break;
      case 'pickup': onPickup(d, e.kind); break;
      case 'fever':
        d.fx.popup('OVERDRIVE', 'combo');
        d.fx.flash('rgba(255,220,90,0.35)');
        d.audio.sfx('fever');
        d.audio.setFever(true);
        d.haptics.vibrate([20, 40, 20]);
        break;
      case 'combo': d.fx.popup(`x${e.combo} CHAIN`, 'combo'); d.audio.sfx('combo'); break;
      case 'end':
        if (e.cleared) {
          d.fx.burst('confetti');
          d.audio.sfx('clear');
        } else {
          d.audio.sfx('fail');
        }
        break;
    }
  }
}
