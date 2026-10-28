// Office v2 mission DOM (spec §3.3), swapped in for src/ui/mission.ts: the HUD mission chip (with the chase
// gauge), the 1.6 s mission card as a section starts, the stamp as a section ends (「미션 완료!」 / 「다음 기회에」,
// with the stamp bonus), the result card's three stamps and grade, and the map's stamp dots.
// Non-blocking (pointer-events: none); built once per run and patched every frame.
import type { MissionView, ResultInfo, StageDef } from '../../types';
import { h } from '../../ui/dom';
import { STAGES } from '../../core/content';
import { loadStamps, missionCardFor } from '../../game/missions';
import { MISSION_BONUS, STAGE_MISSIONS, type MissionKind } from '../core/missions';

const KIND_LABEL: Readonly<Record<MissionKind, string>> = { dodge: '돌파', collect: '수집', chase: '추격', finale: '결전' };
const CARD_MS = 1600;
const STAMP_MS = 1500;

interface MissionDom {
  readonly root: HTMLElement;
  readonly chip: HTMLElement;
  readonly label: HTMLElement;
  readonly count: HTMLElement;
  readonly meter: HTMLElement;
  readonly fill: HTMLElement;
  readonly pips: HTMLElement;
  index: number;
  stampAt: number | undefined;
  text: string;
  cardTimer: ReturnType<typeof setTimeout> | null;
  stampTimer: ReturnType<typeof setTimeout> | null;
}

let dom: MissionDom | null = null;

function build(layer: HTMLElement): MissionDom {
  const label = h('span', { cls: 'mission-chip__label' });
  const count = h('span', { cls: 'mission-chip__count' });
  const fill = h('i', { cls: 'mission-chip__fill' });
  const meter = h('span', { cls: 'mission-chip__meter', attrs: { hidden: '' } }, [fill]);
  const pips = h('span', { cls: 'mission-chip__pips', attrs: { 'aria-hidden': 'true' } });
  const chip = h('div', { cls: 'mission-chip', attrs: { role: 'status' } }, [pips, label, count, meter]);
  const root = h('div', { cls: 'mission', attrs: { 'aria-live': 'polite' } }, [chip]);
  layer.appendChild(root);
  return { root, chip, label, count, meter, fill, pips, index: -1, stampAt: undefined, text: '', cardTimer: null, stampTimer: null };
}

function clear(): void {
  if (!dom) return;
  if (dom.cardTimer) clearTimeout(dom.cardTimer);
  if (dom.stampTimer) clearTimeout(dom.stampTimer);
  dom.root.remove();
  dom = null;
}

function showCard(d: MissionDom, stage: StageDef, index: number, delay = 0): void {
  const card = missionCardFor(stage, index);
  if (!card) return;
  d.root.querySelector('.mission-card')?.remove();
  const goal = card.kind === 'collect' ? `${card.title} ${card.target}개 모으기`
    : card.kind === 'chase' ? `${card.superior} 따돌리기 · 피격 2번까지`
      : card.kind === 'finale' ? `마지막엔 ${card.superior} 뛰어넘기!` : `장애물 ${card.target}개 돌파`;
  const el = h('div', { cls: `mission-card mission-card--${card.kind}` }, [
    h('div', { cls: 'mission-card__kicker', text: `미션 ${card.index + 1}/${card.total} · ${KIND_LABEL[card.kind]}` }),
    h('div', { cls: 'mission-card__title', text: card.title }),
    h('div', { cls: 'mission-card__goal', text: goal }),
    card.superior ? h('div', { cls: 'mission-card__line', text: `${card.superior}: ${card.line}` }) : null,
  ]);
  if (d.cardTimer) clearTimeout(d.cardTimer);
  const show = (): void => {
    d.root.appendChild(el);
    d.cardTimer = setTimeout(() => el.remove(), CARD_MS);
  };
  if (delay > 0) d.cardTimer = setTimeout(show, delay);
  else show();
}

