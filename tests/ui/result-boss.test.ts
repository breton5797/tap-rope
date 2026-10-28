// @vitest-environment jsdom
// v8 result boss banner: the zone boss (one per boss stage), unchanged by the office per-section seam.
import { describe, expect, it } from 'vitest';
import type { ResultInfo } from '../../src/types';
import { bossBanner } from '../../src/ui/result-meta';

const won = (stageId: string) => ({ stageId, mode: 'stage', cleared: true }) as unknown as ResultInfo;

describe('v8 result boss banner', () => {
  it('names the zone boss of the cleared boss stage', () => {
    expect(bossBanner(won('w5-s10'))?.querySelector('.report__boss-name')?.textContent).toBe('간수장 로봇');
    expect(bossBanner(won('w5-s9'))).toBeNull();
  });
});
