/**
 * 사원 복지몰 (spec §4): cosmetics at fixed prices (no randomness), one equipped per category. Only effects that
 * need no per-frame character art: trails, jump effects, result stamps, attendance-card themes. A theme item
 * comes from its week's goal / card, and is sold at its price from the week after its theme first ran.
 */
import type { BuyResult, Cosmetic, CosmeticCategory, CosmeticId, DateKey, LiveSave } from './types';
import { weekOf } from './dates';

/** BALANCE knob: price per category (aim: one item every 2–3 days of 1–2 runs a day) */
export const COSMETIC_PRICES: Readonly<Record<CosmeticCategory, number>> = { trail: 650, jump: 550, stamp: 450, cardTheme: 750 };

const item = (id: CosmeticId, category: CosmeticCategory, name: string, theme?: Cosmetic['theme']): Cosmetic =>
  ({ id, category, name, price: COSMETIC_PRICES[category], sprite: id, ...(theme ? { theme } : {}) });

/** the catalog (art: public-office/art/cosmetic/<sprite>.webp) */
export const COSMETICS: readonly Cosmetic[] = [
  item('trail-sparkle', 'trail', '반짝 잔상'),
  item('trail-confetti', 'trail', '색종이 발자국'),
  item('trail-highlighter', 'trail', '형광펜 줄'),
  item('trail-coffee', 'trail', '커피 방울', 'monday-blues'),
  item('trail-paper', 'trail', '서류 잔상', 'paper-bomb'),
  item('trail-rain', 'trail', '빗방울 발자국', 'rainy-commute'),
  item('jump-dust', 'jump', '먼지 퐁'),
  item('jump-petal', 'jump', '꽃잎 점프'),
  item('jump-papers', 'jump', '서류 휘날림'),
  item('jump-medal', 'jump', '체육대회 메달', 'sports-day'),
  item('stamp-gold', 'stamp', '금색 도장'),
  item('stamp-heart', 'stamp', '하트 도장'),
  item('stamp-cat', 'stamp', '고양이 도장'),
  item('stamp-coffee', 'stamp', '커피잔 도장'),
  item('stamp-star', 'stamp', '별 도장'),
  item('stamp-clock', 'stamp', '칼퇴 시계 도장', 'speed-clockout'),
  item('card-kraft', 'cardTheme', '크라프트 출근 카드'),
  item('card-pastel', 'cardTheme', '파스텔 출근 카드'),
  item('card-sky', 'cardTheme', '노을 하늘 출근 카드'),
  item('card-dinner', 'cardTheme', '포장마차 출근 카드', 'dodge-dinner'),
];

const BY_ID: ReadonlyMap<CosmeticId, Cosmetic> = new Map(COSMETICS.map((c) => [c.id, c]));

export function cosmeticById(id: CosmeticId): Cosmetic | undefined {
  return BY_ID.get(id);
}

/** a theme item is for sale once a week has passed since its theme first ran; others always */
function onSale(live: LiveSave, c: Cosmetic, date: DateKey): boolean {
  if (!c.theme) return true;
  const seen = live.themeSeen[c.theme];
  return seen !== undefined && seen < weekOf(date);
}

/** buy `id` with `coins` 칼퇴 포인트 on `date` (the caller deducts `cost` from SaveData.coins) */
export function buyCosmetic(live: LiveSave, id: CosmeticId, coins: number, date: DateKey): BuyResult {
  const c = cosmeticById(id);
  if (!c) return { ok: false, reason: 'unknown' };
  if (live.owned.includes(id)) return { ok: false, reason: 'owned' };
  if (!onSale(live, c, date)) return { ok: false, reason: 'not-yet' };
  if (coins < c.price) return { ok: false, reason: 'poor' };
  return { ok: true, live: { ...live, owned: [...live.owned, id] }, cost: c.price };
}

/** equip an owned cosmetic (its category's slot); unknown / not owned: unchanged */
export function equipCosmetic(live: LiveSave, id: CosmeticId): LiveSave {
  const c = cosmeticById(id);
  if (!c || !live.owned.includes(id)) return live;
  return { ...live, equipped: { ...live.equipped, [c.category]: id } };
}

/** cosmetics the player could buy now with `coins` (the title's "새로 살 수 있는 꾸미기" count) */
export function affordable(live: LiveSave, coins: number, date: DateKey): readonly Cosmetic[] {
  return COSMETICS.filter((c) => !live.owned.includes(c.id) && onSale(live, c, date) && c.price <= coins);
}
