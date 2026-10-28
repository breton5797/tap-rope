import { describe, expect, it } from 'vitest';
import { challengeUrl, parseChallenge, shareText } from '../../src/ui/share';

describe('challenge link', () => {
  it('parses ?endless=<seed>&vs=<score>', () => {
    expect(parseChallenge('?endless=123456&vs=4200')).toEqual({ seed: 123456, vs: 4200 });
    expect(parseChallenge('?endless=77')).toEqual({ seed: 77, vs: null });
    expect(parseChallenge('?autoplay=1&endless=5&vs=-3')).toEqual({ seed: 5, vs: null });
  });

  it('ignores missing or bad seeds', () => {
    for (const q of ['', '?vs=10', '?endless=abc', '?endless=-1', '?endless=1.5', '?endless=99999999999']) {
      expect(parseChallenge(q)).toBeNull();
    }
  });

  it('builds a link back to the same course on the current page', () => {
    expect(challengeUrl('https://ex.com/game/?autoplay=1#x', 42, 900)).toBe('https://ex.com/game/?endless=42&vs=900');
    expect(parseChallenge(new URL(challengeUrl('https://ex.com/', 42, 900)).search)).toEqual({ seed: 42, vs: 900 });
  });

  it('share text names the mode and score', () => {
    expect(shareText({ mode: 'endless', score: 12345, title: '무한 침투' })).toContain('12,345');
    expect(shareText({ mode: 'daily', score: 900, title: '일일 작전 10.28' })).toContain('일일 작전');
  });
});
