// Office sprite images (public-office/art/<name>.webp). renderer.load() awaits OFFICE_ART (with a timeout)
// so a first visit doesn't switch between the v8 drawing and the sprite mid-run; anything else is fetched
// on first use. Never throws: a missing or still-loading file returns null and the caller draws its
// fallback (the v8 look). A file that failed is requested again on the next loadImages().
import { OFFICE_BOSSES } from '../core/boss';
import { OFFICE_PROPS } from '../core/events';
import type { HeroFrameId } from './hero-frames';

const HERO_FRAMES: readonly HeroFrameId[] = ['run1', 'run2', 'run3', 'run4', 'jump', 'slide', 'hit', 'win'];

/** every sprite the office renderer draws: both heroes' frames, the props, the superiors */
export const OFFICE_ART: readonly string[] = [
  ...(['kid', 'cat'] as const).flatMap((skin) => HERO_FRAMES.map((f) => `hero-${skin}-${f}`)),
  ...OFFICE_PROPS.map((p) => `prop-${p}`),
  ...OFFICE_BOSSES.map((b) => `boss-${b.slot}`),
];

interface Entry {
  img: HTMLImageElement;
  state: 'loading' | 'ok' | 'missing';
  settled: Promise<void>;
}

const cache = new Map<string, Entry | null>();

function request(name: string): Entry | null {
  if (typeof Image === 'undefined') return null;
  const img = new Image();
  img.decoding = 'async';
  let done: () => void = () => undefined;
  const entry: Entry = { img, state: 'loading', settled: new Promise<void>((r) => (done = r)) };
  img.onload = () => {
    entry.state = 'ok';
    done();
  };
  img.onerror = () => {
    entry.state = 'missing';
    done();
  };
  img.src = `./art/${name}.webp`;
  return entry;
}

function entryFor(name: string, retry: boolean): Entry | null {
  const cur = cache.get(name);
  if (cur !== undefined && !(retry && cur?.state === 'missing')) return cur;
  const next = request(name);
  cache.set(name, next);
  return next;
}

/** the decoded image, or null while loading / when it does not exist */
export function officeImage(name: string): HTMLImageElement | null {
  const e = entryFor(name, false);
  return e && e.state === 'ok' && e.img.naturalWidth > 0 ? e.img : null;
}

/** fetch `names` (retrying earlier failures); resolves when all settled or after `timeoutMs` */
export function loadImages(names: readonly string[], timeoutMs: number): Promise<void> {
  const all = Promise.all(names.map((n) => entryFor(n, true)?.settled ?? Promise.resolve())).then(() => undefined);
  return Promise.race([all, new Promise<void>((r) => setTimeout(r, timeoutMs))]);
}

/** start fetching ahead of first use (no wait) */
export function preloadImages(names: readonly string[]): void {
  for (const n of names) entryFor(n, false);
}
