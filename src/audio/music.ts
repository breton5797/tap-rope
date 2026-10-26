// Procedural dark-synth loop with a look-ahead scheduler (16th-note grid, 4-bar loop).
// Layers: 8th-note bass pulse, low hits (no kick/snare), hi-hat ticks, a slow tension pad,
// a sparse per-theme motif; fever keeps the tempo and adds a 16th arpeggio + open hats.
import type { WorldId } from '../types';
import { midiToFreq, noise, tone } from './synth';

const LOOKAHEAD = 0.12; // seconds scheduled ahead
const TICK_MS = 25;
const STEPS_PER_BAR = 16;
const LOOP_STEPS = STEPS_PER_BAR * 4;

interface Style {
  readonly root: number; // bass root (midi)
  readonly prog: readonly number[]; // semitone offset of each of the 4 bars
  readonly pad: readonly number[]; // pad chord intervals above root + 24
  readonly bassType: OscillatorType;
  readonly bassCut: number; // bass pulse filter peak (sweeps down)
  readonly bassLine: readonly number[]; // semitone offsets cycled over the 8 pulses of a bar
  readonly hits: readonly number[]; // low-hit steps within a bar
  readonly hatEvery: 1 | 2; // 16ths or 8ths
  readonly hatFreq: number;
  readonly padType: OscillatorType;
  readonly padCut: number;
  /** sparse motif across the 4-bar loop: [loop step, midi] */
  readonly motif: readonly (readonly [number, number])[];
  readonly motifType: OscillatorType;
  readonly clank?: readonly number[]; // metallic percussion steps (industrial / prison)
}

/** Per-theme timbre: 0 outpost, 1 lab, 2 prison, 3 industrial. */
const STYLES: Readonly<Record<WorldId, Style>> = {
  0: {
    root: 33, prog: [0, -4, 0, -2], pad: [0, 3, 7], bassType: 'sawtooth', bassCut: 520, bassLine: [0, 0, 12, 0, 0, 0, 7, 0],
    hits: [0, 10], hatEvery: 2, hatFreq: 8500, padType: 'sawtooth', padCut: 900,
    motif: [[6, 69], [38, 72], [46, 71]], motifType: 'sine',
  },
  1: {
    root: 38, prog: [0, -2, -5, -7], pad: [0, 7, 10, 14], bassType: 'square', bassCut: 700, bassLine: [0, 0, 0, 12, 0, 0, 10, 0],
    hits: [0, 8], hatEvery: 1, hatFreq: 10500, padType: 'triangle', padCut: 2200,
    motif: [[2, 86], [14, 81], [34, 86], [46, 84], [58, 81]], motifType: 'sine',
  },
  2: {
    root: 40, prog: [0, 1, 0, -2], pad: [0, 3, 6], bassType: 'sawtooth', bassCut: 420, bassLine: [0, 0, 0, 1, 0, 0, 0, -2],
    hits: [0, 3, 6, 8, 11], hatEvery: 2, hatFreq: 6200, padType: 'sawtooth', padCut: 700,
    motif: [[12, 64], [44, 65]], motifType: 'triangle', clank: [14],
  },
  3: {
    root: 36, prog: [0, -4, -2, -5], pad: [0, 3, 7], bassType: 'sawtooth', bassCut: 600, bassLine: [0, 12, 0, 0, 0, 12, 0, 7],
    hits: [0, 4, 8, 12], hatEvery: 1, hatFreq: 7200, padType: 'square', padCut: 800,
    motif: [], motifType: 'square', clank: [2, 7, 10, 13],
  },
};

export interface Music {
  start(bpm: number, world: WorldId, fromTime: number): void;
  stop(): void;
  setFever(on: boolean): void;
  /** v7: boss stages add a heavier drum layer (same tempo, same loop) */
  setBoss(on: boolean): void;
}

interface Voice {
  readonly ctx: BaseAudioContext;
  readonly out: AudioNode;
}

function rootOf(s: Style, step: number): number {
  return s.root + s.prog[Math.floor(step / STEPS_PER_BAR) % s.prog.length];
}

function percussion(v: Voice, s: Style, inBar: number, t: number): void {
  if (s.hits.includes(inBar)) {
    const strong = inBar === 0 || inBar === 8;
    tone(v.ctx, v.out, { type: 'sine', freq: 78, freqEnd: 36, start: t, dur: strong ? 0.42 : 0.26, gain: strong ? 0.62 : 0.4, attack: 0.003 });
    noise(v.ctx, v.out, { start: t, dur: 0.06, gain: 0.08, type: 'lowpass', freq: 500 });
  }
  if (s.clank?.includes(inBar)) {
    noise(v.ctx, v.out, { start: t, dur: 0.09, gain: 0.07, type: 'bandpass', freq: 2300, q: 11 });
    noise(v.ctx, v.out, { start: t, dur: 0.05, gain: 0.04, type: 'bandpass', freq: 3900, q: 14 });
  }
  if (inBar % s.hatEvery === 0) {
    const accent = inBar % 4 === 2 ? 1 : 0.55;
    noise(v.ctx, v.out, { start: t, dur: 0.028, gain: 0.045 * accent, type: 'highpass', freq: s.hatFreq });
  }
}

