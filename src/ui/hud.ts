// In-game HUD. updateHud runs every frame, so every write is diffed first.
import { COPY } from '../flavor';
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
  /** progress row: "SECTOR 2/3" label + one track segment per section (gaps = doors) */
  readonly progLabel: HTMLElement;
  readonly progressWrap: HTMLElement;
  readonly feverBar: HTMLElement;
  readonly feverFill: HTMLElement;
  readonly feverLabel: HTMLElement;
  readonly combo: HTMLElement;
  readonly comboNum: HTMLElement;
  readonly shield: HTMLElement;
  readonly slow: HTMLElement;
  readonly slide: HTMLElement;
  /** v7 boss bar */
  readonly boss: HTMLElement;
  readonly bossCode: HTMLElement;
  readonly bossName: HTMLElement;
  readonly bossPhase: HTMLElement;
  readonly bossCells: readonly HTMLElement[];
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
    progLabel: h('span', { cls: 'hud__barlabel hud__barlabel--prog', text: '진행' }),
    progressWrap: h('div', { cls: 'prog', attrs: { role: 'progressbar', 'aria-label': '진행도', 'aria-valuemin': '0', 'aria-valuemax': '100' } }),
    feverBar: h('div', { cls: 'bar bar--fever' }),
    feverFill: h('div', { cls: 'bar__fill' }),
    feverLabel: h('span', { cls: 'hud__barlabel hud__barlabel--fever', text: COPY.hudFever }),
    combo: h('div', { cls: 'combo' }),
    comboNum: h('span', { cls: 'combo__num' }),
    shield: statusChip('status--shield', icons.shield(), 'SHIELD'),
    slow: statusChip('status--slow', icons.clock(), 'SLOW'),
    slide: h('span', { cls: 'hud__slide', attrs: { 'aria-label': '슬라이딩' } }, [moveGlyph('slide'), h('span', { text: 'SLIDE' })]),
    boss: h('div', { cls: 'boss', attrs: { role: 'meter', 'aria-label': '보스 내구도', 'aria-valuemin': '0', 'aria-valuemax': '100', hidden: '' } }),
    bossCode: h('span', { cls: 'boss__code mono' }),
    bossName: h('span', { cls: 'boss__name' }),
    bossPhase: h('span', { cls: 'boss__phase mono' }),
    bossCells: [0, 1, 2].map(() => h('i', { cls: 'boss__cell' }, [h('b', { cls: 'boss__fill' })])),
  };
  refs.boss.append(
    h('div', { cls: 'boss__head' }, [refs.bossCode, refs.bossName, refs.bossPhase]),
    h('div', { cls: 'boss__bar' }, refs.bossCells),
  );
  refs.feverBar.append(refs.feverFill, icons.fire());
  refs.combo.append(refs.comboNum, h('span', { cls: 'combo__label', text: 'CHAIN' }));
  const el = h('div', { cls: 'hud' }, [
    h('div', { cls: 'hud__top' }, [
      pause,
      h('div', { cls: 'hud__center' }, [refs.title, refs.score]),
      h('div', { cls: 'chip chip--coin chip--sm' }, [icons.coin(), refs.coins]),
    ]),
    // v8 (A2): the SLIDE chip is gone (the runner's pose shows the slide); armor + power-up chips share one row
    h('div', { cls: 'hud__mid' }, [
      h('div', { cls: 'hud__left' }, [refs.hearts]),
      h('div', { cls: 'hud__status' }, [refs.shield, refs.slow]),
    ]),
    // labels sit beside the bars, never on the fill
    h('div', { cls: 'hud__bars' }, [refs.progLabel, refs.progressWrap, refs.feverLabel, refs.feverBar]),
    refs.boss,
    refs.combo,
  ]);
  return { el, refs };
}

function renderHearts(refs: Refs, hearts: number, max: number, prev: Prev, reduced: boolean): void {
  if (prev.maxHearts !== max) {
    // armor gauge: one cell per heart
    refs.hearts.replaceChildren(h('span', { cls: 'hud__armor-label', text: COPY.hudArmor }), ...Array.from({ length: max }, () => h('i', { cls: 'heart' })));
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
    refs.feverLabel.classList.toggle('is-on', s.fever);
    refs.feverLabel.textContent = s.fever ? `${COPY.hudFever} ×2` : COPY.hudFever;
  }
  const wasFull = !prev.fever && (prev.feverGauge ?? 0) >= 1;
  const full = !s.fever && g >= 1;
  if (wasFull !== full || prev.feverGauge === undefined) {
    refs.feverBar.classList.toggle('is-full', full);
    refs.feverLabel.classList.toggle('is-ready', full);
  }
}

