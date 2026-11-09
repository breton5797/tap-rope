// Part 2 rendering logic (part 2 spec §3): the speech bubble's superior is looked up by stage (rematches
// say their part-2 lines), the urgent clock fires at the end of each part, the sprite lists hold each slot once.
import { describe, expect, it } from 'vitest';
import { clockUrgent } from '../../src/office/render/clock';
import { superiorOnStage } from '../../src/office/render/superior';
import { OFFICE_ART, OFFICE_EXTRA_ART } from '../../src/office/render/images';

describe('superiorOnStage', () => {
  it('rematches on stages 7, 9 and 10 use their part-2 lines, not their part-1 ones', () => {
    expect(superiorOnStage(6, 0)?.catchphrase).toContain('택시');
    expect(superiorOnStage(8, 0)?.catchphrase).toContain('2차');
    expect(superiorOnStage(9, 0)?.catchphrase).toContain('통화');
    expect(superiorOnStage(9, 1)?.catchphrase).toContain('집 앞');
    expect(superiorOnStage(9, 2)?.name).toBe('회장님');
  });

  it('part 1 keeps its superiors', () => {
    expect(superiorOnStage(1, 0)?.name).toBe('박과장');
    expect(superiorOnStage(1, 0)?.catchphrase).toContain('최종');
    expect(superiorOnStage(4, 1)?.name).toBe('윤이사');
    expect(superiorOnStage(4, 1)?.catchphrase).toContain('저녁');
  });

  it('is null off the stage table', () => {
    expect(superiorOnStage(10, 0)).toBeNull();
    expect(superiorOnStage(-1, 0)).toBeNull();
  });
});

describe('clockUrgent', () => {
  it('turns red near the end of stage 5 (18:00) and stage 10 (18:30) only', () => {
    expect(clockUrgent(4, 0.9)).toBe(true);
    expect(clockUrgent(9, 0.9)).toBe(true);
    for (const i of [0, 3, 5, 6, 7, 8]) expect(clockUrgent(i, 0.95)).toBe(false);
    expect(clockUrgent(4, 0.5)).toBe(false);
    expect(clockUrgent(9, 0.8)).toBe(false);
  });
});

describe('office sprite lists', () => {
  it('request each superior slot once (rematch slots are not repeated)', () => {
    expect(new Set(OFFICE_ART).size).toBe(OFFICE_ART.length);
    expect(new Set(OFFICE_EXTRA_ART).size).toBe(OFFICE_EXTRA_ART.length);
    for (const slot of ['crane', 'sniper', 'gunship']) {
      expect(OFFICE_ART).toContain(`boss-${slot}`);
      expect(OFFICE_EXTRA_ART).toContain(`boss-${slot}-throw6`);
    }
  });
});

describe('part 2 music', () => {
  it('voices themes 4 (street), 5 (subway) and 6 (food alley) with their own major loops', async () => {
    const { OFFICE_STYLES } = await import('../../src/office/audio/music');
    const part1 = [0, 1, 2, 3].map((w) => OFFICE_STYLES[w as 0]);
    for (const w of [4, 5, 6] as const) {
      expect(part1).not.toContain(OFFICE_STYLES[w]);
      expect(OFFICE_STYLES[w].pad.slice(0, 3)).toEqual([0, 4, 7]);
    }
    expect(OFFICE_STYLES[5].hits).toHaveLength(4); // subway: driving four-on-the-floor
  });
});

describe('part 2 collectibles', () => {
  it('stages 6–10 draw their own collect-mission sprites', async () => {
    const { collectibleFor } = await import('../../src/office/render/collectibles');
    const { STAGE_MISSIONS } = await import('../../src/office/core/missions');
    for (let i = 5; i < 10; i++) {
      const parts = STAGE_MISSIONS[`w${i + 1}-s10`] ?? [];
      parts.forEach((p, k) => expect(collectibleFor(i, k)).toBe(p.collectible ?? null));
    }
  });
});

describe('part 2 superiors on the photo rig', () => {
  it('crane, sniper and gunship stand like every other superior', async () => {
    const { BOSS_PHOTO_RIGS } = await import('../../src/office/render/boss-rigs');
    for (const slot of ['crane', 'sniper', 'gunship'] as const) expect(BOSS_PHOTO_RIGS[slot]).toBe(BOSS_PHOTO_RIGS.warden);
  });
});

