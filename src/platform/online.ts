// Online client (GDD-v7 §3.3): plain fetch to the Supabase Edge Functions, identified by a random
// device secret. Every failure degrades to "offline" (null / empty) — the only rejection is
// submitRun when the server refuses a run (RunRejectedError).
import type { AchievementId, Board, LeaderboardRow, OnlineApi, RunRecord } from '../types';

export const DEVICE_KEY = 'laserescape.device.v1';
export const QUEUE_KEY = 'laserescape.queue.v1';
export const QUEUE_MAX = 20;
export const TIMEOUT_MS = 8000;
const BACKOFF_BASE_MS = 5000;
const BACKOFF_MAX_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 12;
const NICK_RE = /^[가-힣A-Za-z0-9_]{2,12}$/;

const MSG = {
  invalid: '2–12자의 한글·영문·숫자·_만 쓸 수 있어요',
  banned: '쓸 수 없는 단어가 들어 있어요',
  taken: '이미 다른 요원이 쓰는 이름이에요',
  offline: '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요',
} as const;

interface Identity {
  readonly secret: string;
  readonly playerId: string | null;
  readonly nickname: string | null;
}

interface QueuedRun {
  readonly id: string;
  readonly record: RunRecord;
  readonly attempts: number;
  readonly nextAt: number;
}

/** submitRun rejects with this when the server refuses the run (code: bad_inputs, sim_version, sim_failed, rate_limited, …). */
export class RunRejectedError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(`run rejected: ${code}`);
    this.name = 'RunRejectedError';
  }
}

type SendOutcome = { readonly score: number; readonly rank: number } | RunRejectedError | 'retry';

/** Outcome of one HTTP call: a parsed JSON body with its status, or null when the network failed. */
type Reply = { readonly status: number; readonly body: Record<string, unknown> } | null;

export interface OnlineDeps {
  readonly baseUrl?: string; // project URL (VITE_SUPABASE_URL)
  readonly apiKey?: string; // publishable key (VITE_SUPABASE_PUBLISHABLE_KEY)
  readonly fetch?: typeof fetch;
  readonly storage?: Storage;
  readonly now?: () => number;
  readonly random?: (bytes: Uint8Array) => Uint8Array;
  readonly target?: Pick<EventTarget, 'addEventListener'>;
}

const EMPTY_BOARD = { top: [] as readonly LeaderboardRow[], mine: null };

const env = (key: string): string | undefined => {
  const v: unknown = (import.meta.env as Record<string, unknown> | undefined)?.[key];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
};

function safeStorage(): Storage | undefined {
  try {
    return typeof localStorage === 'undefined' ? undefined : localStorage;
  } catch {
    return undefined; // Safari private mode / blocked storage
  }
}

function readJson<T>(storage: Storage | undefined, key: string): T | null {
  try {
    const raw = storage?.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: Storage | undefined, key: string, value: unknown): void {
  try {
    storage?.setItem(key, JSON.stringify(value));
  } catch {
    // quota / private mode: keep working in memory
  }
}

const isIdentity = (v: unknown): v is Identity =>
  typeof v === 'object' && v !== null && typeof (v as Identity).secret === 'string' && /^[0-9a-f]{64}$/.test((v as Identity).secret);

const toHex = (bytes: Uint8Array): string => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');

export const backoffMs = (attempts: number): number => Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** attempts);

