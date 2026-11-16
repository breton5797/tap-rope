// @vitest-environment jsdom
// Office live events UI (src/office/ui/live): the title block, the week card screen and 사원 복지몰, rendered
// from their view models (the rules behind the models are core/live's and tested there).
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { titleLiveBlock } from '../../src/office/ui/live/title-block';
import { buildWeekCardScreen, weekCard } from '../../src/office/ui/live/week-card';
import { buildMall, type MallActions } from '../../src/office/ui/live/mall';
import { unequip, type MallItem, type TitleLiveModel, type WeekCardModel } from '../../src/office/ui/live/model';
import type { Cosmetic, LiveSave } from '../../src/office/core/live';
import { emptyLive } from '../../src/office/core/live/save';
import type { UiCallbacks } from '../../src/types';
import type { Ctx } from '../../src/ui/dom';

const ctx = (): Ctx => ({ cb: new Proxy({}, { get: () => () => undefined }) as UiCallbacks, tap: (fn) => fn, reducedMotion: () => true });
const click = (el: Element | null | undefined): void => (el as HTMLElement).click();

const title = (over: Partial<TitleLiveModel> = {}): TitleLiveModel => ({
  today: '2026-11-18', unlocked: true, dailyDone: false, bossName: '박과장', themeName: '월요병 주간', themeId: 'monday-blues', cardCount: 2,
  goal: { label: '커피 30잔 모으기', value: 12, target: 30, done: false }, newItems: 3, ...over,
});

beforeEach(() => document.body.replaceChildren());

describe('title live block', () => {
  it('a fresh day: 오늘의 미션 with NEW and the boss of the day, card n/7, goal bar, new items', () => {
    const nav = { onDaily: vi.fn(), onCard: vi.fn(), onMall: vi.fn() };
    const el = titleLiveBlock(ctx(), title(), nav);
    const daily = el.querySelector('.live-daily');
    expect(daily?.querySelector('.live-new')?.textContent).toBe('NEW');
    expect(daily?.textContent).toContain('오늘의 상사: 박과장');
    // art review: the weekly goal is folded into the card button (one row less): its sub line + a thin bar
    const chip = el.querySelector('.live-cardchip');
    expect(chip?.textContent).toContain('출근 카드 2/7');
    expect(chip?.textContent).toContain('커피 30잔 모으기 12/30');
    const bar = chip?.querySelector('[role="progressbar"]');
    expect(bar?.getAttribute('aria-valuenow')).toBe('12');
    expect(bar?.getAttribute('aria-valuemax')).toBe('30');
    expect(chip?.querySelector('.live-cardchip__badge')?.getAttribute('src')).toBe('./art/live/badge-monday.webp');
    expect(el.querySelector('.live-goal')).toBeNull();
    expect(el.querySelector('.live-count')?.textContent).toBe('3');
    expect(el.querySelector('.live-mallbtn')?.getAttribute('aria-label')).toBe('사원 복지몰, 새 꾸미기 3');
    click(daily);
    click(el.querySelector('.live-cardchip'));
    click(el.querySelector('.live-mallbtn'));
    expect([nav.onDaily, nav.onCard, nav.onMall].map((f) => f.mock.calls.length)).toEqual([1, 1, 1]);
  });

  it('the card button leads with the week\'s theme badge, no ✓ (pt-casual P3 + art review: never a ✓ on 0/7)', () => {
    const nav = { onDaily: vi.fn(), onCard: vi.fn(), onMall: vi.fn() };
    for (const n of [0, 3]) {
      const chip = titleLiveBlock(ctx(), title({ cardCount: n }), nav).querySelector('.live-cardchip');
      expect(chip?.querySelector('.btn__icon')).toBeNull();
      expect(chip?.firstElementChild?.classList.contains('live-cardchip__badge')).toBe(true);
    }
  });

  it('the new-items count is a corner pill on the 복지몰 button, outside its label (art review)', () => {
    const el = titleLiveBlock(ctx(), title(), { onDaily: vi.fn(), onCard: vi.fn(), onMall: vi.fn() });
    const btn = el.querySelector('.live-mallbtn');
    expect(btn?.querySelector('.btn__label')?.textContent).toBe('사원 복지몰');
    const pill = btn?.querySelector('.live-count');
    expect(pill?.parentElement).toBe(btn);
    expect(pill?.classList.contains('live-count--corner')).toBe(true);
    expect(pill?.getAttribute('aria-hidden')).toBe('true');
  });

  it('a done goal reads 달성! in the card button', () => {
    const el = titleLiveBlock(ctx(), title({ goal: { label: '커피 30잔 모으기', value: 30, target: 30, done: true } }), { onDaily: vi.fn(), onCard: vi.fn(), onMall: vi.fn() });
    expect(el.querySelector('.live-cardchip')?.textContent).toContain('주간 목표 달성!');
  });

  it('done today: no NEW, the replay line; nothing to buy: no count', () => {
    const el = titleLiveBlock(ctx(), title({ dailyDone: true, newItems: 0 }), { onDaily: vi.fn(), onCard: vi.fn(), onMall: vi.fn() });
    expect(el.querySelector('.live-new')).toBeNull();
    expect(el.querySelector('.live-daily')?.textContent).toContain('완료 ✓');
    expect(el.querySelector('.live-count')).toBeNull();
  });

  it('before stage 1 is cleared the daily is shown locked and does nothing', () => {
    const onDaily = vi.fn();
    const el = titleLiveBlock(ctx(), title({ unlocked: false, bossName: '' }), { onDaily, onCard: vi.fn(), onMall: vi.fn() });
    const daily = el.querySelector('.live-daily');
    expect(daily?.getAttribute('aria-disabled')).toBe('true');
    expect(daily?.textContent).toContain('1단계를 깨면 열려요');
    expect(daily?.querySelector('.live-new')).toBeNull();
    click(daily);
    expect(onDaily).not.toHaveBeenCalled();
  });
});

