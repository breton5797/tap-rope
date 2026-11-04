// Office copy, music and sound (office spec §4, §7): comic Korean on every copy key, no spy words, a
// cheerful major-key loop on the same beat grid, and comic re-voicings of a few sound effects.
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { V8_COPY } from '../../src/flavor';
import { COPY } from '../../src/office/flavor';
import { createMusic, OFFICE_STYLES } from '../../src/office/audio/music';
import { playSfx } from '../../src/office/audio/sfx';
import { playSfx as v8Sfx } from '../../src/audio/sfx';
import type { SfxName } from '../../src/types';
import { fakeCtx } from '../audio/fake-ctx';

const SPY_WORDS = ['작전', '요원', 'MISSION', 'OPERATION', '임무', '포로'];

describe('office copy', () => {
  it('has a non-empty value for every copy key', () => {
    for (const k of Object.keys(V8_COPY) as (keyof typeof V8_COPY)[]) expect(COPY[k]?.trim(), k).toBeTruthy();
  });

  it('uses no spy vocabulary (the game title 칼퇴근 대작전 aside)', () => {
    for (const [k, v] of Object.entries(COPY)) {
      const text = v.split('칼퇴근 대작전').join('').split('대작전').join(''); // the title, also split over two lines
      for (const w of SPY_WORDS) expect(text, `${k}: ${v}`).not.toContain(w);
    }
  });

  it('says the comic lines of the spec', () => {
    expect(COPY.titleStart).toBe('퇴근 시작!');
    expect(COPY.resultWinStatus).toBe('퇴근 성공!');
    expect(COPY.resultFailStatus).toBe('야근 확정');
    expect(COPY.resultRetry).toBe('내일은 꼭…!');
    expect(COPY.titleShop).toBe('사원 선택');
    // stage 5 (w5-s10) clear is the 18:00 칼퇴 with the part-2 hook; stage 10 (w10-s10) the 18:30 home ending
    expect(COPY.resultStoryRescue).toContain('칼퇴 성공! 18:00:00');
    expect(COPY.resultStoryRescue).toContain('단톡방');
    expect(COPY.resultStoryEnd).toContain('18:30');
    expect(COPY.resultStoryEnd).toContain('귀가');
    expect([COPY.pickupShield, COPY.pickupSlow, COPY.pickupHeart].join(' ')).toMatch(/노캔 이어폰.*아이스 아메리카노.*삼각김밥/);
    expect(COPY.tutJumpKicker + COPY.tutSlideKicker + COPY.tutLaneKicker).toContain('김대리');
  });

  it('polish copy: part labels, phase label, part-2 map, kid-friendly miss reasons', () => {
    expect(COPY.briefPart1).toBe('1부 · 사무실');
    expect(COPY.briefPart2).toBe('2부 · 퇴근길');
    expect(COPY.bossPhase).toBe('{n}차 공격');
    expect(COPY.resultMapPart2).toBe('퇴근길 지도');
    // the achievements screen has its own kicker (the archive's 퇴근 앨범 is for cutscenes)
    expect(COPY.achKicker).toBe('사원 평가');
    // the last stage's result headline is the 18:30 homecoming, not the generic 퇴근 성공
    expect(COPY.resultFinalStatus).toBe('18:30 귀가 완료!');
    expect(COPY.resultFinalTitle).toBe('오늘도 무사 퇴근!');
    expect(COPY.missLane).toBe('MISS · 줄 바꾸기!');
    expect(COPY.missLevel2).toBe('MISS · 두 번 점프!');
    expect(COPY.missLevel3).toBe('MISS · 세 번 점프!');
    for (const k of ['missDrone', 'missLow', 'missSlide', 'missStanding'] as const) expect(COPY[k], k).toMatch(/^MISS · [가-힣 ]+!$/);
    // no v8 leftovers in the office wording of the screens' fixed labels
    const fixed = ['hudBossAria', 'resultFunds', 'archiveRec', 'archiveShots', 'archiveLocked', 'archiveUnseen', 'archiveKicker', 'achToastKicker', 'hitShielded'] as const;
    for (const k of fixed) expect(COPY[k], k).toMatch(/[가-힣]/);
    expect(Object.values(COPY).join(' ')).not.toMatch(/방탄|보스 내구도|SERVICE RECORD|획득 자금|SHOTS|LOCKED/);
  });

  it('v8 keeps the exact strings its screens inlined before they became copy keys', () => {
    expect([V8_COPY.missDrone, V8_COPY.missLevel2, V8_COPY.missLevel3, V8_COPY.missLow, V8_COPY.missSlide, V8_COPY.missStanding, V8_COPY.missLane])
      .toEqual(['DETECTED · 고도 낮춰', 'MISS · 고도 부족', 'MISS · 고도 부족', 'MISS · 점프', 'MISS · 점프 구간', 'MISS · 슬라이딩', 'MISS · 레인 이탈']);
    expect(V8_COPY.hitShielded).toBe('BLOCKED · 실드');
    expect(V8_COPY.achKicker).toBe('SERVICE RECORD');
    expect([V8_COPY.resultFinalStatus, V8_COPY.resultFinalTitle]).toEqual([V8_COPY.resultWinStatus, V8_COPY.resultWinTitle]);
    expect(V8_COPY.hudBossAria).toBe('보스 내구도');
    expect(V8_COPY.resultFunds).toBe('획득 자금');
    expect(V8_COPY.resultMapPart2).toBe(V8_COPY.resultMap);
    expect([V8_COPY.archiveRec, V8_COPY.archiveShots, V8_COPY.archiveLocked, V8_COPY.archiveUnseen, V8_COPY.archiveKicker, V8_COPY.achToastKicker])
      .toEqual(['REC {n}', '{n} SHOTS', 'LOCKED', '미확인 기록', 'SERVICE RECORD', 'ACHIEVEMENT UNLOCKED']);
  });

  it('the store / home-screen description tells both parts (18:00 칼퇴, then home by 18:30)', () => {
    const html = readFileSync(new URL('../../office.html', import.meta.url), 'utf8');
    const meta = /<meta name="description" content="([^"]+)"/.exec(html)?.[1] ?? '';
    const manifest = JSON.parse(readFileSync(new URL('../../public-office/manifest.webmanifest', import.meta.url), 'utf8')) as { description: string };
    for (const d of [meta, manifest.description]) {
      expect(d).toContain('18:00');
      expect(d).toContain('18:30');
      expect(d).toContain('현관문');
      expect(d).not.toMatch(/슬라이딩/);
    }
  });

  it('keeps a stage-number placeholder where v8 has one', () => {
    expect(COPY.resultStoryNext).toMatch(/\{(zone|n)\}/);
  });
});

