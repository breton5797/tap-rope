// Office v2.1 sampled sfx (office graph): the event → sample map, pickup cues (pitch rising with the collect
// count, 'done' at the target, a haptic per kind), and the sample player's loading, fallback and format pick.
import { describe, expect, it, vi } from 'vitest';
import { SAMPLE_NAMES, sampleFor } from '../../src/audio/sample-map';
import { createSamplePlayer, pickSampleExt } from '../../src/audio/samples';
import { pickupCue, startMissions, trackMissions } from '../../src/game/missions';
import { generateStage } from '../../src/core/levels';
import { stageById } from '../../src/core/content';
import { DEFAULT_PHYSICS } from '../../src/core/physics';
import type { GameEvent } from '../../src/game/session';
import type { StageDef } from '../../src/types';

describe('event → sample', () => {
  it('maps actions, pickups, judgements and stamps to their files', () => {
    expect([1, 2, 3].map((l) => sampleFor('jump', l)?.id)).toEqual(['jump1', 'jump2', 'jump3']);
    expect([2, 3].map((l) => sampleFor('boost', l)?.id)).toEqual(['jump2', 'jump3']);
    const ids = (['land', 'slide', 'lane', 'coin', 'pick-shield', 'pick-slow', 'pick-heart', 'pick-item-done', 'perfect', 'stamp', 'mission-ok', 'mission-miss'] as const)
      .map((n) => sampleFor(n, 1)?.id);
    expect(ids).toEqual(['land', 'slide', 'lane', 'pick-coin', 'pick-shield', 'pick-slow', 'pick-heart', 'pick-item-done', 'perfect', 'stamp', 'mission-ok', 'mission-miss']);
    expect(sampleFor('pick-item', 1.18)).toEqual({ id: 'pick-item', rate: 1.18 });
    expect(sampleFor('zap', 1)).toBeNull(); // everything else stays synthesized
  });

  it('preloads exactly the 16 files of the sfx contract', () => {
    expect([...SAMPLE_NAMES].sort()).toEqual([
      'jump1', 'jump2', 'jump3', 'land', 'lane', 'mission-miss', 'mission-ok', 'perfect', 'pick-coin', 'pick-heart', 'pick-item',
      'pick-item-done', 'pick-shield', 'pick-slow', 'slide', 'stamp',
    ]);
  });
});

describe('pickup cues', () => {
  const judge = (beatId: number): GameEvent => ({ type: 'judge', shielded: false, result: { beatId, grade: 'perfect', hit: false, reason: null, collected: ['coin'] } });

  it('collect coins rise in pitch 1.0 → 1.25 over the target, then "done" on the last one', () => {
    const def = { ...(stageById('w1-s10') as StageDef), seed: 5 };
    const { beats } = generateStage(def, DEFAULT_PHYSICS, 2);
    const coins = beats.filter((b) => b.part === 1 && b.obstacles.some((o) => o.kind === 'coin'));
    let run = startMissions(def, beats);
    const cues = coins.slice(0, 6).map((b) => {
      run = trackMissions(run, { beats, section: 1, time: b.time }, [judge(b.id)]);
      return pickupCue(run, 'coin');
    });
    expect(cues.slice(0, 4).map((c) => c?.name)).toEqual(['pick-item', 'pick-item', 'pick-item', 'pick-item']);
    expect(cues[0]!.level).toBeCloseTo(1);
    expect(cues[3]!.level).toBeCloseTo(1.25 * 0.75 + 0.25); // 1 + 0.25·3/4
    expect(cues[4]).toMatchObject({ name: 'pick-item-done' }); // 5th = the target
    expect(cues[5]).toMatchObject({ name: 'pick-item', level: 1.25 }); // spares stay at the top pitch
    for (const c of cues) expect(c?.haptic).toBeTruthy();
  });

  it('a pickup is cued by the part it was in, even when the section advances in the same step', () => {
    const def = { ...(stageById('w1-s10') as StageDef), seed: 5 };
    const { beats } = generateStage(def, DEFAULT_PHYSICS, 2);
    const coins = beats.filter((b) => b.part === 1 && b.obstacles.some((o) => o.kind === 'coin'));
    let run = startMissions(def, beats);
    for (const b of coins.slice(0, 4)) run = trackMissions(run, { beats, section: 1, time: b.time }, [judge(b.id)]);
    // the 5th (= target) coin and the door into part 2 land in one step
    run = trackMissions(run, { beats, section: 2, time: coins[4].time }, [judge(coins[4].id)]);
    expect(pickupCue(run, 'coin')).toMatchObject({ name: 'pick-item-done' });
  });

  it('power-ups get their own sound and buzz; coins outside a collect part are plain coins', () => {
    const def = { ...(stageById('w1-s10') as StageDef), seed: 5 };
    const run = startMissions(def, generateStage(def, DEFAULT_PHYSICS, 2).beats);
    const cue = (k: 'shield' | 'slow' | 'heart' | 'coin') => pickupCue(run, k);
    expect([cue('shield')?.name, cue('slow')?.name, cue('heart')?.name, cue('coin')?.name]).toEqual(['pick-shield', 'pick-slow', 'pick-heart', 'coin']);
    const buzz = new Set(['shield', 'slow', 'heart', 'coin'].map((k) => JSON.stringify(cue(k as never)?.haptic)));
    expect(buzz.size).toBe(4); // a distinct pattern per kind
    expect(pickupCue(null, 'shield')).toBeNull(); // no missions (endless / demo): v8 feedback
  });
});

