// Office sound effects (칼퇴근 대작전, spec §9), swapped in for src/audio/sfx.ts: comic re-voicings of the
// hit (boing + thud), fail (rubber stamp + wah-wah), door (elevator ding) and clear (major ta-da), all
// synthesised (P7); every other sound is the v8 recipe.
import type { SfxName } from '../../types';
import { sub, tail, tick } from '../../audio/layers';
import { playSfx as v8Sfx } from '../../audio/sfx';
import { midiToFreq, noise, tone } from '../../audio/synth';

export * from '../../audio/sfx';

type Recipe = (ctx: BaseAudioContext, out: AudioNode, t: number) => void;

const COMIC: Partial<Record<SfxName, Recipe>> = {
  // cartoon bump: a springy pitch wobble over a soft thud
  hit: (ctx, out, t) => {
    sub(ctx, out, t, 0.45, 110, 45, 0.22);
    tone(ctx, out, { type: 'triangle', freq: 520, freqEnd: 180, start: t, dur: 0.32, gain: 0.14, attack: 0.004 });
    tone(ctx, out, { type: 'sine', freq: 260, freqEnd: 390, start: t + 0.08, dur: 0.18, gain: 0.07 });
    noise(ctx, out, { start: t, dur: 0.05, gain: 0.12, type: 'lowpass', freq: 600 });
  },
  // "야근 확정": a rubber stamp slap, then a sad trombone wah-wah
  fail: (ctx, out, t) => {
    tick(ctx, out, t, 0.3, 1800, 0.02);
    sub(ctx, out, t, 0.55, 140, 40, 0.3);
    noise(ctx, out, { start: t, dur: 0.09, gain: 0.25, type: 'bandpass', freq: 900, q: 1.4 });
    [0, 1, 2, 3].forEach((i) => {
      const m = 58 - i;
      tone(ctx, out, { type: 'sawtooth', freq: midiToFreq(m), freqEnd: midiToFreq(m - (i === 3 ? 2 : 0)), start: t + 0.35 + i * 0.32, dur: i === 3 ? 0.8 : 0.3, gain: 0.07, attack: 0.03, filter: 1100, filterEnd: 500 });
    });
  },
  // elevator "띵": two soft bells a major third apart, with a short room tail
  door: (ctx, out, t) => {
    tone(ctx, out, { type: 'sine', freq: midiToFreq(88), start: t, dur: 0.9, gain: 0.12, attack: 0.003 });
    tone(ctx, out, { type: 'sine', freq: midiToFreq(84), start: t + 0.22, dur: 1.1, gain: 0.11, attack: 0.003 });
    tail(ctx, out, t, 0.03, 0.5, 3000, 1200);
  },
  // stage cleared: bright major ta-da
  clear: (ctx, out, t) => {
    [72, 76, 79, 84].forEach((m, i) => {
      tone(ctx, out, { type: 'square', freq: midiToFreq(m), start: t + i * 0.08, dur: i === 3 ? 0.7 : 0.16, gain: 0.05, attack: 0.004, filter: 3400 });
    });
    sub(ctx, out, t, 0.3, 120, 60, 0.25);
  },
};

export function playSfx(ctx: BaseAudioContext, out: AudioNode, name: SfxName, level: number): void {
  const comic = COMIC[name];
  if (comic) comic(ctx, out, ctx.currentTime + 0.005);
  else v8Sfx(ctx, out, name, level);
}
