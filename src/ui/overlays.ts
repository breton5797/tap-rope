// Pause menu, countdown, tutorial hints and toasts.
import { COPY } from '../flavor';
import type { LaneDir, MoveId } from '../types';
import { LEAVE_MS, type Banner } from './toast-queue';
import { button, h, svg, swallowInput, type Ctx } from './dom';
import { icons } from './icons';
import { MOVES, moveGlyph } from './moves';

export function buildPause(ctx: Ctx, close: () => void): HTMLElement {
  return h('section', { cls: 'screen screen--modal', attrs: { 'aria-label': '일시정지', role: 'dialog', 'aria-modal': 'true' } }, [
    h('div', { cls: 'modal card pop-in' }, [
      h('div', { cls: 'kicker', text: COPY.pauseKicker }),
      h('h2', { cls: 'modal__title', text: COPY.pauseTitle }),
      h('p', { cls: 'modal__text', text: COPY.pauseText }),
      h('div', { cls: 'stack' }, [
        button({
          label: COPY.pauseResume,
          variant: 'sun',
          size: 'lg',
          icon: icons.play(),
          onPress: ctx.tap(() => {
            close();
            ctx.cb.onResume();
          }),
        }),
        button({ label: COPY.resultRetry, variant: 'glass', icon: icons.retry(), onPress: ctx.tap(() => ctx.cb.onRetry()) }),
        button({ label: COPY.pauseQuit, variant: 'pink', icon: icons.grid(), onPress: ctx.tap(() => ctx.cb.onQuit()) }),
      ]),
    ]),
  ]);
}

// ---------- countdown ----------

export function renderCountdown(layer: HTMLElement, n: number | null): void {
  if (n === null) {
    layer.replaceChildren();
    return;
  }
  const go = n <= 0;
  const el = h('div', { cls: `countdown${go ? ' countdown--go' : ''}`, attrs: { role: 'status' } }, [
    h('div', { cls: 'countdown__ring' }),
    h('div', { cls: 'countdown__num', text: go ? 'GO' : String(n) }),
  ]);
  layer.replaceChildren(el);
}

// ---------- tutorial ----------

export function renderTutorial(layer: HTMLElement, ctx: Ctx, move: MoveId | null): void {
  if (move === null) {
    layer.replaceChildren();
    return;
  }
  const info = MOVES[move];
  const skip = h('button', { cls: 'tut__skip', text: '건너뛰기', attrs: { type: 'button', 'aria-label': '교육 건너뛰기' } });
  swallowInput(skip);
  skip.addEventListener('click', () => {
    ctx.cb.onUiClick();
    ctx.cb.onTutorialDone();
  });
  // v8 (A1): one slim line under the HUD (gesture pill + hint), never during the countdown
  layer.replaceChildren(
    h('div', { cls: `tut tut--line tone--${info.tone}${info.warn ? ' tut--warn' : ''}`, attrs: { role: 'status' } }, [
      h('div', { cls: 'tut__card' }, [
        h('span', { cls: 'tut__tag' }, [moveGlyph(move), h('span', { text: info.gesture })]),
        h('p', { cls: 'tut__text', text: info.hint }),
      ]),
      skip,
    ]),
  );
}

// ---------- v8 (A1): tutorial freeze ----------

type StopStep = 'jump' | 'slide' | 'lane';

const STOP_COPY: Readonly<Record<StopStep, { readonly kicker: string; readonly hint: string }>> = {
  jump: { kicker: COPY.tutJumpKicker, hint: COPY.tutJumpHint },
  slide: { kicker: COPY.tutSlideKicker, hint: COPY.tutSlideHint },
  lane: { kicker: COPY.tutLaneKicker, hint: COPY.tutLaneHint },
};

/** Hand glyph: pulsing tap rings, or a finger travelling along the swipe arrow (dir: +1 down, −1 up). */
function handGlyph(dir: 0 | LaneDir): SVGElement {
  const C = '#3fe0d0';
  const finger = [
    svg('path', { d: 'M-7 4V-14a4 4 0 0 1 8 0V-2l9 2.5a4 4 0 0 1 3 4.4L11 22H-6l-9-12a3.6 3.6 0 0 1 5.6-4.4Z', fill: 'rgba(7,9,12,0.7)', stroke: '#e6ebee', 'stroke-width': 2, 'stroke-linejoin': 'round' }),
  ];
  if (dir === 0) {
    return svg('svg', { class: 'tstop__glyph', viewBox: '-40 -46 80 80', 'aria-hidden': 'true' }, [
      svg('circle', { cy: -16, r: 12, fill: 'none', stroke: C, 'stroke-width': 2.5, class: 'tstop__ring' }),
      svg('circle', { cy: -16, r: 12, fill: 'none', stroke: C, 'stroke-width': 2.5, class: 'tstop__ring tstop__ring--2' }),
      svg('g', { class: 'tstop__tap' }, finger),
    ]);
  }
  const d = dir > 0 ? 'M0 -40V20M-9 11L0 20L9 11' : 'M0 20V-40M-9 -31L0 -40L9 -31';
  return svg('svg', { class: 'tstop__glyph', viewBox: '-40 -46 80 80', 'aria-hidden': 'true' }, [
    svg('path', { d, fill: 'none', stroke: C, 'stroke-width': 3, 'stroke-linecap': 'square', opacity: 0.7, transform: 'translate(-22 0)' }),
    svg('g', { class: `tstop__swipe tstop__swipe--${dir > 0 ? 'down' : 'up'}` }, finger),
  ]);
}

