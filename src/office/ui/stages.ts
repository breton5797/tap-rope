// Office stage select (칼퇴근 대작전), swapped in for src/ui/stages.ts: two maps behind two tabs (part 2 spec §3).
// 1부 is the cut-away building (./art/map-bg.webp) — stage 1 on 12층 at the top, stage 5 in the lobby at the
// bottom; 2부 is the way home (./art/map-bg-2.webp) — stage 6 at the gate plaza down to stage 10 at the front
// door. The tab of the next stage to play opens first; 2부 stays a locked teaser until stage 5 is cleared.
// Nodes, stars and badges are the v8 stage-node pieces; both maps are built, the inactive one is hidden.
import { CHAPTERS, STAGES } from '../../core/content';
import { isStageUnlocked } from '../../core/storage';
import { COPY } from '../../flavor';
import type { SaveData } from '../../types';
import { h, header, type Ctx } from '../../ui/dom';
import { icons } from '../../ui/icons';
import { firstIntroductions, stageNode } from '../../ui/stage-node';
import { stampDots } from '../../ui/mission';
import { accountState } from '../../platform/account';

export { chapterSkin } from '../../ui/stages';

export type MapPart = 1 | 2;

interface MapSheet {
  readonly part: MapPart;
  readonly label: string;
  /** the screen title while this map is shown */
  readonly title: string;
  readonly src: string;
}

export const MAP_SHEETS: readonly MapSheet[] = [
  { part: 1, label: '1부 사무실', title: COPY.resultMap, src: './art/map-bg.webp' },
  { part: 2, label: '2부 퇴근길', title: '퇴근길 지도', src: './art/map-bg-2.webp' },
];

/** each stage's landmark centre in its map art (percent of its width / height), stage 1 first */
export const FLOORS: readonly (readonly [x: number, y: number])[] = [
  // 1부: one floor per stage, top floor first
  [50, 15.5], // 12층 기획팀 사무실
  [44, 35], // 탕비실·복합기 복도
  [32, 51], // 회의실 층
  [38, 67], // 엘리베이터홀·비상계단
  [46, 86], // 1층 로비·회전문
  // 2부: the way home, gate first — on the landmarks of map-bg-2 (art hand-off)
  [54, 16], // 회사 정문·광장
  [47, 34], // 퇴근길 버스정류장
  [58, 51], // 지하철역 개찰구
  [37, 68], // 먹자골목
  [72, 85], // 우리 집 앞 동네
];
/** the v8 node's disc centre below its top edge (stage-node.ts DISC_CENTER) */
const DISC_CENTER = 39;
/** the first stage of part 2 (0-based): opens once stage 5 is cleared */
const PART2_FIRST = STAGES.findIndex((s) => CHAPTERS[s.chapter]?.part === 2);

/** the map part stage `stageIndex` (0-based) sits on */
export function partOf(stageIndex: number): MapPart {
  const s = STAGES[stageIndex];
  return s && CHAPTERS[s.chapter]?.part === 2 ? 2 : 1;
}

/** 2부 is open once stage 6 is unlocked (stage 5 cleared), or for a tester */
export function partOpen(save: SaveData, part: MapPart, openAll = false): boolean {
  return part === 1 || openAll || (PART2_FIRST >= 0 && isStageUnlocked(save, PART2_FIRST));
}

/** the tab shown first: the part of the next stage to play; all cleared → the last open part */
export function initialPart(save: SaveData, openAll = false): MapPart {
  const next = STAGES.findIndex((s, i) => isStageUnlocked(save, i) && (save.stars[s.id] ?? 0) === 0);
  if (next >= 0) return partOf(next);
  return partOpen(save, 2, openAll) ? 2 : 1;
}

const starsOf = (save: SaveData): number => STAGES.reduce((n, s) => n + (save.stars[s.id] ?? 0), 0);

function partTabs(ctx: Ctx, save: SaveData, openAll: boolean, active: MapPart, onPick: (p: MapPart) => void): HTMLElement[] {
  return MAP_SHEETS.map((m) => {
    const open = partOpen(save, m.part, openAll);
    const on = m.part === active;
    const tab = h(
      'button',
      {
        cls: `floors__tab${on ? ' is-active' : ''}${open ? '' : ' is-locked'}`,
        // a locked part stays browsable (teaser map) but is announced as such
        attrs: { type: 'button', role: 'tab', 'aria-selected': String(on), 'aria-label': `${m.label}${open ? '' : ' 잠김'}`, 'data-part': String(m.part) },
      },
      [open ? null : icons.lock(), h('span', { text: m.label })],
    );
    tab.addEventListener('click', ctx.tap(() => onPick(m.part)));
    return tab;
  });
}

