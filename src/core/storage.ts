/**
 * Save data persistence (localStorage key 'laserescape.save.v2'; v1 key read once to migrate), incl. briefed chapters and (v5) whether
 * the controls card was seen — older saves without it load as false (same key and version).
 * v7: seen cutscenes, unlocked achievements (id → unix ms) and the daily streak; older saves load
 * them empty, each field validated on its own.
 * v8: version 2 adds cosmetics (v1 saves migrate on load). A save written by a NEWER build is read
 * leniently and never overwritten (writes are skipped while it is stored); a corrupt save is backed up
 * before starting fresh. Storage problems reach the player once each through setStorageNotice.
 * parseSave validates untrusted JSON field by field and never throws; load/write
 * swallow storage errors (private mode, quota). All updates return new objects.
 */
import type { AchievementId, CutsceneId, SaveCosmetics, SaveData, Settings, SkinId } from '../types';
import { ACHIEVEMENTS } from './achievements';
import { CHAPTERS, SKINS, STAGES } from './content';
import { CUTSCENES } from './cutscenes';
import { NO_COSMETICS, cosmeticById } from './economy';

/** v8: version-2 saves live under their own key, so an older build (stale tab / cached SW) that only
 * knows the v1 key can never overwrite them; the v1 key is read once to migrate and left untouched. */
export const SAVE_KEY = 'laserescape.save.v2';
export const LEGACY_SAVE_KEY = 'laserescape.save.v1';
const KEY = SAVE_KEY;
export const SAVE_VERSION = 2;
const CORRUPT_KEY = 'laserescape.save.corrupt'; // v4 LASER ESCAPE is a fresh game: old TAP ROPE saves are ignored
const SKIN_IDS: readonly SkinId[] = SKINS.map((s) => s.id);
const CUTSCENE_IDS: readonly CutsceneId[] = CUTSCENES.map((c) => c.id);
const ACHIEVEMENT_IDS: readonly AchievementId[] = ACHIEVEMENTS.map((a) => a.id);
const NO_STREAK: SaveData['dailyStreak'] = { last: null, count: 0 };
const DEFAULT_SETTINGS: Settings = { sound: true, music: true, vibration: true, reducedMotion: false };

type Rec = Readonly<Record<string, unknown>>;

const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isSkin = (v: unknown): v is SkinId =>
  typeof v === 'string' && (SKIN_IDS as readonly string[]).includes(v);
const clampStars = (n: number) => Math.min(3, Math.max(0, Math.floor(n)));

export function defaultSave(): SaveData {
  return {
    version: 2, stars: {}, bestScores: {}, coins: 0, ownedSkins: ['kid'], skin: 'kid',
    settings: DEFAULT_SETTINGS, tutorialDone: false, briefed: [], controlsSeen: false,
    seenCutscenes: [], achievements: {}, dailyStreak: NO_STREAK, cosmetics: NO_COSMETICS, tutorialSteps: [],
  };
}

function numberMap(raw: unknown, fix: (n: number) => number): Record<string, number> {
  if (!isRecord(raw)) return {};
  return Object.fromEntries(
    Object.entries(raw)
      .filter((e): e is [string, number] => isNum(e[1]))
      .map(([k, v]) => [k, fix(v)]),
  );
}

function parseSettings(raw: unknown): Settings {
  if (!isRecord(raw)) return DEFAULT_SETTINGS;
  const pick = (k: keyof Settings): boolean => {
    const v = raw[k];
    return typeof v === 'boolean' ? v : DEFAULT_SETTINGS[k];
  };
  return { sound: pick('sound'), music: pick('music'), vibration: pick('vibration'), reducedMotion: pick('reducedMotion') };
}

function parseSkins(raw: unknown): SkinId[] {
  const listed = Array.isArray(raw) ? raw.filter(isSkin) : [];
  return SKIN_IDS.filter((id) => id === 'kid' || listed.includes(id));
}

/** Version a raw save claims: undefined/1 → 1, a positive integer as is, anything else → null. */
function versionOf(raw: Rec): number | null {
  if (raw.version === undefined) return 1;
  return Number.isInteger(raw.version) && (raw.version as number) >= 1 ? (raw.version as number) : null;
}