/** The frozen-world prompt: the half to use lights up with a hand glyph; input still reaches the canvas. */
export function renderTutorialStop(layer: HTMLElement, stop: { readonly step: StopStep; readonly dir: LaneDir | null } | null): void {
  if (stop === null) {
    layer.querySelector('.tstop')?.remove();
    return;
  }
  const copy = STOP_COPY[stop.step];
  const side = stop.step === 'lane' ? 'left' : 'right';
  const dir: 0 | LaneDir = stop.step === 'jump' ? 0 : stop.step === 'slide' ? 1 : (stop.dir ?? 1);
  const label = stop.step === 'jump' ? 'TAP' : dir > 0 ? '↓' : '↑';
  layer.replaceChildren(
    h('div', { cls: `tstop tstop--${side}`, attrs: { role: 'status' } }, [
      h('div', { cls: 'tstop__pad' }, [
        handGlyph(dir),
        h('div', { cls: 'tstop__label', text: label }),
      ]),
      h('div', { cls: 'tstop__card' }, [
        h('span', { cls: 'tstop__kicker', text: copy.kicker }),
        h('span', { cls: 'tstop__hint', text: copy.hint }),
      ]),
    ]),
  );
}

// ---------- v8 (A3): boss phase line ----------

export const BOSS_LINE_MS = 2200;

/** "PHASE 2 — 기관포 연사" banner under the boss bar; replaces any previous one and fades by itself. */
export function renderBossLine(layer: HTMLElement, kicker: string, text: string): void {
  const el = h('div', { cls: 'bossline', attrs: { role: 'status' } }, [
    h('span', { cls: 'bossline__kicker', text: kicker }),
    h('span', { cls: 'bossline__text', text }),
  ]);
  layer.querySelector('.bossline')?.remove();
  layer.appendChild(el);
  window.setTimeout(() => el.remove(), BOSS_LINE_MS);
}

// ---------- achievement banner (v7; v8: one at a time via toast-queue.ts) ----------

/** the achievement's embroidered badge (public/art/ach/<id>.webp); the star icon when several or missing */
function badge(id: string | null): Element {
  if (id === null) return icons.star();
  const img = h('img', { cls: 'ach-toast__badge', attrs: { src: `./art/ach/${id}.webp`, alt: '', width: '40', height: '40', decoding: 'async' } });
  img.addEventListener('error', () => img.replaceWith(icons.star()), { once: true });
  return img;
}

/** Mounts one "ACHIEVEMENT UNLOCKED" banner; returns its exit (fade, then removal). */
export function showAchievementBanner(layer: HTMLElement, b: Banner): () => void {
  let stack = layer.querySelector<HTMLElement>('.ach-stack');
  if (!stack) {
    stack = h('div', { cls: 'ach-stack' });
    layer.appendChild(stack);
  }
  const el = h('div', { cls: `ach-toast${b.count > 1 ? ' ach-toast--multi' : ''}`, attrs: { role: 'status' } }, [
    h('span', { cls: 'ach-toast__icon' }, [badge(b.id)]),
    h('div', { cls: 'ach-toast__body' }, [
      h('div', { cls: 'ach-toast__kicker mono', text: 'ACHIEVEMENT UNLOCKED' }),
      h('div', { cls: 'ach-toast__name', text: b.title }),
      h('div', { cls: 'ach-toast__desc', text: b.desc }),
    ]),
  ]);
  stack.replaceChildren(el);
  return () => {
    el.classList.add('is-leaving');
    window.setTimeout(() => el.remove(), LEAVE_MS);
  };
}

// ---------- toast ----------

export function showToast(layer: HTMLElement, msg: string): void {
  const el = h('div', { cls: 'toast', attrs: { role: 'status' }, text: msg });
  layer.appendChild(el);
  while (layer.children.length > 3) layer.firstElementChild?.remove();
  window.setTimeout(() => el.classList.add('is-leaving'), 1900);
  window.setTimeout(() => el.remove(), 2300);
}