describe('office music', () => {
  it('every theme is in a major key', () => {
    for (const s of Object.values(OFFICE_STYLES)) expect(s.pad.slice(0, 3)).toEqual([0, 4, 7]);
  });

  it('schedules a loop on the shared engine without throwing', () => {
    const ctx = fakeCtx();
    const m = createMusic(ctx, ctx.createGain());
    for (const world of [0, 1, 2, 3] as const) {
      expect(() => m.start(110, world, 3.2)).not.toThrow();
      m.setFever(true);
      m.setBoss(true);
    }
    m.stop();
    expect(ctx.created.Oscillator ?? 0).toBeGreaterThan(0);
  });
});

describe('office sound effects', () => {
  const ALL: readonly SfxName[] = [
    'jump', 'boost', 'land', 'perfect', 'good', 'hit', 'coin', 'powerup', 'combo', 'fever', 'clear', 'fail', 'click', 'count',
    'slide', 'warn', 'zap', 'rescue', 'lane', 'alert', 'door', 'boss-intro', 'boss-charge', 'boss-stagger', 'boss-down', 'achieve',
    'shield', 'graze', 'bump',
  ];
  const nodes = (play: typeof playSfx, name: SfxName): number => {
    const ctx = fakeCtx();
    play(ctx, ctx.createGain(), name, 1);
    return ctx.created.Oscillator ?? 0;
  };

  it.each(ALL)('%s plays without throwing', (name) => {
    for (const level of [0, 1, 3, Number.NaN]) expect(() => playSfx(fakeCtx(), fakeCtx().createGain(), name, level)).not.toThrow();
  });

  it('re-voices the comic ones (boing hit, stamp fail, elevator ding door) and keeps the rest', () => {
    for (const n of ['hit', 'fail', 'door'] as const) {
      const a = fakeCtx();
      const b = fakeCtx();
      playSfx(a, a.createGain(), n, 1);
      v8Sfx(b, b.createGain(), n, 1);
      expect(JSON.stringify(a.created), n).not.toBe(JSON.stringify(b.created));
    }
    expect(nodes(playSfx, 'perfect')).toBe(nodes(v8Sfx, 'perfect'));
  });
});
