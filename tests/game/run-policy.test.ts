import { describe, expect, it } from 'vitest';
import { AUTOPLAY_NOTE, autoplayResult, takeChallenge, withoutChallenge } from '../../src/game/run-policy';
import type { ResultInfo } from '../../src/types';

describe('takeChallenge', () => {
  const c = { seed: 1234, vs: 900 };
  it('the first endless run uses the challenge seed and spends it', () => {
    const first = takeChallenge('endless', c);
    expect(first).toEqual({ seed: 1234, pending: null });
    expect(takeChallenge('endless', first.pending)).toEqual({ seed: null, pending: null });
  });
  it('stage and daily runs leave the challenge pending', () => {
    expect(takeChallenge('stage', c)).toEqual({ seed: null, pending: c });
    expect(takeChallenge('daily', c)).toEqual({ seed: null, pending: c });
  });
});

describe('withoutChallenge', () => {
  it('drops endless / vs and keeps the rest', () => {
    expect(withoutChallenge('?endless=5&vs=10')).toBe('');
    expect(withoutChallenge('?endless=5&vs=10&memdebug')).toBe('?memdebug=');
    expect(withoutChallenge('')).toBe('');
  });
});

describe('autoplayResult', () => {
  it('earns nothing and says so', () => {
    const base = { title: '1-1 · 외곽', score: 900, best: 900, newRecord: true, coinsEarned: 12 } as ResultInfo;
    const r = autoplayResult(base, 300);
    expect(r).toMatchObject({ best: 300, newRecord: false, coinsEarned: 0, score: 900 });
    expect(r.title).toContain(AUTOPLAY_NOTE);
  });
});