/** Validates a v1/v2 save (v1 migrates: no cosmetics). `lenient` also reads a newer build's save. */
export function parseSave(raw: unknown, lenient = false): SaveData {
  if (!isRecord(raw)) return defaultSave();
  const v = versionOf(raw);
  if (v === null || (v > SAVE_VERSION && !lenient)) return defaultSave();
  const ownedSkins = parseSkins(raw.ownedSkins);
  return {
    version: 2,
    stars: numberMap(raw.stars, clampStars),
    bestScores: numberMap(raw.bestScores, (n) => Math.max(0, Math.floor(n))),
    coins: isNum(raw.coins) ? Math.max(0, Math.floor(raw.coins)) : 0,
    ownedSkins,
    skin: isSkin(raw.skin) && ownedSkins.includes(raw.skin) ? raw.skin : 'kid',
    settings: parseSettings(raw.settings),
    tutorialDone: raw.tutorialDone === true,
    briefed: parseBriefed(raw.briefed),
    controlsSeen: raw.controlsSeen === true,
    seenCutscenes: parseSeen(raw.seenCutscenes),
    achievements: parseAchievements(raw.achievements),
    dailyStreak: parseStreak(raw.dailyStreak),
    cosmetics: parseCosmetics(raw.cosmetics, ownedSkins),
    tutorialSteps: parseSteps(raw.tutorialSteps),
  };
}

const TUTORIAL_STEPS = ['jump', 'slide', 'lane'] as const;

/** v8: 1-1 tutorial steps already taught — known values only, unique, in teaching order */
function parseSteps(raw: unknown): NonNullable<SaveData['tutorialSteps']> {
  const listed = Array.isArray(raw) ? raw : [];
  return TUTORIAL_STEPS.filter((s) => listed.includes(s));
}

/** known, owned cosmetic ids; equipped slots only when owned and of the right kind / skin */
function parseCosmetics(raw: unknown, skins: readonly SkinId[]): SaveCosmetics {
  if (!isRecord(raw)) return NO_COSMETICS;
  const listed = Array.isArray(raw.owned) ? raw.owned : [];
  const owned = [...new Set(listed.filter((id): id is string => typeof id === 'string' && cosmeticById(id) !== undefined))];
  const slot = (v: unknown, kind: string): string | null =>
    typeof v === 'string' && owned.includes(v) && cosmeticById(v)?.kind === kind ? v : null;
  const tintRaw = isRecord(raw.tint) ? raw.tint : {};
  const tint = Object.fromEntries(skins
    .map((skin) => [skin, slot(tintRaw[skin], 'tint')] as const)
    .filter((e): e is readonly [SkinId, string] => e[1] !== null && cosmeticById(e[1])?.skin === e[0]));
  return { owned, tint, trail: slot(raw.trail, 'trail'), ring: slot(raw.ring, 'ring'), frame: slot(raw.frame, 'frame') };
}

/** known cutscene ids, unique, in story order */
function parseSeen(raw: unknown): CutsceneId[] {
  const listed = Array.isArray(raw) ? raw : [];
  return CUTSCENE_IDS.filter((id) => listed.includes(id));
}

/** known achievement ids with a finite, non-negative unlock time */
function parseAchievements(raw: unknown): SaveData['achievements'] {
  if (!isRecord(raw)) return {};
  return Object.fromEntries(ACHIEVEMENT_IDS
    .filter((id) => isNum(raw[id]) && (raw[id] as number) >= 0)
    .map((id) => [id, raw[id] as number]));
}

const isIsoDate = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v);

/** { last: YYYY-MM-DD, count ≥ 1 } or no streak */
function parseStreak(raw: unknown): SaveData['dailyStreak'] {
  if (!isRecord(raw) || !isIsoDate(raw.last)) return NO_STREAK;
  return { last: raw.last, count: isNum(raw.count) ? Math.max(1, Math.floor(raw.count)) : 1 };
}

/** Records that a cutscene was played (no-op when already seen); keeps story order. */
export function markCutsceneSeen(save: SaveData, id: CutsceneId): SaveData {
  if (save.seenCutscenes.includes(id)) return save;
  return { ...save, seenCutscenes: CUTSCENE_IDS.filter((c) => c === id || save.seenCutscenes.includes(c)) };
}

/** Stores newly unlocked achievements at `now` (unix ms); already-unlocked ids keep their first time. */
export function recordAchievements(save: SaveData, ids: readonly AchievementId[], now: number): SaveData {
  const fresh = ids.filter((id) => save.achievements[id] === undefined);
  if (fresh.length === 0) return save;
  return { ...save, achievements: { ...save.achievements, ...Object.fromEntries(fresh.map((id) => [id, now])) } };
}

const isChapter = (v: unknown): v is number => Number.isInteger(v) && (v as number) >= 0 && (v as number) < CHAPTERS.length;

/** chapter ids whose briefing was shown: valid ids only, unique, ascending */
function parseBriefed(raw: unknown): number[] {
  if (!Array.isArray(raw)) return [];
  return [...new Set(raw.filter(isChapter))].sort((a, b) => a - b);
}

