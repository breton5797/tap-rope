// v8 share card + challenge link (GDD-v8 A5): the result drawn on a 1080×1350 canvas, shared as an image
// with navigator.share (text + link when files are unsupported), else downloaded. Endless results add a
// challenge link `?endless=<seed>&vs=<score>` that replays the identical course (endless is seed-deterministic).
import { COPY } from '../flavor';
import type { ResultInfo } from '../types';
import { formatNumber } from './dom';

const MAX_SEED = 2 ** 31;

export interface ChallengeLink {
  readonly seed: number;
  readonly vs: number | null;
}

const wholeIn = (text: string | null, max: number): number | null => {
  if (text === null || !/^\d{1,10}$/.test(text)) return null;
  const n = Number(text);
  return n <= max ? n : null;
};

/** `?endless=<seed>&vs=<score>` from a location.search string, else null */
export function parseChallenge(search: string): ChallengeLink | null {
  const q = new URLSearchParams(search);
  const seed = wholeIn(q.get('endless'), MAX_SEED);
  if (seed === null) return null;
  return { seed, vs: wholeIn(q.get('vs'), Number.MAX_SAFE_INTEGER) };
}

/** the page URL (query and hash replaced) carrying the challenge */
export function challengeUrl(pageUrl: string, seed: number, score: number): string {
  const u = new URL(pageUrl);
  u.search = `?endless=${seed}&vs=${Math.max(0, Math.floor(score))}`;
  u.hash = '';
  return u.toString();
}

export function shareText(r: Pick<ResultInfo, 'mode' | 'score' | 'title'>): string {
  const what = r.mode === 'endless' ? '무한 침투' : r.mode === 'daily' ? '일일 작전' : r.title;
  return `${COPY.shareName} · ${what} ${formatNumber(r.score)}점. 이 기록, 넘을 수 있어?`;
}

export interface CardOpts {
  readonly frame: string | null; // equipped frame accent (hex) or null
  readonly headline: string;
  readonly lines: readonly string[];
}

const W = 1080;
const H = 1350;

/** Draws the report card; null where canvas 2D is unavailable. */
export function drawShareCard(r: ResultInfo, o: CardOpts): HTMLCanvasElement | null {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  if (!g) return null;
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#0b1a22');
  bg.addColorStop(1, '#04080b');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  const accent = o.frame ?? '#3ef0c8';
  g.strokeStyle = accent;
  g.lineWidth = o.frame ? 18 : 6;
  g.strokeRect(36, 36, W - 72, H - 72);
  g.textAlign = 'center';
  g.fillStyle = '#7fa8b8';
  g.font = '600 34px ui-monospace, Menlo, monospace';
  g.fillText(COPY.shareCardKicker, W / 2, 150);
  g.fillStyle = '#e8f4f8';
  g.font = '800 64px system-ui, sans-serif';
  g.fillText(r.title, W / 2, 260);
  g.fillStyle = accent;
  g.font = '800 54px system-ui, sans-serif';
  g.fillText(o.headline, W / 2, 350);
  g.fillStyle = '#ffffff';
  g.font = '900 200px ui-monospace, Menlo, monospace';
  g.fillText(formatNumber(r.score), W / 2, 620);
  if (r.mode === 'stage') {
    g.font = '400 110px system-ui, sans-serif';
    g.fillStyle = '#ffd36b';
    g.fillText('★'.repeat(r.stars) + '☆'.repeat(3 - r.stars), W / 2, 790);
  }
  g.fillStyle = '#b8d0da';
  g.font = '600 46px system-ui, sans-serif';
  o.lines.slice(0, 4).forEach((line, i) => g.fillText(line, W / 2, 900 + i * 72));
  g.fillStyle = '#5d7c88';
  g.font = '600 34px system-ui, sans-serif';
  g.fillText(`${COPY.shareName} — 브라우저에서 바로 플레이`, W / 2, H - 100);
  return c;
}

const toBlob = (c: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => {
    try {
      c.toBlob((b) => resolve(b), 'image/png');
    } catch {
      resolve(null);
    }
  });

export type ShareOutcome = 'shared' | 'downloaded' | 'cancelled' | 'failed';

/** navigator.share with the image (or text + link), else a PNG download. */
export async function shareResult(r: ResultInfo, card: CardOpts, url: string | null): Promise<ShareOutcome> {
  const canvas = drawShareCard(r, card);
  const blob = canvas ? await toBlob(canvas) : null;
  const text = shareText(r);
  const nav = typeof navigator === 'undefined' ? undefined : navigator;
  try {
    const file = blob ? new File([blob], 'laser-escape.png', { type: 'image/png' }) : null;
    const withFile: ShareData = { text, ...(url ? { url } : {}), ...(file ? { files: [file] } : {}) };
    if (nav?.share && file && nav.canShare?.(withFile)) {
      await nav.share(withFile);
      return 'shared';
    }
    if (nav?.share) {
      await nav.share({ text, ...(url ? { url } : {}) });
      return 'shared';
    }
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
  }
  if (!blob) return 'failed';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'laser-escape.png';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 10000);
  return 'downloaded';
}
