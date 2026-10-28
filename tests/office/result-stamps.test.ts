// @vitest-environment jsdom
// Office v2 mission DOM (office graph): result card stamps + grade, map stamp dots, and the HUD chip / card /
// stamp each firing once.
import { beforeEach, describe, expect, it } from 'vitest';
import { stageById } from '../../src/core/content';
import { buildStageSelect } from '../../src/ui/stages';
import { buildResult } from '../../src/ui/result';
import { missionResult, renderMission, stampDots } from '../../src/ui/mission';
import { defaultSave } from '../../src/core/storage';
import type { MissionView, ResultInfo, StageDef, UiCallbacks } from '../../src/types';
import type { Ctx } from '../../src/ui/dom';

Element.prototype.scrollIntoView ??= function scrollIntoView(): void {};
const ctx = (): Ctx => ({ cb: new Proxy({}, { get: () => () => undefined }) as UiCallbacks, tap: (fn) => fn, reducedMotion: () => true });
const stage1 = stageById('w1-s10') as StageDef;
const result = (over: Partial<ResultInfo> = {}): ResultInfo => ({
  mode: 'stage', stageId: 'w1-s10', title: '1단계', cleared: true, stars: 2, score: 900, best: 900, newRecord: false,
  perfects: 5, goods: 0, misses: 0, maxCombo: 10, coinsEarned: 300, hasNext: true,
  missions: { stamps: [true, false, true], grade: 'B', stars: 2, bonus: 300, stampBonus: 300, items: 0 }, ...over,
});
const view = (over: Partial<MissionView> = {}): MissionView => ({
  index: 0, kind: 'dodge', title: '포스트잇 폭풍', value: 2, target: 8, complete: false, stamps: [null, null, null], ...over,
});

beforeEach(() => {
  localStorage.clear();
  document.body.replaceChildren();
});

describe('result card', () => {
  it('shows the three mission stamps and the grade', () => {
    const el = buildResult(ctx(), result());
    const stamps = Array.from(el.querySelectorAll('.report__stamp'));
    expect(stamps.map((s) => s.classList.contains('is-ok'))).toEqual([true, false, true]);
    expect(stamps.map((s) => s.querySelector('.report__stamp-name')?.textContent)).toEqual(['포스트잇 폭풍', '커피 쿠폰', '잠깐만~ 뛰어넘기']);
    expect(el.querySelector('.report__grade b')?.textContent).toBe('B');
  });

  it('a failed run shows the door stamps it still earned, and 금일봉', () => {
    const el = buildResult(ctx(), result({ cleared: false, stars: 0, missions: { stamps: [true, null, null], grade: 'B', stars: 1, bonus: 210, stampBonus: 150, items: 3 } }));
    expect(el.querySelector('.report__mission-bonus')?.textContent).toContain('딴 도장 보너스 +₵150');
    expect(el.querySelector('.report__mission-bonus')?.textContent).toContain('금일봉 ×3');
    const won = buildResult(ctx(), result());
    expect(won.querySelector('.report__mission-bonus')?.textContent).toContain('도장 보너스 +₵300');
  });

  it('no row without mission data', () => {
    expect(missionResult(result({ missions: undefined }))).toBeNull();
  });
});

describe('map', () => {
  it('each office floor shows its best stamps', () => {
    localStorage.setItem('officeescape.stamps.v1', JSON.stringify({ 'w1-s10': [true, true, false] }));
    const map = buildStageSelect(ctx(), defaultSave(), () => undefined);
    const first = map.querySelectorAll('.floors__node')[0];
    expect(Array.from(first.querySelectorAll('.stamp-dot')).map((d) => d.classList.contains('is-ok'))).toEqual([true, true, false]);
    expect(stampDots('w2-s10')?.querySelectorAll('.stamp-dot.is-ok')).toHaveLength(0);
  });
});

describe('HUD', () => {
  it('chip counts; card and stamp come and go on the run clock (frozen while paused)', () => {
    const layer = document.createElement('div');
    document.body.appendChild(layer);
    const v0 = view();
    renderMission(layer, v0, stage1, true, 10);
    expect(layer.querySelector('.mission-chip')?.textContent).toContain('2/8');
    expect(layer.querySelectorAll('.mission-card')).toHaveLength(1);
    expect(layer.querySelector('.mission-card__title')?.textContent).toBe('포스트잇 폭풍');
    renderMission(layer, v0, stage1, true, 11); // same section, 1 s in: still the one card
    expect(layer.querySelectorAll('.mission-card')).toHaveLength(1);
    renderMission(layer, v0, stage1, true, 11.7); // 1.6 s of run time later: gone
    expect(layer.querySelectorAll('.mission-card')).toHaveLength(0);
    // a door at run time 20: the stamp lands now, the next card only after it
    const v1 = view({ index: 1, kind: 'collect', title: '커피 쿠폰', value: 0, target: 5, stampAt: 20, stampOk: true, stamps: [true, null, null] });
    renderMission(layer, v1, stage1, true, 20);
    expect(layer.querySelector('.mission-stamp.is-ok')?.textContent).toContain('미션 완료!');
    expect(layer.querySelector('.mission-card')).toBeNull();
    expect(layer.querySelector('.mission-chip__label')?.textContent).toBe('커피 쿠폰');
    renderMission(layer, v1, stage1, true, 21.6);
    expect(layer.querySelector('.mission-stamp')).toBeNull();
    expect(layer.querySelectorAll('.mission-card')).toHaveLength(1);
    renderMission(layer, v1, stage1, true, 21.6); // paused: no time passes, nothing changes
    expect(layer.querySelectorAll('.mission-card')).toHaveLength(1);
    renderMission(layer, undefined, null, true, 0);
    expect(layer.querySelector('.mission')).toBeNull();
  });

  it('the chase chip shows the distance gauge', () => {
    const layer = document.createElement('div');
    const s3 = stageById('w3-s10') as StageDef;
    renderMission(layer, view({ kind: 'chase', title: '5분만! 회의실 추격', complete: true, chase: 0.7 }), s3, true, 0);
    const meter = layer.querySelector<HTMLElement>('.mission-chip__meter');
    expect(meter?.hidden).toBe(false);
    expect(layer.querySelector<HTMLElement>('.mission-chip__fill')?.style.transform).toBe('scaleX(0.700)');
    renderMission(layer, undefined, null, true, 0);
  });
});
