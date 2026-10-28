/**
 * v8 (GDD-v8 A1): interactive first-run tutorial. In stage mode the world freezes at the ideal input moment
 * of the first floor laser, the first slide laser and the first lane change the player has not yet been
 * taught (save.tutorialSteps), shows a hand glyph over the right half of the screen, and resumes when the
 * right input arrives (it is applied at the frozen time, so the run log replays it exactly).
 * Endless / daily never freeze. Pure helpers; app.ts owns the freeze.
 */
import type { Beat, LaneDir, LaneId, ObstacleKind, PhysicsConfig, PlayerState, Swipe } from '../types';
import { LANE_COUNT } from '../types';
import { idealLead } from '../render/lane-timing';

export type TutorialStep = 'jump' | 'slide' | 'lane';
export const TUTORIAL_STEPS: readonly TutorialStep[] = ['jump', 'slide', 'lane'];

export interface TutorialStop {
  readonly step: TutorialStep;
  readonly beatId: number;
  /** session time to freeze at */
  readonly at: number;
  /** lane stops: the lanes the hazard blocks */
  readonly blocked: readonly LaneId[];
}

/** the same input shapes app.ts queues */
export type TutorialInput = 'tap' | 'slideKey' | Swipe | { readonly lane: LaneDir };

/** a lane-change stop freezes this long before the lane hazard arrives */
export const LANE_STOP_LEAD = 0.5;

const isJump = (k: ObstacleKind): boolean => k === 'floor' || k === 'beam';
const isSlide = (k: ObstacleKind): boolean => k === 'high' || k === 'ceiling';

function stepOf(b: Beat): TutorialStep | null {
  const kinds = b.obstacles.map((o) => o.kind);
  if (b.blockedLanes.length > 0) return kinds.some(isJump) || kinds.some(isSlide) ? null : 'lane';
  if (kinds.some(isSlide)) return kinds.some(isJump) ? null : 'slide';
  if (kinds.some(isJump)) return b.requiredLevel === 1 ? 'jump' : null;
  return null;
}

/** first plain beat of every step not in `done`, in freeze order */
export function tutorialStops(beats: readonly Beat[], done: readonly TutorialStep[], cfg: PhysicsConfig): TutorialStop[] {
  const out: TutorialStop[] = [];
  const seen = new Set<TutorialStep>(done);
  for (const b of beats) {
    const step = stepOf(b);
    if (step === null || seen.has(step)) continue;
    seen.add(step);
    const lead = step === 'lane' ? LANE_STOP_LEAD : idealLead(b.obstacles.map((o) => o.kind), b.requiredLevel, cfg);
    out.push({ step, beatId: b.id, at: b.time - lead, blocked: b.blockedLanes });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** direction to the nearest free lane when `lane` is blocked (toward the middle on a tie), else null */
export function laneEscape(blocked: readonly LaneId[], lane: LaneId): LaneDir | null {
  if (!blocked.includes(lane)) return null;
  const free = (l: number): boolean => l >= 0 && l < LANE_COUNT && !blocked.includes(l as LaneId);
  const toMiddle: LaneDir = lane < 1 ? 1 : -1;
  if (free(lane + toMiddle)) return toMiddle;
  if (free(lane - toMiddle)) return (-toMiddle) as LaneDir;
  return free(lane + 2 * toMiddle) ? toMiddle : null;
}

export type TutorialVerdict = 'pass' | 'hold' | 'ignore';

/**
 * What a frozen tutorial does with an input. A touch slide arrives as a tap followed by a ↓ swipe:
 * the tap is held (`held` = a tap is waiting) and the pair passes when the swipe follows.
 */
export function tutorialInput(step: TutorialStep, input: TutorialInput, held: boolean, dir: LaneDir | null): TutorialVerdict {
  if (step === 'jump') return input === 'tap' ? 'pass' : 'ignore';
  if (step === 'slide') {
    if (input === 'slideKey') return 'pass';
    if (input === 'tap') return 'hold';
    return input === 'down' && held ? 'pass' : 'ignore';
  }
  return typeof input === 'object' && (dir === null || input.lane === dir) ? 'pass' : 'ignore';
}

export interface TutorialHooks {
  /** show / hide the hand glyph */
  show(stop: { readonly step: TutorialStep; readonly dir: LaneDir | null } | null): void;
  /** the world just froze (stop the music) */
  frozen(): void;
  /** the right input arrived: the step is learnt (save it) and the world runs again */
  learnt(step: TutorialStep): void;
}

/** a touch slide's tap waits this long (ms) for its ↓ swipe */
const HOLD_MS = 350;

/** Stateful freeze driver for one run (app.ts): clampDt → step → afterStep, and filter() while frozen. */
export class TutorialRun {
  private stops: readonly TutorialStop[] = [];
  private active: { readonly stop: TutorialStop; readonly dir: LaneDir | null } | null = null;
  private held: TutorialInput | null = null;
  private heldAt = 0;

  constructor(private readonly hooks: TutorialHooks) {}

  /** a new run: its stops (empty = no tutorial) */
  reset(stops: readonly TutorialStop[]): void {
    this.stops = stops;
    this.active = null;
    this.held = null;
  }

  get frozen(): boolean {
    return this.active !== null;
  }

  /** the step a frame may take so the session lands exactly on the next freeze point */
  clampDt(time: number, dt: number): number {
    const next = this.stops[0];
    return next && time + dt > next.at ? Math.max(0, next.at - time) : dt;
  }

  /** after stepping: freeze when the session reached the next stop (unless the player already acted) */
  afterStep(time: number, player: PlayerState): void {
    const next = this.stops[0];
    if (this.active || !next || time < next.at - 1e-9) return;
    this.stops = this.stops.slice(1);
    const dir = next.step === 'lane' ? laneEscape(next.blocked, player.lane) : null;
    const done = next.step === 'jump' ? !player.grounded : next.step === 'slide' ? player.sliding : dir === null;
    if (done) return;
    this.active = { stop: next, dir };
    this.hooks.show({ step: next.step, dir });
    this.hooks.frozen();
  }

  /** shows the glyph again (after a pause wiped the overlays) */
  reshow(): void {
    if (this.active) this.hooks.show({ step: this.active.stop.step, dir: this.active.dir });
  }

  /** while frozen: the inputs to apply now (the right one unfreezes); wrong inputs are dropped */
  filter(inputs: readonly TutorialInput[], nowMs: number): TutorialInput[] {
    const a = this.active;
    if (!a) return [...inputs];
    if (this.held && nowMs - this.heldAt > HOLD_MS) this.held = null;
    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      const v = tutorialInput(a.stop.step, input, this.held !== null, a.dir);
      if (v === 'hold') {
        this.held = input;
        this.heldAt = nowMs;
      } else if (v === 'pass') {
        const out = this.held && input === 'down' ? [this.held, input] : [input];
        this.active = null;
        this.held = null;
        this.hooks.show(null);
        this.hooks.learnt(a.stop.step);
        return [...out, ...inputs.slice(i + 1)];
      }
    }
    return [];
  }
}
