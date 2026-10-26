// v7 cutscene player (GDD-v7 §2): full-screen letterboxed stills with a Ken Burns move per shot, 0.4s dissolves,
// typed captions with a speaker label, SKIP (button / Escape / long-press). Reduced motion: static frames + fades.
// `onDone` fires exactly once — after the last shot or on a skip — and the player cleans up after itself.
import type { Cutscene, CutsceneShot } from '../types';
import { h, swallowInput } from './dom';

export const DISSOLVE_MS = 400;
const TYPE_MS = 32;
const LONG_PRESS_MS = 650;

/** Ken Burns frame: scale around the centre, then shift so the focus point moves toward the centre without
 * ever exposing an edge (shift is clamped to the overscan the zoom provides). Returns a CSS transform. */
export function kenBurns(f: CutsceneShot['from']): string {
  const z = Math.max(1, f.zoom);
  const room = (z - 1) / 2;
  const clamp = (v: number): number => Math.max(-room, Math.min(room, v));
  const tx = clamp(-(f.x - 0.5) * z);
  const ty = clamp(-(f.y - 0.5) * z);
  return `translate(${(tx * 100).toFixed(2)}%, ${(ty * 100).toFixed(2)}%) scale(${z.toFixed(3)})`;
}

interface Slot {
  readonly el: HTMLElement;
  img: HTMLImageElement | null;
}

function makeSlot(): Slot {
  return { el: h('div', { cls: 'cut__shot', attrs: { 'aria-hidden': 'true' } }), img: null };
}

function preload(src: string | undefined): void {
  if (!src || typeof Image === 'undefined') return;
  const img = new Image();
  img.decoding = 'async';
  img.src = src;
}

export interface CutscenePlayer {
  readonly el: HTMLElement;
  /** ends the cutscene now (same path as SKIP) */
  skip(): void;
}

export function buildCutscene(c: Cutscene, opts: { readonly reduced: boolean; readonly onClick: () => void }, onDone: () => void): CutscenePlayer {
  const slots: [Slot, Slot] = [makeSlot(), makeSlot()];
  const speaker = h('span', { cls: 'cut__speaker mono' });
  const caption = h('p', { cls: 'cut__caption' });
  const counter = h('span', { cls: 'cut__count mono' });
  const skipBtn = h('button', { cls: 'cut__skip mono', text: 'SKIP ▸▸', attrs: { type: 'button', 'aria-label': '컷신 건너뛰기' } });
  const el = h('section', { cls: `cut${opts.reduced ? ' is-reduced' : ''}`, attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-label': c.title } }, [
    h('div', { cls: 'cut__stage' }, [slots[0].el, slots[1].el]),
    h('div', { cls: 'cut__bar cut__bar--top' }, [h('span', { cls: 'cut__title mono', text: c.title }), counter, skipBtn]),
    h('div', { cls: 'cut__bar cut__bar--bottom' }, [h('div', { cls: 'cut__sub', attrs: { 'aria-live': 'polite' } }, [speaker, caption])]),
    h('div', { cls: 'cut__fade' }),
  ]);
  swallowInput(el);

  const timers = new Set<ReturnType<typeof setTimeout>>();
  const later = (fn: () => void, ms: number): void => {
    const id = setTimeout(() => {
      timers.delete(id);
      fn();
    }, ms);
    timers.add(id);
  };
  let typing: ReturnType<typeof setInterval> | null = null;
  let finished = false;
  let front = 0;

  const typeCaption = (text: string): void => {
    if (typing !== null) clearInterval(typing);
    typing = null;
    caption.setAttribute('aria-label', text);
    if (opts.reduced) {
      caption.textContent = text;
      return;
    }
    const chars = Array.from(text);
    let n = 0;
    caption.textContent = '';
    typing = setInterval(() => {
      n += 1;
      caption.textContent = chars.slice(0, n).join('');
      if (n >= chars.length && typing !== null) {
        clearInterval(typing);
        typing = null;
      }
    }, TYPE_MS);
  };

  const showShot = (i: number): void => {
    const shot = c.shots[i];
    if (!shot) return;
    const slot = slots[front];
    front = 1 - front;
    const other = slots[front];
    slot.img?.remove();
    const img = h('img', { cls: 'cut__img', attrs: { src: shot.image, alt: '', decoding: 'async', draggable: 'false' } });
    slot.el.classList.remove('is-missing');
    img.addEventListener('error', () => {
      img.remove(); // dark fallback frame stays
      slot.el.classList.add('is-missing');
    });
    slot.img = img;
    slot.el.prepend(img);
    if (!opts.reduced && typeof img.animate === 'function') {
      img.animate([{ transform: kenBurns(shot.from) }, { transform: kenBurns(shot.to) }], {
        duration: shot.seconds * 1000 + DISSOLVE_MS,
        easing: 'linear',
        fill: 'both',
      });
    }
    slot.el.classList.add('is-on');
    other.el.classList.remove('is-on');
    speaker.textContent = shot.speaker ?? '';
    speaker.hidden = !shot.speaker;
    typeCaption(shot.caption);
    counter.textContent = `${String(i + 1).padStart(2, '0')}/${String(c.shots.length).padStart(2, '0')}`;
    preload(c.shots[i + 1]?.image);
    later(() => (i + 1 < c.shots.length ? showShot(i + 1) : finish()), shot.seconds * 1000);
  };

  const cleanup = (): void => {
    timers.forEach(clearTimeout);
    timers.clear();
    if (typing !== null) clearInterval(typing);
    typing = null;
    window.removeEventListener('keydown', onKey, true);
  };

  /** Fade to black, then hand control back (once). */
  function finish(): void {
    if (finished) return;
    finished = true;
    cleanup();
    el.classList.add('is-ending');
    setTimeout(() => {
      el.remove();
      onDone();
    }, opts.reduced ? 0 : DISSOLVE_MS);
  }

  const skip = (): void => {
    if (finished) return;
    opts.onClick();
    finish();
  };

  function onKey(e: KeyboardEvent): void {
    if (!el.isConnected && !finished) return;
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      skip();
    }
  }
  window.addEventListener('keydown', onKey, true);

  skipBtn.addEventListener('click', skip);
  let press: ReturnType<typeof setTimeout> | null = null;
  const cancelPress = (): void => {
    if (press !== null) clearTimeout(press);
    press = null;
    el.classList.remove('is-pressing');
  };
  el.addEventListener('pointerdown', (e) => {
    if ((e.target as Element | null)?.closest('button')) return;
    cancelPress();
    el.classList.add('is-pressing');
    press = setTimeout(skip, LONG_PRESS_MS);
  });
  el.addEventListener('pointerup', cancelPress);
  el.addEventListener('pointercancel', cancelPress);
  el.addEventListener('pointerleave', cancelPress);

  if (c.shots.length === 0) later(finish, 0);
  else showShot(0);
  requestAnimationFrame(() => skipBtn.focus({ preventScroll: true }));
  return { el, skip };
}
