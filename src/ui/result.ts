// Result = 작전 보고서 (operation report): status, rank ticks, score count-up and a stats table.
import { STAGES } from '../core/content';
import type { ResultInfo } from '../types';
import { button, formatNumber, h, type Ctx } from './dom';
import { icons } from './icons';

const COUNT_MS = 900;

/** v7 (endless / daily): leaderboard submission state. Lead adds this to ResultInfo as `online?`. */
export interface OnlineStatus {
  readonly state: 'pending' | 'ranked' | 'offline' | 'rejected';
  readonly rank?: number;
}

const ONLINE_TEXT: Readonly<Record<OnlineStatus['state'], (rank?: number) => string>> = {
  pending: () => '검증 중…',
  ranked: (rank) => (rank !== undefined ? `랭킹 등록 #${rank}` : '랭킹 등록 완료'),
  offline: () => '오프라인 — 연결되면 등록',
  rejected: () => '기록 검증 실패 — 랭킹 미등록',
};

function onlineLine(r: ResultInfo): HTMLElement | null {
  const online = (r as ResultInfo & { readonly online?: OnlineStatus }).online;
  if (r.mode === 'stage' || !online) return null;
  return h('div', { cls: `report__online is-${online.state}`, attrs: { role: 'status', 'aria-live': 'polite' } }, [
    h('span', { cls: 'report__online-dot' }),
    h('span', { text: ONLINE_TEXT[online.state](online.rank) }),
  ]);
}

/** Rank: three tick marks lit in sequence. */
function rank(n: number): HTMLElement {
  return h('div', { cls: 'report__rank', attrs: { 'aria-label': `평가 ${n}/3` } }, [
    h('span', { cls: 'report__rank-label mono', text: 'RANK' }),
    ...[0, 1, 2].map((i) => h('i', { cls: `rtick${i < n ? ' is-on' : ''}`, style: { 'animation-delay': `${0.25 + i * 0.18}s` } })),
  ]);
}

function countUp(el: HTMLElement, target: number, reduced: boolean): void {
  if (reduced || target <= 0 || typeof requestAnimationFrame !== 'function') {
    el.textContent = formatNumber(target);
    return;
  }
  const start = performance.now() + 200;
  const tick = (now: number): void => {
    const t = Math.max(0, Math.min(1, (now - start) / COUNT_MS));
    el.textContent = formatNumber(target * (1 - Math.pow(1 - t, 3)));
    if (t < 1 && el.isConnected) requestAnimationFrame(tick);
  };
  el.textContent = '0';
  requestAnimationFrame(tick);
}

/** Share of judged beats that were not misses, as a whole percent. */
export function accuracy(r: Pick<ResultInfo, 'perfects' | 'goods' | 'misses'>): number {
  const total = r.perfects + r.goods + r.misses;
  return total === 0 ? 0 : Math.round(((r.perfects + r.goods) / total) * 100);
}

function statRow(label: string, value: string, cls = ''): HTMLElement {
  return h('div', { cls: `report__row ${cls}`.trim() }, [h('dt', { text: label }), h('dd', { cls: 'mono', text: value })]);
}

interface Headline {
  readonly status: string; // latin status line
  readonly title: string;
  readonly tone: 'win' | 'lose';
}

function headline(r: ResultInfo): Headline {
  if (r.mode !== 'stage') return { status: r.newRecord ? 'NEW RECORD' : 'OPERATION ENDED', title: r.newRecord ? '최고 기록 갱신' : '작전 종료', tone: r.newRecord ? 'win' : 'lose' };
  return r.cleared ? { status: 'MISSION COMPLETE', title: '임무 완료', tone: 'win' } : { status: 'MISSION FAILED', title: '임무 실패 — 재투입?', tone: 'lose' };
}

