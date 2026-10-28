// Office vocabulary sweep (office spec §4, P4): no spy-operation words in anything the office build swaps
// in, and the player-facing data modules (moves, achievements, goals) are swapped. Runs on the office
// module graph, so goals and achievements see the office content and cutscenes.
import { describe, expect, it } from 'vitest';
import { OFFICE_SWAPS } from '../../build/office-swaps';
import { defaultSave } from '../../src/core/storage';

const BANNED = /작전|요원|포로|경비|레이저|침투|MISSION|AGENT|본부|OPERATION|임무|기지|탈출|구출|거점|CLASSIFIED|OPERATIVE/;
/** the game's own title (whole, or its second line on the title screen), and the spec §5 laser-pointer gag */
const ALLOWED = ['칼퇴근 대작전', '대작전', '레이저 포인터'];
/** v8 values the office flavour re-exports only for export parity (never shown) */
const PARITY_ONLY = new Set(['V8_COPY']);

function banned(v: unknown, path: string, out: string[], seen = new Set<unknown>()): string[] {
  if (typeof v === 'string') {
    const text = ALLOWED.reduce((t, ok) => t.split(ok).join(''), v);
    if (BANNED.test(text)) out.push(`${path}: ${v}`);
  } else if (v && typeof v === 'object' && !seen.has(v)) {
    seen.add(v);
    for (const [k, x] of Object.entries(v)) banned(x, `${path}.${k}`, out, seen);
  }
  return out;
}

const load = (path: string): Promise<Record<string, unknown>> => import(/* @vite-ignore */ new URL(`../../${path}`, import.meta.url).href);

describe('office vocabulary', () => {
  it('swaps the player-facing data modules', () => {
    expect(OFFICE_SWAPS).toMatchObject({
      'src/ui/moves.ts': 'src/office/ui/moves.ts',
      'src/core/achievements.ts': 'src/office/core/achievements.ts',
      'src/core/goals.ts': 'src/office/core/goals.ts',
    });
  });

  it('no swapped office module exports a spy word', async () => {
    const out: string[] = [];
    for (const path of Object.values(OFFICE_SWAPS)) {
      const mod = await load(path);
      for (const [name, value] of Object.entries(mod)) if (!PARITY_ONLY.has(name)) banned(value, `${path}:${name}`, out);
    }
    expect(out).toEqual([]);
  }, 30_000); // imports every swapped module: slow on a busy machine

  it('goals stay on office stages and never point at daily / endless / shop', async () => {
    const { nextGoal } = await import('../../src/office/core/goals');
    const { STAGES } = await import('../../src/office/core/content');
    const fresh = defaultSave();
    const allCleared = { ...fresh, stars: Object.fromEntries(STAGES.map((s) => [s.id, 1])) };
    const allThree = { ...fresh, stars: Object.fromEntries(STAGES.map((s) => [s.id, 3])) };
    const streak = { ...fresh, stars: { 'w1-s10': 1 }, dailyStreak: { last: '2026-10-28', count: 3 } };
    const goals = [fresh, { ...fresh, stars: { 'w1-s10': 2 } }, streak, allCleared, allThree].map((s) => nextGoal(s, '2026-10-29'));
    for (const g of goals) {
      expect(['first', 'boss', 'stage', 'achievement'], g.text).toContain(g.kind);
      expect(banned(g.text, 'goal', []), g.text).toEqual([]);
      expect(g.text).not.toMatch(/일일|무한|장비실/);
    }
    expect(goals[1].text).toContain('2단계');
  });

  it('achievements fit the five-stage office run and its two characters', async () => {
    const { ACHIEVEMENTS, evaluateAchievements } = await import('../../src/office/core/achievements');
    const ids = ACHIEVEMENTS.map((a) => a.id);
    for (const gone of ['zone-7', 'zone-10', 'escape', 'endless-60', 'endless-180', 'daily-1', 'daily-7', 'stars-150']) expect(ids).not.toContain(gone);
    const save = { ...defaultSave(), stars: { 'w1-s10': 1, 'w2-s10': 1, 'w3-s10': 1, 'w4-s10': 1, 'w5-s10': 1 } };
    const unlocked = evaluateAchievements(save, null);
    expect(unlocked).toEqual(expect.arrayContaining(['first-clear', 'zone-1', 'zone-3', 'zone-5']));
    // both characters are free from the start: no trophy for owning them
    expect(ids).not.toContain('all-operators');
  });
});
