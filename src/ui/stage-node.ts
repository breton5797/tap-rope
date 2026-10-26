// One chapter's winding trail of stage nodes (normal / bonus / boss).
import { STAGES } from '../core/content';
import { isStageUnlocked } from '../core/storage';
import { stageDifficulty } from '../core/difficulty';
import { generateBeats } from '../core/levels';
import { physicsForWorld } from '../core/physics';
import type { MoveId, SaveData, StageDef } from '../types';
import { formatNumber, h, svg, type Ctx } from './dom';
import { icons } from './icons';
import { MOVES, moveGlyph } from './moves';

/** Horizontal node positions (percent of trail width); the boss sits centred. */
const TRAIL_X = [24, 68, 32, 72, 30, 68, 26, 70, 24, 56] as const;
const ROW_H = 132;
const DISC_CENTER = 39;
const MAX_MOVE_ICONS = 3;
/** extra room above the boss for its crown and bigger disc */
const BOSS_GAP = 84;

/** y of a node's top edge inside the trail. */
function nodeTop(stage: StageDef): number {
  return stage.index * ROW_H + (stage.kind === 'boss' ? BOSS_GAP : 0);
}

export function trailHeight(stages: readonly StageDef[]): number {
  return stages.reduce((m, s) => Math.max(m, nodeTop(s) + ROW_H), 0);
}

/** stageId -> moves that stage is the first (in STAGES order) to list. */
export function firstIntroductions(): ReadonlyMap<string, ReadonlySet<MoveId>> {
  const seen = new Set<MoveId>();
  return new Map(
    STAGES.map((s) => {
      const fresh = new Set((s.moves ?? []).filter((m) => !seen.has(m)));
      fresh.forEach((m) => seen.add(m));
      return [s.id, fresh] as const;
    }),
  );
}

/** Only stages that introduce a move get glyphs (each tagged NEW). */
function moveBadges(stage: StageDef, fresh: ReadonlySet<MoveId>): HTMLElement | null {
  const moves = (stage.moves ?? []).filter((m) => fresh.has(m));
  if (moves.length === 0) return null;
  const shown = moves.slice(0, MAX_MOVE_ICONS);
  const extra = moves.length - shown.length;
  return h('div', { cls: 'node__moves' }, [
    ...shown.map((m) =>
      h('span', { cls: `mv tone--${MOVES[m].tone}${fresh.has(m) ? ' is-new' : ''}`, attrs: { title: MOVES[m].name, 'aria-label': MOVES[m].name } }, [
        moveGlyph(m),
        fresh.has(m) ? h('i', { cls: 'mv__new', text: 'NEW' }) : null,
      ]),
    ),
    extra > 0 ? h('span', { cls: 'mv mv--more', text: `+${extra}` }) : null,
  ]);
}

/** Cheap 1..5 difficulty estimate from the stage definition (no beat generation). */
const difficultyCache = new Map<string, number>();
/** campaign difficulty scores span ≈ 0.27 (easy) … 0.77 (hardest boss); 0.1 per dot */
const DIFF_FLOOR = 0.3;
const DIFF_STEP = 0.1;

/** 1–5 dots from the same difficulty score the balance tests use (cached; bonus always 1). */
export function difficulty(stage: StageDef): number {
  if (stage.kind === 'bonus') return 1;
  let score = difficultyCache.get(stage.id);
  if (score === undefined) {
    score = stageDifficulty(stage, generateBeats(stage, physicsForWorld(stage.world)));
    difficultyCache.set(stage.id, score);
  }
  return Math.max(1, Math.min(5, 1 + Math.floor((score - DIFF_FLOOR) / DIFF_STEP)));
}

function difficultyMeter(stage: StageDef): HTMLElement {
  const level = difficulty(stage);
  return h(
    'div',
    { cls: `node__diff diff--${level}`, attrs: { 'aria-label': `위협도 ${level}/5` } },
    [1, 2, 3, 4, 5].map((i) => h('i', { cls: i <= level ? 'is-on' : '' })),
  );
}

