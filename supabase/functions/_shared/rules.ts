// Pure validation / board rules shared by the Edge Functions (no Deno APIs — unit-tested from vitest).

export const MAX_INPUTS = 20_000;
export const MAX_END_TIME = 3600;
export const RATE_LIMIT_PER_MIN = 6;
export const KST_OFFSET_MS = 9 * 3600 * 1000;

export const ACHIEVEMENT_IDS: ReadonlySet<string> = new Set([
  'first-clear', 'zone-1', 'zone-3', 'zone-5', 'zone-7', 'zone-10',
  'rescue', 'escape', 'flawless-boss', 'perfect-stage', 'chain-50', 'chain-100',
  'overdrive-3', 'all-stars-zone', 'stars-150', 'endless-60', 'endless-180',
  'daily-1', 'daily-7', 'all-operators', 'archivist',
]);

const INPUT_CODES = new Set(['T', 'D', 'S', 'U', 'N']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SECRET_RE = /^[0-9a-f]{64}$/;

export type Result<T> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: string };
const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

export interface CheckedRecord {
  readonly sim: string;
  readonly mode: 'endless' | 'daily';
  readonly seed: number;
  readonly date: string;
  readonly inputs: ReadonlyArray<readonly [number, 'T' | 'D' | 'S' | 'U' | 'N']>;
  readonly endTime: number;
  readonly clientScore: number;
}

export const isSecret = (s: unknown): s is string => typeof s === 'string' && SECRET_RE.test(s);

/** A real calendar date in YYYY-MM-DD form. */
export function isDate(s: unknown): s is string {
  if (typeof s !== 'string' || !DATE_RE.test(s)) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

/** Korea-time calendar date (the game's day boundary). */
export const kstDate = (nowMs: number): string => new Date(nowMs + KST_OFFSET_MS).toISOString().slice(0, 10);

/** ISO-8601 week of a YYYY-MM-DD date, e.g. "2026-W44". */
export function isoWeek(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dayNum = (d.getUTCDay() + 6) % 7; // Mon=0
  d.setUTCDate(d.getUTCDate() - dayNum + 3); // that week's Thursday decides the year
  const year = d.getUTCFullYear();
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const week = 1 + Math.round(((d.getTime() - jan4.getTime()) / 86_400_000 - 3 + ((jan4.getUTCDay() + 6) % 7)) / 7);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

export const weekBoard = (nowMs: number): string => `endless-week:${isoWeek(kstDate(nowMs))}`;

/** |a − b| in whole days for two YYYY-MM-DD dates. */
export const dayDiff = (a: string, b: string): number =>
  Math.round(Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86_400_000);

/** Boards a verified run is entered on; the first is its primary board. */
export function boardsFor(record: CheckedRecord, nowMs: number): readonly string[] {
  return record.mode === 'daily' ? [`daily:${record.date}`] : ['endless', weekBoard(nowMs)];
}

/** Client board name → storage key ('endless-week' means the current week). */
export function resolveBoard(board: string | null, nowMs: number): string | null {
  if (board === 'endless') return 'endless';
  if (board === 'endless-week') return weekBoard(nowMs);
  if (board?.startsWith('daily:') && isDate(board.slice(6))) return board;
  return null;
}

export function checkRecord(body: unknown, nowMs: number): Result<CheckedRecord> {
  if (typeof body !== 'object' || body === null) return fail('bad_record');
  const r = body as Record<string, unknown>;
  if (typeof r.sim !== 'string' || r.sim.length === 0 || r.sim.length > 32) return fail('bad_sim');
  if (r.mode !== 'endless' && r.mode !== 'daily') return fail('bad_mode');
  if (typeof r.seed !== 'number' || !Number.isInteger(r.seed) || r.seed < 0 || r.seed > 0xffffffff) return fail('bad_seed');
  if (!isDate(r.date)) return fail('bad_date');
  if (r.mode === 'daily' && dayDiff(r.date, kstDate(nowMs)) > 1) return fail('stale_date');
  if (typeof r.endTime !== 'number' || !Number.isFinite(r.endTime) || r.endTime <= 0 || r.endTime > MAX_END_TIME) {
    return fail('bad_end_time');
  }
  if (typeof r.clientScore !== 'number' || !Number.isInteger(r.clientScore) || r.clientScore < 0 || r.clientScore > 2_000_000_000) {
    return fail('bad_client_score');
  }
  if (!Array.isArray(r.inputs) || r.inputs.length > MAX_INPUTS) return fail('bad_inputs');
  let prev = 0;
  for (const input of r.inputs) {
    if (!Array.isArray(input) || input.length !== 2) return fail('bad_inputs');
    const [t, code] = input as unknown[];
    if (typeof t !== 'number' || !Number.isFinite(t) || t < prev || t > r.endTime) return fail('bad_inputs');
    if (typeof code !== 'string' || !INPUT_CODES.has(code)) return fail('bad_inputs');
    prev = t;
  }
  return {
    ok: true,
    value: {
      sim: r.sim, mode: r.mode, seed: r.seed, date: r.date, endTime: r.endTime, clientScore: r.clientScore,
      inputs: r.inputs as CheckedRecord['inputs'],
    },
  };
}

/** Accepts `{ unlocked: { [id]: unixMs } }`; drops nothing silently — any bad entry rejects the batch. */
export function checkAchievements(body: unknown, nowMs: number): Result<ReadonlyArray<readonly [string, number]>> {
  if (typeof body !== 'object' || body === null) return fail('bad_body');
  const unlocked = (body as Record<string, unknown>).unlocked;
  if (typeof unlocked !== 'object' || unlocked === null || Array.isArray(unlocked)) return fail('bad_body');
  const entries = Object.entries(unlocked as Record<string, unknown>);
  if (entries.length > ACHIEVEMENT_IDS.size) return fail('too_many');
  const minMs = Date.UTC(2024, 0, 1);
  const out: Array<readonly [string, number]> = [];
  for (const [id, ms] of entries) {
    if (!ACHIEVEMENT_IDS.has(id)) return fail('unknown_achievement');
    if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < minMs || ms > nowMs + 86_400_000) return fail('bad_time');
    out.push([id, Math.floor(ms)] as const);
  }
  return { ok: true, value: out };
}

// ---------- nicknames ----------

const NICK_RE = /^[가-힣A-Za-z0-9_]{2,12}$/;

/** Small blocklist (substring match on the lowercased, underscore/digit-stripped name). */
const BANNED = [
  // Korean
  '시발', '씨발', '씨바', '시바', '씨팔', '시팔', 'ㅅㅂ', '병신', '븅신', '빙신', '개새', '새끼', '좆', '존나', '졸라',
  '미친놈', '미친년', '닥쳐', '꺼져', '년아', '보지', '자지', '섹스', '창녀', '걸레', '애미', '애비', '느금', '니미',
  '엠창', '한남', '김치녀', '일베', '운영자', '관리자',
  // English
  'fuck', 'shit', 'bitch', 'cunt', 'dick', 'cock', 'pussy', 'nigg', 'fag', 'whore', 'slut', 'rape', 'nazi', 'hitler',
  'porn', 'sex', 'asshole', 'bastard', 'admin', 'moderator',
];

export function checkNickname(name: unknown): Result<string> {
  if (typeof name !== 'string') return fail('invalid');
  const trimmed = name.normalize('NFC').trim();
  if (!NICK_RE.test(trimmed)) return fail('invalid');
  const folded = trimmed.toLowerCase().replace(/[_0-9]/g, '');
  if (BANNED.some((w) => folded.includes(w))) return fail('banned');
  return { ok: true, value: trimmed };
}
