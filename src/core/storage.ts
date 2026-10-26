/**
 * Save data persistence (localStorage key 'laserescape.save.v1'), incl. briefed chapters and (v5) whether
 * the controls card was seen — older saves without it load as false (same key and version).
 * v7: seen cutscenes, unlocked achievements (id → unix ms) and the daily streak; older saves load
 * them empty, each field validated on its own.
 * parseSave validates untrusted JSON field by field and never throws; load/write
 * swallow storage errors (private mode, quota). All updates return new objects.
 */
import type { AchievementId, CutsceneId, SaveData, Settings, SkinId } from '../types';
import { ACHIEVEMENTS } from './achievements';
import { CHAPTERS, SKINS, STAGES } from './content';
import { CUTSCENES } from './cutscenes';

const KEY = 'laserescape.save.v1'; // v4 LASER ESCAPE is a fresh game: old TAP ROPE saves are ignored
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
    version: 1, stars: {}, bestScores: {}, coins: 0, ownedSkins: ['kid'], skin: 'kid',
    settings: DEFAULT_SETTINGS, tutorialDone: false, briefed: [], controlsSeen: false,
    seenCutscenes: [], achievements: {}, dailyStreak: NO_STREAK,
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

export function parseSave(raw: unknown): SaveData {
  if (!isRecord(raw) || (raw.version !== undefined && raw.version !== 1)) return defaultSave();
  const ownedSkins = parseSkins(raw.ownedSkins);
  return {
    version: 1,
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
  };
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

export function loadSave(store: Pick<Storage, 'getItem'> | undefined = defaultStore()): SaveData {
  try {
    const text = store?.getItem(KEY);
    return text ? parseSave(JSON.parse(text)) : defaultSave();
  } catch {
    return defaultSave();
  }
}

export function writeSave(data: SaveData, store: Pick<Storage, 'setItem'> | undefined = defaultStore()): void {
  try {
    store?.setItem(KEY, JSON.stringify(data));
  } catch {
    // storage unavailable or full: progress simply isn't persisted
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
