// Tiny DOM helpers: build elements declaratively, never via innerHTML.
import type { UiCallbacks } from '../types';

export type Child = Node | string | number | null | undefined | false;

export interface Props {
  readonly cls?: string;
  readonly text?: string;
  readonly attrs?: Readonly<Record<string, string>>;
  readonly style?: Readonly<Record<string, string>>;
  readonly on?: Readonly<Record<string, EventListener>>;
}

const SVG_NS = 'http://www.w3.org/2000/svg';

function append(el: Element, children: readonly Child[]): void {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number' ? document.createTextNode(String(c)) : c);
  }
}

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Props = {},
  children: readonly Child[] = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (props.cls) el.className = props.cls;
  if (props.text !== undefined) el.textContent = props.text;
  for (const [k, v] of Object.entries(props.attrs ?? {})) el.setAttribute(k, v);
  for (const [k, v] of Object.entries(props.style ?? {})) el.style.setProperty(k, v);
  for (const [k, fn] of Object.entries(props.on ?? {})) el.addEventListener(k, fn);
  append(el, children);
  return el;
}

export function svg(
  tag: string,
  attrs: Readonly<Record<string, string | number>> = {},
  children: readonly Child[] = [],
): SVGElement {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  append(el, children);
  return el;
}

/** Shared context handed to each screen builder. */
export interface Ctx {
  readonly cb: UiCallbacks;
  /** wraps a handler so it plays the click sfx first */
  tap(fn: () => void): () => void;
  reducedMotion(): boolean;
}

export type ButtonVariant = 'sun' | 'pink' | 'mint' | 'sky' | 'violet' | 'glass' | 'ghost';

export interface ButtonOpts {
  readonly label: string;
  readonly variant?: ButtonVariant;
  readonly icon?: SVGElement;
  readonly sub?: string;
  readonly size?: 'lg' | 'md' | 'sm' | 'icon';
  readonly cls?: string;
  readonly aria?: string;
  readonly onPress: () => void;
}

/** Chunky 3D button with a reliable pressed state on touch devices. */
export function button(o: ButtonOpts): HTMLButtonElement {
  const cls = `btn btn--${o.variant ?? 'sun'} btn--${o.size ?? 'md'}${o.cls ? ` ${o.cls}` : ''}`;
  const label = o.size === 'icon' ? null : h('span', { cls: 'btn__label', text: o.label });
  const sub = o.sub ? h('span', { cls: 'btn__sub', text: o.sub }) : null;
  const text = sub ? h('span', { cls: 'btn__text' }, [label, sub]) : label;
  const el = h('button', { cls, attrs: { type: 'button', 'aria-label': o.aria ?? o.label } }, [
    o.icon ? h('span', { cls: 'btn__icon' }, [o.icon]) : null,
    text,
  ]);
  const release = (): void => el.classList.remove('is-pressed');
  el.addEventListener('pointerdown', () => el.classList.add('is-pressed'));
  el.addEventListener('pointerup', release);
  el.addEventListener('pointerleave', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('click', (e) => {
    e.stopPropagation();
    o.onPress();
  });
  return el;
}

const SWALLOWED = ['pointerdown', 'pointerup', 'touchstart', 'touchend', 'mousedown', 'click'] as const;

/** Prevent UI interactions from reaching game input listeners further up the tree. */
export function swallowInput(el: HTMLElement): void {
  for (const type of SWALLOWED) el.addEventListener(type, (e) => e.stopPropagation());
}

/** Plays a Web Animation if supported and motion is allowed. */
export function animate(
  el: Element,
  frames: Keyframe[],
  opts: KeyframeAnimationOptions,
  reduced: boolean,
): void {
  if (reduced || typeof el.animate !== 'function') return;
  el.animate(frames, opts);
}

export function formatNumber(n: number): string {
  return Math.round(n).toLocaleString('ko-KR');
}

/** Standard screen header: back button, title, and right-side slot. */
export function header(ctx: Ctx, title: string, onBack: () => void, right: readonly Child[], back: SVGElement): HTMLElement {
  return h('header', { cls: 'topbar' }, [
    button({ label: '뒤로', variant: 'glass', size: 'icon', icon: back, onPress: ctx.tap(onBack) }),
    h('h1', { cls: 'topbar__title', text: title }),
    h('div', { cls: 'topbar__right' }, right),
  ]);
}
