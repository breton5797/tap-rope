// @vitest-environment jsdom
// Office live events in the app (src/office/game/live-hook.ts) and on the result card: the daily stage, its
// boss-of-the-day line, the run's end through core/live applyRun (points once, the stamp, the rewards shown).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { liveHook } from '../../src/office/game/live-hook';
import { DAILY_POINTS, dailyPlan, loadLive, parseDailyId, todayKey, weekdayOf } from '../../src/office/core/live';
import { missionResult } from '../../src/office/ui/mission';
import { defaultSave } from '../../src/core/storage';
import { stageById } from '../../src/core/content';
import type { ResultInfo, SaveData, StageDef } from '../../src/types';
import type { Session } from '../../src/game/session';

const save = (stars: Record<string, number> = { 'w1-s10': 3, 'w2-s10': 1 }): SaveData => ({ ...defaultSave(), stars });
const base = (stageId: string, over: Partial<ResultInfo> = {}): ResultInfo => ({
  mode: 'stage', stageId, title: '오늘의 칼퇴 미션', cleared: true, stars: 3, score: 900, best: 900, newRecord: false,
  perfects: 5, goods: 0, misses: 0, maxCombo: 10, coinsEarned: 40, hasNext: false,
  missions: { stamps: [true, true, true], grade: 'A', stars: 3, bonus: 0, stampBonus: 0, items: 0 }, ...over,
});
const fakeSession = {} as Session;
const liveOf = (r: ResultInfo) => r.live;
const stamped = (r: ResultInfo): boolean => (r.live?.rewards ?? []).some((x) => x.why === 'daily');

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 18, 12, 0, 0));
});
afterEach(() => vi.useRealTimers());

describe('daily stage + briefing', () => {
  it("plays today's plan for the player's tier; locked before stage 1 is cleared", () => {
    const st = liveHook.dailyStage(save()) as StageDef;
    expect(st.id).toBe(dailyPlan('2026-11-18', 2).stage.id);
    expect(parseDailyId(st.id)?.date).toBe('2026-11-18');
    expect(liveHook.dailyStage(save({}))).toBeNull();
    expect(liveHook.offCampaign(st.id)).toBe(true);
    expect(liveHook.offCampaign('w1-s10')).toBe(false);
  });

  it('the daily names the boss of the day; campaign stages keep their briefing', () => {
    const st = liveHook.dailyStage(save()) as StageDef;
    const b = liveHook.briefing(st);
    expect(b?.text).toBe(`오늘의 상사: ${dailyPlan('2026-11-18', 2).boss.name}`);
    expect(b?.kicker).toContain('오늘의 칼퇴 미션');
    expect(liveHook.briefing(stageById('w1-s10') as StageDef)).toBeNull();
  });
});

