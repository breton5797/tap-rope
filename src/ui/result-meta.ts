// v8 result-card blocks (GDD-v8 A1/A3/A5): fail tip with the glyph of what hit you, boss-win banner,
// ★3 rule, ₵ rewards, achievement badges, daily streak and the endless challenge duel.
import { ACHIEVEMENTS } from '../core/achievements';
import { bossFor } from '../core/boss';
import { STAGES } from '../core/content';
import { ACH_REWARD } from '../core/economy';
import { starRule } from '../core/goals';
import { COPY } from '../flavor';
import type { MoveId, ResultInfo, ResultMeta } from '../types';
import { button, formatNumber, h, type Ctx } from './dom';
import { icons } from './icons';
import { FAIL_TIPS, moveGlyph } from './moves';
import { artImage } from './title';

export { FAIL_TIPS };

export function failTip(id: MoveId): HTMLElement {
  return h('div', { cls: 'report__tip', attrs: { role: 'note' } }, [
    h('span', { cls: 'report__tip-glyph' }, [moveGlyph(id)]),
    h('span', { cls: 'report__tip-text', text: FAIL_TIPS[id] }),
  ]);
}

/** boss-win banner: the boss art with "거점 제압" (falls back to the gradient when the art is missing) */
export function bossBanner(r: ResultInfo): HTMLElement | null {
  const stage = STAGES.find((s) => s.id === r.stageId);
  const boss = stage && r.mode === 'stage' && r.cleared ? bossFor(stage) : null;
  if (!boss) return null;
  return h('div', { cls: 'report__boss' }, [
    artImage(`./art/boss-${boss.id}.webp`, 'art--boss'),
    h('div', { cls: 'report__boss-text' }, [
      h('span', { cls: 'report__boss-code mono', text: `${boss.codename} // NEUTRALIZED` }),
      h('strong', { cls: 'report__boss-banner', text: COPY.resultBossBanner }),
      h('span', { cls: 'report__boss-name', text: boss.name }),
    ]),
  ]);
}

/** "★3 조건: 무피격 · PERFECT 60% (이번 52%)" on a cleared stage below 3 stars */
export function starRuleLine(r: ResultInfo, meta: ResultMeta): HTMLElement | null {
  if (r.mode !== 'stage' || !r.cleared || r.stars >= 3) return null;
  const rule = starRule(r);
  return h('div', { cls: 'report__rule' }, [
    h('span', { cls: 'report__rule-label', text: '★3 조건' }),
    h('span', { cls: meta.hits === 0 ? 'is-met' : 'is-miss', text: `무피격${meta.hits > 0 ? ` (피격 ${meta.hits})` : ''}` }),
    h('span', { text: '·' }),
    h('span', { cls: rule.met ? 'is-met' : 'is-miss', text: `PERFECT 60% (이번 ${rule.pct}%)` }),
  ]);
}

export function rewardList(ctx: Ctx, meta: ResultMeta): HTMLElement | null {
  const shown = meta.rewards.filter((x) => x.kind !== 'achievement'); // achievement ₵ sit on their badges
  if (shown.length === 0) return null;
  const toShop = ctx.cb.onOpenShop;
  return h('ul', { cls: 'report__rewards', attrs: { 'aria-label': '보상' } }, shown.map((x) =>
    h('li', { cls: `report__reward is-${x.kind}` }, [
      h('span', { cls: 'report__reward-coins mono', text: `+₵${formatNumber(x.coins)}` }),
      h('span', { cls: 'report__reward-label', text: x.label }),
      x.kind === 'first-mission' && toShop
        ? button({ label: COPY.titleShop, variant: 'sun', size: 'sm', icon: icons.bag(), onPress: ctx.tap(() => toShop()) })
        : null,
    ])));
}

/** unlocked achievements as badge chips inside the card (badge art, else the rank icon) */
export function badgeChips(meta: ResultMeta): HTMLElement | null {
  if (meta.unlocked.length === 0) return null;
  return h('div', { cls: 'report__badges', attrs: { 'aria-label': `업적 ${meta.unlocked.length}개 달성` } }, meta.unlocked.map((id) => {
    const a = ACHIEVEMENTS.find((x) => x.id === id);
    const img = h('img', { cls: 'badge-chip__img', attrs: { src: `./art/ach/${id}.webp`, alt: '', decoding: 'async' } });
    const fallback = h('span', { cls: 'badge-chip__icon' }, [icons.star()]);
    img.addEventListener('error', () => img.replaceWith(fallback));
    return h('div', { cls: 'badge-chip' }, [
      img,
      h('span', { cls: 'badge-chip__name', text: a?.name ?? id }),
      // first-clear's ₵ is the first-mission line above: don't count it twice
      id === 'first-clear' ? null : h('span', { cls: 'badge-chip__coins mono', text: `+₵${ACH_REWARD[id]}` }),
    ]);
  }));
}

export function streakLine(meta: ResultMeta): HTMLElement | null {
  if (!meta.streak) return null;
  const { count, extended } = meta.streak;
  return h('div', { cls: `report__streak${extended ? ' is-up' : ''}` }, [
    icons.calendar(),
    h('span', { text: extended ? `연속 작전 +1 → ${count}일` : `연속 작전 ${count}일 · 오늘 완료` }),
  ]);
}

/** endless on a challenger's seed: win / lose by N */
export function duelLine(r: ResultInfo, meta: ResultMeta): HTMLElement | null {
  if (meta.vs === null) return null;
  const won = r.score > meta.vs;
  return h('div', { cls: `report__duel ${won ? 'is-win' : 'is-lose'}` }, [
    h('span', { text: `도전 상대 ${formatNumber(meta.vs)}점` }),
    h('strong', { text: won ? `승리 +${formatNumber(r.score - meta.vs)}` : `${formatNumber(meta.vs - r.score + 1)}점 부족` }),
  ]);
}