describe('stage 7 lanejump readability', () => {
  it('every lane + laser beat signs both moves, each in its own action colour', async () => {
    const { STAGES } = await import('../../src/core/content');
    const { generateStage } = await import('../../src/core/levels');
    const { DEFAULT_PHYSICS } = await import('../../src/core/physics');
    const { actionCue } = await import('../../src/office/render/props');
    const { beatHint } = await import('../../src/office/render/readability');
    const { HAZARD_KINDS } = await import('../../src/types');
    let combos = 0;
    for (let seed = 1; seed <= 20; seed++) {
      const { beats } = generateStage({ ...STAGES[6], seed }, DEFAULT_PHYSICS, 2);
      for (const b of beats) {
        const hz = b.obstacles.filter((o) => HAZARD_KINDS.includes(o.kind));
        const cues = new Set(hz.map((o) => actionCue(o.kind)));
        if (!cues.has('lane') || cues.size < 2) continue;
        combos++;
        const hint = beatHint(hz.map((o) => ({ kind: o.kind, level: o.level, from: o.from ?? null })));
        expect(hint).toContain('옆으로!');
        expect(hint).toMatch(/점프!|숙여!|낮게!/);
      }
    }
    expect(combos).toBeGreaterThan(0);
  });
});

describe('callout hint colour chips (art review: combo moves)', () => {
  it('splits a combo hint into one segment per move, each in its action colour', async () => {
    const { hintSegments } = await import('../../src/office/render/readability');
    const { ACTION_COLORS } = await import('../../src/office/render/props');
    expect(hintSegments('옆으로! + 점프!')).toEqual([
      { text: '옆으로!', color: ACTION_COLORS.lane }, { text: '점프!', color: ACTION_COLORS.jump },
    ]);
    expect(hintSegments('뒤에서! 옆으로! + 숙여!')).toEqual([
      { text: '뒤에서! 옆으로!', color: ACTION_COLORS.lane }, { text: '숙여!', color: ACTION_COLORS.slide },
    ]);
    expect(hintSegments('점프 2단!')).toEqual([{ text: '점프 2단!', color: ACTION_COLORS.jump }]);
    expect(hintSegments('낮게!')).toEqual([{ text: '낮게!', color: ACTION_COLORS.low }]);
  });
});

describe('collectibles on the rhythm lane (polish P1a)', () => {
  it('a collect-mission coin is named by its collectible, other pickups get no lane art', async () => {
    const { laneCollectibleName } = await import('../../src/office/render/gadgets');
    const { STAGES } = await import('../../src/core/content');
    const { generateStage } = await import('../../src/core/levels');
    const { DEFAULT_PHYSICS } = await import('../../src/core/physics');
    // stage 8: part 1 is "흩날린 영수증" (collect docs)
    const { beats } = generateStage({ ...STAGES[7], seed: 3 }, DEFAULT_PHYSICS, 2);
    const coin = beats.find((b) => b.part === 1 && b.obstacles.some((o) => o.kind === 'coin'))!;
    expect(laneCollectibleName('coin', coin, 7)).toBe('collect-docs');
    const other = beats.find((b) => b.part === 0 && b.obstacles.some((o) => o.kind === 'coin'));
    if (other) expect(laneCollectibleName('coin', other, 7)).toBeNull();
    expect(laneCollectibleName('heart', coin, 7)).toBeNull();
  });

  it('the v8 lane has no pickup art hook set by default', async () => {
    const { laneArt } = await import('../../src/render/lane');
    expect(typeof laneArt).toBe('object');
  });
});

describe('lane-combo layout (polish P1c)', () => {
  const ob = (id: string, kind: string, lanes: number[] | null = null, timeUntil = 1) =>
    ({ id, kind, lanes, timeUntil, level: 1, from: null, height: 0 }) as unknown as import('../../src/types').VisibleObstacle;

  it('a full-width prop is not drawn on a lane its own beat already blocks (no two props in one column)', async () => {
    const { comboBlocked } = await import('../../src/office/render/readability');
    const obs = [ob('7', 'guard', [0, 1]), ob('7', 'floor'), ob('8', 'floor'), ob('9', 'chaser', [2])];
    const blocked = comboBlocked(obs);
    expect(blocked(obs[1], 0)).toBe(true);
    expect(blocked(obs[1], 1)).toBe(true);
    expect(blocked(obs[1], 2)).toBe(false);
    expect(blocked(obs[2], 0)).toBe(false); // another beat
    expect(blocked(obs[0], 0)).toBe(false); // the lane hazard itself always draws
  });

  it('the safe-lane chevron moves off a combo beat\'s full-width prop', async () => {
    const { safeArrowX, COMBO_ARROW_SHIFT } = await import('../../src/office/render/readability');
    expect(safeArrowX(400, false)).toBe(400);
    expect(safeArrowX(400, true)).toBe(400 + COMBO_ARROW_SHIFT);
  });
});

