/** 사원 복지몰: cosmetics at fixed prices (no randomness), one equipped per category. */
import type { BuyResult, Cosmetic, CosmeticCategory, CosmeticId, DateKey, LiveSave } from './types';

/** BALANCE knob: price per category (2–3 days of 1–2 runs a day per item) */
export const COSMETIC_PRICES: Readonly<Record<CosmeticCategory, number>> = { trail: 300, jump: 250, stamp: 200, cardTheme: 350 };

const todo = (name: string): never => {
  throw new Error(`live: ${name} not implemented yet`);
};

export const COSMETICS: readonly Cosmetic[] = [];

export function cosmeticById(id: CosmeticId): Cosmetic | undefined {
  return COSMETICS.find((c) => c.id === id);
}
/** buy `id` with `coins` 칼퇴 포인트 on `date` (the caller deducts `cost` from SaveData.coins) */
export function buyCosmetic(live: LiveSave, id: CosmeticId, coins: number, date: DateKey): BuyResult {
  return todo(`buyCosmetic(${live.v}, ${id}, ${coins}, ${date})`);
}
/** equip an owned cosmetic (its category's slot); unknown / not owned: unchanged */
export function equipCosmetic(live: LiveSave, id: CosmeticId): LiveSave {
  return todo(`equipCosmetic(${live.v}, ${id})`);
}
/** cosmetics the player could buy now with `coins` (the title's "새로 살 수 있는 꾸미기" count) */
export function affordable(live: LiveSave, coins: number, date: DateKey): readonly Cosmetic[] {
  return todo(`affordable(${live.v}, ${coins}, ${date})`);
}
