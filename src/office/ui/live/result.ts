// Office live events on the result card: today's stamp landing on the week card (a daily's first clear) and
// the live rewards of the run (daily points, card 3 / 5 / 7, weekly goal, theme cosmetic, 개근 배지). Inside the
// report card — never an overlay of its own. Reduced motion: the stamp is simply there.
import { formatNumber, h } from '../../../ui/dom';
import type { ResultLive } from '../../../types';
import { addDays, cosmeticById, loadLive, todayKey, weekOf, type RewardWhy } from '../../core/live';
import { LIVE_COPY, fillLive } from './copy';
import { equippedSprite } from './model';
import { weekCard } from './week-card';

const WHY: Readonly<Record<RewardWhy, string>> = {
  daily: LIVE_COPY.resultDaily.replace('!', ''),
  'card-3': fillLive(LIVE_COPY.milestone, { n: 3 }),
  'card-5': fillLive(LIVE_COPY.milestone, { n: 5 }),
  'card-7': fillLive(LIVE_COPY.milestone, { n: 7 }),
  goal: LIVE_COPY.resultGoal.replace('!', ''),
};

export function rewardText(r: ResultLive['rewards'][number]): string {
  switch (r.kind) {
    case 'points':
      return `${WHY[r.why as RewardWhy] ?? ''} +₵${formatNumber(r.amount)}`.trim();
    case 'cosmetic':
      return fillLive(LIVE_COPY.resultCosmetic, { name: cosmeticById(r.id)?.name ?? r.id });
    default:
      return LIVE_COPY.resultBadge;
  }
}

/** this run's day stamped the card (the daily's first clear pays 'daily' with the stamp) */
export const stampedNow = (v: ResultLive): boolean => v.rewards.some((r) => r.why === 'daily');

/** the week card as it is after the run, in the equipped card theme */
function cardAfter(v: ResultLive): HTMLElement {
  const live = loadLive();
  const week = live.card?.week ?? weekOf(live.maxDate ?? todayKey(new Date()));
  const m = { week, lastDay: addDays(week, 6), stamps: v.stamps, today: v.today, count: v.stamps.filter(Boolean).length, cardTheme: equippedSprite(live, 'cardTheme') };
  const el = weekCard(m, v.stampDesign);
  el.querySelector(`.wcard__slot[data-day="${v.today}"]`)?.classList.add('is-landing');
  return el;
}

/** 「주간 목표 · 점프 150번 +12 (40/150)」: what this run added to the week's goal */
function goalLine(v: ResultLive): HTMLElement | null {
  const g = v.goal;
  if (!g || g.gain <= 0) return null;
  const where = g.done ? LIVE_COPY.goalDone : `(${g.value}/${g.target})`;
  return h('p', { cls: `live-result__goal${g.done ? ' is-done' : ''}`, text: fillLive(LIVE_COPY.resultGoalGain, { label: g.label, gain: g.gain, where }) });
}

export function liveResult(v: ResultLive): HTMLElement | null {
  const stamped = stampedNow(v);
  const goal = goalLine(v);
  if (!stamped && v.rewards.length === 0 && !goal) return null;
  return h('div', { cls: 'live-result', attrs: { role: 'group', 'aria-label': stamped ? LIVE_COPY.resultStamp : LIVE_COPY.resultGoal } }, [
    stamped ? h('div', { cls: 'live-result__head kicker', text: LIVE_COPY.resultStamp }) : null,
    stamped ? h('div', { cls: 'live-result__card' }, [cardAfter(v)]) : null,
    v.rewards.length > 0
      ? h('ul', { cls: 'live-result__rewards' }, v.rewards.map((r) => h('li', { cls: `live-result__reward is-${r.kind}`, text: rewardText(r) })))
      : null,
    goal,
  ]);
}
