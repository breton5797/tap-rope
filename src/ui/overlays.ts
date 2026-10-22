// Pause menu, countdown, tutorial hints and toasts.
import type { MoveId } from '../types';
import { button, h, swallowInput, type Ctx } from './dom';
import { icons } from './icons';
import { moveArt } from './move-art';
import { MOVES, moveGlyph } from './moves';

export function buildPause(ctx: Ctx, close: () => void): HTMLElement {
  return h('section', { cls: 'screen screen--modal', attrs: { 'aria-label': '일시정지', role: 'dialog' } }, [
    h('div', { cls: 'modal card pop-in' }, [
      h('div', { cls: 'modal__badge' }, [icons.pause()]),
      h('h2', { cls: 'modal__title', text: '일시정지' }),
      h('p', { cls: 'modal__text', text: '잠깐 숨 고르기! 준비되면 계속해요.' }),
      h('div', { cls: 'stack' }, [
        button({
          label: '계속하기',
          variant: 'sun',
          size: 'lg',
          icon: icons.play(),
          onPress: ctx.tap(() => {
            close();
            ctx.cb.onResume();
          }),
        }),
        button({ label: '다시하기', variant: 'sky', icon: icons.retry(), onPress: ctx.tap(() => ctx.cb.onRetry()) }),
        button({ label: '나가기', variant: 'glass', icon: icons.grid(), onPress: ctx.tap(() => ctx.cb.onQuit()) }),
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
    h('div', { cls: 'countdown__num', text: go ? 'GO!' : String(n) }),
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
  const skip = h('button', { cls: 'tut__skip', text: '건너뛰기', attrs: { type: 'button' } });
  swallowInput(skip);
  skip.addEventListener('click', () => {
    ctx.cb.onUiClick();
    ctx.cb.onTutorialDone();
  });
  const warn = move === 'bird';
  layer.replaceChildren(
    h('div', { cls: `tut tone--${info.tone}${warn ? ' tut--warn' : ''}`, attrs: { role: 'status' } }, [
      h('div', { cls: 'tut__card' }, [
        moveArt(move),
        h('div', { cls: 'tut__body' }, [
          h('div', { cls: 'tut__head' }, [
            h('span', { cls: 'tut__tag' }, [moveGlyph(move), h('span', { text: info.gesture })]),
            h('span', { cls: 'tut__name', text: info.name }),
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