function harmony(v: Voice, s: Style, step: number, t: number, stepDur: number): void {
  const inBar = step % STEPS_PER_BAR;
  const root = rootOf(s, step);
  if (inBar % 2 === 0) {
    // 8th-note bass pulse: a short plucked filter sweep, accented on the beat
    const off = s.bassLine[(inBar / 2) % s.bassLine.length] ?? 0;
    const beat = inBar % 4 === 0;
    tone(v.ctx, v.out, {
      type: s.bassType, freq: midiToFreq(root + off), start: t, dur: stepDur * 1.7, gain: beat ? 0.2 : 0.14,
      filter: s.bassCut * (beat ? 1.4 : 1), filterEnd: 90, q: 4, attack: 0.004,
    });
  }
  if (inBar === 0) {
    // slow tension pad, one chord per bar, two detuned voices per note
    const bar = stepDur * STEPS_PER_BAR;
    for (const iv of s.pad) {
      for (const detune of [-7, 7]) {
        tone(v.ctx, v.out, {
          type: s.padType, freq: midiToFreq(root + 24 + iv), start: t, dur: bar * 1.08, gain: 0.018,
          attack: bar * 0.4, filter: s.padCut, detune,
        });
      }
    }
  }
  for (const [at, m] of s.motif) {
    if (at === step) tone(v.ctx, v.out, { type: s.motifType, freq: midiToFreq(m), start: t, dur: stepDur * 6, gain: 0.035, attack: 0.01, filter: 3200 });
  }
}

/** Fever: 16th arpeggio over the pad chord + open hats on the off-beats (same tempo). */
function feverLayer(v: Voice, s: Style, step: number, t: number, stepDur: number): void {
  const root = rootOf(s, step);
  const notes = [...s.pad, 12, s.pad[1] + 12];
  const m = root + 36 + notes[step % notes.length];
  tone(v.ctx, v.out, { type: 'sawtooth', freq: midiToFreq(m), start: t, dur: stepDur * 0.9, gain: 0.022, filter: 3600, filterEnd: 900 });
  if (step % 4 === 2) noise(v.ctx, v.out, { start: t, dur: 0.16, gain: 0.035, type: 'highpass', freq: 7000 });
}

/** v7 boss layer: heavy low hits on every beat, a snare-like crack on 2 and 4, low tom fills at the bar end. */
function bossLayer(v: Voice, step: number, t: number): void {
  const inBar = step % STEPS_PER_BAR;
  if (inBar % 4 === 0) {
    tone(v.ctx, v.out, { type: 'sine', freq: 96, freqEnd: 34, start: t, dur: 0.38, gain: 0.55, attack: 0.002, drive: 0.3 });
    noise(v.ctx, v.out, { start: t, dur: 0.05, gain: 0.07, type: 'lowpass', freq: 700 });
  }
  if (inBar === 4 || inBar === 12) {
    noise(v.ctx, v.out, { start: t, dur: 0.16, gain: 0.11, type: 'bandpass', freq: 1700, q: 0.8 });
    tone(v.ctx, v.out, { type: 'triangle', freq: 190, freqEnd: 120, start: t, dur: 0.12, gain: 0.12 });
  }
  if (inBar === 13 || inBar === 14 || inBar === 15) {
    tone(v.ctx, v.out, { type: 'sine', freq: 150 - (inBar - 13) * 22, freqEnd: 70, start: t, dur: 0.16, gain: 0.22 });
  }
}

function mod(n: number, m: number): number {
  return ((n % m) + m) % m;
}

export function createMusic(ctx: BaseAudioContext, out: AudioNode): Music {
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.connect(out);
  const voice: Voice = { ctx, out: filter };
  let timer: ReturnType<typeof setInterval> | null = null;
  let style: Style = STYLES[0];
  let stepDur = 0.125;
  let nextTime = 0;
  let step = 0;
  let fever = false;
  let boss = false;

  const setCutoff = (): void => {
    filter.frequency.setTargetAtTime(fever ? 16000 : 7000, ctx.currentTime, 0.08);
  };
  const tick = (): void => {
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      const inBar = step % STEPS_PER_BAR;
      percussion(voice, style, inBar, nextTime);
      harmony(voice, style, step, nextTime, stepDur);
      if (fever) feverLayer(voice, style, step, nextTime, stepDur);
      if (boss) bossLayer(voice, step, nextTime);
      nextTime += stepDur;
      step = (step + 1) % LOOP_STEPS;
    }
  };
  const stop = (): void => {
    if (timer !== null) clearInterval(timer);
    timer = null;
  };
  return {
    start(bpm, world, fromTime) {
      stop();
      style = STYLES[world] ?? STYLES[0];
      const beatDur = 60 / Math.max(40, bpm);
      stepDur = beatDur / 4;
      const nextBeatIndex = Math.ceil(fromTime / beatDur - 1e-6);
      nextTime = ctx.currentTime + (nextBeatIndex * beatDur - fromTime);
      step = mod(nextBeatIndex * 4, LOOP_STEPS);
      setCutoff();
      tick();
      timer = setInterval(tick, TICK_MS);
    },
    stop,
    setFever(on) {
      fever = on;
      setCutoff();
    },
    setBoss(on) {
      boss = on;
    },
  };
}
