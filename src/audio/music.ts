// Procedural looping music with a look-ahead scheduler (16th-note grid, 4-bar loop).
import type { WorldId } from '../types';
import { midiToFreq, noise, tone } from './synth';

const LOOKAHEAD = 0.12; // seconds scheduled ahead
const TICK_MS = 25;
const STEPS_PER_BAR = 16;
const LOOP_STEPS = STEPS_PER_BAR * 4;

interface Style {
  readonly chords: readonly (readonly number[])[]; // per bar: [bassRoot, ...chord tones]
  readonly scale: readonly number[]; // arp notes (midi)
  readonly kick: readonly number[]; // steps within a bar
  readonly snare: readonly number[];
  readonly hatEvery: 1 | 2 | 4;
  readonly bass: readonly number[];
  readonly stabs: readonly number[];
  readonly arpEvery: 0 | 1 | 2 | 4; // 0 = no arp
  readonly bassType: OscillatorType;
  readonly stabType: OscillatorType;
  readonly arpType: OscillatorType;
  readonly pad: boolean;
  readonly swing: number; // 0..0.35 of a step
  readonly cutoff: number;
  readonly bassLine?: readonly number[]; // semitone offsets cycled over the bass hits
  readonly clank?: readonly number[]; // metallic percussion steps
  readonly toms?: readonly number[];
}

/** Spy/stealth loops per corridor theme: 0 outpost, 1 lab, 2 prison, 3 industrial. */
const STYLES: Readonly<Record<WorldId, Style>> = {
  0: {
    chords: [[45, 69, 72, 76], [41, 69, 72, 77], [45, 69, 72, 76], [40, 68, 71, 76]],
    scale: [81, 84, 88, 84],
    kick: [0, 10], snare: [4, 12], hatEvery: 1, bass: [0, 2, 4, 6, 8, 10, 12, 14], stabs: [3, 11],
    bassLine: [0, 0, 7, 8, 7, 0, 3, 5],
    arpEvery: 0, bassType: 'triangle', stabType: 'square', arpType: 'triangle', pad: false, swing: 0.08, cutoff: 2600,
  },
  1: {
    chords: [[38, 62, 65, 69], [34, 62, 65, 70], [36, 60, 64, 67], [33, 60, 64, 69]],
    scale: [74, 77, 81, 77, 72, 76, 79, 76],
    kick: [0, 8], snare: [4, 12], hatEvery: 2, bass: [0, 8, 11],
    stabs: [], arpEvery: 1, bassType: 'sine', stabType: 'sine', arpType: 'square', pad: true, swing: 0, cutoff: 4200,
  },
  2: {
    chords: [[40, 64, 67, 71], [36, 64, 67, 72], [38, 62, 66, 69], [35, 63, 66, 71]],
    scale: [76, 79, 83, 79],
    kick: [0, 3, 6, 8, 11], snare: [4, 12], hatEvery: 2, bass: [0, 3, 6, 8, 11, 14], stabs: [0],
    toms: [13, 14, 15], bassLine: [0, 0, 12, 0, 0, 7],
    arpEvery: 0, bassType: 'sawtooth', stabType: 'sawtooth', arpType: 'sawtooth', pad: true, swing: 0, cutoff: 2200,
  },
  3: {
    chords: [[36, 60, 63, 67], [32, 60, 63, 68], [34, 58, 62, 65], [31, 59, 62, 67]],
    scale: [72, 75, 79, 75],
    kick: [0, 4, 8, 12], snare: [4, 12], hatEvery: 1, bass: [0, 2, 4, 6, 8, 10, 12, 14], stabs: [],
    clank: [2, 7, 10, 13], bassLine: [0, 0, 12, 0],
    arpEvery: 4, bassType: 'sawtooth', stabType: 'square', arpType: 'square', pad: false, swing: 0, cutoff: 2600,
  },
};

export interface Music {
  start(bpm: number, world: WorldId, fromTime: number): void;
  stop(): void;
  setFever(on: boolean): void;
}

interface Voice {
  readonly ctx: BaseAudioContext;
  readonly out: AudioNode;
}