/** Rank: three tick marks (v6 replaces stars). */
function starRow(n: number): HTMLElement {
  return h('div', { cls: 'node__stars', attrs: { 'aria-label': `평가 ${n}/3` } }, [0, 1, 2].map((i) => h('i', { cls: i < n ? 'tick is-on' : 'tick' })));
}

export function trailPath(stages: readonly StageDef[]): SVGElement {
  const pts = stages.map((s) => [TRAIL_X[s.index] ?? 50, nodeTop(s) + DISC_CENTER] as const);
  const d = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M${x} ${y}`;
    const [px, py] = pts[i - 1];
    const my = (py + y) / 2;
    return `${acc} C${px} ${my} ${x} ${my} ${x} ${y}`;
  }, '');
  return svg('svg', { class: 'trail__path', viewBox: `0 0 100 ${trailHeight(stages)}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' }, [
    svg('path', { d, class: 'trail__shadow', 'vector-effect': 'non-scaling-stroke' }),
    svg('path', { d, class: 'trail__line', 'vector-effect': 'non-scaling-stroke' }),
  ]);
}

function discFace(stage: StageDef, unlocked: boolean): Node {
  if (!unlocked) return icons.lock();
  if (stage.kind === 'bonus') return icons.gift();
  return h('span', { cls: 'node__num mono', text: String(stage.index + 1).padStart(2, '0') });
}

/** Core names bonus/boss stages "보너스 …"/"보스 …"; the kind pill already says so. */
function displayName(stage: StageDef): string {
  return stage.name.replace(/^(보너스|보스)\s+/, '');
}

const KIND_LABEL: Readonly<Record<string, string>> = { bonus: 'SUPPLY', boss: 'TARGET' };

function stageDisc(ctx: Ctx, stage: StageDef, unlocked: boolean, isNext: boolean): HTMLButtonElement {
  const kind = stage.kind ?? 'normal';
  const disc = h(
    'button',
    {
      cls: `node__disc node__disc--${kind}${unlocked ? '' : ' is-locked'}${isNext ? ' is-next' : ''}`,
      attrs: { type: 'button', 'aria-label': `작전 ${stage.chapter + 1}-${stage.index + 1} ${stage.name}${unlocked ? '' : ' 잠김'}` },
    },
    [
      kind === 'boss' ? h('span', { cls: 'node__crown' }, [icons.crown()]) : null,
      discFace(stage, unlocked),
    ],
  );
  disc.addEventListener('click', ctx.tap(() => (unlocked ? ctx.cb.onStartStage(stage.id) : undefined)));
  return disc;
}

export function stageNode(ctx: Ctx, save: SaveData, stage: StageDef, isNext: boolean, fresh: ReadonlySet<MoveId>): HTMLElement {
  const unlocked = isStageUnlocked(save, STAGES.indexOf(stage));
  const best = save.bestScores[stage.id] ?? 0;
  const kind = stage.kind ?? 'normal';
  const kindLabel = KIND_LABEL[kind];
  return h(
    'div',
    { cls: `node node--${kind}`, style: { left: `${TRAIL_X[stage.index] ?? 50}%`, top: `${nodeTop(stage)}px` } },
    [
      isNext ? h('span', { cls: 'node__flag mono', text: 'NEXT' }) : null,
      stageDisc(ctx, stage, unlocked, isNext),
      h('div', { cls: 'node__meta' }, [starRow(unlocked ? save.stars[stage.id] ?? 0 : 0), unlocked ? difficultyMeter(stage) : null]),
      h('div', { cls: 'node__name' }, [kindLabel ? h('span', { cls: `node__kind node__kind--${kind}`, text: kindLabel }) : null, displayName(stage)]),
      moveBadges(stage, fresh),
      best > 0 ? h('div', { cls: 'node__best', text: `최고 ${formatNumber(best)}` }) : null,
    ],
  );
}
