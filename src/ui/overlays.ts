// Pause menu, countdown, tutorial hints and toasts.
import type { MoveId } from '../types';
import { button, h, swallowInput, type Ctx } from './dom';
import { icons } from './icons';
import { moveArt } from './move-art';
import { MOVES, moveGlyph } from './moves';

export function buildPause(ctx: Ctx, close: () => void): HTMLElement {
  return h('section', { cls: 'screen screen--modal', attrs: { 'aria-label': '일시정지', role: 'dialog' } }, [
    h('div', { cls: 'modal card pop-in' }, [
      h('div', { cls: 'kicker', text: 'OPERATION HOLD' }),
      h('h2', { cls: 'modal__title', text: '작전 일시정지' }),
      h('p', { cls: 'modal__text', text: '통신 유지 중. 준비되면 재개.' }),
      h('div', { cls: 'stack' }, [
        button({
          label: '작전 재개',
          variant: 'sun',
          size: 'lg',
          icon: icons.play(),
          onPress: ctx.tap(() => {
            close();
            ctx.cb.onResume();
          }),
        }),
        button({ label: '재투입', variant: 'glass', icon: icons.retry(), onPress: ctx.tap(() => ctx.cb.onRetry()) }),
        button({ label: '작전 중단', variant: 'pink', icon: icons.grid(), onPress: ctx.tap(() => ctx.cb.onQuit()) }),
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
  layer.replaceChildren(
    h('div', { cls: `tut tone--${info.tone}${info.warn ? ' tut--warn' : ''}`, attrs: { role: 'status' } }, [
      h('div', { cls: 'tut__card' }, [
        moveArt(move),
        h('div', { cls: 'tut__body' }, [
          h('div', { cls: 'tut__head' }, [
            h('span', { cls: 'tut__tag' }, [moveGlyph(move), h('span', { text: info.gesture })]),
            h('span', { cls: 'tut__name', text: info.name }),
            h('span', { cls: 'tut__kicker mono', text: info.warn ? 'ALERT' : 'TRAINING' }),
          ]),
          h('p', { cls: 'tut__text', text: info.hint }),
        ]),
      ]),
      skip,
    ]),
  );
}

// ---------- toast ----------

export function showToast(layer: HTMLElement, msg: string): void {
  const el = h('div', { cls: 'toast', attrs: { role: 'status' }, text: msg });
  layer.appendChild(el);
  while (layer.children.length > 3) layer.firstElementChild?.remove();
  window.setTimeout(() => el.classList.add('is-leaving'), 1900);
  window.setTimeout(() => el.remove(), 2300);
}
