// Office stage select (칼퇴근 대작전), swapped in for src/ui/stages.ts: one cut-away building (./art/map-bg.webp)
// with each stage's node on its own floor — stage 1 on 12층 at the top, stage 5 in the lobby at the bottom.
// Nodes, stars and badges are the v8 stage-node pieces; there are no chapter tabs (one stage per floor).
import { STAGES } from '../../core/content';
import { isStageUnlocked } from '../../core/storage';
import { COPY } from '../../flavor';
import type { SaveData } from '../../types';
import { h, header, type Ctx } from '../../ui/dom';
import { icons } from '../../ui/icons';
import { firstIntroductions, stageNode } from '../../ui/stage-node';
import { stampDots } from '../../ui/mission';

export { chapterSkin } from '../../ui/stages';

/** each floor's centre in the map art (percent of its width / height), top floor first */
export const FLOORS: readonly (readonly [x: number, y: number])[] = [
  [50, 15.5], // 12층 기획팀 사무실
  [44, 35], // 탕비실·복합기 복도
  [32, 51], // 회의실 층
  [38, 67], // 엘리베이터홀·비상계단
  [46, 86], // 1층 로비·회전문
];
/** the v8 node's disc centre below its top edge (stage-node.ts DISC_CENTER) */
const DISC_CENTER = 39;

const starsOf = (save: SaveData): number => STAGES.reduce((n, s) => n + (save.stars[s.id] ?? 0), 0);

export function buildStageSelect(ctx: Ctx, save: SaveData, onBack: () => void): HTMLElement {
  const fresh = firstIntroductions();
  const next = STAGES.find((s, i) => isStageUnlocked(save, i) && (save.stars[s.id] ?? 0) === 0);
  const nodes = STAGES.map((s, i) => {
    const el = stageNode(ctx, save, s, s === next, fresh.get(s.id) ?? new Set());
    const [x, y] = FLOORS[i] ?? [50, 50];
    el.style.left = `${x}%`;
    el.style.top = `calc(${y}% - ${DISC_CENTER}px)`;
    el.classList.add('floors__node');
    // v2: the stage's best mission stamps under its name
    const dots = stampDots(s.id);
    if (dots) el.appendChild(dots);
    return el;
  });
  const img = h('img', { cls: 'floors__img', attrs: { src: './art/map-bg.webp', alt: '', decoding: 'async', draggable: 'false' } });
  img.addEventListener('error', () => img.remove());
  const map = h('div', { cls: 'floors' }, [img, ...nodes]);
  const total = h('div', { cls: 'chip chip--star chip--sm', attrs: { 'aria-label': `전체 평가 ${starsOf(save)}/${STAGES.length * 3}` } }, [
    icons.star(),
    h('span', { cls: 'chip__value', text: `${starsOf(save)}/${STAGES.length * 3}` }),
  ]);
  const scroll = h('div', { cls: 'scroll floors__scroll' }, [map]);
  const screen = h('section', { cls: 'screen screen--stages screen--floors', attrs: { 'aria-label': COPY.resultMap } }, [
    header(ctx, COPY.resultMap, onBack, [total], icons.back()),
    scroll,
  ]);
  // bring the next floor to play into view (the top floor needs no scroll)
  requestAnimationFrame(() => {
    const target = next ? nodes[STAGES.indexOf(next)] : null;
    if (target && STAGES.indexOf(next as (typeof STAGES)[number]) > 0) target.scrollIntoView?.({ block: 'center', behavior: ctx.reducedMotion() ? 'auto' : 'smooth' });
  });
  return screen;
}
