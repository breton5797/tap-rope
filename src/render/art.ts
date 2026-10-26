// Photographic corridor art (GDD-v6 §2): wall / floor / ceiling WebPs per theme in public/art/.
// Memory discipline: load() only fetches the compressed files (Blobs, tens of KB each). A photo is
// decoded only when the corridor is about to bake the one tile that uses it, and released right
// after that bake — so at most one or two decoded photos exist at any moment. Every failure is
// swallowed: a file that does not fetch or decode is marked failed and its layer stays procedural;
// a theme with no usable files is a plain procedural theme.
import type { WorldId } from '../types';

const WALL_PHOTOS = ['a', 'b', 'c'] as const;
const THEMES: readonly WorldId[] = [0, 1, 2, 3];

/** A decoded photo: an ImageBitmap, or an <img> where createImageBitmap is missing (iOS 14). */
export type Photo = ImageBitmap | HTMLImageElement;

/** The usable photo file names of a theme (decoded later, one at a time). */
export interface PhotoSet {
  readonly walls: readonly string[];
  readonly floor: string | null;
  readonly ceiling: string | null;
}

function files(t: WorldId): string[] {
  return [...WALL_PHOTOS.map((s) => `wall-${t}-${s}`), `floor-${t}`, `ceiling-${t}`];
}

async function fetchBlob(name: string): Promise<Blob | null> {
  try {
    const res = await fetch(`./art/${name}.webp`, { cache: 'force-cache' });
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

function dispose(p: Photo): void {
  if (p instanceof HTMLImageElement) p.src = '';
  else p.close();
}

export class ArtStore {
  private readonly blobs = new Map<string, Blob>();
  private readonly failed = new Set<string>();
  private readonly ready = new Map<string, Photo>();
  private readonly pending = new Set<string>();
  /** bumps whenever a file fails to decode (photo caches built with it must be rebuilt) */
  version = 0;

  async load(onProgress?: (done: number, total: number) => void): Promise<void> {
    const names = THEMES.flatMap(files);
    let done = 0;
    const report = (): void => {
      try {
        onProgress?.(done, names.length);
      } catch {
        // a throwing progress callback must not break loading
      }
    };
    report();
    await Promise.all(
      names.map(async (n) => {
        const b = await fetchBlob(n);
        if (b) this.blobs.set(n, b);
        done++;
        report();
      }),
    );
  }

  private usable(name: string): boolean {
    return this.blobs.has(name) && !this.failed.has(name);
  }

  /** The theme's usable photos, or null when it has none (= plain procedural theme). */
  photoSet(t: WorldId): PhotoSet | null {
    const walls = WALL_PHOTOS.map((s) => `wall-${t}-${s}`).filter((n) => this.usable(n));
    const floor = this.usable(`floor-${t}`) ? `floor-${t}` : null;
    const ceiling = this.usable(`ceiling-${t}`) ? `ceiling-${t}` : null;
    return walls.length > 0 || floor || ceiling ? { walls, floor, ceiling } : null;
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
      }
    });
    return null;
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
      const w = p instanceof HTMLImageElement ? p.naturalWidth : p.width;
      const h = p instanceof HTMLImageElement ? p.naturalHeight : p.height;
      b += w * h * 4;
    }
    return b;
  }
}
