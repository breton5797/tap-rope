// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  backoffMs, createOnline, DEVICE_KEY, LeaderboardUnavailableError, QUEUE_KEY, QUEUE_MAX, RunRejectedError, TIMEOUT_MS,
} from '../../src/platform/online';
import type { RunRecord } from '../../src/types';

const BASE = 'https://example.supabase.co';
const SECRET_RE = /^[0-9a-f]{64}$/;

const record = (clientScore = 100): RunRecord => ({
  sim: 'v7.1', mode: 'endless', seed: 7, date: '2026-10-27', inputs: [[0.5, 'T']], endTime: 12, clientScore,
});

type Handler = (path: string, init: RequestInit) => { status: number; body?: unknown } | 'offline' | 'hang';

function fakeFetch(handler: Handler) {
  const calls: Array<{ path: string; init: RequestInit }> = [];
  const fn = vi.fn((url: string, init: RequestInit) => {
    const path = url.slice(`${BASE}/functions/v1/`.length);
    calls.push({ path, init });
    const out = handler(path, init);
    if (out === 'offline') return Promise.reject(new TypeError('Failed to fetch'));
    if (out === 'hang') {
      return new Promise<Response>((_resolve, reject) => {
        init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
      });
    }
    return Promise.resolve(new Response(JSON.stringify(out.body ?? {}), { status: out.status }));
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

/** A small in-memory stand-in for the Edge Functions. */
function server(opts: { offline?: () => boolean } = {}): Handler {
  return (path, init) => {
    if (opts.offline?.()) return 'offline';
    const headers = init.headers as Record<string, string>;
    if (path === 'register') return { status: 200, body: { playerId: 'p1', nickname: null } };
    if (path === 'nickname') {
      const name = (JSON.parse(String(init.body)) as { nickname: string }).nickname;
      if (name === 'taken') return { status: 409, body: { error: 'taken' } };
      if (name === 'badword') return { status: 400, body: { error: 'banned' } };
      return { status: 200, body: { nickname: name } };
    }
    if (path === 'submit-run') {
      const r = JSON.parse(String(init.body)) as RunRecord;
      return { status: 200, body: { score: r.clientScore, rank: 1 } };
    }
    if (path.startsWith('leaderboard')) {
      const me = Boolean(headers['x-device-secret']);
      return {
        status: 200,
        body: {
          top: [{ rank: 1, nickname: 'A', score: 9, me: false }, { bogus: true }],
          mine: me ? { rank: 3, nickname: '요원-ABCD', score: 5, me: true } : null,
        },
      };
    }
    if (path === 'achievements') return { status: 200, body: { synced: 1 } };
    return { status: 404 };
  };
}

describe('online client', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates and persists a 256-bit device secret, registers lazily, and sends it as a header', async () => {
    const { fn, calls } = fakeFetch(server());
    const online = createOnline({ baseUrl: BASE, apiKey: 'pk', fetch: fn });
    expect(online.ready).toBe(false);
    await online.init();
    expect(online.ready).toBe(true);
    const saved = JSON.parse(localStorage.getItem(DEVICE_KEY) as string) as { secret: string; playerId: string };
    expect(saved.secret).toMatch(SECRET_RE);
    expect(saved.playerId).toBe('p1');
    const headers = calls[0].init.headers as Record<string, string>;
    expect(calls[0].path).toBe('register');
    expect(headers['x-device-secret']).toBe(saved.secret);
    expect(headers.apikey).toBe('pk');

    // a second client reuses the stored identity without registering again
    const again = fakeFetch(server());
    const online2 = createOnline({ baseUrl: BASE, fetch: again.fn });
    await online2.init();
    expect(again.calls).toHaveLength(0);
    expect(online2.ready).toBe(true);
  });

  it('ignores a corrupt stored identity and makes a new one', async () => {
    localStorage.setItem(DEVICE_KEY, '{"secret":"nope"');
    const { fn } = fakeFetch(server());
    const online = createOnline({ baseUrl: BASE, fetch: fn });
    await online.init();
    expect((JSON.parse(localStorage.getItem(DEVICE_KEY) as string) as { secret: string }).secret).toMatch(SECRET_RE);
  });

  it('sets a nickname and maps server errors to Korean messages', async () => {
    const { fn, calls } = fakeFetch(server());
    const online = createOnline({ baseUrl: BASE, fetch: fn });
    await online.init();
    expect(await online.setNickname('a')).toMatch(/2–12자/);
    expect(await online.setNickname('bad name!')).toMatch(/2–12자/);
    expect(calls.filter((c) => c.path === 'nickname')).toHaveLength(0); // validated locally first
    expect(await online.setNickname('taken')).toMatch(/이미/);
    expect(await online.setNickname('badword')).toMatch(/단어/);
    expect(await online.setNickname(' 요원_7 ')).toBeNull();
    expect(online.nickname()).toBe('요원_7');
  });

  it('returns an offline message when the server cannot be reached', async () => {
    const { fn } = fakeFetch(() => 'offline');
    const online = createOnline({ baseUrl: BASE, fetch: fn });
    await online.init();
    expect(online.ready).toBe(false);
    expect(await online.setNickname('요원')).toMatch(/연결/);
  });

  it('submits a run and returns the server score', async () => {
    const { fn } = fakeFetch(server());
    const online = createOnline({ baseUrl: BASE, fetch: fn });
    await online.init();
    expect(await online.submitRun(record(321))).toEqual({ score: 321, rank: 1 });
  });

  it.each([
    [409, 'sim_version'],
    [400, 'bad_inputs'],
    [422, 'sim_failed'],
    [429, 'rate_limited'],
  ])('rejects (and does not queue) a run the server refuses: %i %s', async (status, code) => {
    const { fn } = fakeFetch((path) =>
      path === 'register' ? { status: 200, body: { playerId: 'p1' } } : { status, body: { error: code } });
    const online = createOnline({ baseUrl: BASE, fetch: fn });
    await online.init();
    const err = await online.submitRun(record()).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RunRejectedError);
    expect(err).toMatchObject({ code, status });
    expect(localStorage.getItem(QUEUE_KEY)).toBeNull();
  });

  it('queues runs while offline (max 20) and flushes them on the online event', async () => {
    let down = true;
    const { fn, calls } = fakeFetch(server({ offline: () => down }));
    const target = new EventTarget();
    const online = createOnline({ baseUrl: BASE, fetch: fn, target });
    await online.init();
    for (let i = 0; i < QUEUE_MAX + 3; i++) expect(await online.submitRun(record(i))).toBeNull();
    const queued = JSON.parse(localStorage.getItem(QUEUE_KEY) as string) as Array<{ record: RunRecord }>;
    expect(queued).toHaveLength(QUEUE_MAX);
    expect(queued[0].record.clientScore).toBe(3); // oldest dropped

    down = false;
    calls.length = 0;
    target.dispatchEvent(new Event('online'));
    await vi.waitFor(() => expect(JSON.parse(localStorage.getItem(QUEUE_KEY) as string)).toHaveLength(0));
    expect(calls.filter((c) => c.path === 'submit-run')).toHaveLength(QUEUE_MAX);
    expect(calls[0].path).toBe('register');
  });

  it('retries queued runs with exponential backoff', async () => {
    let down = true;
    const { fn, calls } = fakeFetch(server({ offline: () => down }));
    const online = createOnline({ baseUrl: BASE, fetch: fn, target: new EventTarget() });
    await online.init();
    await online.submitRun(record(5));
    const submits = () => calls.filter((c) => c.path === 'submit-run').length;
    expect(submits()).toBe(0); // offline: register failed, nothing reached submit-run
    await vi.advanceTimersByTimeAsync(backoffMs(0));
    const queued = JSON.parse(localStorage.getItem(QUEUE_KEY) as string) as Array<{ attempts: number }>;
    expect(queued[0].attempts).toBe(1);
    down = false;
    await vi.advanceTimersByTimeAsync(backoffMs(1));
    expect(submits()).toBe(1);
    expect(JSON.parse(localStorage.getItem(QUEUE_KEY) as string)).toHaveLength(0);
    expect(backoffMs(2)).toBe(2 * backoffMs(1));
    expect(backoffMs(30)).toBe(10 * 60 * 1000);
  });

  it('queues on 5xx and keeps a queued run on 429 (backs off) but drops it on other 4xx', async () => {
    let status = 503;
    const { fn } = fakeFetch((path) => (path === 'register' ? { status: 200, body: { playerId: 'p1' } } : { status }));
    const online = createOnline({ baseUrl: BASE, fetch: fn, target: new EventTarget() });
    await online.init();
    expect(await online.submitRun(record())).toBeNull();
    const queue = () => JSON.parse(localStorage.getItem(QUEUE_KEY) as string) as Array<{ attempts: number }>;
    expect(queue()).toHaveLength(1);
    status = 429;
    await vi.advanceTimersByTimeAsync(backoffMs(0));
    expect(queue()).toEqual([expect.objectContaining({ attempts: 1 })]);
    status = 400;
    await vi.advanceTimersByTimeAsync(backoffMs(1));
    expect(queue()).toHaveLength(0);
  });

  it('times out hung requests after 8s without throwing', async () => {
    const { fn } = fakeFetch(() => 'hang');
    const online = createOnline({ baseUrl: BASE, fetch: fn, target: new EventTarget() });
    const pending = online.init();
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    await expect(pending).resolves.toBeUndefined();
    expect(online.ready).toBe(false);
  });

  it('re-registers once when the server no longer knows the device (401)', async () => {
    let known = false;
    const { fn, calls } = fakeFetch((path, init) => {
      if (path === 'register') {
        known = true;
        return { status: 200, body: { playerId: 'p2' } };
      }
      return known ? server()(path, init) : { status: 401, body: { error: 'bad_secret' } };
    });
    localStorage.setItem(DEVICE_KEY, JSON.stringify({ secret: 'a'.repeat(64), playerId: 'stale', nickname: 'x' }));
    const online = createOnline({ baseUrl: BASE, fetch: fn });
    expect(await online.submitRun(record(9))).toEqual({ score: 9, rank: 1 });
    expect(calls.map((c) => c.path)).toEqual(['submit-run', 'register', 'submit-run']);
  });

  it('fetches leaderboards with my row when registered and filters malformed rows', async () => {
    const { fn, calls } = fakeFetch(server());
    const online = createOnline({ baseUrl: BASE, fetch: fn });
    const anon = await online.leaderboard('endless');
    expect(anon.mine).toBeNull();
    expect((calls[0].init.headers as Record<string, string>)['x-device-secret']).toBeUndefined();
    await online.init();
    const board = await online.leaderboard('daily:2026-10-27');
    expect(calls.at(-1)?.path).toBe('leaderboard?board=daily%3A2026-10-27');
    expect(board.top).toEqual([{ rank: 1, nickname: 'A', score: 9, me: false }]);
    expect(board.mine).toEqual({ rank: 3, nickname: '요원-ABCD', score: 5, me: true });
  });

  it('resolves a real empty board', async () => {
    const { fn } = fakeFetch(() => ({ status: 200, body: { board: 'endless', top: [], mine: null } }));
    expect(await createOnline({ baseUrl: BASE, fetch: fn }).leaderboard('endless')).toEqual({ top: [], mine: null });
  });

  it.each([
    ['offline', () => 'offline' as const, null],
    ['a 5xx', () => ({ status: 503 }), 503],
    ['a 4xx', () => ({ status: 400, body: { error: 'bad_board' } }), 400],
  ])('rejects the leaderboard when %s', async (_name, handler, status) => {
    const { fn } = fakeFetch(handler);
    const err = await createOnline({ baseUrl: BASE, fetch: fn }).leaderboard('endless-week').catch((e: unknown) => e);
    expect(err).toBeInstanceOf(LeaderboardUnavailableError);
    expect(err).toMatchObject({ status });
  });

  it('rejects the leaderboard after the 8s timeout', async () => {
    const { fn } = fakeFetch(() => 'hang');
    const pending = createOnline({ baseUrl: BASE, fetch: fn }).leaderboard('endless').catch((e: unknown) => e);
    await vi.advanceTimersByTimeAsync(TIMEOUT_MS);
    expect(await pending).toBeInstanceOf(LeaderboardUnavailableError);
  });

  it('syncs achievements and skips empty sets', async () => {
    const { fn, calls } = fakeFetch(server());
    const online = createOnline({ baseUrl: BASE, fetch: fn });
    await online.init();
    await online.syncAchievements({});
    expect(calls.filter((c) => c.path === 'achievements')).toHaveLength(0);
    await online.syncAchievements({ 'first-clear': 1_793_000_000_000 });
    const sent = calls.find((c) => c.path === 'achievements');
    expect(JSON.parse(String(sent?.init.body))).toEqual({ unlocked: { 'first-clear': 1_793_000_000_000 } });
  });

  it('is a silent no-op without a configured URL', async () => {
    const { fn, calls } = fakeFetch(server());
    const online = createOnline({ baseUrl: '', fetch: fn });
    await online.init();
    expect(online.ready).toBe(false);
    expect(await online.submitRun(record())).toBeNull();
    await expect(online.leaderboard('endless')).rejects.toBeInstanceOf(LeaderboardUnavailableError);
    await online.syncAchievements({ 'zone-1': 1 });
    expect(calls).toHaveLength(0);
  });

  it('keeps working when localStorage throws', async () => {
    const broken = {
      getItem: () => { throw new Error('denied'); },
      setItem: () => { throw new Error('denied'); },
    } as unknown as Storage;
    const { fn } = fakeFetch(server());
    const online = createOnline({ baseUrl: BASE, fetch: fn, storage: broken });
    await online.init();
    expect(online.ready).toBe(true);
    expect(await online.submitRun(record(4))).toEqual({ score: 4, rank: 1 });
  });
});