describe('run end', () => {
  it("today's first daily clear: points once, the stamp lands on today's slot, shown on the result", () => {
    const st = liveHook.dailyStage(save()) as StageDef;
    liveHook.start(fakeSession);
    const end = liveHook.finish(save(), { stageId: st.id, cleared: true, score: 900 });
    expect(end.coins).toBe(DAILY_POINTS);
    const r = end.decorate(base(st.id));
    expect(r.coinsEarned).toBe(40 + DAILY_POINTS);
    const live = liveOf(r);
    expect(stamped(r)).toBe(true);
    expect(live?.stamps[weekdayOf('2026-11-18')]).toBe(true);
    expect(live?.today).toBe(weekdayOf('2026-11-18'));
    expect(loadLive().daily['2026-11-18']).toEqual({ cleared: true, best: 900 });
    // the same day again: nothing more
    liveHook.start(fakeSession);
    const again = liveHook.finish(save(), { stageId: st.id, cleared: true, score: 1200 });
    expect(again.coins).toBe(0);
    expect(stamped(again.decorate(base(st.id)))).toBe(false);
    expect(loadLive().daily['2026-11-18'].best).toBe(1200);
  });

  it('a failed daily earns nothing and stamps nothing', () => {
    const st = liveHook.dailyStage(save()) as StageDef;
    liveHook.start(fakeSession);
    const end = liveHook.finish(save(), { stageId: st.id, cleared: false, score: 100 });
    expect(end.coins).toBe(0);
    expect(stamped(end.decorate(base(st.id, { cleared: false })))).toBe(false);
  });

  it('a campaign run with nothing to pay leaves the result card as it was', () => {
    liveHook.start(fakeSession);
    const end = liveHook.finish(save(), { stageId: 'w1-s10', cleared: true, score: 500 });
    const r = base('w1-s10');
    expect(end.coins).toBe(0);
    expect(end.decorate(r)).toBe(r);
  });

  it("a daily started before midnight still counts for its own day", () => {
    vi.setSystemTime(new Date(2026, 10, 18, 23, 59, 0));
    const st = liveHook.dailyStage(save()) as StageDef;
    liveHook.start(fakeSession);
    vi.setSystemTime(new Date(2026, 10, 19, 0, 1, 0));
    expect(todayKey(new Date())).toBe('2026-11-19');
    const end = liveHook.finish(save(), { stageId: st.id, cleared: true, score: 900 });
    expect(end.coins).toBe(DAILY_POINTS);
    expect(loadLive().daily['2026-11-18']?.cleared).toBe(true);
  });
});

describe('result card', () => {
  it("the daily's report shows its three mission stamps, the week card with today's stamp landing and the rewards", () => {
    const st = liveHook.dailyStage(save()) as StageDef;
    liveHook.start(fakeSession);
    const r = liveHook.finish(save(), { stageId: st.id, cleared: true, score: 900 }).decorate(base(st.id));
    const el = missionResult(r) as HTMLElement;
    expect(el.querySelectorAll('.report__stamp')).toHaveLength(3);
    const live = el.querySelector('.live-result');
    expect(live?.querySelector('.live-result__head')?.textContent).toBe('출근 도장 쾅!');
    const landing = live?.querySelector('.wcard__slot.is-landing');
    expect(landing?.getAttribute('data-day')).toBe(String(weekdayOf('2026-11-18')));
    expect(landing?.querySelector('.live-stamp')).not.toBeNull();
    expect(Array.from(live?.querySelectorAll('.live-result__reward') ?? []).map((x) => x.textContent)).toEqual([`오늘의 미션 완료 +₵${DAILY_POINTS}`]);
  });

  it('no live data: the report is unchanged', () => {
    const el = missionResult(base('w1-s10')) as HTMLElement;
    expect(el.querySelector('.live-result')).toBeNull();
  });
});

describe('the daily is not the last campaign stage', () => {
  it("its result reads as a normal clear, never the 18:30 ending", async () => {
    const { buildResult } = await import('../../src/ui/result');
    const { COPY } = await import('../../src/flavor');
    const st = liveHook.dailyStage(save()) as StageDef;
    const ctxStub = { cb: new Proxy({}, { get: () => () => undefined }), tap: (fn: () => void) => fn, reducedMotion: () => true } as never;
    const el = buildResult(ctxStub, base(st.id, { hasNext: false }));
    expect(el.querySelector('.report__status')?.textContent).toBe(COPY.resultWinStatus);
    expect(el.querySelector('.report__status')?.textContent).not.toBe(COPY.resultFinalStatus);
    const last = buildResult(ctxStub, base('w10-s10', { hasNext: false }));
    expect(last.querySelector('.report__status')?.textContent).toBe(COPY.resultFinalStatus);
  });

  it('its run title is its own name, without a campaign stage tag', async () => {
    const { runTitle } = await import('../../src/game/snapshot');
    const { createSession } = await import('../../src/game/session');
    const st = liveHook.dailyStage(save()) as StageDef;
    expect(runTitle(createSession('stage', st, { seed: 1 }))).toBe('오늘의 칼퇴 미션');
    expect(runTitle(createSession('stage', stageById('w1-s10') as StageDef, { seed: 1 }))).toMatch(/1단계/);
  });
});
