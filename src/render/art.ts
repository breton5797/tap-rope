// Photographic corridor art (GDD-v6 §2): wall / floor / ceiling WebPs per theme in public/art/.
// Memory discipline: load() only fetches the compressed files (Blobs, a few hundred KB each); a
// theme's images are decoded to ImageBitmaps on demand (async, off the main thread where the browser
// can) while its corridor tiles are being baked, and closed again as soon as no unfinished tile cache
// needs them. Every failure is swallowed: missing art simply means the procedural look.
import type { WorldId } from '../types';

export const WALL_PHOTOS = ['a', 'b', 'c'] as const;
const THEMES: readonly WorldId[] = [0, 1, 2, 3];

export interface ThemeArt {
  /** decoded wall elevations (1–3; only the files that loaded) */
  readonly walls: readonly ImageBitmap[];
  readonly floor: ImageBitmap | null;
  readonly ceiling: ImageBitmap | null;
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

async function decode(blob: Blob | undefined): Promise<ImageBitmap | null> {
  if (!blob) return null;
  try {
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

export class ArtStore {
  private readonly blobs = new Map<string, Blob>();
  private readonly decoded = new Map<WorldId, ThemeArt>();
  private readonly decoding = new Set<WorldId>();
  /** bumps whenever a theme finishes decoding (corridor caches compare it to upgrade) */
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

  /** Is there any photo art for this theme (fetched, maybe not decoded yet)? */
  has(t: WorldId): boolean {
    return files(t).some((n) => this.blobs.has(n));
  }

  /** Decoded art for a theme, or null (decoding starts in the background if possible). */
  theme(t: WorldId): ThemeArt | null {
    const hit = this.decoded.get(t);
    if (hit) return hit;
    if (this.has(t) && !this.decoding.has(t)) void this.decodeTheme(t);
    return null;
  }

  /** Close the bitmaps of every theme not listed (their tiles are baked or no longer needed). */
  keepOnly(themes: readonly WorldId[]): void {
    for (const [t, art] of this.decoded) {
      if (themes.includes(t)) continue;
      for (const b of art.walls) b.close();
      art.floor?.close();
      art.ceiling?.close();
      this.decoded.delete(t);
    }
  }

  /** Decoded bitmap bytes (debug / memory report). */
  bytes(): number {
    let b = 0;
    for (const art of this.decoded.values()) {
      for (const bm of [...art.walls, art.floor, art.ceiling]) if (bm) b += bm.width * bm.height * 4;
    }
    return b;
  }

  private async decodeTheme(t: WorldId): Promise<void> {
    this.decoding.add(t);
    const [a, b, c, floor, ceiling] = await Promise.all(files(t).map((n) => decode(this.blobs.get(n))));
    this.decoding.delete(t);
    const walls = [a, b, c].filter((x): x is ImageBitmap => x !== null);
    this.decoded.set(t, { walls, floor, ceiling });
    this.version++;
  }
}
