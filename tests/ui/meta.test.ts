// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { defaultSave } from '../../src/core/storage';
import { decodeTransfer, encodeTransfer } from '../../src/core/transfer';
import type { ResultInfo, ResultMeta, SaveData, UiCallbacks } from '../../src/types';
import type { Ctx } from '../../src/ui/dom';
import { buildResult } from '../../src/ui/result';
import { buildSettings } from '../../src/ui/settings';
import { buildShop } from '../../src/ui/shop';
import { buildStageSelect } from '../../src/ui/stages';
import { buildTitle } from '../../src/ui/title';
import { buildTransfer } from '../../src/ui/transfer';

// jsdom has no scrolling; the map centres its NEXT node on the next frame
Element.prototype.scrollTo ??= function scrollTo(): void {};

function ctxWith(over: Partial<UiCallbacks> = {}): Ctx {
  const noop = (): void => undefined;
  const cb: UiCallbacks = {
    onStartStage: noop, onStartEndless: noop, onStartDaily: noop, onPause: noop, onResume: noop, onRetry: noop,
    onQuit: noop, onNextStage: noop, onBuySkin: noop, onSelectSkin: noop, onSettingsChange: noop, onTutorialDone: noop,
    onUiClick: noop, onOpenArchive: noop, onPlayCutscene: noop, onOpenAchievements: noop, onOpenLeaderboard: vi.fn(), onOpenNickname: noop,
    ...over,
  };
  return { cb, tap: (fn) => fn, reducedMotion: () => true };
}

const meta = (over: Partial<ResultMeta> = {}): ResultMeta => ({
  rewards: [], streak: null, unlocked: [], hitBy: null, seed: null, vs: null, board: null, hits: 0, frame: null, ...over,
});
const result = (over: Partial<ResultInfo> = {}): ResultInfo => ({
  mode: 'stage', stageId: 'w1-s3', title: '1-3 · t', cleared: true, stars: 2, score: 900, best: 900, newRecord: false,
  perfects: 5, goods: 5, misses: 0, maxCombo: 10, coinsEarned: 0, hasNext: true, ...over,
});
const text = (el: HTMLElement): string => el.textContent ?? '';

describe('v8 result card', () => {
  it('failed run: one-line tip with the glyph of what hit you; stats folded', () => {
    const el = buildResult(ctxWith(), result({ cleared: false, stars: 0, meta: meta({ hitBy: 'slide' }) }));
    expect(el.querySelector('.report__tip')?.textContent).toContain('천장 레이저');
    expect(el.querySelector('.report__tip svg')).not.toBeNull();
    expect(el.querySelector<HTMLDetailsElement>('.report__more')?.open).toBe(false);
  });

  it('cleared below ★3: the rule line with this run\'s PERFECT share and hits', () => {
    const el = buildResult(ctxWith(), result({ meta: meta({ hits: 1 }) }));
    expect(el.querySelector('.report__rule')?.textContent).toContain('PERFECT 60% (이번 50%)');
    expect(el.querySelector('.report__rule')?.textContent).toContain('피격 1');
    expect(buildResult(ctxWith(), result({ stars: 3, meta: meta() })).querySelector('.report__rule')).toBeNull();
    expect(el.querySelector<HTMLDetailsElement>('.report__more')?.open).toBe(true);
  });

  it('boss win: boss art banner "거점 제압"', () => {
    const el = buildResult(ctxWith(), result({ stageId: 'w1-s10', title: '1-10', meta: meta() }));
    expect(el.querySelector('.report__boss-banner')?.textContent).toBe('거점 제압');
    expect(el.querySelector('.report__boss img')?.getAttribute('src')).toBe('./art/boss-warden.webp');
    expect(buildResult(ctxWith(), result({ stageId: 'w1-s10', cleared: false, meta: meta() })).querySelector('.report__boss')).toBeNull();
  });

  it('rewards, first-mission → 장비실, achievement badges with art + ₵ (no double count for first-clear)', () => {
    const onOpenShop = vi.fn();
    const el = buildResult(ctxWith({ onOpenShop }), result({
      meta: meta({
        rewards: [
          { kind: 'first-clear', label: '첫 클리어', coins: 10 },
          { kind: 'first-mission', label: '첫 임무 보상 → 장비실', coins: 60 },
          { kind: 'achievement', label: '업적 · 50 체인', coins: 20 },
        ],
        unlocked: ['first-clear', 'chain-50'],
      }),
    }));
    expect(el.querySelectorAll('.report__reward').length).toBe(2);
    el.querySelector<HTMLButtonElement>('.report__reward .btn')?.click();
    expect(onOpenShop).toHaveBeenCalled();
    const chips = el.querySelectorAll('.badge-chip');
    expect(chips.length).toBe(2);
    expect(chips[0].querySelector('img')?.getAttribute('src')).toBe('./art/ach/first-clear.webp');
    expect(chips[0].querySelector('.badge-chip__coins')).toBeNull();
    expect(chips[1].textContent).toContain('+₵20');
  });

  it('daily clear without a record reads as a success with the streak', () => {
    const el = buildResult(ctxWith(), result({
      mode: 'daily', stageId: null, best: 2000, score: 900, meta: meta({ streak: { count: 4, extended: true }, board: 'daily:2026-10-28' }),
    }));
    expect(el.classList.contains('is-win')).toBe(true);
    expect(text(el)).toContain('연속 4일');
    expect(text(el)).toContain('연속 작전 +1 → 4일');
    expect(text(el)).toContain('최고 기록까지 −1,100');
  });

  it('endless: next-rank gap, 랭킹 button opens its board, challenge duel', () => {
    const ctx = ctxWith();
    const el = buildResult(ctx, result({
      mode: 'endless', stageId: null, cleared: false, score: 900, best: 900,
      online: { state: 'ranked', rank: 7, gap: 101 }, meta: meta({ seed: 42, vs: 1000, board: 'endless' }),
    }));
    expect(el.querySelector('.report__online')?.textContent).toContain('다음 순위까지 −101점');
    expect(el.querySelector('.report__duel')?.textContent).toContain('101점 부족');
    [...el.querySelectorAll<HTMLButtonElement>('.report__extras .btn')].find((b) => b.textContent?.includes('랭킹'))?.click();
    expect(ctx.cb.onOpenLeaderboard).toHaveBeenCalledWith('endless');
    expect(el.querySelector('button[aria-label="같은 코스 도전 링크 보내기"]')).not.toBeNull();
  });

  it('an equipped frame colours the card', () => {
    const el = buildResult(ctxWith(), result({ meta: meta({ frame: '#ffd36b' }) }));
    const card = el.querySelector<HTMLElement>('.report');
    expect(card?.classList.contains('report--framed')).toBe(true);
    expect(card?.style.getPropertyValue('--frame')).toBe('#ffd36b');
  });
});

