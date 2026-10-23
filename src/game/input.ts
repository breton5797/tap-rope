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
  /** keyboard ↓ / S: slide without a tap */
  onSlideKey(): void;
  onPauseKey(): void;
}

const SWIPE_MIN_PX = 26;
// stays inside the physics SWIPE_WINDOW (0.25s) so a recognized swipe is never silently ignored
const SWIPE_MAX_MS = 240;
const TAP_KEYS = new Set([' ', 'Spacebar', 'Enter', 'w', 'W', 'ArrowUp']);
const SLIDE_KEYS = new Set(['ArrowDown', 's', 'S']);
const PAUSE_KEYS = new Set(['Escape', 'p', 'P']);

interface Track {
  readonly x: number;
  readonly y: number;
  readonly t: number;
  readonly fired: boolean;
  readonly lastX: number;
  readonly lastY: number;
}

export function swipeDirection(dx: number, dy: number, minPx = SWIPE_MIN_PX): Swipe | null {
  if (Math.hypot(dx, dy) < minPx) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

function bindPointer(canvas: HTMLCanvasElement, h: InputHandlers): void {
  const tracks = new Map<number, Track>();
  /** a swipe only modifies the jump its own finger started (multi-touch safety) */
  let lastTapPointer: number | null = null;
  const tryFire = (id: number, tr: Track, x: number, y: number, now: number): void => {
    if (tr.fired || now - tr.t > SWIPE_MAX_MS || id !== lastTapPointer) return;
    const dir = swipeDirection(x - tr.x, y - tr.y);
    if (!dir) return;
    tracks.set(id, { ...tr, fired: true });
    h.onSwipe(dir);
  };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    tracks.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp, fired: false, lastX: e.clientX, lastY: e.clientY });
    lastTapPointer = e.pointerId;
    h.onTap();
  });
  canvas.addEventListener('pointermove', (e) => {
    const tr = tracks.get(e.pointerId);
    if (!tr) return;
    tracks.set(e.pointerId, { ...tr, lastX: e.clientX, lastY: e.clientY });
    tryFire(e.pointerId, tr, e.clientX, e.clientY, e.timeStamp);
  });
  canvas.addEventListener('pointerup', (e) => tracks.delete(e.pointerId));
  // iOS edge gestures (home indicator, back swipe) cancel the touch mid-swipe: judge it from the last position
  canvas.addEventListener('pointercancel', (e) => {
    const tr = tracks.get(e.pointerId);
    if (tr) tryFire(e.pointerId, tr, tr.lastX, tr.lastY, e.timeStamp);
    tracks.delete(e.pointerId);
  });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
}

function bindKeys(h: InputHandlers): void {
  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    const target = e.target as HTMLElement | null;
    if (target?.closest('button') && e.key !== 'Escape') return;
    if (TAP_KEYS.has(e.key)) {
      e.preventDefault();
      h.onTap();
    } else if (SLIDE_KEYS.has(e.key)) {
      e.preventDefault();
      h.onSlideKey();
    } else if (PAUSE_KEYS.has(e.key)) {
      h.onPauseKey();
    }
  });
}

export function bindInput(canvas: HTMLCanvasElement, h: InputHandlers): void {
  bindPointer(canvas, h);
  bindKeys(h);
}
