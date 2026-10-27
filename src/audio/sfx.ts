// Procedural sound effects (v6 realistic tone). Each recipe schedules a few short voices at `t`.
import type { SfxName } from '../types';
import { midiToFreq, noise, tone } from './synth';

type Recipe = (ctx: BaseAudioContext, out: AudioNode, t: number, level: number) => void;

/** A held chord of filtered voices (stingers). */
const chord = (ctx: BaseAudioContext, out: AudioNode, t: number, midis: readonly number[], dur: number, type: OscillatorType, gain: number, cut: number): void => {
  midis.forEach((m, i) => {
    tone(ctx, out, { type, freq: midiToFreq(m), start: t, dur, gain, attack: 0.012, filter: cut, filterEnd: cut * 0.35, detune: i % 2 ? 6 : -6 });
  });
};

/** Low body hit under stingers / impacts. */
const thump = (ctx: BaseAudioContext, out: AudioNode, t: number, gain: number, dur = 0.3): void => {
  tone(ctx, out, { type: 'sine', freq: 92, freqEnd: 36, start: t, dur, gain, attack: 0.002 });
  noise(ctx, out, { start: t, dur: 0.06, gain: gain * 0.35, type: 'lowpass', freq: 450 });
};

/** Irregular electric crackle: short resonant noise bursts. */
const crackle = (ctx: BaseAudioContext, out: AudioNode, t: number, offsets: readonly number[], freq: number, gain: number): void => {
  offsets.forEach((dt, i) => noise(ctx, out, { start: t + dt, dur: 0.018 + (i % 3) * 0.008, gain, type: 'bandpass', freq: freq * (1 + (i % 4) * 0.18), q: 3 }));
};

