import { describe, expect, it } from 'vitest';
import { legalHref } from '../../src/office/ui/legal-href';

describe('legal page links', () => {
  it('web: the pages next to the game', () => {
    expect(legalHref('privacy.html', 'office')).toBe('./privacy.html');
    expect(legalHref('terms.html', 'production')).toBe('./terms.html');
  });

  it('app: the published pages, so the system browser opens them and the game stays put', () => {
    expect(legalHref('privacy.html', 'office-app')).toBe('https://breton5797.github.io/tap-rope/office/privacy.html');
    expect(legalHref('terms.html', 'office-app')).toBe('https://breton5797.github.io/tap-rope/office/terms.html');
  });
});
