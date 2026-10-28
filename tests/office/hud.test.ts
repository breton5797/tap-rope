// Office HUD (Review Focus 2): on stage 5 the HUD boss bar follows the section's superior and its own gauge.
// Loads the shared v8 snapshot.ts through Vite with the office module swaps, exactly as the office build does.
import { createServer, type ViteDevServer } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { OFFICE_SWAPS } from '../../build/office-swaps';
import { swapModules } from '../../build/swap-modules';
import { stageById } from '../../src/core/content';
import { createSession, type Session } from '../../src/game/session';
import type * as Snapshot from '../../src/game/snapshot';
import type { Beat, StageDef } from '../../src/types';
import { HAZARD_KINDS } from '../../src/types';

let server: ViteDevServer;
let toHud: typeof Snapshot.toHud;

beforeAll(async () => {
  server = await createServer({
    configFile: false, root: new URL('../..', import.meta.url).pathname, logLevel: 'silent', appType: 'custom',
    plugins: [swapModules(OFFICE_SWAPS)], server: { middlewareMode: true, hmr: false, ws: false },
  });
  ({ toHud } = (await server.ssrLoadModule('/src/game/snapshot.ts')) as typeof Snapshot);
}, 30_000);
afterAll(() => server?.close());

const isHazard = (b: Beat) => b.obstacles.some((o) => HAZARD_KINDS.includes(o.kind));

/** the session just after the door into `section`, with every earlier hazard done */
function atSection(s: Session, section: number): Session {
  const time = section === 0 ? 0 : s.doors[section - 1].time + 0.01;
  const hazardDone = s.beats.filter((b) => isHazard(b) && b.section < section).length;
  return { ...s, time, section, hazardDone };
}

describe('office HUD boss bar', () => {
  it('stage 5 gauge resets per section and names the section superior', () => {
    const s = createSession('stage', { ...(stageById('w5-s10') as StageDef), seed: 4242 });
    expect([0, 1, 2].map((i) => toHud(atSection(s, i)).boss?.name)).toEqual(['한전무', '윤이사', '사장님']);
    for (const i of [0, 1, 2]) expect(toHud(atSection(s, i)).boss?.hp, `section ${i}`).toBe(1);
    // halfway through section 1: only section-1 hazards count
    const sec1 = atSection(s, 1);
    const own = s.beats.filter((b) => isHazard(b) && b.section === 1).length;
    const half = Math.floor(own / 2);
    expect(toHud({ ...sec1, hazardDone: sec1.hazardDone + half }).boss?.hp).toBeCloseTo(1 - half / own, 9);
  });

  it('stages 1-4 keep one superior and a whole-stage gauge', () => {
    const s = createSession('stage', stageById('w2-s10') as StageDef);
    const later = atSection(s, 2);
    expect(toHud(later).boss?.name).toBe('박과장');
    expect(toHud(later).boss?.hp).toBeCloseTo(1 - later.hazardDone / s.hazardTotal, 9);
  });
});