/** Story line after a boss: rescue (zone 5), final escape (zone 10), or the next zone opening. */
function storyBeat(r: ResultInfo): string | null {
  const stage = STAGES.find((s) => s.id === r.stageId);
  if (r.mode !== 'stage' || !r.cleared || stage?.kind !== 'boss') return null;
  if (r.stageId === 'w5-s10') return '포로 확보. 2단계 탈출 작전 개시 — ZONE 06';
  if (r.stageId === 'w10-s10' || !r.hasNext) return '탈출 성공. 전 작전 종료.';
  return `거점 제압. ZONE ${String(stage.chapter + 2).padStart(2, '0')} 개방`;
}

function actions(ctx: Ctx, r: ResultInfo): HTMLElement {
  const next =
    r.mode === 'stage' && r.cleared && r.hasNext
      ? button({ label: '다음 작전', variant: 'sun', size: 'lg', icon: icons.next(), onPress: ctx.tap(() => ctx.cb.onNextStage()) })
      : null;
  const retry = button({
    label: '재투입',
    variant: next ? 'glass' : 'sun',
    size: next ? 'md' : 'lg',
    icon: icons.retry(),
    onPress: ctx.tap(() => ctx.cb.onRetry()),
  });
  const quit = button({
    label: r.mode !== 'stage' ? '메뉴' : '작전 지도',
    variant: 'glass',
    icon: icons.grid(),
    onPress: ctx.tap(() => ctx.cb.onQuit()),
  });
  return next ? h('div', { cls: 'stack' }, [next, h('div', { cls: 'row' }, [retry, quit])]) : h('div', { cls: 'stack' }, [retry, quit]);
}

export function buildResult(ctx: Ctx, r: ResultInfo): HTMLElement {
  const head = headline(r);
  const score = h('div', { cls: 'report__score mono' });
  countUp(score, r.score, ctx.reducedMotion());
  const story = storyBeat(r);
  const card = h('div', { cls: `report card pop-in report--${head.tone}` }, [
    h('div', { cls: 'report__head' }, [
      h('div', { cls: 'kicker', text: 'OPERATION REPORT // 작전 보고서' }),
      h('div', { cls: 'report__op', text: r.title }),
    ]),
    h('div', { cls: 'report__status mono', text: head.status }),
    h('h2', { cls: 'report__title', text: head.title }),
    story ? h('div', { cls: 'report__story' }, [icons.unlock(), h('span', { text: story })]) : null,
    onlineLine(r),
    h('div', { cls: 'report__scorebox' }, [
      h('div', { cls: 'report__label mono', text: 'SCORE' }),
      score,
      h('div', { cls: 'report__best' }, [
        h('span', { text: `최고 ${formatNumber(Math.max(r.best, r.score))}` }),
        r.newRecord ? h('span', { cls: 'report__new mono', text: 'NEW RECORD' }) : null,
      ]),
      r.mode === 'stage' ? rank(r.stars) : null,
    ]),
    h('dl', { cls: 'report__stats' }, [
      // teal only on success; a failed run reads neutral (or red when most beats were missed)
      statRow('정확도', `${accuracy(r)}%`, head.tone === 'win' ? 'report__row--acc' : accuracy(r) < 50 ? 'report__row--miss' : ''),
      statRow('PERFECT', formatNumber(r.perfects)),
      statRow('GOOD', formatNumber(r.goods)),
      statRow('MISS', formatNumber(r.misses), 'report__row--miss'),
      statRow('최대 연속', `x${formatNumber(r.maxCombo)}`),
      // replays earn nothing: a dash instead of a broken-looking "₵ 0"
      r.coinsEarned > 0 ? statRow('획득 자금', `₵ ${formatNumber(r.coinsEarned)}`, 'report__row--funds') : statRow('획득 자금', '—', 'report__row--none'),
    ]),
    actions(ctx, r),
  ]);
  return h('section', { cls: `screen screen--modal screen--result is-${head.tone}`, attrs: { 'aria-label': '작전 보고서' } }, [card]);
}
