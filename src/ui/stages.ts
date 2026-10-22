// Stage select: world tabs + a winding path of five stage nodes per world.
import { STAGES, WORLDS } from '../core/content';
import { isStageUnlocked } from '../core/storage';
import type { MoveId, SaveData, StageDef, WorldId } from '../types';
import { formatNumber, h, header, svg, type Ctx } from './dom';
import { icons } from './icons';
import { MOVES, moveGlyph, ROPE_MODE_LABEL } from './moves';
import { coinChip } from './title';

/** Horizontal node positions (percent of path width) for the zig-zag trail. */
const TRAIL_X = [26, 70, 36, 72, 34] as const;
const ROW_H = 124;
const MAX_MOVE_ICONS = 4;

let selectedWorld: WorldId | null = null;

/** stageId -> moves that stage is the first (in STAGES order) to list. */
function firstIntroductions(): ReadonlyMap<string, ReadonlySet<MoveId>> {
  const seen = new Set<MoveId>();
  return new Map(
    STAGES.map((s) => {
      const fresh = new Set((s.moves ?? []).filter((m) => !seen.has(m)));
      fresh.forEach((m) => seen.add(m));
      return [s.id, fresh] as const;
    }),
  );
}

function moveBadges(stage: StageDef, fresh: ReadonlySet<MoveId>): HTMLElement | null {
  const moves = [...(stage.moves ?? [])].sort((a, b) => Number(fresh.has(b)) - Number(fresh.has(a)));
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

function starRow(n: number, cls: string): HTMLElement {
  return h('div', { cls }, [0, 1, 2].map((i) => h('span', { cls: i < n ? 'star is-on' : 'star' }, [icons.star()])));
}

function worldStages(world: WorldId): StageDef[] {
  return STAGES.filter((s) => s.world === world);
}

/** The world containing the furthest unlocked stage. */
function currentWorld(save: SaveData): WorldId {
  let w: WorldId = 0;
  STAGES.forEach((s, i) => {
    if (isStageUnlocked(save, i)) w = s.world;
  });
  return w;
}

function totalStars(save: SaveData): number {
  return STAGES.reduce((sum, s) => sum + (save.stars[s.id] ?? 0), 0);
}

function trailPath(count: number): SVGElement {
  const pts = TRAIL_X.slice(0, count).map((x, i) => [x, i * ROW_H + 39] as const);
  const d = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M${x} ${y}`;
    const [px, py] = pts[i - 1];
    const my = (py + y) / 2;
    return `${acc} C${px} ${my} ${x} ${my} ${x} ${y}`;
  }, '');
  const height = count * ROW_H;
  return svg('svg', { class: 'trail__path', viewBox: `0 0 100 ${height}`, preserveAspectRatio: 'none', 'aria-hidden': 'true' }, [
    svg('path', { d, class: 'trail__shadow', 'vector-effect': 'non-scaling-stroke' }),
    svg('path', { d, class: 'trail__line', 'vector-effect': 'non-scaling-stroke' }),
  ]);
}

function stageNode(ctx: Ctx, save: SaveData, stage: StageDef, isNext: boolean, fresh: ReadonlySet<MoveId>): HTMLElement {
  const globalIndex = STAGES.indexOf(stage);
  const unlocked = isStageUnlocked(save, globalIndex);
  const stars = save.stars[stage.id] ?? 0;
  const best = save.bestScores[stage.id] ?? 0;
  const label = `${stage.index + 1}`;
  const mode = stage.ropeMode ?? 'long';
  const disc = h(
    'button',
    {
      cls: `node__disc${unlocked ? '' : ' is-locked'}${isNext ? ' is-next' : ''}`,
      attrs: { type: 'button', 'aria-label': `스테이지 ${label} ${stage.name}${unlocked ? '' : ' 잠김'}` },
    },
    [
      unlocked ? h('span', { cls: 'node__num', text: label }) : icons.lock(),
      h('span', { cls: `node__mode node__mode--${mode}`, text: ROPE_MODE_LABEL[mode] }),
    ],
  );
  disc.addEventListener(
    'click',
    ctx.tap(() => {
      if (unlocked) ctx.cb.onStartStage(stage.id);
    }),
  );
  return h(
    'div',
    { cls: 'node', style: { left: `${TRAIL_X[stage.index] ?? 50}%`, top: `${stage.index * ROW_H}px` } },
    [
      isNext ? h('span', { cls: 'node__flag', text: '도전!' }) : null,
      disc,
      starRow(unlocked ? stars : 0, 'node__stars'),
      h('div', { cls: 'node__name', text: stage.name }),
      moveBadges(stage, fresh),
      best > 0 ? h('div', { cls: 'node__best', text: `최고 ${formatNumber(best)}` }) : null,
    ],
  );
}

function worldTabs(ctx: Ctx, active: WorldId, onPick: (w: WorldId) => void): HTMLElement {
  return h(
    'nav',
    { cls: 'tabs', attrs: { role: 'tablist' } },
    WORLDS.map((w) => {
      const tab = h(
        'button',
        { cls: `tab tab--w${w.id}${w.id === active ? ' is-active' : ''}`, attrs: { type: 'button', role: 'tab', 'aria-selected': String(w.id === active) } },
        [h('span', { cls: 'tab__num', text: String(w.id + 1) }), h('span', { cls: 'tab__name', text: w.name })],
      );
      tab.addEventListener('click', ctx.tap(() => onPick(w.id)));
      return tab;
    }),
  );
}

function worldBody(ctx: Ctx, save: SaveData, world: WorldId): HTMLElement {
  const meta = WORLDS.find((w) => w.id === world);
  const stages = worldStages(world);
  const nextStage = stages.find((s) => isStageUnlocked(save, STAGES.indexOf(s)) && (save.stars[s.id] ?? 0) === 0);
  const intro = firstIntroductions();
  const earned = stages.reduce((sum, s) => sum + (save.stars[s.id] ?? 0), 0);
  return h('div', { cls: `world world--w${world}` }, [
    h('div', { cls: 'world__hero' }, [
      h('div', { cls: 'world__deco' }),
      h('div', { cls: 'world__kicker', text: `WORLD ${world + 1}` }),
      h('h2', { cls: 'world__name', text: meta?.name ?? '' }),
      h('p', { cls: 'world__sub', text: meta?.subtitle ?? '' }),
      h('div', { cls: 'world__stars' }, [icons.star(), h('span', { text: `${earned} / ${stages.length * 3}` })]),
    ]),
    h('div', { cls: 'trail', style: { height: `${stages.length * ROW_H}px` } }, [
      trailPath(stages.length),
      ...stages.map((s) => stageNode(ctx, save, s, s === nextStage, intro.get(s.id) ?? new Set())),
    ]),
  ]);
}

export function buildStageSelect(ctx: Ctx, save: SaveData, onBack: () => void): HTMLElement {
  const active = selectedWorld ?? currentWorld(save);
  const body = h('div', { cls: 'scroll' }, [worldBody(ctx, save, active)]);
  const screen = h('section', { cls: 'screen screen--stages', attrs: { 'aria-label': '스테이지 선택' } });
  const pick = (w: WorldId): void => {
    selectedWorld = w;
    screen.replaceWith(buildStageSelect(ctx, save, onBack));
  };
  const stars = h('div', { cls: 'chip chip--star chip--sm' }, [icons.star(), h('span', { cls: 'chip__value', text: `${totalStars(save)}/${STAGES.length * 3}` })]);
  screen.append(header(ctx, '스테이지', onBack, [stars, coinChip(save.coins, 'chip--sm')], icons.back()), worldTabs(ctx, active, pick), body);
  return screen;
}