export function createOnline(deps: OnlineDeps = {}): OnlineApi {
  const baseUrl = deps.baseUrl ?? env('VITE_SUPABASE_URL');
  const apiKey = deps.apiKey ?? env('VITE_SUPABASE_PUBLISHABLE_KEY');
  const doFetch = deps.fetch ?? (typeof fetch === 'function' ? fetch.bind(globalThis) : undefined);
  const storage = deps.storage ?? safeStorage();
  const now = deps.now ?? (() => Date.now());
  const random = deps.random ?? ((b: Uint8Array) => crypto.getRandomValues(b));
  const target = deps.target ?? (typeof window === 'undefined' ? undefined : window);
  const enabled = Boolean(baseUrl && doFetch);

  let identity: Identity | null = null;
  let registering: Promise<boolean> | null = null;
  let flushing = false;
  let flushTimer: ReturnType<typeof setTimeout> | null = null;
  let initialized = false;

  function loadIdentity(): Identity {
    if (identity) return identity;
    const saved = readJson<unknown>(storage, DEVICE_KEY);
    identity = isIdentity(saved)
      ? { secret: saved.secret, playerId: saved.playerId ?? null, nickname: saved.nickname ?? null }
      : { secret: toHex(random(new Uint8Array(32))), playerId: null, nickname: null };
    writeJson(storage, DEVICE_KEY, identity);
    return identity;
  }

  function saveIdentity(next: Identity): void {
    identity = next;
    writeJson(storage, DEVICE_KEY, next);
  }

  async function call(path: string, init: { method: 'GET' | 'POST'; body?: unknown; auth?: boolean }): Promise<Reply> {
    if (!enabled) return null;
    const controller = typeof AbortController === 'undefined' ? null : new AbortController();
    const timer = controller ? setTimeout(() => controller.abort(), TIMEOUT_MS) : null;
    try {
      const headers: Record<string, string> = {};
      if (apiKey) headers.apikey = apiKey;
      if (init.auth !== false) headers['x-device-secret'] = loadIdentity().secret;
      if (init.body !== undefined) headers['content-type'] = 'application/json';
      const res = await (doFetch as typeof fetch)(`${(baseUrl as string).replace(/\/$/, '')}/functions/v1/${path}`, {
        method: init.method,
        headers,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller?.signal,
      });
      let body: Record<string, unknown> = {};
      try {
        const parsed: unknown = await res.json();
        if (typeof parsed === 'object' && parsed !== null) body = parsed as Record<string, unknown>;
      } catch {
        // non-JSON error page from the gateway
      }
      return { status: res.status, body };
    } catch {
      return null; // offline, aborted (timeout), CORS
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Lazily registers the device; resolves true once the server knows it. */
  function ensureRegistered(): Promise<boolean> {
    const id = loadIdentity();
    if (id.playerId) return Promise.resolve(true);
    if (!enabled) return Promise.resolve(false);
    registering ??= call('register', { method: 'POST' })
      .then((reply) => {
        const playerId = reply?.status === 200 ? reply.body.playerId : undefined;
        if (typeof playerId !== 'string') return false;
        const nickname = typeof reply?.body.nickname === 'string' ? reply.body.nickname : null;
        saveIdentity({ ...loadIdentity(), playerId, nickname });
        return true;
      })
      .finally(() => {
        registering = null;
      });
    return registering;
  }

  /** Calls an authenticated endpoint; on 401 (server forgot this device) re-registers once and retries. */
  async function authed(path: string, init: { method: 'GET' | 'POST'; body?: unknown }): Promise<Reply> {
    if (!(await ensureRegistered())) return null;
    const reply = await call(path, init);
    if (reply?.status !== 401) return reply;
    saveIdentity({ ...loadIdentity(), playerId: null });
    if (!(await ensureRegistered())) return null;
    return call(path, init);
  }

  const readQueue = (): QueuedRun[] => {
    const q = readJson<unknown>(storage, QUEUE_KEY);
    return Array.isArray(q) ? (q as QueuedRun[]) : [];
  };
  const writeQueue = (q: readonly QueuedRun[]): void => writeJson(storage, QUEUE_KEY, q.slice(-QUEUE_MAX));

  function enqueue(record: RunRecord): void {
    writeQueue([...readQueue(), { id: toHex(random(new Uint8Array(8))), record, attempts: 0, nextAt: now() + backoffMs(0) }]);
    scheduleFlush();
  }

  function scheduleFlush(): void {
    if (flushTimer !== null) clearTimeout(flushTimer);
    const q = readQueue();
    if (q.length === 0) return;
    const wait = Math.max(0, Math.min(...q.map((e) => e.nextAt)) - now());
    flushTimer = setTimeout(() => {
      flushTimer = null;
      void flush();
    }, wait);
  }

  /** Sends one run: 'retry' when the server can't be reached (offline, timeout, 5xx), else its verdict. */
  async function send(record: RunRecord): Promise<SendOutcome> {
    const reply = await authed('submit-run', { method: 'POST', body: record });
    if (reply === null || reply.status >= 500) return 'retry';
    const { score, rank, error } = reply.body;
    if (reply.status === 200 && typeof score === 'number') return { score, rank: typeof rank === 'number' ? rank : 0 };
    return new RunRejectedError(typeof error === 'string' ? error : `http_${reply.status}`, reply.status);
  }

  async function flush(force = false): Promise<void> {
    if (flushing || !enabled) return;
    flushing = true;
    try {
      for (const entry of readQueue()) {
        if (!force && entry.nextAt > now()) continue;
        const outcome = await send(entry.record);
        const rest = readQueue().filter((e) => e.id !== entry.id);
        // queued runs also back off on 429; other rejections (bad replay, version, stale date) are dropped
        const transient = outcome === 'retry' || (outcome instanceof RunRejectedError && outcome.status === 429);
        if (transient && entry.attempts + 1 < MAX_ATTEMPTS) {
          writeQueue([...rest, { ...entry, attempts: entry.attempts + 1, nextAt: now() + backoffMs(entry.attempts + 1) }]);
          break; // still offline: don't hammer the rest
        }
        writeQueue(rest);
      }
    } catch {
      // never throw from background work
    } finally {
      flushing = false;
      scheduleFlush();
    }
  }

  return {
    get ready() {
      return Boolean(identity?.playerId);
    },

    async init() {
      try {
        loadIdentity();
        if (!initialized) {
          initialized = true;
          target?.addEventListener('online', () => void flush(true));
        }
        if (await ensureRegistered()) await flush(true);
        else scheduleFlush();
      } catch {
        // offline start is fine
      }
    },

    nickname() {
      return loadIdentity().nickname;
    },

    async setNickname(name) {
      try {
        const trimmed = name.normalize('NFC').trim();
        if (!NICK_RE.test(trimmed)) return MSG.invalid;
        const reply = await authed('nickname', { method: 'POST', body: { nickname: trimmed } });
        if (reply === null || reply.status >= 500) return MSG.offline;
        if (reply.status === 200) {
          const saved = typeof reply.body.nickname === 'string' ? reply.body.nickname : trimmed;
          saveIdentity({ ...loadIdentity(), nickname: saved });
          return null;
        }
        if (reply.status === 409) return MSG.taken;
        if (reply.body.error === 'banned') return MSG.banned;
        return reply.status === 400 ? MSG.invalid : MSG.offline;
      } catch {
        return MSG.offline;
      }
    },

    async submitRun(record) {
      let outcome: SendOutcome;
      try {
        outcome = await send(record);
      } catch {
        outcome = 'retry';
      }
      if (outcome === 'retry') {
        enqueue(record);
        return null;
      }
      void flush(); // we're online: drain anything due
      if (outcome instanceof RunRejectedError) throw outcome; // the one documented rejection (OnlineApi.submitRun)
      return outcome;
    },

    async leaderboard(board: Board) {
      try {
        const registered = Boolean(loadIdentity().playerId);
        const reply = await call(`leaderboard?board=${encodeURIComponent(board)}`, { method: 'GET', auth: registered });
        if (reply?.status !== 200) return EMPTY_BOARD;
        const rows = (v: unknown): LeaderboardRow | null => {
          if (typeof v !== 'object' || v === null) return null;
          const r = v as Record<string, unknown>;
          if (typeof r.rank !== 'number' || typeof r.nickname !== 'string' || typeof r.score !== 'number') return null;
          return { rank: r.rank, nickname: r.nickname, score: r.score, me: r.me === true };
        };
        const top = Array.isArray(reply.body.top) ? reply.body.top.map(rows).filter((r): r is LeaderboardRow => r !== null) : [];
        return { top, mine: rows(reply.body.mine) };
      } catch {
        return EMPTY_BOARD;
      }
    },

    async syncAchievements(unlocked: Readonly<Partial<Record<AchievementId, number>>>) {
      try {
        if (Object.keys(unlocked).length === 0) return;
        await authed('achievements', { method: 'POST', body: { unlocked } });
      } catch {
        // best effort; the full set is re-sent next time
      }
    },
  };
}
