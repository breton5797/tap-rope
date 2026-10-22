/**
 * Save data persistence (localStorage key 'taprope.save.v1').
 * parseSave validates untrusted JSON field by field and never throws; load/write
 * swallow storage errors (private mode, quota). All updates return new objects.
 */
import type { SaveData, Settings, SkinId } from '../types';
import { SKINS, STAGES } from './content';

const KEY = 'taprope.save.v1';
const SKIN_IDS: readonly SkinId[] = SKINS.map((s) => s.id);
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
    settings: DEFAULT_SETTINGS, tutorialDone: false,
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
  };
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

export function recordResult(
  save: SaveData, key: string, stars: number, score: number, coins: number,
): SaveData {
  const prevStars = save.stars[key] ?? 0;
  const prevBest = save.bestScores[key] ?? 0;
  return {
    ...save,
    stars: { ...save.stars, [key]: Math.max(prevStars, clampStars(stars)) },
    bestScores: { ...save.bestScores, [key]: Math.max(prevBest, Math.floor(score)) },
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
