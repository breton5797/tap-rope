// AudioApi: lazily-created WebAudio graph. Every entry point is guarded so a
// missing or blocked AudioContext degrades to silence instead of throwing.
import type { AudioApi, SfxName, WorldId } from '../types';
import { createMusic, type Music } from './music';
import { createDedupe, createLimiter, createMaster, panBus } from './mixer';
import { playSfx } from './sfx';

interface Graph {
  readonly ctx: AudioContext;
  readonly sfx: GainNode;
  readonly music: GainNode;
  readonly loop: Music;
}

const SFX_LEVEL = 0.9;
const MUSIC_LEVEL = 0.42;

type AudioCtor = new () => AudioContext;

function audioCtor(): AudioCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

function buildGraph(): Graph | null {
  const Ctor = audioCtor();
  if (!Ctor) return null;
  const ctx = new Ctor();
  const master = createMaster(ctx, ctx.destination);
  const sfx = ctx.createGain();
  const music = ctx.createGain();
  sfx.connect(createLimiter(ctx, master));
  music.connect(master);
  return { ctx, sfx, music, loop: createMusic(ctx, music) };
}

const nowMs = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** iOS needs a sound started inside the gesture to fully unlock output. */
function primeOutput(ctx: AudioContext): void {
  const src = ctx.createBufferSource();
  src.buffer = ctx.createBuffer(1, 1, 22050);
  src.connect(ctx.destination);
  src.start(0);
}

/** v7: beyond the AudioApi contract — the boss drum layer. Call setBoss(hud.boss !== null) when a stage starts/ends. */
export interface BossAudio {
  setBoss(on: boolean): void;
}

export function createAudio(): AudioApi & BossAudio {
  let graph: Graph | null = null;
  let soundOn = true;
  let musicOn = true;
  let fever = false;
  let boss = false;
  const fresh = createDedupe();

  const applyGains = (): void => {
    if (!graph) return;
    const t = graph.ctx.currentTime;
    graph.sfx.gain.setTargetAtTime(soundOn ? SFX_LEVEL : 0, t, 0.02);
    graph.music.gain.setTargetAtTime(musicOn ? MUSIC_LEVEL : 0, t, 0.05);
  };
  const safe = (fn: (g: Graph) => void): void => {
    if (!graph) return;
    try {
      fn(graph);
    } catch {
      // Audio is best-effort; never break the game loop.
    }
  };

  return {
    unlock() {
      try {
        if (!graph) {
          graph = buildGraph();
          applyGains();
          if (graph) primeOutput(graph.ctx);
        }
        if (graph && graph.ctx.state !== 'running') void graph.ctx.resume().catch(() => undefined);
      } catch {
        graph = null;
      }
    },
    setEnabled(sound, music) {
      soundOn = sound;
      musicOn = music;
      safe(applyGains);
    },
    startMusic(bpm: number, world: WorldId, fromTime: number) {
      safe((g) => {
        g.loop.start(bpm, world, fromTime);
        g.loop.setFever(fever);
        g.loop.setBoss(boss);
      });
    },
    stopMusic() {
      safe((g) => g.loop.stop());
    },
    setFever(on) {
      fever = on;
      safe((g) => g.loop.setFever(on));
    },
    setBoss(on) {
      boss = on;
      safe((g) => g.loop.setBoss(on));
    },
    sfx(name: SfxName, level = 1, pan = 0) {
      if (!soundOn || !graph || !fresh(name, nowMs())) return;
      safe((g) => playSfx(g.ctx, panBus(g.ctx, g.sfx, pan), name, level));
    },
  };
}