/** One track segment per section; rebuilt only when the section count changes. */
function buildSegments(refs: Refs, n: number): void {
  refs.progressWrap.replaceChildren(...Array.from({ length: n }, () => h('i', { cls: 'prog__seg' }, [h('b', { cls: 'prog__fill' })])));
}

/** Fills each segment by its share of the stage, marks cleared / current sections and updates the label. */
function renderProgress(refs: Refs, p: number, section: number, sections: number, prev: Prev): void {
  const n = Math.max(1, Math.floor(sections));
  const cur = Math.max(0, Math.min(n - 1, Math.floor(section)));
  if (prev.sections !== sections) buildSegments(refs, n);
  const segs = refs.progressWrap.children;
  for (let i = 0; i < segs.length; i++) {
    const seg = segs[i] as HTMLElement;
    const f = Math.max(0, Math.min(1, p * n - i));
    (seg.firstElementChild as HTMLElement).style.transform = `scaleX(${f})`;
    seg.classList.toggle('is-done', n > 1 && i < cur);
    seg.classList.toggle('is-current', n > 1 && i === cur);
  }
  const label = n > 1 ? `구간 ${cur + 1}/${n}` : '진행';
  if (refs.progLabel.textContent !== label) refs.progLabel.textContent = label;
  refs.progLabel.classList.toggle('is-sector', n > 1);
  refs.progressWrap.setAttribute('aria-valuenow', String(Math.round(p * 100)));
  refs.progressWrap.setAttribute('aria-valuetext', n > 1 ? `구간 ${cur + 1}/${n}, ${Math.round(p * 100)}%` : `${Math.round(p * 100)}%`);
}

type BossHud = NonNullable<HudState['boss']>;

/** v7 boss bar: codename · name · PHASE n/3, HP split into 3 phase cells (drains right → left), flash on damage. */
function renderBoss(refs: Refs, b: HudState['boss'], prev: HudState['boss'] | undefined, reduced: boolean): void {
  // v8 (A2): boss stages drop the sector bar (boss HP already is the progress)
  refs.boss.parentElement?.classList.toggle('hud--boss', b !== null);
  if (!b) {
    refs.boss.hidden = true;
    return;
  }
  refs.boss.hidden = false;
  if (prev?.codename !== b.codename) refs.bossCode.textContent = b.codename;
  if (prev?.name !== b.name) refs.bossName.textContent = b.name;
  const hp = Math.max(0, Math.min(1, b.hp));
  const phase = Math.max(0, Math.min(2, Math.floor(b.phase)));
  if (prev?.phase !== b.phase) refs.bossPhase.textContent = `PHASE ${phase + 1}/3`;
  refs.bossCells.forEach((cell, i) => {
    (cell.firstElementChild as HTMLElement).style.transform = `scaleX(${Math.max(0, Math.min(1, hp * 3 - i))})`;
    // the cell currently draining belongs to the active phase
    cell.classList.toggle('is-active', i === 2 - phase);
    cell.classList.toggle('is-gone', hp * 3 - i <= 0);
  });
  refs.boss.setAttribute('aria-valuenow', String(Math.round(hp * 100)));
  refs.boss.setAttribute('aria-valuetext', `${b.codename} ${Math.round(hp * 100)}%, 페이즈 ${phase + 1}/3`);
  if (prev && hp < prev.hp - 1e-4) {
    refs.boss.classList.remove('is-hit');
    void refs.boss.offsetWidth; // restart the flash
    refs.boss.classList.add('is-hit');
    if (reduced) refs.boss.classList.remove('is-hit');
  }
}

function sameBoss(a: BossHud | null | undefined, b: BossHud | null): boolean {
  if (!a || !b) return a === b;
  return a.hp === b.hp && a.phase === b.phase && a.name === b.name && a.codename === b.codename;
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
  if (prev.progress !== p || prev.section !== s.section || prev.sections !== s.sections) renderProgress(refs, p, s.section, s.sections, prev);
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
      if (!sameBoss(prev.boss, s.boss ?? null)) renderBoss(refs, s.boss ?? null, prev.boss ?? undefined, reduced);
      prev = {
        ...s,
        progress: Math.round(Math.max(0, Math.min(1, s.progress)) * 400) / 400,
        feverGauge: Math.round(Math.max(0, Math.min(1, s.feverGauge)) * 200) / 200,
      };
    },
    reset(): void {
      prev = {};
      refs.combo.classList.remove('is-visible');
      refs.boss.hidden = true;
      refs.boss.classList.remove('is-hit');
      el.classList.remove('hud--boss');
    },
  };
}
