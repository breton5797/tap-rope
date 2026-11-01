// Sampled sfx (office v2.1): fetches + decodes a fixed list of short files once each, then plays them on the sfx
// bus (so mute, volume, the limiter and the pan pool apply). Loading is lazy (load() after the first user gesture —
// the same unlock that starts the AudioContext on iOS), one request in flight per name. A file that is missing
// or will not decode in the chosen format is tried once in the other one, then given up: play() returns false
// and the caller falls back to the synth voice. Never throws.

export type SampleExt = 'ogg' | 'm4a';

/** AAC in an .m4a (the precached format) wherever it plays; Ogg Vorbis only where it does not */
export function pickSampleExt(canPlayType: ((type: string) => string) | null): SampleExt {
  if (!canPlayType || canPlayType('audio/mp4; codecs="mp4a.40.2"') !== '') return 'm4a';
  return canPlayType('audio/ogg; codecs="vorbis"') !== '' ? 'ogg' : 'm4a';
}

/** the browser's answer, or null outside a browser */
export function browserCanPlay(): ((type: string) => string) | null {
  if (typeof document === 'undefined') return null;
  const el = document.createElement('audio');
  return typeof el.canPlayType === 'function' ? (t) => el.canPlayType(t) : null;
}

export interface SamplePlayerOptions {
  readonly base: string; // e.g. './sfx/'
  readonly names: readonly string[];
  readonly ext: SampleExt;
  readonly fetch?: (url: string) => Promise<{ ok: boolean; arrayBuffer(): Promise<ArrayBuffer> }>;
}

export interface SamplePlayer {
  /** starts loading every listed file (idempotent) */
  load(): void;
  /** plays a decoded sample now; false when it is not (or never will be) available */
  play(name: string, out: AudioNode, rate: number): boolean;
}

const OTHER: Readonly<Record<SampleExt, SampleExt>> = { ogg: 'm4a', m4a: 'ogg' };

export function createSamplePlayer(ctx: BaseAudioContext, o: SamplePlayerOptions): SamplePlayer {
  const fetchFn = o.fetch ?? (typeof fetch === 'function' ? (u: string) => fetch(u) : null);
  const buffers = new Map<string, AudioBuffer>();
  const pending = new Set<string>();
  const failed = new Set<string>();

  const decode = async (name: string, ext: SampleExt): Promise<AudioBuffer> => {
    if (!fetchFn) throw new Error('no fetch');
    const res = await fetchFn(`${o.base}${name}.${ext}`);
    if (!res.ok) throw new Error(`missing ${name}.${ext}`);
    return ctx.decodeAudioData(await res.arrayBuffer());
  };

  const loadOne = (name: string): void => {
    if (buffers.has(name) || pending.has(name) || failed.has(name)) return;
    pending.add(name);
    decode(name, o.ext)
      .catch(() => decode(name, OTHER[o.ext]))
      .then((buf) => buffers.set(name, buf), () => failed.add(name))
      .finally(() => pending.delete(name));
  };

  return {
    load() {
      for (const n of o.names) loadOne(n);
    },
    play(name, out, rate) {
      const buf = buffers.get(name);
      if (!buf) return false;
      try {
        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.playbackRate.value = rate;
        src.connect(out);
        src.onended = () => src.disconnect();
        src.start(ctx.currentTime);
        return true;
      } catch {
        return false;
      }
    },
  };
}