/** Records that a chapter's briefing card was shown (no-op for unknown or already-briefed chapters). */
export function markBriefed(save: SaveData, chapter: number): SaveData {
  if (!isChapter(chapter) || save.briefed.includes(chapter)) return save;
  return { ...save, briefed: [...save.briefed, chapter].sort((a, b) => a - b) };
}

function defaultStore(): Storage | undefined {
  try {
    return typeof globalThis.localStorage === 'undefined' ? undefined : globalThis.localStorage;
  } catch {
    return undefined;
  }
}

// ---------- storage notices (shown once each as a toast; queued until the UI registers) ----------

export const NOTICE = {
  newer: '새 버전에서 만든 저장 데이터를 보호 중이에요. 앱을 최신으로 업데이트하면 이어서 진행돼요.',
  corrupt: '저장 데이터가 손상되어 새로 시작해요. 이전 데이터는 따로 보관했어요.',
  recovered: '저장 데이터가 손상되어 이전 버전의 저장에서 복구했어요. 손상된 데이터는 따로 보관했어요.',
  quota: '저장 공간이 부족해 진행 상황이 저장되지 않을 수 있어요.',
} as const;
type NoticeId = keyof typeof NOTICE;

let noticeSink: ((msg: string) => void) | null = null;
let pendingNotices: NoticeId[] = [];
const noticed = new Set<NoticeId>();

function notify(id: NoticeId): void {
  if (noticed.has(id)) return;
  noticed.add(id);
  if (noticeSink) noticeSink(NOTICE[id]);
  else pendingNotices = [...pendingNotices, id];
}

/** Registers the toast for storage notices and delivers the ones raised before the UI existed. */
export function setStorageNotice(sink: ((msg: string) => void) | null): void {
  noticeSink = sink;
  if (!sink) return;
  const due = pendingNotices;
  pendingNotices = [];
  for (const id of due) sink(NOTICE[id]);
}

/** test hook: forget which notices were shown */
export function resetStorageNotices(): void {
  noticed.clear();
  pendingNotices = [];
  noticeSink = null;
}

export type SaveStatus = 'new' | 'ok' | 'migrated' | 'newer' | 'corrupt' | 'recovered';

type Store = Pick<Storage, 'getItem'> & Partial<Pick<Storage, 'setItem'>>;

/** the newest corrupt copy lives at CORRUPT_KEY, older ones at `${CORRUPT_KEY}.1` … (3 kept) */
const CORRUPT_KEEP = 3;
const corruptKey = (i: number): string => (i === 0 ? CORRUPT_KEY : `${CORRUPT_KEY}.${i}`);

/** Keeps the bytes of a corrupt save for a manual rescue (a ring of 3; the same bytes twice are kept once). */
function backupCorrupt(store: Store | undefined, text: string): void {
  try {
    if (!store?.setItem || store.getItem(CORRUPT_KEY) === text) return;
    for (let i = CORRUPT_KEEP - 1; i > 0; i--) {
      const older = store.getItem(corruptKey(i - 1));
      if (older !== null) store.setItem(corruptKey(i), older);
    }
    store.setItem(CORRUPT_KEY, text);
  } catch {
    // nothing more we can do
  }
}

/** JSON text → its claimed version and parsed value; version null = corrupt */
function readRaw(text: string): { readonly raw: unknown; readonly v: number | null } {
  try {
    const raw: unknown = JSON.parse(text);
    return { raw, v: isRecord(raw) ? versionOf(raw) : null };
  } catch {
    return { raw: undefined, v: null };
  }
}

/** the legacy v1-key save, migrated (whatever version it claims), or null when absent / corrupt */
function readLegacy(store: Store | undefined): SaveData | null {
  const text = store?.getItem(LEGACY_SAVE_KEY);
  if (!text) return null;
  const { raw, v } = readRaw(text);
  return v === null ? null : parseSave(raw, true);
}

/**
 * Reads the save and says what was found: the v2 key first, else the legacy v1 key (migrated — whatever
 * version it claims), newer = written by a newer build. A corrupt v2 save is backed up and the intact v1
 * save, if any, is migrated instead (recovered).
 */
export function loadSaveState(store: Store | undefined = defaultStore()): { readonly save: SaveData; readonly status: SaveStatus } {
  try {
    const text = store?.getItem(KEY);
    if (!text) {
      const legacy = readLegacy(store);
      if (legacy) return { save: legacy, status: 'migrated' };
      const old = store?.getItem(LEGACY_SAVE_KEY);
      if (old) backupCorrupt(store, old);
      return old ? { save: defaultSave(), status: 'corrupt' } : { save: defaultSave(), status: 'new' };
    }
    const { raw, v } = readRaw(text);
    if (v === null) {
      backupCorrupt(store, text);
      const legacy = readLegacy(store);
      return legacy ? { save: legacy, status: 'recovered' } : { save: defaultSave(), status: 'corrupt' };
    }
    if (v > SAVE_VERSION) return { save: parseSave(raw, true), status: 'newer' };
    return { save: parseSave(raw), status: v < SAVE_VERSION ? 'migrated' : 'ok' };
  } catch {
    return { save: defaultSave(), status: 'new' };
  }
}

