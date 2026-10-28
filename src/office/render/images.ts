// Office sprite images (public-office/art/<name>.webp). renderer.load() awaits OFFICE_ART (with a timeout)
// so a first visit doesn't switch between the v8 drawing and the sprite mid-run; anything else is fetched
// on first use. Never throws: a missing or still-loading file returns null and the caller draws its
// fallback (the v8 look). A file that failed is requested again on the next loadImages().
import { OFFICE_BOSSES } from '../core/boss';
import { OFFICE_PROPS } from '../core/events';
import type { HeroFrameId } from './hero-frames';

/** name1..nameN */
function seq(name: string, n: number): string[] {
  return Array.from({ length: n }, (_, i) => `${name}${i + 1}`);
}

const HERO_FRAMES: readonly HeroFrameId[] = ['run1', 'run2', 'run3', 'run4', 'jump', 'slide', 'hit', 'win'];

/** every sprite the office renderer draws: both heroes' frames, the props, the superiors */
export const OFFICE_ART: readonly string[] = [
  ...(['kid', 'cat'] as const).flatMap((skin) => HERO_FRAMES.map((f) => `hero-${skin}-${f}`)),
  ...OFFICE_PROPS.map((p) => `prop-${p}`),
  ...OFFICE_BOSSES.map((b) => `boss-${b.slot}`),
];

/**
 * v2 feel pack art, used when present (older art sets lack it): run5..8, jump1..8, slide1..4, hit1..4, boss
 * idle2 / throw1..6 / attack / tired, office pickup sprites and the stage collectibles.
 */
export const OFFICE_EXTRA_ART: readonly string[] = [
  ...(['kid', 'cat'] as const).flatMap((skin) => [
    ...['run5', 'run6', 'run7', 'run8', ...seq('jump', 8), ...seq('slide', 4), ...seq('hit', 4)].map((f) => `hero-${skin}-${f}`),
  ]),
  ...OFFICE_BOSSES.flatMap((b) => ['idle2', 'attack', 'tired', ...seq('throw', 6)].map((p) => `boss-${b.slot}-${p}`)),
  ...['coin', 'shield', 'slow', 'heart'].map((k) => `pickup-${k}`),
  ...['coupon', 'docs', 'cookie', 'badge', 'envelope'].map((c) => `collect-${c}`),
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
    // perf: decode off the frame path, so the first drawImage of a sprite mid-run doesn't stall
    const ready = () => {
      entry.state = 'ok';
      done();
    };
    if (typeof img.decode === 'function') img.decode().then(ready, ready);
    else ready();
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

/** load state of a sprite: requested on first ask */
export function imageState(name: string): 'ok' | 'loading' | 'missing' {
  const e = entryFor(name, false);
  if (!e) return 'missing';
  return e.state === 'ok' && e.img.naturalWidth > 0 ? 'ok' : e.state === 'loading' ? 'loading' : 'missing';
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
