// Result = 작전 보고서 (operation report): status, rank ticks, score count-up and a stats table.
// v8: boss-win banner, fail tip (what hit you), ★3 rule, ₵ rewards, achievement badges, daily streak,
// next-rank gap, leaderboard / share / challenge buttons; stats fold away on a failed run.
import { STAGES } from '../core/content';
import type { Board, ResultInfo } from '../types';
import { button, formatNumber, h, type Ctx } from './dom';
import { icons } from './icons';
import { badgeChips, bossBanner, duelLine, failTip, rewardList, starRuleLine, streakLine } from './result-meta';
import { challengeUrl, shareResult } from './share';

const COUNT_MS = 900;

/** v7 (endless / daily): leaderboard submission state (ResultInfo.online). */
export type OnlineStatus = NonNullable<ResultInfo['online']>;

const ONLINE_TEXT: Readonly<Record<OnlineStatus['state'], (o: OnlineStatus) => string>> = {
  pending: () => '검증 중…',
  ranked: (o) => {
    const rank = o.rank !== undefined ? `랭킹 등록 #${o.rank}` : '랭킹 등록 완료';
    if (o.rank === 1) return `${rank} · 1위!`;
    return o.gap !== undefined ? `${rank} · 다음 순위까지 −${formatNumber(o.gap)}점` : rank;
  },
  offline: () => '오프라인 — 연결되면 등록',
  rejected: () => '기록 검증 실패 — 랭킹 미등록',
};

