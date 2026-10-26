// In-game HUD. updateHud runs every frame, so every write is diffed first.
import type { HudState } from '../types';
import { animate, formatNumber, h, swallowInput, type Ctx } from './dom';
import { icons } from './icons';
import { moveGlyph } from './moves';

export interface Hud {
  readonly el: HTMLElement;
  update(s: HudState): void;
  reset(): void;
}

interface Refs {
  readonly hearts: HTMLElement;
  readonly title: HTMLElement;
  readonly score: HTMLElement;
  readonly coins: HTMLElement;
  readonly progress: HTMLElement;
  /** v5: section track over the progress bar (door markers + current-section highlight) */
  readonly progressWrap: HTMLElement;
  readonly sections: HTMLElement;
  readonly feverBar: HTMLElement;
  readonly feverFill: HTMLElement;
  readonly feverLabel: HTMLElement;
  readonly combo: HTMLElement;
  readonly comboNum: HTMLElement;
  readonly shield: HTMLElement;
  readonly slow: HTMLElement;
  readonly slide: HTMLElement;
}

type Prev = { -readonly [K in keyof HudState]?: HudState[K] };

const POP: KeyframeAnimationOptions = { duration: 200, easing: 'ease-out' };

function statusChip(cls: string, icon: SVGElement, label: string): HTMLElement {
  return h('div', { cls: `status ${cls}`, attrs: { 'aria-label': label } }, [icon, h('span', { text: label })]);
}

function buildDom(ctx: Ctx): { el: HTMLElement; refs: Refs } {
  const pause = h('button', { cls: 'hud__pause', attrs: { type: 'button', 'aria-label': '일시정지' } }, [icons.pause()]);
  swallowInput(pause);
  pause.addEventListener('click', () => {
    ctx.cb.onUiClick();
    ctx.cb.onPause();
  });
  const refs: Refs = {
    hearts: h('div', { cls: 'hud__hearts', attrs: { 'aria-label': '방탄', role: 'img' } }),
    title: h('div', { cls: 'hud__title' }),
    score: h('div', { cls: 'hud__score', text: '0' }),
    coins: h('span', { cls: 'chip__value', text: '0' }),
    progress: h('div', { cls: 'bar__fill' }),
    progressWrap: h('div', { cls: 'prog', attrs: { role: 'progressbar', 'aria-label': '진행도', 'aria-valuemin': '0', 'aria-valuemax': '100' } }),
    sections: h('div', { cls: 'prog__sections', attrs: { 'aria-hidden': 'true' } }),
    feverBar: h('div', { cls: 'bar bar--fever' }),
    feverFill: h('div', { cls: 'bar__fill' }),
    feverLabel: h('span', { cls: 'bar__label', text: 'OVERDRIVE' }),
    combo: h('div', { cls: 'combo', attrs: { 'aria-live': 'polite' } }),
    comboNum: h('span', { cls: 'combo__num' }),
    shield: statusChip('status--shield', icons.shield(), 'SHIELD'),
    slow: statusChip('status--slow', icons.clock(), 'SLOW'),
    slide: h('span', { cls: 'hud__slide', attrs: { 'aria-label': '슬라이딩' } }, [moveGlyph('slide'), h('span', { text: 'SLIDE' })]),
  };
  refs.feverBar.append(refs.feverFill, refs.feverLabel, icons.fire());
  refs.combo.append(refs.comboNum, h('span', { cls: 'combo__label', text: 'CHAIN' }));
  refs.progressWrap.append(h('div', { cls: 'bar bar--progress' }, [refs.progress]), refs.sections);
  const el = h('div', { cls: 'hud' }, [
    h('div', { cls: 'hud__top' }, [
      pause,
      h('div', { cls: 'hud__center' }, [refs.title, refs.score]),
      h('div', { cls: 'chip chip--coin chip--sm' }, [icons.coin(), refs.coins]),
    ]),
    h('div', { cls: 'hud__mid' }, [
      h('div', { cls: 'hud__left' }, [refs.hearts, refs.slide]),
      h('div', { cls: 'hud__status' }, [refs.shield, refs.slow]),
    ]),
    h('div', { cls: 'hud__bars' }, [refs.progressWrap, refs.feverBar]),
    refs.combo,
  ]);
  return { el, refs };
}

function renderHearts(refs: Refs, hearts: number, max: number, prev: Prev, reduced: boolean): void {
  if (prev.maxHearts !== max) {
    // armor gauge: one cell per heart
    refs.hearts.replaceChildren(h('span', { cls: 'hud__armor-label mono', text: 'ARMOR' }), ...Array.from({ length: max }, () => h('i', { cls: 'heart' })));
  }
  const nodes = Array.from(refs.hearts.querySelectorAll('.heart'));
  nodes.forEach((node, i) => {
    const full = i < hearts;
    const wasFull = prev.hearts === undefined ? full : i < prev.hearts;
    node.classList.toggle('is-empty', !full);
    if (wasFull === full || prev.hearts === undefined) return;
    const frames = full
      ? [{ opacity: 0.3 }, { opacity: 1 }]
      : [{ background: '#ff2a3a', boxShadow: '0 0 10px #ff2a3a' }, { background: '#ff2a3a' }, {}];
    animate(node, frames, { duration: full ? 300 : 520, easing: 'ease-out' }, reduced);
  });
  refs.hearts.setAttribute('aria-label', `방탄 ${hearts}/${max}`);
  refs.hearts.classList.toggle('is-critical', hearts === 1 && max > 1);
}