/** a tiny AudioContext stand-in: decode resolves for "ok" bytes, rejects otherwise */
function fakeCtx() {
  const started: { buffer: unknown; rate: number }[] = [];
  const ctx = {
    currentTime: 0,
    decodeAudioData: vi.fn((buf: ArrayBuffer) => (new Uint8Array(buf)[0] === 1 ? Promise.resolve({ duration: 0.2 }) : Promise.reject(new Error('bad')))),
    createBufferSource: () => {
      const node = {
        buffer: null as unknown, playbackRate: { value: 1 }, connect: vi.fn(), start: vi.fn(() => started.push({ buffer: node.buffer, rate: node.playbackRate.value })),
      };
      return node;
    },
    createGain: () => ({ gain: { value: 1 }, connect: vi.fn() }),
  };
  return { ctx: ctx as unknown as BaseAudioContext, started };
}
const flush = () => new Promise((r) => setTimeout(r, 0));
const bytes = (ok: boolean) => ({ ok: true, arrayBuffer: () => Promise.resolve(new Uint8Array([ok ? 1 : 0]).buffer) });

describe('sample player', () => {
  it('loads each file once, plays it on the bus with its rate, and reports a miss for the synth fallback', async () => {
    const { ctx, started } = fakeCtx();
    const fetch = vi.fn((url: string) => Promise.resolve(url.includes('missing') ? { ok: false, arrayBuffer: () => Promise.reject() } : bytes(true)));
    const player = createSamplePlayer(ctx, { base: './sfx/', names: ['jump1', 'missing'], ext: 'ogg', fetch: fetch as never });
    player.load();
    player.load(); // one request in flight per name
    expect(player.play('jump1', {} as AudioNode, 1)).toBe(false); // not decoded yet: synth this time
    await flush();
    await flush();
    expect(fetch).toHaveBeenCalledWith('./sfx/jump1.ogg');
    expect(fetch.mock.calls.filter(([u]) => String(u).includes('jump1.'))).toHaveLength(1);
    expect(player.play('jump1', {} as AudioNode, 1.2)).toBe(true);
    expect(started.at(-1)?.rate).toBeCloseTo(1.2);
    expect(player.play('missing', {} as AudioNode, 1)).toBe(false);
    expect(player.play('never-listed', {} as AudioNode, 1)).toBe(false);
  });

  it('falls back to the other format once when the first one will not decode', async () => {
    const { ctx } = fakeCtx();
    const fetch = vi.fn((url: string) => Promise.resolve(bytes(url.endsWith('.m4a'))));
    const player = createSamplePlayer(ctx, { base: './sfx/', names: ['land'], ext: 'ogg', fetch: fetch as never });
    player.load();
    for (let i = 0; i < 5; i += 1) await flush();
    expect(fetch.mock.calls.map(([u]) => u)).toEqual(['./sfx/land.ogg', './sfx/land.m4a']);
    expect(player.play('land', {} as AudioNode, 1)).toBe(true);
  });

  it('prefers AAC (.m4a, the precached format) wherever it plays; Ogg only where it does not', () => {
    expect(pickSampleExt((t) => (t.includes('mp4') ? 'probably' : ''))).toBe('m4a');
    expect(pickSampleExt((t) => (t.includes('mp4') ? 'maybe' : 'probably'))).toBe('m4a');
    expect(pickSampleExt((t) => (t.includes('ogg') ? 'probably' : ''))).toBe('ogg');
    expect(pickSampleExt(null)).toBe('m4a');
  });
});
