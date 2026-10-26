// Photographic corridor art (GDD-v6 §2): wall / floor / ceiling WebPs per theme in public/art/.
// Memory discipline: load() only fetches the compressed files (Blobs, tens of KB each). A photo is
// decoded only when the corridor is about to bake the one tile that uses it, and released right
// after that bake — so at most one or two decoded photos exist at any moment. Every failure is
// swallowed: a file that does not fetch or decode is marked failed and its layer stays procedural;
// a theme with no usable files is a plain procedural theme.
import type { Variant, WorldId } from '../types';

const WALL_PHOTOS = ['a', 'b', 'c'] as const;
const THEMES: readonly WorldId[] = [0, 1, 2, 3];
/** exterior sets (theme 0 only): rooftop at night, helipad at dawn — open sky, no ceiling photo */
const EXTERIORS: readonly ('night' | 'dawn')[] = ['night', 'dawn'];
const VARIANT_INDEX: Readonly<Record<Variant, number>> = { base: 0, alarm: 1, dark: 2, steam: 3, night: 4, dawn: 5 };

/** A decoded photo: an ImageBitmap, or an <img> where createImageBitmap is missing (iOS 14). */
export type Photo = ImageBitmap | HTMLImageElement;

/** The usable photo file names of a scene (decoded later, one at a time). */
export interface PhotoSet {
  /** identity of the set: a cache built from a different set (e.g. before every file had loaded) is stale */
  readonly id: string;
  readonly walls: readonly string[];
  readonly floor: string | null;
  readonly ceiling: string | null;
  /** exterior scene: draw an open-sky band instead of a ceiling */
  readonly sky: 'night' | 'dawn' | null;
}

function files(t: WorldId): string[] {
  return [...WALL_PHOTOS.map((s) => `wall-${t}-${s}`), `floor-${t}`, `ceiling-${t}`];
}

function exteriorFiles(): string[] {
  return EXTERIORS.flatMap((e) => [...WALL_PHOTOS.map((s) => `wall-0-${e}-${s}`), `floor-0-${e}`]);
}

/** a fetch that hasn't completed after this long is abandoned (the file counts as missing) */
const FETCH_TIMEOUT_MS = 8000;

async function fetchBlob(name: string): Promise<Blob | null> {
  const ctrl = typeof AbortController === 'function' ? new AbortController() : null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => {
      ctrl?.abort();
      resolve(null);
    }, FETCH_TIMEOUT_MS);
  });
  try {
    return await Promise.race([fetchOnce(name, ctrl?.signal), timeout]);
  } finally {
    if (timer !== null) clearTimeout(timer);
  }
}

async function fetchOnce(name: string, signal: AbortSignal | undefined): Promise<Blob | null> {
  try {
    const res = await fetch(`./art/${name}.webp`, { cache: 'force-cache', signal });
    if (!res.ok) return null;
    const type = res.headers.get('content-type') ?? '';
    // the dev server answers unknown paths with index.html: only accept images
    if (type && !type.startsWith('image/')) return null;
    const blob = await res.blob();
    return blob.size > 0 ? blob : null;
  } catch {
    return null;
  }
}

/** Decode with createImageBitmap, or through an <img> + object URL when it is unavailable. */
async function decode(blob: Blob): Promise<Photo | null> {
  try {
    if (typeof createImageBitmap === 'function') return await createImageBitmap(blob);
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.src = url;
    try {
      await img.decode();
    } finally {
      URL.revokeObjectURL(url);
    }
    return img.naturalWidth > 0 ? img : null;
  } catch {
    return null;
  }
}

function isBitmap(p: Photo): p is ImageBitmap {
  return typeof (p as ImageBitmap).close === 'function';
}

function dispose(p: Photo): void {
  if (isBitmap(p)) p.close();
  else p.src = '';
}

export class ArtStore {
  private readonly blobs = new Map<string, Blob>();
  private readonly failed = new Set<string>();
  private readonly ready = new Map<string, Photo>();
  private readonly pending = new Set<string>();
  /** bumps whenever a file fails to decode (photo caches built with it must be rebuilt) */
  version = 0;
  /** files whose fetch hasn't finished yet (a scene waits briefly only for its own files) */
  private readonly inflight = new Set<string>();
  private started = false;

  /**
   * Fetch every photo (each fetch times out after FETCH_TIMEOUT_MS). Resolves once the 20 core
   * files have settled; the optional exterior extras keep loading in the background.
   */
  async load(onProgress?: (done: number, total: number) => void): Promise<void> {
    const names = THEMES.flatMap(files);
    const extras = exteriorFiles();
    this.started = true;
    for (const n of names) this.inflight.add(n);
    for (const n of extras) this.inflight.add(n);
    let done = 0;
    const report = (): void => {
      try {
        onProgress?.(done, names.length);
      } catch {
        // a throwing progress callback must not break loading
      }
    };
    const one = async (n: string): Promise<void> => {
      const b = await fetchBlob(n);
      this.inflight.delete(n);
      if (b) {
        this.blobs.set(n, b);
        this.stamp++;
      }
    };
    report();
    for (const n of extras) void one(n);
    await Promise.all(names.map(async (n) => {
      await one(n);
      done++;
      report();
    }));
  }

