import { describe, expect, it } from 'vitest';
import { shouldRegister } from '../../src/platform/pwa';

describe('service worker registration', () => {
  it('registers in production web builds', () => {
    expect(shouldRegister({ PROD: true, MODE: 'production' })).toBe(true);
    expect(shouldRegister({ PROD: true, MODE: 'office' })).toBe(true);
  });

  it('skips dev builds and the iPad app build (it ships no sw.js)', () => {
    expect(shouldRegister({ PROD: false, MODE: 'development' })).toBe(false);
    expect(shouldRegister({ PROD: true, MODE: 'office-app' })).toBe(false);
  });
});
