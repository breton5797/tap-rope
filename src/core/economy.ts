/**
 * v8 economy (GDD-v8 A5): ₵ rewards paid outside the session (scoring and replays never see them) and
 * cosmetic sinks. All functions are pure and return new saves.
 *
 * Sources: first clear +10 (boss +30), each newly earned star +5, achievements 20–50 (first-clear pays
 * the one-time 60 first-mission bonus), daily streak 10 / 25 / 50 by streak length, plus lane pickups.
 * Sinks: operators (content SKINS), per-skin colour variants, laser-trail and landing-ring colours,
 * result-card frames (render-only: cosmeticsOf → RenderSnapshot.cosmetics, frameOf → result card).
 */
import type { AchievementId, CosmeticLook, Reward, SaveData, SaveCosmetics, SkinId } from '../types';
import { ACHIEVEMENTS } from './achievements';
import { STAGES } from './content';
import { COPY } from '../flavor';

export const FIRST_CLEAR_COINS = 10;
export const BOSS_CLEAR_COINS = 30;
export const STAR_COINS = 5;
export const FIRST_MISSION_COINS = 60;

export const ACH_REWARD: Readonly<Record<AchievementId, number>> = {
  'first-clear': FIRST_MISSION_COINS,
  'zone-1': 30, 'zone-3': 30, 'zone-5': 40, 'zone-7': 40, 'zone-10': 50,
  rescue: 30, escape: 50, 'flawless-boss': 40, 'perfect-stage': 30,
  'chain-50': 20, 'chain-100': 40, 'overdrive-3': 30, 'all-stars-zone': 50, 'stars-150': 50,
  'endless-60': 20, 'endless-180': 40, 'daily-1': 20, 'daily-7': 50, 'all-operators': 50, archivist: 30, 'stamps-15': 50,
};

/** ₵ for a daily clear that extends the streak to `count` days. */
export const streakReward = (count: number): number => (count >= 7 ? 50 : count >= 3 ? 25 : 10);

const isBoss = new Set(STAGES.filter((s) => s.kind === 'boss').map((s) => s.id));
const stageName = new Map(STAGES.map((s) => [s.id, s.name]));
const achName = new Map(ACHIEVEMENTS.map((a) => [a.id, a.name]));

/**
 * Rewards earned by a finished run. `before` / `after` are the saves around recordResult (stars),
 * `unlocked` the achievements this run unlocked, `streak` the daily streak after a daily clear.
 */
export function runRewards(
  before: SaveData, after: SaveData, unlocked: readonly AchievementId[],
  streak: { readonly count: number; readonly extended: boolean } | null,
): Reward[] {
  const out: Reward[] = [];
  let stars = 0;
  for (const [id, now] of Object.entries(after.stars)) {
    const prev = before.stars[id] ?? 0;
    if (prev === 0 && now >= 1) {
      out.push(isBoss.has(id)
        ? { kind: 'boss-clear', label: `${COPY.rewardBossClear} · ${stageName.get(id) ?? id}`, coins: BOSS_CLEAR_COINS }
        : { kind: 'first-clear', label: '첫 클리어', coins: FIRST_CLEAR_COINS });
    }
    stars += Math.max(0, now - prev);
  }
  if (stars > 0) out.push({ kind: 'star', label: `새 별 ★${stars}`, coins: stars * STAR_COINS });
  for (const id of unlocked) {
    out.push(id === 'first-clear'
      ? { kind: 'first-mission', label: COPY.rewardFirst, coins: FIRST_MISSION_COINS }
      : { kind: 'achievement', label: `업적 · ${achName.get(id) ?? id}`, coins: ACH_REWARD[id] });
  }
  // the first-mission line sits right after the clear lines it explains
  out.sort((a, b) => order(a) - order(b));
  if (streak?.extended) out.push({ kind: 'streak', label: `연속 작전 ${streak.count}일`, coins: streakReward(streak.count) });
  return out;
}

const ORDER: Readonly<Record<Reward['kind'], number>> = {
  'first-clear': 0, 'boss-clear': 0, star: 1, 'first-mission': 2, achievement: 3, streak: 4,
};
const order = (r: Reward): number => ORDER[r.kind];

export function applyRewards(save: SaveData, rewards: readonly Reward[]): SaveData {
  const total = rewards.reduce((n, r) => n + r.coins, 0);
  return total === 0 ? save : { ...save, coins: save.coins + total };
}

// ---------- cosmetics ----------

export type CosmeticKind = 'tint' | 'trail' | 'ring' | 'frame';

export interface Cosmetic {
  readonly id: string;
  readonly kind: CosmeticKind;
  readonly name: string;
  readonly price: number;
  /** render colour (hex); frames: the frame's accent */
  readonly color: string;
  /** colour variants belong to one operator */
  readonly skin?: SkinId;
}

