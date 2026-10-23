// The rescued prisoner running behind the agent. It replays the agent's moves with a
// short delay (ring buffer of recent player states), so jumps and slides ripple back.
import { PLAYER_X, type PlayerState } from '../types';
import { AgentPainter } from './agent';
import { ESCORT_DX } from './layout';
import type { Ctx } from './util';

const DELAY_FRAMES = 9;
const ESCORT_SCALE = 1.12;

export class EscortPainter {
  private readonly painter = new AgentPainter();
  private readonly buf: (PlayerState | null)[] = new Array(DELAY_FRAMES).fill(null);
  private head = 0;

  /** Record this frame's agent state; returns the delayed state for the escort. */
  private delayed(p: PlayerState): PlayerState {
    this.buf[this.head] = p;
    this.head = (this.head + 1) % DELAY_FRAMES;
    return this.buf[this.head] ?? p;
  }

  draw(ctx: Ctx, p: PlayerState, t: number, scroll: number, running: boolean): void {
    const q = this.delayed(p);
    const x = PLAYER_X + ESCORT_DX;
    this.painter.shadow(ctx, x, q.height, q.sliding, ESCORT_SCALE);
    this.painter.draw(ctx, {
      x, id: 'prisoner', p: q, mood: running ? 'happy' : 'idle', t: t + 0.37, scroll: scroll - 23, running,
      blink: false, torch: false, scale: ESCORT_SCALE,
    });
  }
}