function showStamp(d: MissionDom, ok: boolean, stage: StageDef | null): void {
  d.root.querySelector('.mission-stamp')?.remove();
  const i = stage ? Math.max(0, STAGES.findIndex((s) => s.id === stage.id)) : 0;
  const el = h('div', { cls: `mission-stamp ${ok ? 'is-ok' : 'is-miss'}` }, [
    h('div', { cls: 'mission-stamp__ink', text: ok ? '미션 완료!' : '다음 기회에' }),
    ok ? h('div', { cls: 'mission-stamp__bonus', text: `+₵${MISSION_BONUS(i)}` }) : null,
  ]);
  d.root.appendChild(el);
  if (d.stampTimer) clearTimeout(d.stampTimer);
  d.stampTimer = setTimeout(() => el.remove(), STAMP_MS);
}

function chipText(v: MissionView): string {
  if (v.kind === 'chase') return v.complete ? '따돌리는 중' : '따라잡혔다!';
  return `${v.value}/${v.target}`;
}

/** patches the HUD for this frame; undefined clears it (menus, result, a new run) */
export function renderMission(layer: HTMLElement, view: MissionView | undefined, stage: StageDef | null, _reduced: boolean): void {
  if (!view || !stage) {
    clear();
    return;
  }
  if (!dom || !layer.contains(dom.root)) {
    clear();
    dom = build(layer);
  }
  const d = dom;
  const spec = STAGE_MISSIONS[stage.id]?.[view.index];
  const label = spec?.kind === 'collect' ? spec.title : KIND_LABEL[view.kind];
  const text = `${label}|${chipText(view)}|${view.complete}|${view.stamps.join(',')}`;
  if (text !== d.text) {
    d.text = text;
    d.label.textContent = label;
    d.count.textContent = chipText(view);
    d.chip.classList.toggle('is-complete', view.complete);
    d.chip.dataset.kind = view.kind;
    d.pips.replaceChildren(...view.stamps.map((s, k) => h('i', { cls: `pip${s === true ? ' is-ok' : s === false ? ' is-miss' : ''}${k === view.index ? ' is-now' : ''}` })));
  }
  d.meter.hidden = view.chase === undefined;
  if (view.chase !== undefined) d.fill.style.transform = `scaleX(${view.chase.toFixed(3)})`;
  const stamped = view.stampAt !== undefined && view.stampAt !== d.stampAt;
  if (stamped) {
    d.stampAt = view.stampAt;
    showStamp(d, view.stampOk === true, stage);
  }
  if (view.index !== d.index) {
    d.index = view.index;
    // at a door the stamp lands first, then the next mission's card
    showCard(d, stage, view.index, stamped ? STAMP_MS : 0);
  }
}

/** the result card's row: one stamp per mission and the stage grade */
export function missionResult(r: ResultInfo): HTMLElement | null {
  const m = r.missions;
  const specs = r.stageId ? STAGE_MISSIONS[r.stageId] : undefined;
  if (!m || !specs) return null;
  return h('div', { cls: 'report__missions', attrs: { role: 'group', 'aria-label': `미션 도장 ${m.stamps.filter((s) => s === true).length}/${specs.length}, 등급 ${m.grade}` } }, [
    h('div', { cls: 'report__stamps' }, specs.map((spec, k) => {
      const s = m.stamps[k];
      return h('div', { cls: `report__stamp${s === true ? ' is-ok' : s === false ? ' is-miss' : ' is-none'}` }, [
        h('span', { cls: 'report__stamp-ink', text: s === true ? '완료' : s === false ? '다음에' : '—' }),
        h('span', { cls: 'report__stamp-name', text: spec.title }),
      ]);
    })),
    h('div', { cls: `report__grade grade--${m.grade}` }, [h('span', { cls: 'report__grade-label', text: '등급' }), h('b', { text: m.grade })]),
  ]);
}

/** the map: a stage's best stamps as three dots */
export function stampDots(stageId: string): HTMLElement | null {
  const specs = STAGE_MISSIONS[stageId];
  if (!specs) return null;
  const best = loadStamps()[stageId] ?? [];
  const n = best.filter(Boolean).length;
  return h('div', { cls: 'floors__stamps', attrs: { 'aria-label': `도장 ${n}/${specs.length}` } },
    specs.map((_, k) => h('i', { cls: `stamp-dot${best[k] ? ' is-ok' : ''}` })));
}
