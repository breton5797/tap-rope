// Miss popups read from the flavour copy (core polish round): v8 keeps its exact strings.
import { describe, expect, it } from 'vitest';
import { missText } from '../../src/game/feedback';

describe('missText (v8)', () => {
  it('is the same text v8 always showed', () => {
    expect(missText('drone', 1)).toBe('DETECTED · 고도 낮춰');
    expect(missText('level', 2)).toBe('MISS · 고도 부족');
    expect(missText('level', 3)).toBe('MISS · 고도 부족');
    expect(missText('low', 1)).toBe('MISS · 점프');
    expect(missText('slide', 1)).toBe('MISS · 점프 구간');
    expect(missText('standing', 1)).toBe('MISS · 슬라이딩');
    expect(missText('lane', 1)).toBe('MISS · 레인 이탈');
    expect(missText(undefined, 1)).toBe('MISS');
  });
});
