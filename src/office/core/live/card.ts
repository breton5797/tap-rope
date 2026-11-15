/**
 * 주간 출근 카드 (spec §2): a stamp for each day the daily mission is cleared (Monday … Sunday), rewards at
 * 3 / 5 / 7 stamps, nothing lost for a missed day. A new week brings a new card; the old one goes to the
 * 출근 기록부 (history, newest first).
 */
import type { CardHistoryEntry, CardMilestone, DateKey, WeekCard } from './types';
import { weekOf, weekdayOf } from './dates';

/** BALANCE knobs: points at 3 / 5 / 7 stamps */
export const CARD_POINTS: Readonly<Record<CardMilestone, number>> = { 3: 100, 5: 150, 7: 200 };
export const CARD_MILESTONES: readonly CardMilestone[] = [3, 5, 7];
export const HISTORY_KEEP_WEEKS = 26;

const EMPTY: WeekCard['stamps'] = [false, false, false, false, false, false, false];

export const stampCount = (card: WeekCard): number => card.stamps.filter(Boolean).length;

/** the card for `date`'s week: the current one, or a fresh one (an older card goes to the history) */
export function cardFor(card: WeekCard | null, history: readonly CardHistoryEntry[], date: DateKey): { readonly card: WeekCard; readonly history: readonly CardHistoryEntry[] } {
  const week = weekOf(date);
  if (card && card.week === week) return { card, history };
  // a card from a later week (clock turned back) stays; the caller earns nothing on an earlier date
  if (card && card.week > week) return { card, history };
  const archived = card ? [{ week: card.week, stamps: stampCount(card) }, ...history].slice(0, HISTORY_KEEP_WEEKS) : history;
  return { card: { week, stamps: EMPTY }, history: archived };
}

/** the card with `date`'s day stamped (a date of another week: unchanged) */
export function stamp(card: WeekCard, date: DateKey): WeekCard {
  if (weekOf(date) !== card.week) return card;
  const day = weekdayOf(date);
  return { ...card, stamps: card.stamps.map((v, i) => v || i === day) as unknown as WeekCard['stamps'] };
}