const card = (over: Partial<WeekCardModel> = {}): WeekCardModel => ({
  week: '2026-11-16', lastDay: '2026-11-22', stamps: [true, false, true, false, false, false, false], today: 2, count: 2,
  milestones: [
    { at: 3, points: 100, cosmetic: null, badge: false, reached: false },
    { at: 5, points: 150, cosmetic: '커피 발자국', badge: false, reached: false },
    { at: 7, points: 200, cosmetic: null, badge: true, reached: false },
  ],
  history: [{ week: '2026-11-09', stamps: 7 }, { week: '2026-11-02', stamps: 3 }],
  themeName: '월요병 주간', themeId: 'monday-blues', goal: { label: '커피 30잔 모으기', value: 30, target: 30, done: true }, cardTheme: null, ...over,
});

describe('week card screen', () => {
  it('seven slots Mon–Sun: stamps on the cleared days, today marked, later days ahead', () => {
    const el = weekCard(card(), 'stamp-cat');
    const slots = Array.from(el.querySelectorAll('.wcard__slot'));
    expect(slots.map((s) => s.querySelector('.wcard__day')?.textContent)).toEqual(['월', '화', '수', '목', '금', '토', '일']);
    expect(slots.map((s) => s.classList.contains('is-on'))).toEqual([true, false, true, false, false, false, false]);
    expect(slots[2].classList.contains('is-today')).toBe(true);
    expect(slots[3].classList.contains('is-future')).toBe(true);
    expect(slots[0].querySelector('.live-stamp--stamp-cat')).not.toBeNull();
    expect(el.querySelector('.wcard__dates')?.textContent).toBe('11.16 ~ 11.22');
  });

  it('3 / 5 / 7 rewards, the goal, the play button and the 출근 기록부', () => {
    const onPlay = vi.fn();
    const el = buildWeekCardScreen(ctx(), card({ cardTheme: 'card-mint' }), { stampKey: null, dailyOpen: true, onPlay, onBack: vi.fn() });
    const ms = Array.from(el.querySelectorAll('.wcard__ms'));
    expect(ms.map((m) => m.querySelector('.wcard__ms-reward')?.textContent)).toEqual(['₵100', '₵150 + 커피 발자국', '₵200 + 개근 배지']);
    expect(el.querySelector('.wcard--card-mint')).not.toBeNull();
    expect(el.querySelector('.live-goal')?.classList.contains('is-done')).toBe(true);
    click(el.querySelector('.wcard__play'));
    expect(onPlay).toHaveBeenCalledOnce();
    const rows = Array.from(el.querySelectorAll('.wcard-history__row'));
    expect(rows.map((r) => r.textContent)).toEqual(['11.9 주도장 7개', '11.2 주도장 3개']);
    expect(rows[0].classList.contains('is-full')).toBe(true);
    expect(rows[0].querySelector('.wcard-history__badge')?.getAttribute('src')).toBe('./art/live/badge-attendance.webp');
    expect(rows[1].querySelector('.wcard-history__badge')).toBeNull();
    expect(el.querySelector('.wcard__ms[data-at="7"] .wcard__ms-badge')).not.toBeNull();
    expect(el.querySelector('.live-deco--tape')).not.toBeNull();
  });

  it('a reached milestone is ticked; no history yet says where it will show', () => {
    const el = buildWeekCardScreen(ctx(), card({ count: 3, history: [], milestones: card().milestones.map((m) => ({ ...m, reached: m.at === 3 })) }), {
      stampKey: null, dailyOpen: false, onPlay: vi.fn(), onBack: vi.fn(),
    });
    expect(el.querySelector('.wcard__ms[data-at="3"]')?.classList.contains('is-reached')).toBe(true);
    expect(el.querySelector('.wcard__play')).toBeNull();
    expect(el.querySelector('.wcard-history__empty')).not.toBeNull();
  });
});