const tints = (skin: SkinId, list: readonly (readonly [string, string, string, number])[]): Cosmetic[] =>
  list.map(([key, name, color, price]) => ({ id: `tint:${skin}:${key}`, kind: 'tint', name, price, color, skin }));

export const COSMETICS: readonly Cosmetic[] = [
  ...tints('kid', [['ember', '앰버 파이핑', '#ffb347', 80], ['frost', '프로스트', '#9fe8ff', 120]]),
  ...tints('cat', [['violet', '바이올렛', '#b48cff', 100], ['gold', '골드 아이', '#ffd36b', 140]]),
  ...tints('bunny', [['lime', '라임 코드', '#b6ff5c', 100], ['magenta', '마젠타', '#ff5cc8', 140]]),
  ...tints('ninja', [['crimson', '크림슨', '#ff4d5e', 120], ['ghost', '고스트', '#e8f0ff', 160]]),
  ...tints('robot', [['amber', '앰버 코어', '#ffa62b', 120], ['cyan', '시안 코어', '#3ef0ff', 160]]),
  ...tints('astro', [['desert', '사막 위장', '#d8b27a', 140], ['arctic', '극지 위장', '#cfe9ff', 180]]),
  { id: 'trail:amber', kind: 'trail', name: '앰버 잔상', price: 120, color: '#ffb347' },
  { id: 'trail:violet', kind: 'trail', name: '바이올렛 잔상', price: 150, color: '#b48cff' },
  { id: 'trail:crimson', kind: 'trail', name: '크림슨 잔상', price: 180, color: '#ff4d5e' },
  { id: 'trail:white', kind: 'trail', name: '화이트 잔상', price: 220, color: '#f4f8ff' },
  { id: 'ring:amber', kind: 'ring', name: '앰버 링', price: 100, color: '#ffb347' },
  { id: 'ring:mint', kind: 'ring', name: '민트 링', price: 120, color: '#5cffb0' },
  { id: 'ring:pink', kind: 'ring', name: '핑크 링', price: 150, color: '#ff6fb5' },
  { id: 'frame:carbon', kind: 'frame', name: '카본 프레임', price: 150, color: '#8a96a8' },
  { id: 'frame:gold', kind: 'frame', name: '골드 프레임', price: 250, color: '#ffd36b' },
  { id: 'frame:neon', kind: 'frame', name: '네온 프레임', price: 300, color: '#3ef0ff' },
];

const BY_ID: ReadonlyMap<string, Cosmetic> = new Map(COSMETICS.map((c) => [c.id, c]));

export const cosmeticById = (id: string): Cosmetic | undefined => BY_ID.get(id);

export const NO_COSMETICS: SaveCosmetics = { owned: [], tint: {}, trail: null, ring: null, frame: null };

export function buyCosmetic(save: SaveData, id: string): SaveData | null {
  const c = BY_ID.get(id);
  if (!c || save.cosmetics.owned.includes(id) || save.coins < c.price) return null;
  if (c.skin && !save.ownedSkins.includes(c.skin)) return null;
  return { ...save, coins: save.coins - c.price, cosmetics: { ...save.cosmetics, owned: [...save.cosmetics.owned, id] } };
}

/**
 * Equips an owned cosmetic (its kind / skin come from the catalog), or unequips a slot with id = null
 * (`kind`, and `skin` for a colour variant). Unknown or unowned ids leave the save unchanged.
 */
export function equipCosmetic(save: SaveData, id: string | null, kind?: CosmeticKind, skin?: SkinId): SaveData {
  const cur = save.cosmetics;
  if (id === null) {
    if (kind === 'tint') {
      if (!skin) return save;
      const { [skin]: _drop, ...rest } = cur.tint;
      return { ...save, cosmetics: { ...cur, tint: rest } };
    }
    return kind ? { ...save, cosmetics: { ...cur, [kind]: null } } : save;
  }
  const c = BY_ID.get(id);
  if (!c || !cur.owned.includes(id)) return save;
  if (c.kind === 'tint' && c.skin) return { ...save, cosmetics: { ...cur, tint: { ...cur.tint, [c.skin]: id } } };
  return { ...save, cosmetics: { ...cur, [c.kind]: id } };
}

const colorOf = (id: string | null | undefined): string | null => (id ? BY_ID.get(id)?.color ?? null : null);

/** Render colours for the deployed operator (null = default look). */
export function cosmeticsOf(save: SaveData): CosmeticLook {
  const c = save.cosmetics;
  return { tint: colorOf(c.tint[save.skin]), trail: colorOf(c.trail), ring: colorOf(c.ring) };
}

export function frameOf(save: SaveData): Cosmetic | null {
  return save.cosmetics.frame ? BY_ID.get(save.cosmetics.frame) ?? null : null;
}
