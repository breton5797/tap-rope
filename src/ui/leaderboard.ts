// v7 랭킹 screen (GDD-v7 §4): board tabs, top 50, a pinned "my row", loading / offline / empty states.
import type { Board, LeaderboardRow } from '../types';
import { button, formatNumber, h, header, type Ctx } from './dom';
import { icons } from './icons';

export type LeaderboardData = { readonly top: readonly LeaderboardRow[]; readonly mine: LeaderboardRow | null } | 'loading' | 'offline';

const TOP = 50;

/** Today's daily board id, local date (matches the daily-operation date the game uses). */
export function todayBoard(now = new Date()): Board {
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return `daily:${d}`;
}

interface Tab {
  readonly label: string;
  readonly board: Board;
}

function tabs(ctx: Ctx, active: Board): HTMLElement {
  const list: readonly Tab[] = [
    { label: '무한 침투', board: 'endless' },
    { label: '주간', board: 'endless-week' },
    { label: '오늘의 일일 작전', board: todayBoard() },
  ];
  const isActive = (b: Board): boolean => b === active || (b.startsWith('daily:') && active.startsWith('daily:'));
  return h(
    'nav',
    { cls: 'lb__tabs', attrs: { role: 'tablist', 'aria-label': '랭킹 종류' } },
    list.map((t) => {
      const on = isActive(t.board);
      const el = h('button', { cls: `lb__tab${on ? ' is-active' : ''}`, text: t.label, attrs: { type: 'button', role: 'tab', 'aria-selected': String(on) } });
      if (!on) el.addEventListener('click', ctx.tap(() => ctx.cb.onOpenLeaderboard(t.board)));
      return el;
    }),
  );
}

function row(r: LeaderboardRow, pinned = false): HTMLElement {
  const podium = r.rank <= 3 ? ` is-top${r.rank}` : '';
  return h('li', { cls: `lb__row${r.me ? ' is-me' : ''}${pinned ? ' is-pinned' : ''}${podium}`, attrs: { 'aria-label': `${r.rank}위 ${r.nickname} ${r.score}점${r.me ? ' (나)' : ''}` } }, [
    h('span', { cls: 'lb__rank mono', text: String(r.rank).padStart(2, '0') }),
    h('span', { cls: 'lb__name', text: r.nickname }),
    r.me ? h('span', { cls: 'lb__me mono', text: 'YOU' }) : null,
    h('span', { cls: 'lb__score mono', text: formatNumber(r.score) }),
  ]);
}

function state(kicker: string, text: string, action: HTMLElement | null, cls: string): HTMLElement {
  return h('div', { cls: `lb__state ${cls}`, attrs: { role: 'status' } }, [h('div', { cls: 'kicker', text: kicker }), h('p', { text }), action]);
}

function body(ctx: Ctx, board: Board, data: LeaderboardData): HTMLElement {
  if (data === 'loading') {
    return h('div', { cls: 'lb__body', attrs: { 'aria-busy': 'true' } }, [
      state('LINK', '순위 수신 중…', null, 'lb__state--loading'),
      h('ul', { cls: 'lb__list', attrs: { 'aria-hidden': 'true' } }, Array.from({ length: 8 }, () => h('li', { cls: 'lb__row is-skeleton' }, [h('i'), h('i'), h('i')]))),
    ]);
  }
  if (data === 'offline') {
    const retry = button({ label: '다시 시도', variant: 'glass', size: 'sm', icon: icons.retry(), onPress: ctx.tap(() => ctx.cb.onOpenLeaderboard(board)) });
    return h('div', { cls: 'lb__body' }, [state('NO SIGNAL', '오프라인 — 연결 후 다시 시도. 기록은 연결되면 자동 등록된다.', retry, 'lb__state--offline')]);
  }
  const top = data.top.slice(0, TOP);
  if (top.length === 0) {
    return h('div', { cls: 'lb__body' }, [state('NO RECORDS', '아직 등록된 기록 없음. 첫 기록을 등록하라.', null, 'lb__state--empty'), data.mine ? row(data.mine, true) : null]);
  }
  const mineVisible = data.mine !== null && top.some((r) => r.me);
  return h('div', { cls: 'lb__body' }, [
    h('ul', { cls: 'lb__list' }, top.map((r) => row(r))),
    // pinned "my row": always reachable at the bottom unless it is already in view in the list
    data.mine && !mineVisible ? row(data.mine, true) : null,
  ]);
}

export function buildLeaderboard(ctx: Ctx, board: Board, data: LeaderboardData, onBack: () => void): HTMLElement {
  const nick = button({ label: '호출명', variant: 'glass', size: 'sm', icon: icons.gear(), aria: '닉네임 변경', onPress: ctx.tap(() => ctx.cb.onOpenNickname()) });
  const content = body(ctx, board, data);
  const pinned = content.querySelector('.lb__row.is-pinned');
  return h('section', { cls: 'screen screen--leaderboard', attrs: { 'aria-label': '랭킹' } }, [
    header(ctx, '랭킹', onBack, [nick], icons.back()),
    tabs(ctx, board),
    h('div', { cls: 'lb__head mono', attrs: { 'aria-hidden': 'true' } }, [h('span', { text: 'RANK' }), h('span', { text: 'OPERATOR' }), h('span', { text: 'SCORE' })]),
    h('div', { cls: 'scroll' }, [content]),
    pinned ? h('div', { cls: 'lb__pin' }, [pinned]) : null,
  ]);
}
