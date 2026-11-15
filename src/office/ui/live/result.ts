// Office live events on the result card: today's stamp landing on the week card (a daily's first clear) and
// the live rewards of the run (daily points, card 3 / 5 / 7, weekly goal, theme cosmetic, 개근 배지). Inside the
// report card — never an overlay of its own. Reduced motion: the stamp is simply there.
import { formatNumber, h } from '../../../ui/dom';
import { cosmeticById, type Reward, type RewardWhy } from '../../core/live';
import { LIVE_COPY, fillLive } from './copy';
import type { LiveResultView } from './model';
import { weekCard } from './week-card';

const WHY: Readonly<Record<RewardWhy, string>> = {
  daily: LIVE_COPY.resultDaily.replace('!', ''),
  'card-3': fillLive(LIVE_COPY.milestone, { n: 3 }),
  'card-5': fillLive(LIVE_COPY.milestone, { n: 5 }),
  'card-7': fillLive(LIVE_COPY.milestone, { n: 7 }),
  goal: LIVE_COPY.resultGoal.replace('!', ''),
};

export function rewardText(r: Reward): string {
  switch (r.kind) {
    case 'points':
      return `${WHY[r.why]} +₵${formatNumber(r.amount)}`;
    case 'cosmetic':
      return fillLive(LIVE_COPY.resultCosmetic, { name: cosmeticById(r.id)?.name ?? r.id });
    default:
      return LIVE_COPY.resultBadge;
  }
}

export function liveResult(v: LiveResultView): HTMLElement | null {
  if (!v.stamped && v.rewards.length === 0) return null;
  const card = v.stamped ? weekCard(v.card, v.stampKey) : null;
  card?.querySelector(`.wcard__slot[data-day="${v.card.today}"]`)?.classList.add('is-landing');
  return h('div', { cls: 'live-result', attrs: { role: 'group', 'aria-label': v.stamped ? LIVE_COPY.resultStamp : LIVE_COPY.resultGoal } }, [
    v.stamped ? h('div', { cls: 'live-result__head kicker', text: LIVE_COPY.resultStamp }) : null,
    card ? h('div', { cls: 'live-result__card' }, [card]) : null,
    v.rewards.length > 0
      ? h('ul', { cls: 'live-result__rewards' }, v.rewards.map((r) => h('li', { cls: `live-result__reward is-${r.kind}`, text: rewardText(r) })))
      : null,
  ]);
}
