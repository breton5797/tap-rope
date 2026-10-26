/** Translates GameEvents into juice: particles, popups, sound and haptics. */
import type { AudioApi, EffectsApi, ObstacleKind } from '../types';
import type { GameEvent } from './session';

export interface Haptics {
  vibrate(p: number | number[]): void;
  setEnabled(on: boolean): void;
}

export interface FeedbackDeps {
  readonly fx: EffectsApi;
  readonly audio: AudioApi;
  readonly haptics: Haptics;
}

const MISS_TEXT: Record<string, string> = {
  drone: '드론에 들켰다! 낮게!',
  level: '더 높이!',
  low: '점프!',
  slide: '점프해야 해요!',
  standing: '슬라이딩! ↓',
  lane: '레인을 바꿔! ↑↓',
};

const PICKUP_TEXT: Partial<Record<ObstacleKind, string>> = {
  shield: '실드 장착!',
  slow: '슬로우 모션!',
  heart: '하트 +1',
};

function onTap(d: FeedbackDeps, e: Extract<GameEvent, { type: 'tap' }>): void {
  if (e.action === 'none' && e.keptSlide) {
    d.haptics.vibrate(6); // the tap was read as the start of a ↓ swipe: keep sliding
    return;
  }
  if (e.action === 'jump') {
    d.audio.sfx('jump', 1);
    d.haptics.vibrate(8);
  } else if (e.action === 'boost') {
    d.audio.sfx('boost', e.level);
    d.fx.burst('sparkle');
    d.haptics.vibrate(14);
  }
}

function onMove(d: FeedbackDeps, e: Extract<GameEvent, { type: 'move' }>): void {
  if (e.action === 'none') return;
  if (e.action === 'slide') {
    d.audio.sfx('slide');
    d.fx.burst('dust');
    d.haptics.vibrate(12);
  } else {
    d.haptics.vibrate(8); // dive: the slide sfx plays when it lands
  }
}

function onJudge(d: FeedbackDeps, e: Extract<GameEvent, { type: 'judge' }>): void {
  const g = e.result.grade;
  if (g === 'perfect') {
    d.fx.popup('PERFECT!', 'perfect');
    d.fx.burst('sparkle');
    d.audio.sfx('perfect');
  } else if (g === 'good') {
    d.fx.popup(e.shielded ? '실드 방어!' : 'GOOD', e.shielded ? 'info' : 'good');
    d.audio.sfx('good');
  } else if (g === 'miss') {
    d.fx.popup(MISS_TEXT[e.result.reason ?? ''] ?? 'MISS', 'miss');
  }
}

function onHit(d: FeedbackDeps, e: Extract<GameEvent, { type: 'hit' }>): void {
  if (e.shielded) {
    d.fx.flash('rgba(120,210,255,0.45)');
    d.fx.burst('powerup');
    d.audio.sfx('powerup');
    d.haptics.vibrate(20);
    return;
  }
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

function onLane(d: FeedbackDeps, e: Extract<GameEvent, { type: 'lane' }>): void {
  if (e.action === 'lane') {
    d.audio.sfx('lane');
    d.haptics.vibrate(6);
  } else {
    d.fx.shake(0.12); // already at the edge lane: a tiny bump
    d.haptics.vibrate(3);
  }
}

/** `quiet` = attract-mode demo: visuals only, no sound/haptics/popups. */
export function playFeedback(d: FeedbackDeps, events: readonly GameEvent[], quiet = false): void {
  for (const e of events) {
    if (quiet) {
      if (e.type === 'land') d.fx.burst('dust');
      continue;
    }
    switch (e.type) {
      case 'tap': onTap(d, e); break;
      case 'move': onMove(d, e); break;
      case 'lane': onLane(d, e); break;
      case 'alert': d.audio.sfx('alert'); d.haptics.vibrate([8, 40, 8]); break;
      case 'door': d.audio.sfx('door'); break;
      case 'land': d.fx.burst('dust'); d.audio.sfx('land'); break;
      case 'judge': onJudge(d, e); break;
      case 'hit': onHit(d, e); break;
      case 'pickup': onPickup(d, e.kind); break;
      case 'fever':
        d.fx.popup('FEVER TIME!', 'combo');
        d.fx.flash('rgba(255,220,90,0.35)');
        d.audio.sfx('fever');
        d.audio.setFever(true);
        d.haptics.vibrate([20, 40, 20]);
        break;
      case 'combo': d.fx.popup(`${e.combo} COMBO!`, 'combo'); d.audio.sfx('combo'); break;
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
