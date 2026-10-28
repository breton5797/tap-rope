// Office sprite images (public-office/art/<name>.webp), fetched on first use. Never throws: a missing or
// still-loading file returns null and the caller draws its fallback (the v8 vector look or a shape).
const cache = new Map<string, HTMLImageElement | 'missing'>();

function request(name: string): HTMLImageElement | 'missing' {
  if (typeof Image === 'undefined') return 'missing';
  const img = new Image();
  img.decoding = 'async';
  img.onerror = () => cache.set(name, 'missing');
  img.src = `./art/${name}.webp`;
  return img;
}

/** the decoded image, or null while loading / when it does not exist */
export function officeImage(name: string): HTMLImageElement | null {
  let entry = cache.get(name);
  if (entry === undefined) {
    entry = request(name);
    cache.set(name, entry);
  }
  return entry !== 'missing' && entry.complete && entry.naturalWidth > 0 ? entry : null;
}

/** start fetching ahead of first use */
export function preloadImages(names: readonly string[]): void {
  for (const n of names) officeImage(n);
}

/** draw `img` with its anchor (fractions of the image) at (x, y), `h` logical px tall */
export function drawAnchored(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, h: number, ax = 0.5, ay = 1): void {
  const w = (h * img.naturalWidth) / img.naturalHeight;
  ctx.drawImage(img, x - w * ax, y - h * ay, w, h);
}