export function loadSave(
  store: Pick<Storage, 'getItem'> & Partial<Pick<Storage, 'setItem'>> | undefined = defaultStore(),
): SaveData {
  const { save, status } = loadSaveState(store);
  if (status === 'newer' || status === 'corrupt' || status === 'recovered') notify(status);
  return save;
}

/** True while the stored save comes from a newer build (it must not be overwritten). */
function storedIsNewer(store: Partial<Pick<Storage, 'getItem'>>): boolean {
  try {
    const text = store.getItem?.(KEY);
    if (!text) return false;
    const raw: unknown = JSON.parse(text);
    const v = isRecord(raw) ? versionOf(raw) : null;
    return v !== null && v > SAVE_VERSION;
  } catch {
    return false;
  }
}

export type WriteResult = 'ok' | 'protected' | 'failed';

export function writeSave(
  data: SaveData, store: Pick<Storage, 'setItem'> & Partial<Pick<Storage, 'getItem'>> | undefined = defaultStore(),
): WriteResult {
  if (!store) return 'failed';
  if (storedIsNewer(store)) {
    notify('newer');
    return 'protected';
  }
  try {
    store.setItem(KEY, JSON.stringify(data));
    return 'ok';
  } catch {
    notify('quota'); // storage full or blocked: progress isn't persisted
    return 'failed';
  }
}

/**
 * v8 multi-tab: calls `onChange` with the save another tab just wrote (the 'storage' event), so this tab
 * stops overwriting it with stale progress. Returns an unsubscribe function.
 */
export function watchSave(
  onChange: (save: SaveData) => void,
  target: Pick<EventTarget, 'addEventListener' | 'removeEventListener'> | undefined = typeof window === 'undefined' ? undefined : window,
): () => void {
  const listener = (e: Event): void => {
    const { key, newValue } = e as StorageEvent;
    if (key !== KEY || !newValue) return;
    const { save, status } = loadSaveState({ getItem: () => newValue });
    if (status === 'ok' || status === 'migrated' || status === 'newer') onChange(save);
  };
  target?.addEventListener('storage', listener);
  return () => target?.removeEventListener('storage', listener);
}

let persistAsked = false;

/** Asks the browser to keep this site's storage (Safari evicts script storage after 7 idle days). Once per page. */
export function requestPersistentStorage(nav: { storage?: { persist?: () => Promise<boolean> } } | undefined =
  typeof navigator === 'undefined' ? undefined : navigator): void {
  if (persistAsked) return;
  persistAsked = true;
  try {
    void nav?.storage?.persist?.().catch(() => false);
  } catch {
    // unsupported
  }
}

const DAILY_PREFIX = 'daily:';

export function recordResult(
  save: SaveData, key: string, stars: number, score: number, coins: number,
): SaveData {
  const prevStars = save.stars[key] ?? 0;
  const prevBest = save.bestScores[key] ?? 0;
  const isStage = STAGES.some((s) => s.id === key);
  // only today's daily best is worth keeping; older daily keys would grow the save forever
  const kept = key.startsWith(DAILY_PREFIX)
    ? Object.fromEntries(Object.entries(save.bestScores).filter(([k]) => !k.startsWith(DAILY_PREFIX)))
    : save.bestScores;
  return {
    ...save,
    stars: isStage ? { ...save.stars, [key]: Math.max(prevStars, clampStars(stars)) } : save.stars,
    bestScores: { ...kept, [key]: Math.max(prevBest, Math.floor(score)) },
    coins: save.coins + Math.max(0, Math.floor(coins)),
  };
}

export function isStageUnlocked(save: SaveData, stageIndex: number): boolean {
  if (!Number.isInteger(stageIndex) || stageIndex < 0 || stageIndex >= STAGES.length) return false;
  if (stageIndex === 0) return true;
  return (save.stars[STAGES[stageIndex - 1].id] ?? 0) >= 1;
}

export function buySkin(save: SaveData, id: SkinId): SaveData | null {
  const skin = SKINS.find((s) => s.id === id);
  if (!skin || save.ownedSkins.includes(id) || save.coins < skin.price) return null;
  return { ...save, coins: save.coins - skin.price, ownedSkins: [...save.ownedSkins, id] };
}