describe('judge popups vs the attack callout (polish P1d)', () => {
  it('fade while a callout is up, full otherwise', async () => {
    const { calloutFade } = await import('../../src/office/render/popups');
    expect(calloutFade(Number.NEGATIVE_INFINITY)).toBe(1);
    expect(calloutFade(320)).toBeLessThan(0.5);
  });
});

describe('sudden-hazard signs (polish P2)', () => {
  it('the v8 amber ⚠ is dropped where the office prop and its move-coloured footprint are drawn', async () => {
    const { keepV8Sign } = await import('../../src/office/render/warnings');
    expect(keepV8Sign(true)).toBe(false);
    expect(keepV8Sign(false)).toBe(true);
  });
});

describe('props after they pass the hero (polish P2)', () => {
  it('fade out within PASS_FADE s instead of piling up at the left edge', async () => {
    const { passFade, PASS_FADE } = await import('../../src/office/render/readability');
    expect(passFade(0.3)).toBe(1);
    expect(passFade(0)).toBe(1);
    expect(passFade(-PASS_FADE / 2)).toBeCloseTo(0.5);
    expect(passFade(-PASS_FADE)).toBe(0);
    expect(passFade(-1)).toBe(0);
    expect(PASS_FADE).toBeLessThanOrEqual(0.25);
  });
});

describe('part-2 props in the renderer (core props.ts)', () => {
  it('the prop id follows the stage (rematch rows) and the sprite resolves aliases / missing part-2 art', async () => {
    const { propIdFor, setPropFrame, propSpriteNames } = await import('../../src/office/render/props');
    const { attackVariant } = await import('../../src/office/core/events');
    setPropFrame('sewer-eye', 5, undefined, 6);
    const o = { id: '3-0', kind: 'guard' as const };
    expect(propIdFor(o)).toBe(attackVariant('sewer-eye', 'lane', 5, 3, 7));
    // round 4: survey-box has its own sprite (the old alias look is its fallback)
    expect(propSpriteNames('survey-box')).toEqual(['prop-survey-box', 'prop-papers']);
    expect(propSpriteNames('taxi')).toEqual(['prop-taxi', 'prop-cart']);
    expect(propSpriteNames('postit')).toEqual(['prop-postit']);
  });

  it('callouts use the core callout names (no generic 기습! for part-2 props)', async () => {
    const { calloutName } = await import('../../src/office/render/surprise-fx');
    expect(calloutName('survey-box')).toBe('설문 응모함!');
    expect(calloutName('postit')).toBe('포스트잇 폭풍!');
    expect(calloutName('nope')).toBe('기습!');
  });
});

describe('office miss text', () => {
  it('uses the kid-friendly office copy, picking the jump count by the beat level', async () => {
    const { missText } = await import('../../src/game/feedback');
    expect(missText('level', 2)).toBe('MISS · 두 번 점프!');
    expect(missText('level', 3)).toBe('MISS · 세 번 점프!');
    expect(missText('lane', 1)).toBe('MISS · 줄 바꾸기!');
  });
});

describe('surprise event copy by stage (core eventCopy)', () => {
  it('banners take the stage copy: office in part 1, the commute in part 2', async () => {
    const { eventText } = await import('../../src/office/render/surprise-fx');
    const { eventCopy } = await import('../../src/office/core/events');
    for (const i of [0, 4, 5, 9]) {
      expect(eventText(i, 'broadcast')).toBe(eventCopy(i).broadcast);
      expect(eventText(i, 'fireDrill')).toBe(eventCopy(i).fireDrill);
      expect(eventText(i, 'highFive')).toBe(eventCopy(i).highFive);
    }
    expect(eventText(7, 'broadcast')).not.toContain('사내방송');
  });
});

describe('judgement popups never intersect the callout box (round 2 #9)', () => {
  it('the scaled text box of every stacked popup ends up below the callout bottom', async () => {
    const { popupBoxes } = await import('../../src/office/render/popups');
    // a CHAIN popup stacked above a PERFECT, both freshly popped (scale 1.12) or fully drifted
    for (const age of [0, 0.05, 0.4]) {
      const items = [
        { y0: 300, bump: 30, age, life: 0.6, size: 16 }, // x80 CHAIN
        { y0: 300, bump: 0, age, life: 0.6, size: 26 }, // PERFECT
      ];
      for (const callout of [250, 290, 330]) {
        const boxes = popupBoxes(items, callout, Number.NEGATIVE_INFINITY);
        for (const b of boxes) expect(b.top).toBeGreaterThanOrEqual(callout);
      }
      // no callout and no HUD line: no shift (same as a callout far above every popup)
      expect(popupBoxes(items, Number.NEGATIVE_INFINITY, Number.NEGATIVE_INFINITY)).toEqual(popupBoxes(items, 0, Number.NEGATIVE_INFINITY));
    }
  });
});