  /**
   * Could photos for this scene still arrive? True before load() starts and while any of the
   * scene's own files is still being fetched.
   */
  waiting(t: WorldId, variant: Variant): boolean {
    if (!this.started) return true;
    if (this.inflight.size === 0) return false;
    for (const n of files(t)) if (this.inflight.has(n)) return true;
    if (t === 0 && (variant === 'night' || variant === 'dawn')) {
      for (const s of WALL_PHOTOS) if (this.inflight.has(`wall-0-${variant}-${s}`)) return true;
      if (this.inflight.has(`floor-0-${variant}`)) return true;
    }
    return false;
  }

  private usable(name: string): boolean {
    return this.blobs.has(name) && !this.failed.has(name);
  }

  /**
   * The scene's usable photos, or null when it has none (= plain procedural theme). Theme 0 at
   * night / dawn prefers its exterior set (rooftop / helipad, open sky) when those files exist.
   */
  photoSet(t: WorldId, variant: Variant): PhotoSet | null {
    // memoised per (theme, variant) until a file arrives or fails
    const key = t * 8 + VARIANT_INDEX[variant];
    const memo = this.memo[key];
    if (memo && memo.stamp === this.stamp) return memo.set;
    const set = this.computeSet(t, variant);
    this.memo[key] = { stamp: this.stamp, set };
    return set;
  }

  private readonly memo: ({ stamp: number; set: PhotoSet | null } | undefined)[] = [];
  /** bumps when the set of usable files changes */
  private stamp = 0;

  private computeSet(t: WorldId, variant: Variant): PhotoSet | null {
    if (t === 0 && (variant === 'night' || variant === 'dawn')) {
      const ext = this.exterior(variant);
      if (ext) return ext;
    }
    const walls = WALL_PHOTOS.map((s) => `wall-${t}-${s}`).filter((n) => this.usable(n));
    const floor = this.usable(`floor-${t}`) ? `floor-${t}` : null;
    const ceiling = this.usable(`ceiling-${t}`) ? `ceiling-${t}` : null;
    if (walls.length === 0 && !floor && !ceiling) return null;
    return this.cached({ id: `${walls.join(',')}|${floor}|${ceiling}`, walls, floor, ceiling, sky: null });
  }

  private exterior(e: 'night' | 'dawn'): PhotoSet | null {
    const walls = WALL_PHOTOS.map((s) => `wall-0-${e}-${s}`).filter((n) => this.usable(n));
    if (walls.length === 0) return null;
    const own = `floor-0-${e}`;
    const floor = this.usable(own) ? own : this.usable('floor-0') ? 'floor-0' : null;
    return this.cached({ id: `${walls.join(',')}|${floor}|sky-${e}`, walls, floor, ceiling: null, sky: e });
  }

  /** one PhotoSet object per identity (no per-frame allocation once stable) */
  private readonly sets = new Map<string, PhotoSet>();

  private cached(p: PhotoSet): PhotoSet {
    const hit = this.sets.get(p.id);
    if (hit) return hit;
    this.sets.set(p.id, p);
    return p;
  }

  /** Is this file still usable (fetched and not failed to decode)? */
  ok(name: string): boolean {
    return this.usable(name);
  }

  /** The decoded photo, or null — decoding starts in the background (one file per request). */
  request(name: string): Photo | null {
    const hit = this.ready.get(name);
    if (hit) return hit;
    const blob = this.blobs.get(name);
    if (!blob || this.failed.has(name) || this.pending.has(name)) return null;
    this.pending.add(name);
    void decode(blob).then((p) => {
      this.pending.delete(name);
      if (p) this.ready.set(name, p);
      else {
        this.failed.add(name);
        this.version++;
        this.stamp++;
      }
    });
    return null;
  }

  /** Drop every decoded photo not in `keep` (e.g. decoded for a cache that was abandoned). */
  releaseExcept(keep: readonly string[]): void {
    for (const name of this.ready.keys()) if (!keep.includes(name)) this.release(name);
  }

  /** Drop a decoded photo (its tile is baked). */
  release(name: string): void {
    const p = this.ready.get(name);
    if (!p) return;
    dispose(p);
    this.ready.delete(name);
  }

  /** Decoded photo bytes (debug / memory report). */
  bytes(): number {
    let b = 0;
    for (const p of this.ready.values()) {
      const w = isBitmap(p) ? p.width : p.naturalWidth;
      const h = isBitmap(p) ? p.height : p.naturalHeight;
      b += w * h * 4;
    }
    return b;
  }
}
