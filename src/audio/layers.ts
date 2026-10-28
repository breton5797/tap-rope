// v7.1 layer building blocks for impact sfx: transient + body + sub + tail (GDD-v7.1 §5).
import { noise, tone } from './synth';

type Ctx = BaseAudioContext;

/** Transient: a 6–20 ms band-limited noise click that gives the attack its edge. */
export const tick = (ctx: Ctx, out: AudioNode, t: number, gain: number, freq = 4200, dur = 0.012): void => {
  noise(ctx, out, { start: t, dur, gain, type: 'bandpass', freq, q: 1.1 });
};

/** Sub: a sine kick gliding down — the weight you feel more than hear. */
export const sub = (ctx: Ctx, out: AudioNode, t: number, gain: number, freq: number, freqEnd: number, dur: number): void => {
  tone(ctx, out, { type: 'sine', freq, freqEnd, start: t, dur, gain, attack: 0.002 });
};

/** Tail: slowly decaying filtered noise standing in for a short room reverb. */
export const tail = (ctx: Ctx, out: AudioNode, t: number, gain: number, dur: number, freq: number, freqEnd?: number): void => {
  noise(ctx, out, { start: t, dur, gain, type: 'lowpass', freq, freqEnd, q: 0.5 });
};

/** Metallic ring: inharmonic sine partials (struck-plate ratios), each decaying a little faster than the last. */
export const ring = (ctx: Ctx, out: AudioNode, t: number, freq: number, gain: number, dur: number, ratios: readonly number[] = [1, 2.76]): void => {
  ratios.forEach((r, i) => {
    tone(ctx, out, { type: 'sine', freq: freq * r, start: t, dur: dur / (1 + i * 0.6), gain: gain / (1 + i * 1.5), attack: 0.002 });
  });
};

/** Rattle: a few tiny resonant clicks (gear, debris, sparks). */
export const rattle = (ctx: Ctx, out: AudioNode, t: number, offsets: readonly number[], freq: number, gain: number, q = 8): void => {
  offsets.forEach((dt, i) => noise(ctx, out, { start: t + dt, dur: 0.014 + (i % 2) * 0.008, gain: gain * (1 - i * 0.18), type: 'bandpass', freq: freq * (1 + (i % 3) * 0.23), q }));
};