function drums(v: Voice, s: Style, inBar: number, t: number, swingT: number): void {
  if (s.kick.includes(inBar)) {
    tone(v.ctx, v.out, { type: 'sine', freq: 160, freqEnd: 42, start: t, dur: 0.24, gain: 0.7, attack: 0.002 });
  }
  if (s.snare.includes(inBar)) {
    noise(v.ctx, v.out, { start: t, dur: 0.16, gain: 0.16, type: 'bandpass', freq: 1900, q: 0.8 });
    tone(v.ctx, v.out, { type: 'triangle', freq: 220, freqEnd: 140, start: t, dur: 0.08, gain: 0.12 });
  }
  if (s.clank?.includes(inBar)) {
    noise(v.ctx, v.out, { start: t, dur: 0.07, gain: 0.12, type: 'bandpass', freq: 2600, q: 9 });
    tone(v.ctx, v.out, { type: 'square', freq: 1870, freqEnd: 1500, start: t, dur: 0.05, gain: 0.025, filter: 6000 });
  }
  if (s.toms?.includes(inBar)) {
    const f = 200 - s.toms.indexOf(inBar) * 35;
    tone(v.ctx, v.out, { type: 'sine', freq: f, freqEnd: f * 0.55, start: t, dur: 0.18, gain: 0.32 });
  }
  if (inBar % s.hatEvery === 0) {
    const accent = inBar % 4 === 2 ? 1 : 0.6;
    noise(v.ctx, v.out, { start: swingT, dur: 0.035, gain: 0.05 * accent, type: 'highpass', freq: 7500 });
  }
}

function harmony(v: Voice, s: Style, step: number, t: number, swingT: number, stepDur: number): void {
  const inBar = step % STEPS_PER_BAR;
  const chord = s.chords[Math.floor(step / STEPS_PER_BAR) % s.chords.length];
  const [root, ...tones] = chord;
  if (s.bass.includes(inBar)) {
    const line = s.bassLine ?? [0];
    const oct = line[s.bass.indexOf(inBar) % line.length] ?? 0;
    tone(v.ctx, v.out, { type: s.bassType, freq: midiToFreq(root + oct), start: t, dur: stepDur * 1.6, gain: 0.2, filter: 900 });
  }
  if (s.stabs.includes(inBar)) {
    for (const m of tones) tone(v.ctx, v.out, { type: s.stabType, freq: midiToFreq(m), start: swingT, dur: stepDur * 2.2, gain: 0.035, filter: 2800 });
  }
  if (s.pad && inBar === 0) {
    for (const m of tones) {
      tone(v.ctx, v.out, { type: s.stabType === 'sawtooth' ? 'sawtooth' : 'sine', freq: midiToFreq(m - 12), start: t, dur: stepDur * 16, gain: 0.03, attack: stepDur * 4, filter: 1600, detune: 6 });
    }
  }
  if (s.arpEvery > 0 && inBar % s.arpEvery === 0) {
    const n = s.scale[(step / s.arpEvery) % s.scale.length | 0];
    tone(v.ctx, v.out, { type: s.arpType, freq: midiToFreq(n), start: swingT, dur: stepDur * 1.6, gain: 0.05, filter: 4200 });
  }
}

function feverLayer(v: Voice, s: Style, step: number, t: number, stepDur: number): void {
  const chord = s.chords[Math.floor(step / STEPS_PER_BAR) % s.chords.length];
  const tones = chord.slice(1);
  const m = tones[step % tones.length] + 12;
  tone(v.ctx, v.out, { type: 'square', freq: midiToFreq(m), start: t, dur: stepDur * 0.9, gain: 0.025, filter: 7000 });
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

  const setCutoff = (): void => {
    filter.frequency.setTargetAtTime(fever ? 14000 : style.cutoff * 2.5, ctx.currentTime, 0.08);
  };
  const tick = (): void => {
    while (nextTime < ctx.currentTime + LOOKAHEAD) {
      const inBar = step % STEPS_PER_BAR;
      const swingT = nextTime + (inBar % 4 === 2 ? style.swing * stepDur : 0);
      drums(voice, style, inBar, nextTime, swingT);
      harmony(voice, style, step, nextTime, swingT, stepDur);
      if (fever) feverLayer(voice, style, step, nextTime, stepDur);
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
  };
}
