/**
 * Pointer + keyboard input. Every pointerdown on the canvas is one tap, fired
 * immediately (rhythm games can't wait to classify). If that same pointer then
 * travels far enough quickly, a swipe is reported once — the session treats it
 * as a modifier on the jump the touch already started.
 */
import type { Swipe } from '../types';

export interface InputHandlers {
  onTap(): void;
  onSwipe(dir: Swipe): void;
  onPauseKey(): void;
}

const SWIPE_MIN_PX = 26;
const SWIPE_MAX_MS = 300;
const TAP_KEYS = new Set([' ', 'Spacebar', 'Enter', 'w', 'W']);
const ARROW_SWIPES: Readonly<Record<string, Swipe>> = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
};
const PAUSE_KEYS = new Set(['Escape', 'p', 'P']);

interface Track {
  readonly x: number;
  readonly y: number;
  readonly t: number;
  readonly fired: boolean;
}

export function swipeDirection(dx: number, dy: number, minPx = SWIPE_MIN_PX): Swipe | null {
  if (Math.hypot(dx, dy) < minPx) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

function bindPointer(canvas: HTMLCanvasElement, h: InputHandlers): void {
  const tracks = new Map<number, Track>();
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    tracks.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp, fired: false });
    h.onTap();
  });
  canvas.addEventListener('pointermove', (e) => {
    const tr = tracks.get(e.pointerId);
    if (!tr || tr.fired || e.timeStamp - tr.t > SWIPE_MAX_MS) return;
    const dir = swipeDirection(e.clientX - tr.x, e.clientY - tr.y);
    if (!dir) return;
    tracks.set(e.pointerId, { ...tr, fired: true });
    h.onSwipe(dir);
  });
  const end = (e: PointerEvent): void => {
    tracks.delete(e.pointerId);
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

function bindKeys(h: InputHandlers): void {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button') && e.key !== 'Escape') return;
    const dir = ARROW_SWIPES[e.key];
    if (TAP_KEYS.has(e.key) || dir) {
      e.preventDefault();
      h.onTap();
      if (dir) h.onSwipe(dir);
    } else if (PAUSE_KEYS.has(e.key)) {
      h.onPauseKey();
    }
  });
}

export function bindInput(canvas: HTMLCanvasElement, h: InputHandlers): void {
  bindPointer(canvas, h);
  bindKeys(h);
}