function renderCombo(refs: Refs, combo: number, prev: number | undefined, reduced: boolean): void {
  const visible = combo >= 3;
  refs.combo.classList.toggle('is-visible', visible);
  if (!visible) return;
  refs.comboNum.textContent = `x${combo}`;
  const tier = combo >= 50 ? 3 : combo >= 25 ? 2 : combo >= 10 ? 1 : 0;
  refs.combo.dataset.tier = String(tier);
  if (prev !== undefined && combo > prev) {
    animate(refs.combo, [{ opacity: 0.55, transform: 'translateX(-4px)' }, { opacity: 1, transform: 'none' }], POP, reduced);
  }
}

function renderFever(refs: Refs, s: HudState, prev: Prev): void {
  const g = Math.round(Math.max(0, Math.min(1, s.feverGauge)) * 200) / 200;
  if (prev.feverGauge !== g) refs.feverFill.style.transform = `scaleX(${g})`;
  if (prev.fever !== s.fever) {
    refs.feverBar.classList.toggle('is-fever', s.fever);
    refs.feverLabel.textContent = s.fever ? 'OVERDRIVE ×2' : 'OVERDRIVE';
  }
  const wasFull = !prev.fever && (prev.feverGauge ?? 0) >= 1;
  const full = !s.fever && g >= 1;
  if (wasFull !== full || prev.feverGauge === undefined) refs.feverBar.classList.toggle('is-full', full);
}

/** Section pips: a highlighted segment per section and a door marker between sections (hidden for 1). */
function renderSections(refs: Refs, section: number, sections: number, prev: Prev): void {
  const n = Math.max(1, Math.floor(sections));
  const cur = Math.max(0, Math.min(n - 1, Math.floor(section)));
  if (prev.sections !== sections) {
    refs.progressWrap.classList.toggle('has-sections', n > 1);
    refs.sections.replaceChildren(
      ...(n > 1 ? Array.from({ length: n }, (_, i) => h('i', { cls: 'prog__seg', style: { left: `${(i / n) * 100}%`, width: `${100 / n}%` } })) : []),
      ...Array.from({ length: n - 1 }, (_, i) => h('i', { cls: 'prog__door', style: { left: `${((i + 1) / n) * 100}%` } })),
    );
  }
  const segs = refs.sections.querySelectorAll('.prog__seg');
  const doors = refs.sections.querySelectorAll('.prog__door');
  segs.forEach((el, i) => {
    el.classList.toggle('is-current', i === cur);
    el.classList.toggle('is-done', i < cur);
  });
  doors.forEach((el, i) => el.classList.toggle('is-open', i < cur));
  refs.progressWrap.setAttribute('aria-valuetext', n > 1 ? `구간 ${cur + 1}/${n}` : '');
}

/** "7-3 · 이름" renders the stage number as a small badge. */
function renderTitle(el: HTMLElement, title: string): void {
  const m = /^(\d+-\d+) · (.*)$/.exec(title);
  el.replaceChildren(...(m ? [h('span', { cls: 'hud__no', text: m[1] }), m[2]] : [title]));
}

function renderValues(refs: Refs, s: HudState, prev: Prev, reduced: boolean): void {
  if (prev.title !== s.title) renderTitle(refs.title, s.title);
  if (prev.score !== s.score) {
    refs.score.textContent = formatNumber(s.score);
    if (prev.score !== undefined && s.score > prev.score) {
      animate(refs.score, [{ color: '#ffb020' }, { color: '#e6ebee' }], POP, reduced);
    }
  }
  if (prev.coins !== s.coins) {
    refs.coins.textContent = formatNumber(s.coins);
    if (prev.coins !== undefined) animate(refs.coins, [{ color: '#ffb020' }, { color: '#e6ebee' }], POP, reduced);
  }
  const p = Math.round(Math.max(0, Math.min(1, s.progress)) * 400) / 400;
  if (prev.progress !== p) {
    refs.progress.style.transform = `scaleX(${p})`;
    refs.progressWrap.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  }
  if (prev.section !== s.section || prev.sections !== s.sections) renderSections(refs, s.section, s.sections, prev);
  if (prev.shield !== s.shield) refs.shield.classList.toggle('is-on', s.shield);
  if (prev.slowMo !== s.slowMo) refs.slow.classList.toggle('is-on', s.slowMo);
  if (prev.sliding !== s.sliding) {
    refs.slide.classList.toggle('is-on', s.sliding);
    if (s.sliding && prev.sliding !== undefined) animate(refs.slide, [{ opacity: 0.4 }, { opacity: 1 }], POP, reduced);
  }
}

export function createHud(ctx: Ctx): Hud {
  const { el, refs } = buildDom(ctx);
  let prev: Prev = {};
  return {
    el,
    update(s: HudState): void {
      const reduced = ctx.reducedMotion();
      if (prev.hearts !== s.hearts || prev.maxHearts !== s.maxHearts) renderHearts(refs, s.hearts, s.maxHearts, prev, reduced);
      if (prev.combo !== s.combo) renderCombo(refs, s.combo, prev.combo, reduced);
      renderValues(refs, s, prev, reduced);
      renderFever(refs, s, prev);
      prev = {
        ...s,
        progress: Math.round(Math.max(0, Math.min(1, s.progress)) * 400) / 400,
        feverGauge: Math.round(Math.max(0, Math.min(1, s.feverGauge)) * 200) / 200,
      };
    },
    reset(): void {
      prev = {};
      refs.combo.classList.remove('is-visible');
    },
  };
}
