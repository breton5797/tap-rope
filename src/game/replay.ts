/**
 * Server-side score verification (GDD-v7 §3.2): re-simulates a recorded endless/daily run with the
 * same pure session code the client plays. Inputs were applied at deterministic session boundaries,
 * so replaying them at the same times reproduces the run exactly. No DOM — bundled for the Edge Function.
 */
import type { RunInput, RunRecord } from '../types';
import { advanceTo, createSession, lane, slide, swipe, tap, type Session } from './session';

/** bump whenever gameplay, generation or scoring changes — the server rejects other versions */
export const SIM_VERSION = 'le-v7.1';

const MAX_INPUTS = 20000;
const MAX_TIME = 3600;

export interface SimResult {
  readonly score: number;
  readonly endTime: number;
  readonly status: Session['status'];
}

function applyInput(s: Session, code: RunInput[1]): Session {
  switch (code) {
    case 'T': return tap(s).session;
    case 'D': return swipe(s, 'down').session;
    case 'S': return slide(s).session;
    case 'U': return lane(s, -1).session;
    case 'N': return lane(s, 1).session;
    default: throw new Error(`replay: unknown input code ${String(code)}`);
  }
}

function validate(r: RunRecord): void {
  if (r.sim !== SIM_VERSION) throw new Error(`replay: sim version ${r.sim} != ${SIM_VERSION}`);
  if (r.mode !== 'endless' && r.mode !== 'daily') throw new Error('replay: bad mode');
  if (!Number.isFinite(r.endTime) || r.endTime < 0 || r.endTime > MAX_TIME) throw new Error('replay: bad endTime');
  if (!Array.isArray(r.inputs) || r.inputs.length > MAX_INPUTS) throw new Error('replay: bad inputs');
  let prev = 0;
  for (const i of r.inputs) {
    if (!Array.isArray(i) || !Number.isFinite(i[0])) throw new Error('replay: bad input');
    if (i[0] < prev) throw new Error('replay: inputs out of order');
    prev = i[0];
  }
}

export function simulateRun(r: RunRecord): SimResult {
  validate(r);
  let s = r.mode === 'daily'
    ? createSession('daily', null, { date: r.date })
    : createSession('endless', null, { seed: r.seed });
  for (const [time, code] of r.inputs) {
    if (time > r.endTime || s.status !== 'playing') break;
    s = advanceTo(s, time).session;
    if (s.status !== 'playing') break;
    s = applyInput(s, code);
  }
  if (s.status === 'playing') s = advanceTo(s, r.endTime).session;
  return { score: s.score.score, endTime: s.time, status: s.status };
}
