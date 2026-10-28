// @vitest-environment jsdom
// Office stage 5 result: the banner names the superior beaten last (사장님, the final section), not the first.
import { describe, expect, it } from 'vitest';
import type { ResultInfo } from '../../src/types';
import { bossBanner } from '../../src/ui/result-meta';

const won = (stageId: string) => ({ stageId, mode: 'stage', cleared: true }) as unknown as ResultInfo;
const nameOf = (el: HTMLElement | null) => el?.querySelector('.report__boss-name')?.textContent ?? null;

describe('office result boss banner', () => {
  it('stage 5 shows 사장님; stages 1-4 their own superior', () => {
    expect(nameOf(bossBanner(won('w5-s10')))).toBe('사장님');
    expect(bossBanner(won('w5-s10'))?.querySelector('img')?.getAttribute('src') ?? './art/boss-chimera.webp').toContain('boss-chimera');
    expect([1, 2, 3, 4].map((n) => nameOf(bossBanner(won(`w${n}-s10`))))).toEqual(['김대리', '박과장', '최팀장', '오부장']);
  });
});
