// Stage select: scrollable chapter chips, a themed chapter card and its stage trail.
import { CHAPTERS, STAGES } from '../core/content';
import { isStageUnlocked } from '../core/storage';
import type { ChapterMeta, SaveData, StageDef } from '../types';
import { h, header, type Ctx } from './dom';
import { icons } from './icons';
import { firstIntroductions, stageNode, trailHeight, trailPath } from './stage-node';
import { zoneArt, zoneKey } from './zone-art';

let selectedChapter: number | null = null;

/** CSS skin for a zone (theme × variant palette). */
export function chapterSkin(c: Pick<ChapterMeta, 'theme' | 'variant'>): string {
  return `zone--${zoneKey(c.theme, c.variant)}`;
}

const PART_LABEL: Readonly<Record<1 | 2, string>> = { 1: '1부 구출작전', 2: '2부 탈출작전' };

function chapterStages(chapter: number): StageDef[] {
  return STAGES.filter((s) => s.chapter === chapter);
}

function chapterUnlocked(save: SaveData, chapter: number): boolean {
  const first = chapterStages(chapter)[0];
  return first !== undefined && isStageUnlocked(save, STAGES.indexOf(first));
}

/** The chapter containing the furthest unlocked stage. */
function currentChapter(save: SaveData): number {
  return STAGES.reduce((c, s, i) => (isStageUnlocked(save, i) ? s.chapter : c), 0);
}

function starsOf(save: SaveData, stages: readonly StageDef[]): number {
  return stages.reduce((sum, s) => sum + (save.stars[s.id] ?? 0), 0);
}

function chapterTabs(ctx: Ctx, save: SaveData, active: number, onPick: (c: number) => void): HTMLElement {
  const row = h('nav', { cls: 'chaps', attrs: { role: 'tablist', 'aria-label': '구역' } });
  const tabs: HTMLElement[] = [];
  for (const c of CHAPTERS) {
    if (c.id === 0 || CHAPTERS[c.id - 1]?.part !== c.part) row.appendChild(h('span', { cls: `chaps__part chaps__part--${c.part}`, text: PART_LABEL[c.part] }));
    const open = chapterUnlocked(save, c.id);
    const on = c.id === active;
    const tab = h(
      'button',
      { cls: `chap ${chapterSkin(c)}${on ? ' is-active' : ''}${open ? '' : ' is-locked'}`, attrs: { type: 'button', role: 'tab', 'aria-selected': String(on) } },
      [h('span', { cls: 'chap__num' }, [open ? String(c.id + 1) : icons.lock()]), h('span', { cls: 'chap__name', text: c.name })],
    );
    tab.addEventListener('click', ctx.tap(() => onPick(c.id)));
    row.appendChild(tab);
    tabs.push(tab);
  }
  // centre the active chip once laid out
  requestAnimationFrame(() => {
    const el = tabs[active];
    if (el) row.scrollLeft = el.offsetLeft - (row.clientWidth - el.offsetWidth) / 2;
  });
  return row;
}

function chapterCard(save: SaveData, c: ChapterMeta, stages: readonly StageDef[]): HTMLElement {
  const open = chapterUnlocked(save, c.id);
  return h('div', { cls: `world__hero ${chapterSkin(c)}` }, [
    h('div', { cls: 'world__deco' }, [zoneArt(c.theme, c.variant)]),
    h('div', { cls: 'world__kicker' }, [
      h('span', { cls: `world__part world__part--${c.part}`, text: PART_LABEL[c.part] }),
      h('span', { text: `ZONE ${String(c.id + 1).padStart(2, '0')}` }),
    ]),
    h('h2', { cls: 'world__name', text: c.name }),
    h('p', { cls: 'world__sub', text: c.subtitle }),
    h('div', { cls: 'world__meta' }, [
      h('span', { cls: 'world__stars' }, [icons.star(), h('span', { text: `${starsOf(save, stages)} / ${stages.length * 3}` })]),
      open ? null : h('span', { cls: 'world__lock' }, [icons.lock(), h('span', { text: '이전 구역 보스를 깨면 열려요' })]),
    ]),
  ]);
}

function chapterBody(ctx: Ctx, save: SaveData, chapter: number): HTMLElement {
  const meta = CHAPTERS[chapter] ?? CHAPTERS[0];
  const stages = chapterStages(chapter);
  const next = stages.find((s) => isStageUnlocked(save, STAGES.indexOf(s)) && (save.stars[s.id] ?? 0) === 0);
  const intro = firstIntroductions();
  return h('div', { cls: `world ${chapterSkin(meta)}` }, [
    chapterCard(save, meta, stages),
    h('div', { cls: 'trail', style: { height: `${trailHeight(stages)}px` } }, [
      trailPath(stages),
      ...stages.map((s) => stageNode(ctx, save, s, s === next, intro.get(s.id) ?? new Set())),
    ]),
  ]);
}

/** Scrolls the trail so the "도전!" node sits mid-screen (instant under reduced motion). */
function centreNextNode(screen: HTMLElement, reduced: boolean): void {
  const scroller = screen.querySelector<HTMLElement>('.scroll');
  const node = screen.querySelector<HTMLElement>('.node__flag')?.parentElement;
  if (!scroller || !node) return;
  const box = scroller.getBoundingClientRect();
  const r = node.getBoundingClientRect();
  const top = scroller.scrollTop + r.top - box.top - (scroller.clientHeight - r.height) / 2;
  scroller.scrollTo({ top: Math.max(0, top), behavior: reduced ? 'auto' : 'smooth' });
}

export function buildStageSelect(ctx: Ctx, save: SaveData, onBack: () => void): HTMLElement {
  const active = selectedChapter ?? currentChapter(save);
  const screen = h('section', { cls: 'screen screen--stages', attrs: { 'aria-label': '스테이지 선택' } });
  const pick = (c: number): void => {
    selectedChapter = c;
    screen.replaceWith(buildStageSelect(ctx, save, onBack));
  };
  const total = h('div', { cls: 'chip chip--star chip--sm' }, [
    icons.star(),
    h('span', { cls: 'chip__value', text: `${starsOf(save, STAGES)}/${STAGES.length * 3}` }),
  ]);
  requestAnimationFrame(() => centreNextNode(screen, ctx.reducedMotion()));
  screen.append(
    header(ctx, '작전 지도', onBack, [total], icons.back()),
    chapterTabs(ctx, save, active, pick),
    h('div', { cls: 'scroll' }, [chapterBody(ctx, save, active)]),
  );
  return screen;
}
