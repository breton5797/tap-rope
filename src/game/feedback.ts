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
  bird: '너무 높아요!',
  level: '더 높이!',
  cross: '엇걸어! ✕',
  dir: '방향이 반대예요!',
  tumble: '덤블링으로! ↑',
  ball: '공을 피해요!',
};

const PICKUP_TEXT: Partial<Record<ObstacleKind, string>> = {
  shield: '실드 장착!',
  slow: '슬로우 모션!',
  heart: '하트 +1',
};

function onTap(d: FeedbackDeps, e: Extract<GameEvent, { type: 'tap' }>): void {
  if (e.action === 'jump') {
    d.audio.sfx('jump', 1);
    d.haptics.vibrate(8);
  } else if (e.action === 'boost') {
    d.audio.sfx('boost', e.level);
    d.fx.burst('sparkle');
    d.haptics.vibrate(14);
  }
}

function onSwipe(d: FeedbackDeps, e: Extract<GameEvent, { type: 'swipe' }>, backward: boolean): void {
  if (e.action === 'none') return;
  d.audio.sfx(e.action);
  d.haptics.vibrate(e.action === 'tumble' ? 24 : 12);
  if (e.action === 'tumble') d.fx.burst('sparkle');
  if (e.action === 'reverse') d.fx.popup(backward ? '뒤로넘기 ↺' : '앞으로 ↻', 'info');
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
  d.audio.sfx('hit');
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

/**
 * `quiet` = attract-mode demo: visuals only, no sound/haptics/popups.
 * `backward` = the player's 뒤로넘기 state after these events (for the reverse popup).
 */
export function playFeedback(d: FeedbackDeps, events: readonly GameEvent[], quiet = false, backward = false): void {
  for (const e of events) {
    if (quiet) {
      if (e.type === 'land') d.fx.burst('dust');
      continue;
    }
    switch (e.type) {
      case 'tap': onTap(d, e); break;
      case 'swipe': onSwipe(d, e, backward); break;
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