const item = (id: string, over: Partial<Cosmetic> = {}): Cosmetic => ({ id, category: 'trail', name: id, price: 300, sprite: `trail-${id}`, ...over });

describe('사원 복지몰', () => {
  it('tabs per category; each item shows buy / poor / equip / equipped / not-yet; buying redraws', () => {
    let state: Record<string, MallItem['state']> = { a: 'buy', b: 'poor', c: 'owned', d: 'equipped', e: 'not-yet' };
    const asked: string[] = [];
    const actions: MallActions = {
      view: (cat) => {
        asked.push(cat);
        return { coins: 500, owned: 2, total: 20, themeName: '비 오는 퇴근길 주간', items: Object.keys(state).map((id) => ({ item: item(id, id === 'e' ? { theme: 'rainy-commute' } : {}), state: state[id] })) };
      },
      buy: vi.fn((id: string) => {
        state = { ...state, [id]: 'equipped', d: 'owned' };
        return `${id} 교환 완료!`;
      }),
      equip: vi.fn(),
    };
    const el = buildMall(ctx(), actions, vi.fn());
    expect(el.querySelector('.mall-dex')?.textContent).toBe('도감 2/20');
    expect(el.querySelector('.mall-banner')?.getAttribute('src')).toBe('./art/live/shop-header.webp');
    expect(Array.from(el.querySelectorAll('.mall-tab')).map((t) => t.textContent)).toEqual(['발자국', '점프 효과', '결과 도장', '출근 카드']);
    const row = (id: string) => el.querySelector(`.mall-item[data-id="${id}"]`);
    expect(row('a')?.querySelector('button')?.getAttribute('aria-label')).toBe('a ₵300');
    expect(row('b')?.querySelector('button')?.classList.contains('is-poor')).toBe(true);
    expect(row('c')?.querySelector('button')?.textContent).toBe('장착');
    expect(row('d')?.querySelector('.mall-item__on')?.textContent).toBe('장착 중');
    expect(row('e')?.querySelector('button')).toBeNull();
    expect(row('e')?.querySelector('.mall-item__tag')?.textContent).toBe('테마');
    expect(row('e')?.querySelector('.mall-item__later')?.textContent).toBe('비 오는 퇴근길 주간 이벤트 상품 · 다음 주부터 살 수 있어요');
    // two steps (pt-casual P2c): the first tap selects and asks, the second exchanges
    click(row('a')?.querySelector('button'));
    expect(actions.buy).not.toHaveBeenCalled();
    expect(row('a')?.classList.contains('is-selected')).toBe(true);
    expect(row('a')?.querySelector('button')?.textContent).toBe('교환하기 (₵300)');
    click(row('b')?.querySelector('button')); // too few points: says so, selects nothing
    expect(el.querySelector('.mall-status')?.textContent).toBe('포인트가 모자라요');
    expect(row('b')?.classList.contains('is-selected')).toBe(false);
    click(row('a')?.querySelector('button'));
    expect(actions.buy).toHaveBeenCalledWith('a');
    expect(el.querySelector('.mall-status')?.textContent).toBe('a 교환 완료!');
    expect(row('a')?.classList.contains('is-equipped')).toBe(true);
    click(row('a')?.querySelector('button'));
    expect(actions.equip).toHaveBeenCalledWith(null, 'trail'); // the equipped one's button takes it off
    click(el.querySelector('.mall-tab[data-tab="stamp"]'));
    expect(asked.at(-1)).toBe('stamp');
    expect(el.querySelector('.mall-tab[data-tab="stamp"]')?.getAttribute('aria-selected')).toBe('true');
  });

  it('unequip empties only that category', () => {
    const live: LiveSave = { ...emptyLive(), owned: ['x', 'y'], equipped: { trail: 'x', jump: 'y' } };
    expect(unequip(live, 'trail').equipped).toEqual({ jump: 'y' });
    expect(unequip(live, 'stamp')).toBe(live);
  });
});
