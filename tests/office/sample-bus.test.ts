// @vitest-environment jsdom
// Office v2.1 (office graph): samples play on the sfx bus — the same gain the mute / volume setting drives, the
// same pan pool and peak limiter — only after the first gesture, and a sound without a file is synthesized.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudio } from '../../src/audio';
import { fakeCtx } from '../audio/fake-ctx';

type Node = { connected: unknown[]; gain?: { value: number }; buffer?: unknown; playbackRate?: { value: number } };

let ctx: ReturnType<typeof fakeCtx> & Record<string, unknown>;
let sources: Node[];
let gains: { node: Node; target: number }[];

beforeEach(() => {
  sources = [];
  gains = [];
  const base = fakeCtx();
  const createGain = base.createGain.bind(base);
  const createBufferSource = base.createBufferSource.bind(base);
  ctx = Object.assign(base, {
    destination: { connect: vi.fn() },
    state: 'running',
    resume: () => Promise.resolve(),
    decodeAudioData: () => Promise.resolve({ duration: 0.2, decoded: true }),
    createGain: () => {
      const g = createGain() as unknown as Node & { gain: { setTargetAtTime: (v: number) => unknown } };
      const set = g.gain.setTargetAtTime;
      g.gain.setTargetAtTime = (v: number, ...rest: unknown[]) => {
        gains.push({ node: g, target: v });
        return (set as (...a: unknown[]) => unknown)(v, ...rest);
      };
      return g;
    },
    createBufferSource: () => {
      const s = Object.assign(createBufferSource() as unknown as Node, { playbackRate: { value: 1 } });
      sources.push(s);
      return s;
    },
  }) as never;
  vi.stubGlobal('AudioContext', function FakeAudioContext() { return ctx; });
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: true, arrayBuffer: () => Promise.resolve(new ArrayBuffer(4)) })));
});
afterEach(() => vi.unstubAllGlobals());

const flush = async () => { for (let i = 0; i < 6; i += 1) await new Promise((r) => setTimeout(r, 0)); };
const decoded = () => sources.filter((s) => (s.buffer as { decoded?: boolean } | null)?.decoded);
/** the node a source feeds, followed down to the bus gain the sound setting drives */
const reachesSfxBus = (s: Node, bus: Node) => {
  let n: Node | undefined = s.connected[0] as Node;
  for (let i = 0; i < 4 && n; i += 1) {
    if (n === bus) return true;
    n = n.connected[0] as Node;
  }
  return false;
};

describe('sample bus', () => {
  it('loads nothing before the first gesture', () => {
    createAudio();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('plays samples on the sfx bus (the gain mute / volume drive), panned through the pan pool', async () => {
    const audio = createAudio();
    audio.unlock();
    await flush();
    expect(fetch).toHaveBeenCalled();
    const sfxBus = gains.find((g) => Math.abs(g.target - 0.9) < 1e-9)!.node; // SFX_LEVEL
    audio.sfx('lane', 1, 0.6);
    const s = decoded().at(-1)!;
    expect(s).toBeTruthy();
    expect(reachesSfxBus(s, sfxBus)).toBe(true);
    audio.sfx('pick-item', 1.2);
    expect(decoded().at(-1)!.playbackRate!.value).toBeCloseTo(1.2);
  });

  it('mute plays nothing; a sound without a sample is synthesized', async () => {
    const audio = createAudio();
    audio.unlock();
    await flush();
    const before = decoded().length;
    audio.setEnabled(false, true);
    audio.sfx('land');
    expect(decoded().length).toBe(before);
    expect(gains.some((g) => g.target === 0)).toBe(true); // the bus is turned down too
    audio.setEnabled(true, true);
    const osc = ctx.created.Oscillator ?? 0;
    audio.sfx('zap');
    expect(decoded().length).toBe(before);
    expect((ctx.created.Oscillator ?? 0) + (ctx.created.BufferSource ?? 0)).toBeGreaterThan(osc);
  });

  it('a file that fails falls back to the synth voice', async () => {
    vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({ ok: false, arrayBuffer: () => Promise.reject(new Error('404')) })));
    const audio = createAudio();
    audio.unlock();
    await flush();
    const osc = ctx.created.Oscillator ?? 0;
    audio.sfx('slide');
    expect(decoded()).toHaveLength(0);
    expect((ctx.created.Oscillator ?? 0) + (ctx.created.BufferSource ?? 0)).toBeGreaterThan(osc);
  });
});
