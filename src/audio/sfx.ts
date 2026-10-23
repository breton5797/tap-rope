// Procedural sound effects. Each recipe schedules a few short voices at `t`.
import type { SfxName } from '../types';
import { midiToFreq, noise, tone } from './synth';

type Recipe = (ctx: BaseAudioContext, out: AudioNode, t: number, level: number) => void;

const notes = (ctx: BaseAudioContext, out: AudioNode, t: number, midis: readonly number[], step: number, type: OscillatorType, gain: number): void => {
  midis.forEach((m, i) => {
    tone(ctx, out, { type, freq: midiToFreq(m), start: t + i * step, dur: step * 2.4, gain, attack: 0.004 });
  });
};

const RECIPES: Readonly<Record<SfxName, Recipe>> = {
  jump: (ctx, out, t, level) => {
    const base = 420 * Math.pow(1.26, Math.max(0, level - 1));
    tone(ctx, out, { type: 'triangle', freq: base, freqEnd: base * 1.9, start: t, dur: 0.12, gain: 0.32 });
    tone(ctx, out, { type: 'sine', freq: base * 2, freqEnd: base * 3, start: t, dur: 0.06, gain: 0.08 });
  },
  boost: (ctx, out, t, level) => {
    const base = 520 * Math.pow(1.22, Math.max(0, level - 2));
    tone(ctx, out, { type: 'square', freq: base, freqEnd: base * 2.4, start: t, dur: 0.16, gain: 0.09, filter: 3200 });
    noise(ctx, out, { start: t, dur: 0.2, gain: 0.08, type: 'bandpass', freq: 900, freqEnd: 5200, q: 1.2 });
  },
  land: (ctx, out, t) => {
    tone(ctx, out, { type: 'sine', freq: 150, freqEnd: 60, start: t, dur: 0.09, gain: 0.25 });
    noise(ctx, out, { start: t, dur: 0.05, gain: 0.05, type: 'lowpass', freq: 900 });
  },
  perfect: (ctx, out, t) => {
    notes(ctx, out, t, [88, 95], 0.065, 'sine', 0.22);
    notes(ctx, out, t, [76, 83], 0.065, 'triangle', 0.1);
  },
  good: (ctx, out, t) => {
    tone(ctx, out, { type: 'triangle', freq: midiToFreq(81), start: t, dur: 0.18, gain: 0.2 });
  },
  hit: (ctx, out, t) => {
    // electric zap + body thump
    tone(ctx, out, { type: 'sine', freq: 170, freqEnd: 45, start: t, dur: 0.3, gain: 0.5 });
    tone(ctx, out, { type: 'sawtooth', freq: 1600, freqEnd: 70, start: t, dur: 0.26, gain: 0.12, filter: 5000 });
    [0, 0.025, 0.06, 0.1, 0.15].forEach((dt) => noise(ctx, out, { start: t + dt, dur: 0.03, gain: 0.2, type: 'bandpass', freq: 3800, q: 2 }));
  },
  coin: (ctx, out, t) => {
    tone(ctx, out, { type: 'square', freq: midiToFreq(83), start: t, dur: 0.07, gain: 0.08, filter: 6000 });
    tone(ctx, out, { type: 'square', freq: midiToFreq(88), start: t + 0.06, dur: 0.22, gain: 0.08, filter: 6000 });
  },
  powerup: (ctx, out, t) => {
    notes(ctx, out, t, [72, 76, 79, 84, 88], 0.05, 'square', 0.06);
    notes(ctx, out, t, [60, 64, 67, 72], 0.06, 'triangle', 0.12);
  },
  combo: (ctx, out, t, level) => {
    const root = 72 + Math.min(12, Math.max(0, level - 1) * 2);
    notes(ctx, out, t, [root, root + 4, root + 7], 0.055, 'triangle', 0.18);
  },
  fever: (ctx, out, t) => {
    noise(ctx, out, { start: t, dur: 0.6, gain: 0.1, type: 'bandpass', freq: 1200, freqEnd: 9000, q: 2 });
    notes(ctx, out, t + 0.05, [84, 88, 91, 96, 100, 103], 0.045, 'sine', 0.14);
  },
  clear: (ctx, out, t) => {
    notes(ctx, out, t, [72, 76, 79], 0.11, 'square', 0.07);
    tone(ctx, out, { type: 'square', freq: midiToFreq(84), start: t + 0.36, dur: 0.6, gain: 0.08, attack: 0.01, filter: 5000 });
    [60, 64, 67, 72].forEach((m) => tone(ctx, out, { type: 'triangle', freq: midiToFreq(m), start: t + 0.36, dur: 0.7, gain: 0.08 }));
  },
  fail: (ctx, out, t) => {
    notes(ctx, out, t, [67, 63, 60], 0.16, 'triangle', 0.18);
    tone(ctx, out, { type: 'sawtooth', freq: midiToFreq(55), freqEnd: midiToFreq(48), start: t + 0.48, dur: 0.6, gain: 0.08, filter: 900 });
  },
  click: (ctx, out, t) => {
    tone(ctx, out, { type: 'sine', freq: 1500, freqEnd: 900, start: t, dur: 0.035, gain: 0.16 });
  },
  slide: (ctx, out, t) => {
    noise(ctx, out, { start: t, dur: 0.32, gain: 0.2, type: 'bandpass', freq: 3200, freqEnd: 700, q: 1.1 });
    noise(ctx, out, { start: t + 0.04, dur: 0.26, gain: 0.07, type: 'highpass', freq: 6000 });
    tone(ctx, out, { type: 'sine', freq: 420, freqEnd: 160, start: t, dur: 0.16, gain: 0.08 });
  },
  warn: (ctx, out, t) => {
    [0, 0.13].forEach((dt, i) => {
      tone(ctx, out, { type: 'square', freq: i ? 660 : 880, start: t + dt, dur: 0.1, gain: 0.12, filter: 3200, attack: 0.003 });
    });
  },
  zap: (ctx, out, t) => {
    tone(ctx, out, { type: 'sawtooth', freq: 1200, freqEnd: 90, start: t, dur: 0.22, gain: 0.12, filter: 4200 });
    [0, 0.03, 0.07, 0.12].forEach((dt) => noise(ctx, out, { start: t + dt, dur: 0.025, gain: 0.16, type: 'bandpass', freq: 4500, q: 2.5 }));
  },
  rescue: (ctx, out, t) => {
    notes(ctx, out, t, [67, 72, 76, 79], 0.08, 'square', 0.06);
    [60, 64, 67, 72, 76].forEach((m) => tone(ctx, out, { type: 'triangle', freq: midiToFreq(m), start: t + 0.34, dur: 0.9, gain: 0.07, attack: 0.02 }));
    tone(ctx, out, { type: 'sawtooth', freq: midiToFreq(84), start: t + 0.34, dur: 0.7, gain: 0.04, filter: 3800, attack: 0.02 });
    noise(ctx, out, { start: t + 0.34, dur: 0.5, gain: 0.05, type: 'highpass', freq: 8000 });
  },
  count: (ctx, out, t, level) => {
    const go = level <= 0;
    tone(ctx, out, { type: 'square', freq: midiToFreq(go ? 84 : 72), start: t, dur: go ? 0.4 : 0.14, gain: 0.08, filter: 4000 });
    tone(ctx, out, { type: 'sine', freq: midiToFreq(go ? 96 : 84), start: t, dur: go ? 0.35 : 0.1, gain: 0.08 });
  },
};

export function playSfx(ctx: BaseAudioContext, out: AudioNode, name: SfxName, level: number): void {
  RECIPES[name](ctx, out, ctx.currentTime + 0.005, level);
}
