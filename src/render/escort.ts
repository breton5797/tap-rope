// The rescued prisoner running behind the agent. It replays the agent's moves DELAY seconds
// late (timestamped ring buffer), so jumps and slides ripple back. The buffer is cleared
// whenever a new run starts or the escort (re)appears, so no stale moves leak across runs.
import { PLAYER_X, type PlayerState } from '../types';
import { AgentPainter } from './agent';
import { depthScale, ESCORT_DX, laneLean, laneY, projX, visualLane } from './layout';
import type { Ctx } from './util';

const DELAY = 0.15;
const CAP = 64;
/** a gap longer than this between frames means the escort was hidden / a new run began */
const GAP_RESET = 0.5;
const ESCORT_SCALE = 0.97;

export class EscortPainter {
  private readonly painter = new AgentPainter();
  private readonly times = new Float64Array(CAP);
  private readonly states: (PlayerState | null)[] = new Array(CAP).fill(null);
  private head = 0;
  private count = 0;
  private lastReal = Number.NEGATIVE_INFINITY;
  private lastStage = Number.NEGATIVE_INFINITY;

  reset(): void {
    this.states.fill(null);
    this.head = 0;
    this.count = 0;
  }

  /** Record this frame's agent state; returns the state from DELAY seconds ago. */
  private delayed(p: PlayerState, now: number): PlayerState {
    this.times[this.head] = now;
    this.states[this.head] = p;
    this.head = (this.head + 1) % CAP;
    this.count = Math.min(CAP, this.count + 1);
    let best: PlayerState | null = null;
    for (let i = 1; i <= this.count; i++) {
      const idx = (this.head - i + CAP) % CAP;
      if (this.times[idx] <= now - DELAY) {
        best = this.states[idx];
        break;
      }
      best = this.states[idx];
    }
    return best ?? p;
  }

  /**
   * Record this frame's agent state and return the escort's (delayed) state; call once per frame
   * before drawing, so the renderer knows which lane pass the escort belongs to.
   */
  update(p: PlayerState, realTime: number, stageTime: number): PlayerState {
    if (realTime - this.lastReal > GAP_RESET || stageTime < this.lastStage - 1e-3) this.reset();
    this.lastReal = realTime;
    this.lastStage = stageTime;
    return this.delayed(p, realTime);
  }

  /** Draw the escort in its own (delayed) lane, a step behind the agent; `hurt` = the agent was
   * just hit (the scientist stumbles). Civilian motion: no flips or knee slides. */
  draw(ctx: Ctx, q: PlayerState, realTime: number, scroll: number, running: boolean, rim: string, hurt = false): void {
    const d = visualLane(q);
    const depth = depthScale(d);
    const x = projX(PLAYER_X + ESCORT_DX, d);
    const floorY = laneY(d);
    this.painter.shadow(ctx, x, floorY, q.height, q.sliding, ESCORT_SCALE * depth);
    this.painter.draw(ctx, {
      x, id: 'prisoner', p: q, mood: hurt ? 'hurt' : running ? 'happy' : 'idle', t: realTime + 0.37, scroll: scroll - 23, running,
      blink: false, torch: false, scale: ESCORT_SCALE * depth, floorY, depth, lean: laneLean(q), rim, civilian: true,
    });
    ctx.globalAlpha = 1;
  }
}