function mapSheet(m: MapSheet, nodes: readonly HTMLElement[], open: boolean): HTMLElement {
  const img = h('img', { cls: 'floors__img', attrs: { src: m.src, alt: '', decoding: 'async', draggable: 'false' } });
  img.addEventListener('error', () => img.remove());
  const teaser = open
    ? null
    : h('div', { cls: 'floors__teaser' }, [icons.lock(), h('strong', { text: '18:00 칼퇴 후 퇴근길' }), h('span', { text: '1부 5단계를 클리어하면 열려요' })]);
  return h('div', { cls: `floors floors--part${m.part}${open ? '' : ' is-teaser'}`, attrs: { 'data-part': String(m.part), role: 'tabpanel', 'aria-label': m.label } }, [
    img,
    ...nodes,
    teaser,
  ]);
}

export function buildStageSelect(ctx: Ctx, save: SaveData, onBack: () => void): HTMLElement {
  const fresh = firstIntroductions();
  // login spec §1: a tester picks any floor
  const openAll = accountState().tester;
  const next = STAGES.find((s, i) => isStageUnlocked(save, i) && (save.stars[s.id] ?? 0) === 0);
  const nodes = STAGES.map((s, i) => {
    const el = stageNode(ctx, save, s, s === next, fresh.get(s.id) ?? new Set(), openAll);
    const [x, y] = FLOORS[i] ?? [50, 50];
    el.style.left = `${x}%`;
    el.style.top = `calc(${y}% - ${DISC_CENTER}px)`;
    el.classList.add('floors__node');
    // v2: the stage's best mission stamps under its name
    const dots = stampDots(s.id);
    if (dots) el.appendChild(dots);
    return el;
  });
  let active = initialPart(save, openAll);
  const sheets = MAP_SHEETS.map((m) => mapSheet(m, nodes.filter((_, i) => partOf(i) === m.part), partOpen(save, m.part, openAll)));
  const scroll = h('div', { cls: 'scroll floors__scroll' }, sheets);
  const nextIndex = next ? STAGES.indexOf(next) : -1;
  /** the next stage to play into view when it is on this map (past its first stage), else the map's top */
  const focusNext = (part: MapPart): void => {
    scroll.scrollTop = 0;
    const first = STAGES.findIndex((_, k) => partOf(k) === part);
    if (nextIndex <= first || partOf(nextIndex) !== part) return;
    requestAnimationFrame(() => nodes[nextIndex]?.scrollIntoView?.({ block: 'center', behavior: ctx.reducedMotion() ? 'auto' : 'smooth' }));
  };
  const show = (part: MapPart): void => {
    active = part;
    sheets.forEach((el, i) => (el.hidden = MAP_SHEETS[i].part !== part));
    tabs.forEach((t, i) => {
      const on = MAP_SHEETS[i].part === part;
      t.classList.toggle('is-active', on);
      t.setAttribute('aria-selected', String(on));
    });
    focusNext(part);
    const title = MAP_SHEETS.find((m) => m.part === part)?.title ?? COPY.resultMap;
    top.querySelector('.topbar__title')?.replaceChildren(title);
    screen.setAttribute('aria-label', title);
  };
  const tabs = partTabs(ctx, save, openAll, active, show);
  const total = h('div', { cls: 'chip chip--star chip--sm', attrs: { 'aria-label': `전체 평가 ${starsOf(save)}/${STAGES.length * 3}` } }, [
    icons.star(),
    h('span', { cls: 'chip__value', text: `${starsOf(save)}/${STAGES.length * 3}` }),
  ]);
  const top = header(ctx, COPY.resultMap, onBack, [total], icons.back());
  const screen = h('section', { cls: 'screen screen--stages screen--floors', attrs: { 'aria-label': COPY.resultMap } }, [
    top,
    h('nav', { cls: 'floors__tabs', attrs: { role: 'tablist', 'aria-label': '지도' } }, tabs),
    scroll,
  ]);
  show(active);
  return screen;
}
