/**
 * Pointer + keyboard input (GDD v5 §2). The canvas is split in two:
 * - right half (action pad): every pointerdown is one tap, fired immediately (rhythm games can't
 *   wait to classify). If that same pointer then travels far enough quickly, a swipe is reported
 *   once — the session treats it as a modifier on the jump the touch already started.
 * - left half (lane pad): no tap; a vertical swipe changes lanes (up = far lane), once per touch,
 *   recognized while the finger is still down.
 */
import type { LaneDir, Swipe } from '../types';

export interface InputHandlers {
  onTap(): void;
  onSwipe(dir: Swipe): void;
  /** left-thumb swipe or ↑ / ↓ key */
  onLane(dir: LaneDir): void;
  /** keyboard Shift / S: slide without a tap */
  onSlideKey(): void;
  onPauseKey(): void;
}

const SWIPE_MIN_PX = 26;
// stays inside the physics SWIPE_WINDOW (0.25s) so a recognized swipe is never silently ignored
const SWIPE_MAX_MS = 240;
const LANE_MIN_PX = 22;
const LANE_MAX_MS = 300;
const TAP_KEYS = new Set([' ', 'Spacebar', 'Enter']);
const SLIDE_KEYS = new Set(['Shift', 's', 'S']);
const PAUSE_KEYS = new Set(['Escape', 'p', 'P']);
const LANE_KEYS: Readonly<Record<string, LaneDir>> = { ArrowUp: -1, ArrowDown: 1 };

export type Side = 'lane' | 'action';
export type KeyAction = 'tap' | 'slide' | 'pause' | { readonly lane: LaneDir } | null;

interface Track {
  readonly x: number;
  readonly y: number;
  readonly t: number;
  readonly fired: boolean;
  readonly lastX: number;
  readonly lastY: number;
  readonly side: Side;
}

export function swipeDirection(dx: number, dy: number, minPx = SWIPE_MIN_PX): Swipe | null {
  if (Math.hypot(dx, dy) < minPx) return null;
  if (Math.abs(dx) > Math.abs(dy)) return dx < 0 ? 'left' : 'right';
  return dy < 0 ? 'up' : 'down';
}

/** which pad a touch at css x belongs to */
export function sideOf(x: number, width: number): Side {
  return x < width / 2 ? 'lane' : 'action';
}

/** a left-thumb movement as a lane change; horizontal or short movements mean nothing */
export function laneSwipe(dx: number, dy: number): LaneDir | null {
  const dir = swipeDirection(dx, dy, LANE_MIN_PX);
  return dir === 'up' ? -1 : dir === 'down' ? 1 : null;
}

export function keyAction(key: string): KeyAction {
  if (key in LANE_KEYS) return { lane: LANE_KEYS[key] };
  if (TAP_KEYS.has(key)) return 'tap';
  if (SLIDE_KEYS.has(key)) return 'slide';
  if (PAUSE_KEYS.has(key)) return 'pause';
  return null;
}

function bindPointer(canvas: HTMLCanvasElement, h: InputHandlers): void {
  const tracks = new Map<number, Track>();
  /** a swipe only modifies the jump its own finger started (multi-touch safety) */
  let lastTapPointer: number | null = null;
  const tryFire = (id: number, tr: Track, x: number, y: number, now: number): void => {
    if (tr.fired) return;
    if (tr.side === 'lane') {
      const dir = now - tr.t <= LANE_MAX_MS ? laneSwipe(x - tr.x, y - tr.y) : null;
      if (dir === null) return;
      tracks.set(id, { ...tr, fired: true });
      h.onLane(dir);
      return;
    }
    if (now - tr.t > SWIPE_MAX_MS || id !== lastTapPointer) return;
    const dir = swipeDirection(x - tr.x, y - tr.y);
    if (!dir) return;
    tracks.set(id, { ...tr, fired: true });
    h.onSwipe(dir);
  };
  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const side = sideOf(e.clientX - rect.left, rect.width);
    tracks.set(e.pointerId, { x: e.clientX, y: e.clientY, t: e.timeStamp, fired: false, lastX: e.clientX, lastY: e.clientY, side });
    if (side === 'lane') return;
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
    const a = keyAction(e.key);
    if (a === null) return;
    if (a !== 'pause') e.preventDefault();
    if (a === 'tap') h.onTap();
    else if (a === 'slide') h.onSlideKey();
    else if (a === 'pause') h.onPauseKey();
    else h.onLane(a.lane);
  });
}

export function bindInput(canvas: HTMLCanvasElement, h: InputHandlers): void {
  bindPointer(canvas, h);
  bindKeys(h);
}
