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
/** seconds of run time the card and the stamp stay up (run time: they wait while the game is paused) */
const CARD_S = 1.6;
const STAMP_S = 1.5;

/** an overlay shown from `from` to `until` (run time) */
interface Timed {
  readonly el: HTMLElement;
  readonly from: number;
  readonly until: number;
}

interface MissionDom {
  readonly root: HTMLElement;
  readonly chip: HTMLElement;
  readonly label: HTMLElement;
  readonly count: HTMLElement;
  readonly meter: HTMLElement;
  readonly fill: HTMLElement;
  readonly pips: HTMLElement;
  /** the last view patched in (views are cached per run state, so identity means "unchanged") */
  view: MissionView | null;
  index: number;
  stampAt: number | undefined;
  card: Timed | null;
  stamp: Timed | null;
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
  return { root, chip, label, count, meter, fill, pips, view: null, index: -1, stampAt: undefined, card: null, stamp: null };
}

function clear(): void {
  dom?.root.remove();
  dom = null;
}

function cardEl(stage: StageDef, index: number): HTMLElement | null {
  const card = missionCardFor(stage, index);
  if (!card) return null;
  const goal = card.kind === 'collect' ? `${card.title} ${card.target}개 모으기`
    : card.kind === 'chase' ? `${card.superior} 따돌리기 · 피격 2번까지`
      : card.kind === 'finale' ? `마지막엔 ${card.superior} 뛰어넘기!` : `장애물 ${card.target}개 돌파`;
  return h('div', { cls: `mission-card mission-card--${card.kind}` }, [
    h('div', { cls: 'mission-card__kicker', text: `미션 ${card.index + 1}/${card.total} · ${KIND_LABEL[card.kind]}` }),
    h('div', { cls: 'mission-card__title', text: card.title }),
    h('div', { cls: 'mission-card__goal', text: goal }),
    card.superior ? h('div', { cls: 'mission-card__line', text: `${card.superior}: ${card.line}` }) : null,
  ]);
}

function stampEl(ok: boolean, stage: StageDef): HTMLElement {
  const i = Math.max(0, STAGES.findIndex((s) => s.id === stage.id));
  return h('div', { cls: `mission-stamp ${ok ? 'is-ok' : 'is-miss'}` }, [
    h('div', { cls: 'mission-stamp__ink', text: ok ? '미션 완료!' : '다음 기회에' }),
    ok ? h('div', { cls: 'mission-stamp__bonus', text: `+₵${MISSION_BONUS(i)}` }) : null,
  ]);
}

/** attaches a timed overlay while `time` is inside its window, detaches it after (null once done) */
function show(root: HTMLElement, t: Timed | null, time: number): Timed | null {
  if (!t) return null;
  if (time >= t.until) {
    t.el.remove();
    return null;
  }
  if (time >= t.from && !t.el.isConnected) root.appendChild(t.el);
  return t;
}

function chipText(v: MissionView): string {
  if (v.kind === 'chase') return v.complete ? '따돌리는 중' : '따라잡혔다!';
  return `${v.value}/${v.target}`;
}

function patchChip(d: MissionDom, view: MissionView, stage: StageDef): void {
  const spec = STAGE_MISSIONS[stage.id]?.[view.index];
  d.label.textContent = spec?.kind === 'collect' ? spec.title : KIND_LABEL[view.kind];
  d.count.textContent = chipText(view);
  d.chip.classList.toggle('is-complete', view.complete);
  d.chip.dataset.kind = view.kind;
  d.pips.replaceChildren(...view.stamps.map((s, k) => h('i', { cls: `pip${s === true ? ' is-ok' : s === false ? ' is-miss' : ''}${k === view.index ? ' is-now' : ''}` })));
  d.meter.hidden = view.chase === undefined;
  if (view.chase !== undefined) d.fill.style.transform = `scaleX(${view.chase.toFixed(3)})`;
}

/** patches the HUD at run time `time`; undefined clears it (menus, result, a new run) */
export function renderMission(layer: HTMLElement, view: MissionView | undefined, stage: StageDef | null, _reduced: boolean, time: number): void {
  if (!view || !stage) {
    clear();
    return;
  }
  if (!dom || !layer.contains(dom.root)) {
    clear();
    dom = build(layer);
  }
  const d = dom;
  if (view !== d.view) {
    d.view = view;
    patchChip(d, view, stage);
    const stamped = view.stampAt !== undefined && view.stampAt !== d.stampAt;
    if (stamped) {
      d.stampAt = view.stampAt;
      d.stamp?.el.remove();
      d.stamp = { el: stampEl(view.stampOk === true, stage), from: time, until: time + STAMP_S };
    }
    if (view.index !== d.index) {
      d.index = view.index;
      d.card?.el.remove();
      // at a door the stamp lands first, then the next mission's card
      const from = stamped ? time + STAMP_S : time;
      const el = cardEl(stage, view.index);
      d.card = el ? { el, from, until: from + CARD_S } : null;
    }
  }
  d.stamp = show(d.root, d.stamp, time);
  d.card = show(d.root, d.card, time);
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
    bonusLine(r),
  ]);
}

/** 「도장 보너스 +₵N」 (a failed run: 「딴 도장 보너스」, paid at the doors) and 「금일봉 ×N」 */
function bonusLine(r: ResultInfo): HTMLElement | null {
  const m = r.missions;
  if (!m || (m.stampBonus <= 0 && m.items <= 0)) return null;
  const parts = [
    m.stampBonus > 0 ? `${r.cleared ? '도장 보너스' : '딴 도장 보너스'} +₵${m.stampBonus}` : null,
    m.items > 0 ? `금일봉 ×${m.items} +₵${m.bonus - m.stampBonus}` : null,
  ].filter((x): x is string => x !== null);
  return h('div', { cls: 'report__mission-bonus', text: parts.join(' · ') });
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
