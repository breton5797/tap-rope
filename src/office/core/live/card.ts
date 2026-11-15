/** 주간 출근 카드: a stamp for each day a daily mission is cleared, rewards at 3 / 5 / 7 stamps, nothing lost. */
import type { CardHistoryEntry, CardMilestone, DateKey, WeekCard } from './types';

/** BALANCE knobs */
export const CARD_POINTS: Readonly<Record<CardMilestone, number>> = { 3: 100, 5: 150, 7: 200 };
export const HISTORY_KEEP_WEEKS = 26;

const todo = (name: string): never => {
  throw new Error(`live: ${name} not implemented yet`);
};

/** the card for `date`'s week: the current one, or a fresh one (the old one goes to the history) */
export function cardFor(card: WeekCard | null, history: readonly CardHistoryEntry[], date: DateKey): { readonly card: WeekCard; readonly history: readonly CardHistoryEntry[] } {
  return todo(`cardFor(${card?.week}, ${history.length}, ${date})`);
}
/** the card with `date`'s day stamped */
export function stamp(card: WeekCard, date: DateKey): WeekCard {
  return todo(`stamp(${card.week}, ${date})`);
}
export const stampCount = (card: WeekCard): number => card.stamps.filter(Boolean).length;
