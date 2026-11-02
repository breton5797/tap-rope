// v2.2 picker run preview: a small canvas on the selected hire card playing that hero's run cycle (the render
// worker's paintRunPreview). Reduced motion: the still run1, painted once its frame has loaded. The loop ends
// when the canvas leaves the page (the picker closed).
import type { SkinId } from '../../types';
import { paintRunPreview } from '../render/hero-preview';

type Paint = (ctx: CanvasRenderingContext2D, skin: string, t: number) => boolean;

export interface RunPreviewOpts {
  readonly reduced: () => boolean;
  readonly paint?: Paint;
  readonly raf?: (cb: FrameRequestCallback) => number;
  readonly context?: (el: HTMLCanvasElement) => CanvasRenderingContext2D | null;
}

export interface RunPreview {
  readonly el: HTMLCanvasElement;
  show(skin: SkinId): void;
}

/** canvas pixels (CSS size is set by office.css; ×2 for sharp phones) */
const W = 112;
const H = 144;
/** frames to wait for the picker to be mounted before giving up */
const MOUNT_FRAMES = 120;

export function createRunPreview(opts: RunPreviewOpts): RunPreview {
  const paint = opts.paint ?? paintRunPreview;
  const raf = opts.raf ?? ((cb: FrameRequestCallback) => window.requestAnimationFrame(cb));
  const el = document.createElement('canvas');
  el.width = W;
  el.height = H;
  el.className = 'picker__run';
  el.setAttribute('aria-hidden', 'true');
  const ctx = (opts.context ?? ((c) => c.getContext('2d')))(el);
  let skin: SkinId = 'kid';
  let running = false;
  let start: number | null = null;
  let seen = false;
  let idle = 0;

  const frame = (now: number): void => {
    if (!ctx) {
      running = false;
      return;
    }
    if (!el.isConnected) {
      if (seen || ++idle > MOUNT_FRAMES) {
        running = false;
        return;
      }
      raf(frame);
      return;
    }
    seen = true;
    start ??= now;
    const reduced = opts.reduced();
    const painted = paint(ctx, skin, reduced ? 0 : (now - start) / 1000);
    if (reduced && painted) {
      running = false;
      return;
    }
    raf(frame);
  };

  return {
    el,
    show(next) {
      skin = next;
      if (running || !ctx) return;
      running = true;
      raf(frame);
    },
  };
}
