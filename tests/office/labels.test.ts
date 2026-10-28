// Stage and boss-phase labels (office: "3단계", "1차 공격 · 1/3"; v8 output unchanged: "3-10", "PHASE 1/3").
import { describe, expect, it } from 'vitest';
import { COPY as V8, fillCopy } from '../../src/flavor';
import { COPY as OFFICE } from '../../src/office/flavor';
import { STAGES } from '../../src/core/content';
import { createSession } from '../../src/game/session';
import { toHud } from '../../src/game/snapshot';

const stage = { chapter: 2, index: 9 };
const vars = (s: { chapter: number; index: number }) => ({
  chapter: s.chapter + 1, index: s.index + 1, index2: String(s.index + 1).padStart(2, '0'), zone: String(s.chapter + 1).padStart(2, '0'), n: s.chapter + 1,
});

describe('fillCopy', () => {
  it('fills every {key} occurrence and leaves unknown keys alone', () => {
    expect(fillCopy('{n}차 · {n}/3 {x}', { n: 2 })).toBe('2차 · 2/3 {x}');
  });
});

describe('v8 labels are unchanged', () => {
  it('stage tag, node number, zone tag and boss phase', () => {
    expect(fillCopy(V8.stageTag, vars(stage))).toBe('3-10');
    expect(fillCopy(V8.stageNum, vars(stage))).toBe('10');
    expect(fillCopy(V8.zoneTag, vars(stage))).toBe('ZONE 03');
    expect(fillCopy(V8.bossPhase, { n: 1 })).toBe('PHASE 1/3');
    expect(fillCopy(V8.bossPhaseAria, { n: 2 })).toBe('페이즈 2/3');
  });

  it('the HUD title still reads "1-1 · name"', () => {
    expect(toHud(createSession('stage', STAGES[0])).title).toBe(`1-1 · ${STAGES[0].name}`);
  });
});

describe('office labels', () => {
  it('stages are "N단계", the boss bar "N차 공격 · N/3"', () => {
    expect(fillCopy(OFFICE.stageTag, vars(stage))).toBe('3단계');
    expect(fillCopy(OFFICE.stageNum, vars(stage))).toBe('3');
    expect(fillCopy(OFFICE.zoneTag, vars(stage))).toBe('3단계');
    expect(fillCopy(OFFICE.bossPhase, { n: 1 })).toBe('1차 공격 · 1/3');
    expect(fillCopy(OFFICE.bossPhaseAria, { n: 2 })).toBe('2차 공격');
    expect(fillCopy(OFFICE.resultStoryNext, vars({ chapter: 1, index: 9 }))).toBe('한 층 내려왔다! 2단계 개방');
  });

  it('no office label shows a v8 "1-10" style stage id', () => {
    for (const k of ['stageTag', 'stageNum', 'zoneTag'] as const) expect(fillCopy(OFFICE[k], vars(stage))).not.toMatch(/\d+-\d+|^\d{2}$/);
  });
});
