// Office sprite loading (review): renderer.load() awaits the office art (with a timeout) so a first visit
// doesn't flip between v8 drawings and sprites mid-run, and a failed file is retried on the next load().
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** fake Image: files in `ok` load after `delay` ms, others fail; files in `never` never settle */
class FakeImage {
  static ok = new Set<string>();
  static never = new Set<string>();
  static delay = 5;
  static requests: string[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  decoding = '';
  complete = false;
  naturalWidth = 0;
  naturalHeight = 0;
  set src(url: string) {
    FakeImage.requests.push(url);
    const name = url.replace('./art/', '').replace('.webp', '');
    if (FakeImage.never.has(name)) return;
    setTimeout(() => {
      this.complete = true;
      if (FakeImage.ok.has(name)) {
        this.naturalWidth = 512;
        this.naturalHeight = 512;
        this.onload?.();
      } else this.onerror?.();
    }, FakeImage.delay);
  }
}

const fresh = async () => {
  vi.resetModules();
  return import('../../src/office/render/images');
};

beforeEach(() => {
  FakeImage.ok = new Set();
  FakeImage.never = new Set();
  FakeImage.requests = [];
  vi.stubGlobal('Image', FakeImage);
});
afterEach(() => vi.unstubAllGlobals());

describe('office images', () => {
  it('loadImages resolves once every file has loaded or failed', async () => {
    FakeImage.ok = new Set(['prop-golf']);
    const m = await fresh();
    await m.loadImages(['prop-golf', 'prop-nope'], 1000);
    expect(m.officeImage('prop-golf')).not.toBeNull();
    expect(m.officeImage('prop-nope')).toBeNull();
  });

  it('gives up after the timeout (the game starts; late files appear when they arrive)', async () => {
    FakeImage.never = new Set(['prop-slow']);
    const m = await fresh();
    const t0 = Date.now();
    await m.loadImages(['prop-slow'], 40);
    expect(Date.now() - t0).toBeLessThan(500);
    expect(m.officeImage('prop-slow')).toBeNull();
  });

  it('retries a file that failed on the next load', async () => {
    const m = await fresh();
    await m.loadImages(['hero-kid-run1'], 1000);
    expect(m.officeImage('hero-kid-run1')).toBeNull();
    FakeImage.ok = new Set(['hero-kid-run1']);
    await m.loadImages(['hero-kid-run1'], 1000);
    expect(m.officeImage('hero-kid-run1')).not.toBeNull();
    expect(FakeImage.requests.filter((u) => u.includes('hero-kid-run1'))).toHaveLength(2);
  });

  it('lists every hero frame, prop and superior for preloading', async () => {
    const m = await fresh();
    expect(m.OFFICE_ART).toContain('hero-cat-slide');
    expect(m.OFFICE_ART).toContain('prop-revolving-door');
    expect(m.OFFICE_ART).toContain('boss-chimera');
    expect(m.OFFICE_ART.filter((n) => n.startsWith('hero-'))).toHaveLength(16);
    expect(m.OFFICE_ART.filter((n) => n.startsWith('prop-'))).toHaveLength(20);
  });
});
