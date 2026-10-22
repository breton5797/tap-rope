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
    tone(ctx, out, { type: 'sine', freq: 180, freqEnd: 40, start: t, dur: 0.32, gain: 0.55 });
    tone(ctx, out, { type: 'sawtooth', freq: 110, freqEnd: 55, start: t, dur: 0.22, gain: 0.12, filter: 800 });
    noise(ctx, out, { start: t, dur: 0.22, gain: 0.25, type: 'lowpass', freq: 2400, freqEnd: 300 });
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
  tumble: (ctx, out, t) => {
    noise(ctx, out, { start: t, dur: 0.42, gain: 0.16, type: 'bandpass', freq: 500, freqEnd: 6500, q: 1.4 });
    tone(ctx, out, { type: 'triangle', freq: 300, freqEnd: 1100, start: t, dur: 0.3, gain: 0.18 });
    notes(ctx, out, t + 0.18, [91, 95, 98, 103], 0.04, 'sine', 0.1);
  },
  side: (ctx, out, t) => {
    noise(ctx, out, { start: t, dur: 0.12, gain: 0.14, type: 'bandpass', freq: 2600, freqEnd: 900, q: 1.6 });
    tone(ctx, out, { type: 'sine', freq: 700, freqEnd: 480, start: t, dur: 0.08, gain: 0.08 });
  },
  cross: (ctx, out, t) => {
    [0, 0.055].forEach((dt, i) => {
      tone(ctx, out, { type: 'square', freq: i ? 2100 : 1700, freqEnd: 1200, start: t + dt, dur: 0.03, gain: 0.115, filter: 5000 });
      noise(ctx, out, { start: t + dt, dur: 0.02, gain: 0.1, type: 'highpass', freq: 5000 });
    });
  },
  reverse: (ctx, out, t) => {
    tone(ctx, out, { type: 'triangle', freq: 1300, freqEnd: 380, start: t, dur: 0.18, gain: 0.16 });
    tone(ctx, out, { type: 'square', freq: 650, freqEnd: 190, start: t + 0.03, dur: 0.16, gain: 0.04, filter: 2200 });
    tone(ctx, out, { type: 'sine', freq: midiToFreq(79), start: t + 0.2, dur: 0.1, gain: 0.12 });
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
