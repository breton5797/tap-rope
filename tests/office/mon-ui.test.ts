// @vitest-environment jsdom
// Result-card rewarded bonus and the 칼퇴 패스 card, driven by the scripted test adapters.
import { beforeEach, describe, expect, it } from 'vitest';
import { adBonus } from '../../src/office/ui/monetization/bonus';
import { passCard } from '../../src/office/ui/monetization/pass-card';
import { createMonetization, type Monetization } from '../../src/office/monetization/index';
import { createTestAds, createTestPass, type TestAdScript } from '../../src/office/monetization/adapters/test';
import { DEFAULT_CONFIG } from '../../src/office/monetization/config';
import type { ResultInfo, SaveData, UiCallbacks } from '../../src/types';
import type { Ctx } from '../../src/ui/dom';

const T0 = new Date(2026, 10, 18, 9, 0, 0).getTime();
const LATER = T0 + 10 * 60_000;

function mem(): Pick<Storage, 'getItem' | 'setItem'> {
  const d: Record<string, string> = {};
  return { getItem: (k) => d[k] ?? null, setItem: (k, v) => { d[k] = v; } };
}

async function mon(ads: TestAdScript | null, owned = false): Promise<{ m: Monetization; at: (t: number) => void }> {
  let now = T0;
  const m = createMonetization({
    ads: ads ? createTestAds(ads) : null, pass: createTestPass({ owned }), store: mem(), now: () => now, config: DEFAULT_CONFIG, sleep: async () => undefined,
  });
  await m.ready;
  return { m, at: (t) => { now = t; } };
}

function ctxWithSave(save: { coins: number }): Ctx {
  const cb = new Proxy({}, {
    get: (_t, k) => (k === 'onMetaUpdate'
      ? (u: (s: SaveData) => SaveData | null) => {
        const next = u(save as SaveData);
        if (next) save.coins = next.coins;
        return next;
      }
      : () => undefined),
  }) as UiCallbacks;
  return { cb, tap: (fn) => fn, reducedMotion: () => true };
}

const stageClear = { mode: 'stage', stageId: 'w1-s1', cleared: true } as unknown as ResultInfo;
const flush = () => new Promise((r) => setTimeout(r, 0));
const btn = (el: HTMLElement) => el.querySelector<HTMLButtonElement>('.ad-bonus__btn');

beforeEach(() => document.body.replaceChildren());

describe('result card rewarded bonus', () => {
  it('watching the ad adds the points to the save once', async () => {
    const { m, at } = await mon({});
    at(LATER);
    const save = { coins: 100 };
    const el = adBonus(ctxWithSave(save), stageClear, m, new Date(LATER))!;
    await flush();
    expect(btn(el)?.textContent).toContain('광고 보고 +₵30 더 받기');
    expect(el.textContent).toContain('오늘 0/5');
    btn(el)!.click();
    await flush();
    await flush();
    expect(save.coins).toBe(130);
    expect(el.textContent).toContain('보너스 +₵30 받았어요!');
    expect(btn(el)).toBeNull();
  });

  it('a skipped ad pays nothing and says why; the button stays', async () => {
    const { m, at } = await mon({ show: 'skip' });
    at(LATER);
    const save = { coins: 100 };
    const el = adBonus(ctxWithSave(save), stageClear, m, new Date(LATER))!;
    btn(el)!.click();
    await flush();
    await flush();
    expect(save.coins).toBe(100);
    expect(el.textContent).toContain('끝까지 보면');
    expect(btn(el)).not.toBeNull();
  });

  it('stays hidden for a new player, a failed run, and a build without ads or purchases', async () => {
    const fresh = await mon({});
    expect(adBonus(ctxWithSave({ coins: 0 }), stageClear, fresh.m, new Date(T0))!.hidden).toBe(true);
    expect(adBonus(ctxWithSave({ coins: 0 }), { ...stageClear, cleared: false }, fresh.m)).toBeNull();
    const web = createMonetization({ ads: null, pass: null, store: mem(), now: () => LATER, config: DEFAULT_CONFIG });
    expect(adBonus(ctxWithSave({ coins: 0 }), stageClear, web)).toBeNull();
  });

  it('a pass holder gets the bonus without an ad', async () => {
    const { m } = await mon(null, true);
    const save = { coins: 0 };
    const el = adBonus(ctxWithSave(save), stageClear, m, new Date(T0))!;
    expect(btn(el)?.textContent).toContain('칼퇴 패스 보너스 +₵30');
    btn(el)!.click();
    await flush();
    expect(save.coins).toBe(30);
  });
});

describe('칼퇴 패스 card', () => {
  it('lists the perks and the store price, buys and then shows 사용 중', async () => {
    const { m } = await mon({});
    let owned = 0;
    const card = passCard(ctxWithSave({ coins: 0 }), { m, onOwned: () => { owned += 1; } })!;
    await flush();
    expect(card.textContent).toContain('광고 없이 결과 화면 보너스를 바로 받아요');
    const buy = card.querySelector<HTMLButtonElement>('.pass-card__buy')!;
    expect(buy.textContent).toContain('₩3,300 구매');
    buy.click();
    await flush();
    await flush();
    expect(card.textContent).toContain('사용 중');
    expect(card.textContent).toContain('칼퇴 패스를 사용할 수 있어요');
    expect(owned).toBe(1);
    expect(card.querySelector('.pass-card__restore')).not.toBeNull();
    expect(card.textContent).toContain('광고 개인정보 설정');
  });

  it('never uses urgency words (family title, P4)', async () => {
    const { m } = await mon({});
    const card = passCard(ctxWithSave({ coins: 0 }), { m, onOwned: () => undefined })!;
    expect(card.textContent).not.toMatch(/한정|마감|오늘만|지금 안 사면|남은 시간|놓치/);
  });

  it('shows no buy button while the store price is unknown (offline / no billing)', async () => {
    const m = createMonetization({
      ads: null, pass: createTestPass({ owned: false, price: null }), store: mem(), now: () => T0, config: DEFAULT_CONFIG,
    });
    await m.ready;
    const card = passCard(ctxWithSave({ coins: 0 }), { m, onOwned: () => undefined })!;
    expect(card.querySelector('.pass-card__buy')).toBeNull();
    expect(card.textContent).toContain('지금은 스토어에 연결할 수 없어요');
    expect(card.querySelector('.pass-card__restore')).not.toBeNull();
  });

  it('is absent where the store cannot sell it', () => {
    const web = createMonetization({ ads: null, pass: null, store: mem(), now: () => T0, config: DEFAULT_CONFIG });
    expect(passCard(ctxWithSave({ coins: 0 }), { m: web, onOwned: () => undefined })).toBeNull();
  });
});
