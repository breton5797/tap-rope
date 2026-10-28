import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BANNER_MS, bannerFor, createToastQueue, GATHER_MS, LEAVE_MS, type Banner } from '../../src/ui/toast-queue';
import type { AchievementMeta } from '../../src/types';

const A = (id: string, name = id): AchievementMeta => ({ id, name, desc: `${name} desc` }) as AchievementMeta;

describe('bannerFor', () => {
  it('one achievement shows itself, several collapse into a count', () => {
    expect(bannerFor([])).toBeNull();
    expect(bannerFor([A('a', '첫 임무')])).toEqual({ id: 'a', title: '첫 임무', desc: '첫 임무 desc', count: 1 });
    const b = bannerFor([A('a', '첫 임무'), A('b', '구역 1'), A('c', '연속')]);
    expect(b?.title).toBe('업적 3개 달성');
    expect(b?.desc).toBe('첫 임무 · 구역 1 · 연속');
  });
});

describe('createToastQueue', () => {
  let shown: Banner[];
  let leaving: number;
  const show = (b: Banner): (() => void) => {
    shown.push(b);
    return () => { leaving++; };
  };
  beforeEach(() => {
    vi.useFakeTimers();
    shown = [];
    leaving = 0;
  });
  afterEach(() => vi.useRealTimers());

  it('collapses unlocks that arrive together into one banner', () => {
    const q = createToastQueue(show);
    q.push(A('a'));
    q.push(A('b'));
    vi.advanceTimersByTime(GATHER_MS);
    expect(shown.map((b) => b.count)).toEqual([2]);
  });

  it('shows one banner at a time, the next after the first has left', () => {
    const q = createToastQueue(show);
    q.push(A('a'));
    vi.advanceTimersByTime(GATHER_MS);
    q.push(A('b'));
    vi.advanceTimersByTime(GATHER_MS + 100);
    expect(shown.length).toBe(1);
    vi.advanceTimersByTime(BANNER_MS);
    expect(leaving).toBe(1);
    vi.advanceTimersByTime(LEAVE_MS);
    expect(shown.map((b) => b.title)).toEqual(['a', 'b']);
  });

  it('waits while blocked (countdown / briefing) and flushes when unblocked', () => {
    const q = createToastQueue(show);
    q.setBlocked(true);
    q.push(A('a'));
    vi.advanceTimersByTime(5000);
    expect(shown.length).toBe(0);
    q.setBlocked(false);
    vi.advanceTimersByTime(GATHER_MS);
    expect(shown.length).toBe(1);
  });

  it('clear drops what is waiting (result card shows badges instead)', () => {
    const q = createToastQueue(show);
    q.setBlocked(true);
    q.push(A('a'));
    q.clear();
    q.setBlocked(false);
    vi.advanceTimersByTime(5000);
    expect(shown.length).toBe(0);
  });

  it('ignores a duplicate unlock still waiting', () => {
    const q = createToastQueue(show);
    q.push(A('a'));
    q.push(A('a'));
    vi.advanceTimersByTime(GATHER_MS);
    expect(shown[0].count).toBe(1);
  });
});