describe('take-off rings are neutral (round 2 #14)', () => {
  it('every jump ring colour is a grey (no hue that reads as a lane / move footprint)', async () => {
    const { JUMP_RING_COLORS } = await import('../../src/office/render/juice');
    for (const c of JUMP_RING_COLORS) {
      const n = Number.parseInt(c.slice(1), 16);
      const ch = [n >> 16, (n >> 8) & 255, n & 255];
      expect(Math.max(...ch) - Math.min(...ch), c).toBeLessThanOrEqual(24);
    }
  });
});

describe('footprint rings on dark floors (round 2 #7)', () => {
  /** a fake 2D context recording each stroke's style and width */
  const recorder = () => {
    const strokes: { style: string; width: number }[] = [];
    const ctx = {
      globalAlpha: 1, strokeStyle: '', fillStyle: '', lineWidth: 1,
      save() {}, restore() {}, beginPath() {}, ellipse() {}, fill() {}, setLineDash() {}, moveTo() {}, lineTo() {}, closePath() {},
      stroke() { strokes.push({ style: String(this.strokeStyle), width: this.lineWidth }); },
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, strokes };
  };

  it('every footprint (jump amber, slide blue, lane red) gets a white under-stroke wider than its colour ring', async () => {
    const { drawFootprint, ACTION_COLORS } = await import('../../src/office/render/props');
    for (const [kind, cue] of [['floor', 'jump'], ['ceiling', 'slide'], ['guard', 'lane']] as const) {
      const { ctx, strokes } = recorder();
      drawFootprint(ctx, kind, 100, 200, 60);
      const white = strokes.findIndex((s) => /^(#fff(fff)?|rgba\(255, ?255, ?255)/i.test(s.style));
      const colour = strokes.findIndex((s) => s.style === ACTION_COLORS[cue]);
      expect(white, kind).toBeGreaterThanOrEqual(0);
      expect(colour, kind).toBeGreaterThan(white);
      expect(strokes[white].width).toBeGreaterThan(strokes[colour].width);
      expect(strokes[colour].width, kind).toBeGreaterThanOrEqual(2.4);
    }
  });
});

describe('lane art while a collectible sprite is loading (code review)', () => {
  it('a mission item never falls back to the ₵ icon: a neutral item glyph instead', async () => {
    const { laneCollectibleArt, setPickupFrame } = await import('../../src/office/render/gadgets');
    const { STAGES } = await import('../../src/core/content');
    const { generateStage } = await import('../../src/core/levels');
    const { DEFAULT_PHYSICS } = await import('../../src/core/physics');
    const { beats } = generateStage({ ...STAGES[7], seed: 3 }, DEFAULT_PHYSICS, 2);
    setPickupFrame(beats, 7);
    const coin = beats.find((b) => b.part === 1 && b.obstacles.some((o) => o.kind === 'coin'))!;
    // node: no Image → the sprite is "missing"; the hook still returns art (the neutral glyph), not null
    expect(laneCollectibleArt(coin.id, 'coin')).not.toBeNull();
    const plain = beats.find((b) => b.part === 0 && b.obstacles.some((o) => o.kind === 'coin'));
    if (plain) expect(laneCollectibleArt(plain.id, 'coin')).toBeNull();
  });
});

describe('popup bitmaps (perf r4)', () => {
  it('render scale buckets round up (the bitmap is only ever downscaled: crisp) and stay few per text', async () => {
    const { popupBucket } = await import('../../src/office/render/popups');
    for (const m of [2.1, 2.7, 2.999, 3.0, 3.36]) {
      const b = popupBucket(m);
      expect(b).toBeGreaterThanOrEqual(m);
      expect(b - m).toBeLessThan(0.25);
    }
    // one popup's whole pop (1.12 → 1 at 1.35× on a 2× screen): at most 3 bitmaps
    const set = new Set([1, 1.03, 1.06, 1.09, 1.12].map((sc) => popupBucket(2 * 1.35 * sc)));
    expect(set.size).toBeLessThanOrEqual(3);
  });
});

describe('prop outline warm-up queue (perf r4: no first-appearance bake spikes)', () => {
  it('lists every sprite + move-colour pair the stage superiors can throw, each once', async () => {
    const { warmList } = await import('../../src/office/render/props');
    const list = warmList(9); // stage 10: 최팀장, 한전무, 회장님
    const keys = list.map((w) => `${w.name}|${w.cue}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(list.length).toBeGreaterThan(5);
    expect(list.every((w) => w.name.startsWith('prop-'))).toBe(true);
    expect(new Set(list.map((w) => w.cue))).toEqual(new Set(['lane', 'jump', 'slide', 'low']));
  });
});

describe('perf r4 warm-up details', () => {
  it('popup bitmaps only for fixed words (a combo count changes every beat: painted, never baked per number)', async () => {
    const { bitmapWorthy } = await import('../../src/office/render/popups');
    expect(bitmapWorthy('PERFECT')).toBe(true);
    expect(bitmapWorthy('MISS · 줄 바꾸기!')).toBe(true);
    expect(bitmapWorthy('x23 CHAIN')).toBe(false);
    expect(bitmapWorthy('+₵1350')).toBe(false);
  });

  it('hero set scales are warmed one set per call, then nothing is left', async () => {
    const { warmHeroSets } = await import('../../src/office/render/hero-scale');
    const seen: string[] = [];
    const left = [warmHeroSets('kid', (s) => seen.push(s)), warmHeroSets('kid', (s) => seen.push(s)), warmHeroSets('kid', (s) => seen.push(s)), warmHeroSets('kid', (s) => seen.push(s))];
    expect(seen).toEqual(['jump', 'slide', 'hit']);
    expect(left).toEqual([true, true, true, false]);
  });
});

describe('popup bitmap warm-up', () => {
  it('names the fixed judgement words and the scale buckets of their whole pop', async () => {
    const { warmPopupPlan } = await import('../../src/office/render/popups');
    const plan = warmPopupPlan(2);
    expect(plan.texts).toEqual(expect.arrayContaining(['PERFECT', 'GREAT', 'GOOD']));
    expect(plan.buckets.length).toBeGreaterThan(0);
    expect(plan.buckets.length).toBeLessThanOrEqual(3);
  });
});

describe('callout text warm-up', () => {
  it('stagePropIds lists the ids the stage superiors throw (callout names to measure ahead)', async () => {
    const { stagePropIds } = await import('../../src/office/render/props');
    const { propCallout } = await import('../../src/office/render/props');
    const ids = stagePropIds(5); // stage 6: 강차장
    expect(ids.length).toBeGreaterThan(3);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => propCallout(id) !== '기습!')).toBe(true);
  });
});

describe('tutorial stop vs the superior (P3)', () => {
  it('the office stop hand sits low in its half, below the superior figure', async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/office/styles/office.css', 'utf8');
    expect(css).toMatch(/\.tstop__pad\s*\{[^}]*place-content:\s*end center/);
  });
});

describe('judgement box includes its white rim (part-1 audit b)', () => {
  it('the drawn top of a popup (text + half the 7 px rim, scaled) clears the callout', async () => {
    const { popupBoxes, POPUP_RIM } = await import('../../src/office/render/popups');
    expect(POPUP_RIM).toBeGreaterThanOrEqual(3.5);
    const items = [{ y0: 300, bump: 30, age: 0, life: 0.6, size: 16 }, { y0: 300, bump: 0, age: 0, life: 0.6, size: 26 }];
    for (const callout of [250, 300]) {
      const boxes = popupBoxes(items, callout, Number.NEGATIVE_INFINITY);
      // top includes the rim: the glyph box is at least rim px below the reported top
      for (const b of boxes) expect(b.top).toBeGreaterThanOrEqual(callout);
      const glyphTop = (b: { centre: number }, size: number) => b.centre - (size / 2 + POPUP_RIM) * 1.12 * 1.35;
      expect(glyphTop(boxes[0], 16)).toBeGreaterThanOrEqual(callout - 1e-9);
    }
  });
});

describe('callout icon (perf r4)', () => {
  it('pre-scaled icon size: 26 logical px tall at the device scale, aspect kept, at least 1 px', async () => {
    const { iconPixels } = await import('../../src/office/render/surprise-fx');
    expect(iconPixels(512, 640, 2)).toEqual({ w: 42, h: 52 });
    expect(iconPixels(640, 512, 3)).toEqual({ w: 98, h: 78 });
    expect(iconPixels(1, 1, 0.01)).toEqual({ w: 1, h: 1 });
  });
});