function onlineLine(r: ResultInfo): HTMLElement | null {
  const online = r.online;
  if (r.mode === 'stage' || !online) return null;
  return h('div', { cls: `report__online is-${online.state}`, attrs: { role: 'status', 'aria-live': 'polite' } }, [
    h('span', { cls: 'report__online-dot' }),
    h('span', { text: ONLINE_TEXT[online.state](online) }),
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

/** le-v8 timing weights for 정확도: PERFECT 1, GREAT 0.75, GOOD 0.5, MISS 0. */
export const ACCURACY_WEIGHT = { perfect: 1, great: 0.75, good: 0.5 } as const;

/** Timing-weighted share of judged beats, as a whole percent. */
export function accuracy(r: Pick<ResultInfo, 'perfects' | 'greats' | 'goods' | 'misses'>): number {
  const greats = r.greats ?? 0;
  const total = r.perfects + greats + r.goods + r.misses;
  if (total === 0) return 0;
  const w = ACCURACY_WEIGHT;
  return Math.round(((r.perfects * w.perfect + greats * w.great + r.goods * w.good) / total) * 100);
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
  if (r.mode === 'daily' && r.cleared) {
    // a daily clear counts for the streak even without a record: success tone
    const days = r.meta?.streak?.count;
    return { status: r.newRecord ? 'NEW RECORD' : 'DAILY CLEAR', title: days ? `작전 완료 · 연속 ${days}일` : '작전 완료', tone: 'win' };
  }
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

/** Identity of a run's report: a second showResult with the same key only updates the online line. */
export function resultKey(r: ResultInfo): string {
  const { online: _online, ...run } = r; // everything except the server status identifies the run
  return JSON.stringify(run, Object.keys(run).sort());
}

/** Swap just the online status line of a mounted report (no count-up / entry animation replay). */
export function patchOnline(screen: HTMLElement, r: ResultInfo): void {
  const next = onlineLine(r);
  const current = screen.querySelector('.report__online');
  if (current && next) current.replaceWith(next);
  else if (current) current.remove();
  else if (next) (screen.querySelector('.report__story') ?? screen.querySelector('.report__title'))?.after(next);
}

/** small secondary row: 랭킹 · 공유 · 도전 링크 */
function extras(ctx: Ctx, r: ResultInfo, tone: Headline['tone']): HTMLElement | null {
  const board: Board | null = r.meta?.board ?? (r.mode === 'endless' ? 'endless' : null);
  const page = typeof location === 'undefined' ? null : location.href;
  const seed = r.meta?.seed ?? null;
  const link = seed !== null && page ? challengeUrl(page, seed, r.score) : null;
  const card = { frame: r.meta?.frame ?? null, headline: headline(r).title, lines: [`정확도 ${accuracy(r)}%`, `최대 연속 x${formatNumber(r.maxCombo)}`] };
  const share = (url: string | null): void => {
    void shareResult(r, card, url).then((out) => {
      if (out === 'downloaded') ctx.cb.onUiClick();
    });
  };
  const items = [
    board ? button({ label: '랭킹', variant: 'glass', size: 'sm', icon: icons.crown(), onPress: ctx.tap(() => ctx.cb.onOpenLeaderboard(board)) }) : null,
    tone === 'win' || r.mode !== 'stage'
      ? button({ label: '공유', variant: 'glass', size: 'sm', icon: icons.share(), onPress: ctx.tap(() => share(link)) })
      : null,
    link ? button({ label: '도전장', variant: 'glass', size: 'sm', icon: icons.link(), aria: '같은 코스 도전 링크 보내기', onPress: ctx.tap(() => share(link)) }) : null,
  ].filter((x): x is HTMLButtonElement => x !== null);
  return items.length ? h('div', { cls: 'row report__extras' }, items) : null;
}

function actions(ctx: Ctx, r: ResultInfo, tone: Headline['tone']): HTMLElement {
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
  const more = extras(ctx, r, tone);
  return next
    ? h('div', { cls: 'stack' }, [next, h('div', { cls: 'row' }, [retry, quit]), more])
    : h('div', { cls: 'stack' }, [retry, quit, more]);
}

function stats(r: ResultInfo, tone: Headline['tone']): HTMLElement {
  const list = h('dl', { cls: 'report__stats' }, [
    // teal only on success; a failed run reads neutral (or red when most beats were missed)
    statRow('정확도', `${accuracy(r)}%`, tone === 'win' ? 'report__row--acc' : accuracy(r) < 50 ? 'report__row--miss' : ''),
    statRow('PERFECT', formatNumber(r.perfects)),
    statRow('GREAT', formatNumber(r.greats ?? 0)),
    statRow('GOOD', formatNumber(r.goods)),
    statRow('MISS', formatNumber(r.misses), 'report__row--miss'),
    statRow('최대 연속', `x${formatNumber(r.maxCombo)}`),
    // pickups this run (replays and failed runs keep theirs); a dash only on a true zero
    r.coinsEarned > 0 ? statRow('획득 자금', `₵ ${formatNumber(r.coinsEarned)}`, 'report__row--funds') : statRow('획득 자금', '—', 'report__row--none'),
  ]);
  // a failed run leads with the tip; the numbers fold away (one tap to open)
  const box = h('details', { cls: 'report__more' }, [h('summary', { cls: 'report__more-sum', text: '작전 기록 상세' }), list]);
  if (tone === 'win' || !r.meta?.hitBy) box.open = true;
  return box;
}

export function buildResult(ctx: Ctx, r: ResultInfo): HTMLElement {
  const head = headline(r);
  const meta = r.meta;
  const score = h('div', { cls: 'report__score mono' });
  countUp(score, r.score, ctx.reducedMotion());
  const story = storyBeat(r);
  const frame = meta?.frame ?? null;
  const card = h('div', {
    cls: `report card pop-in report--${head.tone}${frame ? ' report--framed' : ''}`,
    style: frame ? { '--frame': frame } : {},
  }, [
    bossBanner(r),
    h('div', { cls: 'report__head' }, [
      h('div', { cls: 'kicker', text: 'OPERATION REPORT // 작전 보고서' }),
      h('div', { cls: 'report__op', text: r.title }),
    ]),
    h('div', { cls: 'report__status mono', text: head.status }),
    h('h2', { cls: 'report__title', text: head.title }),
    story ? h('div', { cls: 'report__story' }, [icons.unlock(), h('span', { text: story })]) : null,
    onlineLine(r),
    !r.cleared && meta?.hitBy ? failTip(meta.hitBy) : null,
    h('div', { cls: 'report__scorebox' }, [
      h('div', { cls: 'report__label mono', text: 'SCORE' }),
      score,
      h('div', { cls: 'report__best' }, [
        h('span', { text: `최고 ${formatNumber(Math.max(r.best, r.score))}` }),
        r.newRecord ? h('span', { cls: 'report__new mono', text: 'NEW RECORD' }) : null,
        // v8: endless / daily — how far the personal best still is
        !r.newRecord && r.mode !== 'stage' && r.best > r.score
          ? h('span', { cls: 'report__gap mono', text: `최고 기록까지 −${formatNumber(r.best - r.score)}` })
          : null,
      ]),
      r.mode === 'stage' ? rank(r.stars) : null,
    ]),
    meta ? starRuleLine(r, meta) : null,
    meta ? streakLine(meta) : null,
    meta ? duelLine(r, meta) : null,
    meta ? rewardList(ctx, meta) : null,
    meta ? badgeChips(meta) : null,
    stats(r, head.tone),
    actions(ctx, r, head.tone),
  ]);
  return h('section', { cls: `screen screen--modal screen--result is-${head.tone}`, attrs: { 'aria-label': '작전 보고서' } }, [card]);
}