describe('v8 title / map / settings / shop', () => {
  it('title: next goal strip and the daily streak state', () => {
    const save: SaveData = { ...defaultSave(), stars: { 'w1-s1': 2 }, dailyStreak: { last: '2026-10-27', count: 3 } };
    const nav = { toStages: vi.fn(), toArchive: vi.fn(), toAchievements: vi.fn(), toLeaderboard: vi.fn(), toShop: vi.fn(), toSettings: vi.fn(), toGuide: vi.fn() };
    const el = buildTitle(ctxWith(), save, nav, '2026-10-28');
    expect(el.querySelector('.title__goal')?.textContent).toContain('연속 3일');
    expect(el.querySelector('.btn--daily')?.textContent).toContain('연속 3일 · 오늘 미완료');
    const done = buildTitle(ctxWith(), { ...save, dailyStreak: { last: '2026-10-28', count: 4 } }, nav, '2026-10-28');
    expect(done.querySelector('.btn--daily')?.textContent).toContain('완료 ✓ · 연속 4일');
  });

  it('map: locked zone tabs are aria-disabled and say 잠김; a 랭킹 shortcut', () => {
    const ctx = ctxWith();
    const el = buildStageSelect(ctx, defaultSave(), () => undefined);
    const tabs = [...el.querySelectorAll('.chap')];
    expect(tabs[0].getAttribute('aria-disabled')).toBeNull();
    expect(tabs[1].getAttribute('aria-disabled')).toBe('true');
    expect(tabs[1].getAttribute('aria-label')).toContain('잠김');
    el.querySelector<HTMLButtonElement>('.btn--rank')?.click();
    expect(ctx.cb.onOpenLeaderboard).toHaveBeenCalledWith('endless');
  });

  it('settings: switches spell ON/OFF and flip it', () => {
    const el = buildSettings(ctxWith(), defaultSave(), () => undefined, () => undefined);
    const first = el.querySelector<HTMLElement>('.setting');
    expect(first?.querySelector('.switch__state')?.textContent).toBe('ON');
    first?.click();
    expect(first?.querySelector('.switch__state')?.textContent).toBe('OFF');
    expect(el.textContent).toContain('v8');
    expect(el.querySelector('.transfer')).not.toBeNull();
  });

  it('shop: buying a cosmetic equips it, reports the new save and redraws in place', () => {
    const onMetaChange = vi.fn();
    const local = vi.fn();
    const el = buildShop(ctxWith({ onMetaChange }), { ...defaultSave(), coins: 500 }, () => undefined, local);
    const buy = el.querySelector<HTMLButtonElement>('.cos .btn');
    buy?.click();
    const next = onMetaChange.mock.calls[0][0] as SaveData;
    expect(next.coins).toBe(500 - 80);
    expect(next.cosmetics.tint.kid).toBe('tint:kid:ember');
    expect(local).toHaveBeenCalledWith(next);
    expect(el.querySelector('.cos.is-on')?.textContent).toContain('해제');
    expect(el.querySelector('.chip__value')?.textContent).toBe('420');
    const poor = buildShop(ctxWith({ onMetaChange }), defaultSave(), () => undefined);
    poor.querySelector<HTMLButtonElement>('.cos .btn')?.click();
    expect(poor.querySelector('.shop__status')?.textContent).toContain('부족');
  });
});

describe('v8 transfer card', () => {
  it('imports a code after confirming: writes the save and reloads', () => {
    localStorage.clear();
    const reload = vi.fn();
    const el = buildTransfer(ctxWith(), defaultSave(), { reload });
    const code = encodeTransfer({ ...defaultSave(), coins: 77, stars: { 'w1-s1': 3 } }, null);
    const input = el.querySelectorAll('textarea')[1];
    const [, check, confirm] = [...el.querySelectorAll<HTMLButtonElement>('button')];
    input.value = 'garbage';
    check.click();
    expect(el.querySelector('.transfer__status')?.className).toContain('is-err');
    expect(confirm.style.display).toBe('none');
    input.value = code;
    check.click();
    expect(el.querySelector('.transfer__status')?.textContent).toContain('별 3개 · ₵77');
    confirm.click();
    expect(reload).toHaveBeenCalled();
    const stored = localStorage.getItem('laserescape.save.v1');
    expect(stored && JSON.parse(stored).coins).toBe(77);
  });

  it('exports this device\'s save as a valid code', () => {
    const el = buildTransfer(ctxWith(), { ...defaultSave(), coins: 5 });
    el.querySelector<HTMLButtonElement>('button')?.click();
    const out = el.querySelector('textarea')?.value ?? '';
    const r = decodeTransfer(out);
    expect(r.ok && r.save.coins).toBe(5);
  });
});