const RECIPES: Readonly<Record<SfxName, Recipe>> = {
  // cloth swish + foot push; higher jump levels push a little harder
  jump: (ctx, out, t, level) => {
    const k = 1 + 0.15 * Math.max(0, Math.min(3, level) - 1);
    noise(ctx, out, { start: t, dur: 0.15, gain: 0.15 * k, type: 'bandpass', freq: 800, freqEnd: 2600 * k, q: 0.8 });
    tone(ctx, out, { type: 'sine', freq: 120, freqEnd: 58, start: t, dur: 0.07, gain: 0.26 });
    noise(ctx, out, { start: t, dur: 0.035, gain: 0.08, type: 'lowpass', freq: 600 });
  },
  // mid-air push: a sharper, brighter swish
  boost: (ctx, out, t, level) => {
    const k = 1 + 0.1 * Math.max(0, Math.min(3, level) - 2);
    noise(ctx, out, { start: t, dur: 0.12, gain: 0.17, type: 'bandpass', freq: 1500 * k, freqEnd: 5200 * k, q: 1.3 });
    tone(ctx, out, { type: 'sine', freq: 170, freqEnd: 90, start: t, dur: 0.05, gain: 0.1 });
  },
  // heavy footstep: low thud + floor grit
  land: (ctx, out, t) => {
    tone(ctx, out, { type: 'sine', freq: 96, freqEnd: 40, start: t, dur: 0.15, gain: 0.48 });
    noise(ctx, out, { start: t, dur: 0.09, gain: 0.22, type: 'lowpass', freq: 320 });
    noise(ctx, out, { start: t, dur: 0.03, gain: 0.05, type: 'bandpass', freq: 1900, q: 1 });
  },
  // clean HUD confirm: two quick sine tones a fifth apart
  perfect: (ctx, out, t) => {
    tone(ctx, out, { type: 'sine', freq: midiToFreq(88), start: t, dur: 0.08, gain: 0.11, attack: 0.002 });
    tone(ctx, out, { type: 'sine', freq: midiToFreq(95), start: t + 0.045, dur: 0.13, gain: 0.08, attack: 0.002 });
  },
  good: (ctx, out, t) => {
    tone(ctx, out, { type: 'triangle', freq: midiToFreq(83), start: t, dur: 0.09, gain: 0.1, attack: 0.002, filter: 4000 });
  },
  // electric shock: distorted buzz, crackle, body hit
  hit: (ctx, out, t) => {
    thump(ctx, out, t, 0.5, 0.32);
    tone(ctx, out, { type: 'sawtooth', freq: 96, freqEnd: 60, start: t, dur: 0.3, gain: 0.16, drive: 0.8, filter: 3800, filterEnd: 600 });
    crackle(ctx, out, t, [0, 0.022, 0.05, 0.065, 0.11, 0.16, 0.21], 3400, 0.17);
  },
  // metallic pickup click: two bright resonant ticks
  coin: (ctx, out, t) => {
    noise(ctx, out, { start: t, dur: 0.035, gain: 0.5, type: 'bandpass', freq: 4300, q: 14 });
    tone(ctx, out, { type: 'square', freq: 3150, start: t, dur: 0.02, gain: 0.03, filter: 8000 });
    noise(ctx, out, { start: t + 0.04, dur: 0.05, gain: 0.32, type: 'bandpass', freq: 5900, q: 16 });
  },
  // servo charge-up, then a short confirm
  powerup: (ctx, out, t) => {
    tone(ctx, out, { type: 'sawtooth', freq: 180, freqEnd: 620, start: t, dur: 0.34, gain: 0.07, filter: 900, filterEnd: 3200, q: 3 });
    noise(ctx, out, { start: t, dur: 0.34, gain: 0.05, type: 'bandpass', freq: 1200, freqEnd: 5000, q: 2 });
    tone(ctx, out, { type: 'sine', freq: midiToFreq(81), start: t + 0.32, dur: 0.16, gain: 0.1 });
  },
  // tactical blip; each tier steps up a semitone (capped)
  combo: (ctx, out, t, level) => {
    const f = midiToFreq(79 + Math.min(7, Math.max(0, level - 1)));
    tone(ctx, out, { type: 'sine', freq: f, start: t, dur: 0.06, gain: 0.1, attack: 0.002 });
    tone(ctx, out, { type: 'square', freq: f, start: t + 0.065, dur: 0.05, gain: 0.025, filter: 3000 });
  },
  // low riser into the fever layer
  fever: (ctx, out, t) => {
    tone(ctx, out, { type: 'sawtooth', freq: 55, freqEnd: 110, start: t, dur: 0.75, gain: 0.09, attack: 0.2, filter: 220, filterEnd: 2600, q: 5 });
    noise(ctx, out, { start: t, dur: 0.75, gain: 0.09, type: 'bandpass', freq: 400, freqEnd: 6500, q: 1.5 });
  },
  // mission complete: low minor stinger over a body hit
  clear: (ctx, out, t) => {
    thump(ctx, out, t, 0.5, 0.5);
    chord(ctx, out, t, [33, 40, 45, 52, 57], 1.3, 'sawtooth', 0.045, 1400);
    tone(ctx, out, { type: 'sine', freq: midiToFreq(76), start: t + 0.05, dur: 1.1, gain: 0.035, attack: 0.02 });
  },
  // mission failed: descending low drone
  fail: (ctx, out, t) => {
    tone(ctx, out, { type: 'sawtooth', freq: 110, freqEnd: 52, start: t, dur: 1.2, gain: 0.1, filter: 800, filterEnd: 160 });
    tone(ctx, out, { type: 'sawtooth', freq: 116, freqEnd: 55, start: t, dur: 1.2, gain: 0.08, filter: 800, filterEnd: 160 });
    thump(ctx, out, t, 0.4, 0.45);
    noise(ctx, out, { start: t, dur: 0.8, gain: 0.06, type: 'lowpass', freq: 260 });
  },
  // UI tick
  click: (ctx, out, t) => {
    tone(ctx, out, { type: 'square', freq: 2300, start: t, dur: 0.012, gain: 0.05, filter: 6000 });
    noise(ctx, out, { start: t, dur: 0.014, gain: 0.05, type: 'highpass', freq: 6500 });
  },
  // countdown beep; level <= 0 = GO (longer, higher, with a low hit)
  count: (ctx, out, t, level) => {
    const go = level <= 0;
    tone(ctx, out, { type: 'sine', freq: midiToFreq(go ? 88 : 81), start: t, dur: go ? 0.36 : 0.09, gain: 0.13, attack: 0.002 });
    tone(ctx, out, { type: 'square', freq: midiToFreq(go ? 88 : 81), start: t, dur: go ? 0.2 : 0.06, gain: 0.02, filter: 2500 });
    if (go) thump(ctx, out, t, 0.35, 0.3);
  },
  // knee slide: fabric/floor scrape with a low rumble
  slide: (ctx, out, t) => {
    noise(ctx, out, { start: t, dur: 0.34, gain: 0.3, type: 'bandpass', freq: 2300, freqEnd: 800, q: 0.9 });
    noise(ctx, out, { start: t, dur: 0.3, gain: 0.09, type: 'lowpass', freq: 420 });
  },
  // low two-tone alarm (rear laser warning)
  warn: (ctx, out, t) => {
    [0, 0.18].forEach((dt, i) => {
      tone(ctx, out, { type: 'sawtooth', freq: i ? 330 : 440, start: t + dt, dur: 0.16, gain: 0.08, filter: 1400, attack: 0.006 });
    });
  },
  // sudden-attack "!" chirp: short, sharp and rising, distinct from warn
  alert: (ctx, out, t) => {
    [0, 0.08].forEach((dt) => {
      tone(ctx, out, { type: 'square', freq: 1150, freqEnd: 1500, start: t + dt, dur: 0.06, gain: 0.06, filter: 4200, attack: 0.002 });
      tone(ctx, out, { type: 'sine', freq: 1150, freqEnd: 1500, start: t + dt, dur: 0.06, gain: 0.08, attack: 0.002 });
    });
  },
  // laser emitter sizzle
  zap: (ctx, out, t) => {
    tone(ctx, out, { type: 'sawtooth', freq: 60, start: t, dur: 0.24, gain: 0.08, drive: 0.6, filter: 6000, filterEnd: 1500 });
    crackle(ctx, out, t, [0, 0.03, 0.07, 0.12, 0.17], 5200, 0.1);
  },
  // prisoner rescued: resolved low major stinger
  rescue: (ctx, out, t) => {
    thump(ctx, out, t, 0.45, 0.5);
    chord(ctx, out, t, [36, 43, 48, 52, 55], 1.5, 'sawtooth', 0.04, 1600);
    tone(ctx, out, { type: 'sine', freq: midiToFreq(79), start: t + 0.12, dur: 1.2, gain: 0.035, attack: 0.03 });
  },
  // lane change: air cut whoosh; level = target lane (0 far … 2 near) lowers the pitch toward the camera
  lane: (ctx, out, t, level) => {
    const k = Math.pow(0.88, Math.max(0, Math.min(2, level)));
    noise(ctx, out, { start: t, dur: 0.14, gain: 0.42, type: 'bandpass', freq: 700 * k, freqEnd: 2800 * k, q: 1.4 });
  },
  // v7 boss arrival: detuned low brass/synth roar over a sub drop
  'boss-intro': (ctx, out, t) => {
    [33, 40, 45].forEach((m, i) =>
      tone(ctx, out, { type: 'sawtooth', freq: midiToFreq(m), freqEnd: midiToFreq(m) * 0.94, start: t + i * 0.02, dur: 1.6, gain: 0.07, attack: 0.18, filter: 380, filterEnd: 1400, q: 3, drive: 0.4, detune: i % 2 ? 9 : -9 }),
    );
    tone(ctx, out, { type: 'sine', freq: 62, freqEnd: 30, start: t, dur: 1.8, gain: 0.5, attack: 0.05 });
    noise(ctx, out, { start: t, dur: 1.2, gain: 0.06, type: 'bandpass', freq: 300, freqEnd: 1200, q: 0.9 });
  },
  // v7 boss charge-up telegraph: rising whine with a resonant filter climb
  'boss-charge': (ctx, out, t) => {
    tone(ctx, out, { type: 'sawtooth', freq: 180, freqEnd: 1450, start: t, dur: 1.05, gain: 0.05, attack: 0.2, filter: 600, filterEnd: 6000, q: 8 });
    tone(ctx, out, { type: 'sine', freq: 360, freqEnd: 2900, start: t, dur: 1.05, gain: 0.025, attack: 0.3 });
    noise(ctx, out, { start: t + 0.3, dur: 0.75, gain: 0.03, type: 'highpass', freq: 3000, freqEnd: 9000 });
  },
  // v7 phase break: metal impact + scattered debris
  'boss-stagger': (ctx, out, t) => {
    thump(ctx, out, t, 0.55, 0.45);
    noise(ctx, out, { start: t, dur: 0.25, gain: 0.12, type: 'bandpass', freq: 1800, q: 6 });
    noise(ctx, out, { start: t, dur: 0.4, gain: 0.06, type: 'bandpass', freq: 3100, q: 12 });
    crackle(ctx, out, t + 0.08, [0, 0.05, 0.11, 0.16, 0.24, 0.31, 0.42], 2600, 0.05);
  },
  // v7 boss destroyed: explosion body, crackle, long low tail
  'boss-down': (ctx, out, t) => {
    noise(ctx, out, { start: t, dur: 0.9, gain: 0.25, type: 'lowpass', freq: 2400, freqEnd: 180 });
    tone(ctx, out, { type: 'sine', freq: 70, freqEnd: 24, start: t, dur: 2.4, gain: 0.6, attack: 0.004 });
    crackle(ctx, out, t + 0.12, [0, 0.07, 0.15, 0.26, 0.38, 0.55, 0.7], 1500, 0.07);
    chord(ctx, out, t + 0.3, [33, 40], 2.2, 'sawtooth', 0.035, 500);
  },
  // v7 achievement: short two-note tactical chime
  achieve: (ctx, out, t) => {
    tone(ctx, out, { type: 'sine', freq: midiToFreq(83), start: t, dur: 0.18, gain: 0.12, attack: 0.003 });
    tone(ctx, out, { type: 'sine', freq: midiToFreq(90), start: t + 0.09, dur: 0.42, gain: 0.11, attack: 0.003 });
    tone(ctx, out, { type: 'triangle', freq: midiToFreq(78), start: t + 0.09, dur: 0.42, gain: 0.04, filter: 3000 });
  },
  // blast door: hydraulic pump, steam hiss, heavy clunk
  door: (ctx, out, t) => {
    tone(ctx, out, { type: 'sawtooth', freq: 68, freqEnd: 96, start: t, dur: 0.45, gain: 0.08, filter: 420, attack: 0.05 });
    noise(ctx, out, { start: t + 0.05, dur: 0.6, gain: 0.12, type: 'highpass', freq: 4200, freqEnd: 2400 });
    thump(ctx, out, t + 0.45, 0.5, 0.24);
    noise(ctx, out, { start: t + 0.45, dur: 0.05, gain: 0.08, type: 'bandpass', freq: 1300, q: 4 });
  },
  // v7.1 placeholders (GDD-v7.1 §5 replaces them with layered recipes)
  shield: (ctx, out, t) => noise(ctx, out, { start: t, dur: 0.3, gain: 0.12, type: 'highpass', freq: 3000 }),
  graze: (ctx, out, t) => noise(ctx, out, { start: t, dur: 0.12, gain: 0.06, type: 'bandpass', freq: 5200, q: 3 }),
  bump: (ctx, out, t) => thump(ctx, out, t, 0.2, 0.12),
};

export function playSfx(ctx: BaseAudioContext, out: AudioNode, name: SfxName, level: number): void {
  RECIPES[name](ctx, out, ctx.currentTime + 0.005, level);
}
