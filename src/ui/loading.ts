// v6 boot overlay ("SYSTEM BOOT"): a progress bar while the renderer loads the photographic art.
// Built once and then only patched, so it can be updated every progress tick.
import { h } from './dom';

const STEPS: readonly (readonly [number, string])[] = [
  [0, '보안망 접속 중'],
  [0.35, '시설 도면 수신 중'],
  [0.7, '장비 점검 중'],
  [1, '접속 완료'],
];

interface LoadingView {
  readonly el: HTMLElement;
  readonly fill: HTMLElement;
  readonly pct: HTMLElement;
  readonly status: HTMLElement;
  readonly bar: HTMLElement;
}

let view: LoadingView | null = null;

function build(): LoadingView {
  const fill = h('div', { cls: 'boot__fill' });
  const pct = h('span', { cls: 'boot__pct mono', text: '0%' });
  const status = h('span', { cls: 'boot__status', text: STEPS[0][1] });
  const bar = h('div', { cls: 'boot__bar', attrs: { role: 'progressbar', 'aria-label': '로딩', 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-valuenow': '0' } }, [fill]);
  const el = h('div', { cls: 'boot', attrs: { role: 'status' } }, [
    h('div', { cls: 'boot__panel' }, [
      h('div', { cls: 'kicker', text: 'SYSTEM BOOT // LE-06' }),
      h('div', { cls: 'boot__logo mono', text: 'LASER ESCAPE' }),
      h('div', { cls: 'boot__sub', text: '레이저 탈출작전' }),
      bar,
      h('div', { cls: 'boot__row' }, [status, pct]),
    ]),
  ]);
  return { el, fill, pct, status, bar };
}

export function renderLoading(layer: HTMLElement, progress: number | null): void {
  if (progress === null) {
    view = null;
    layer.replaceChildren();
    return;
  }
  if (!view || !layer.contains(view.el)) {
    view = build();
    layer.replaceChildren(view.el);
  }
  const p = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const pct = Math.round(p * 100);
  view.fill.style.transform = `scaleX(${p})`;
  view.pct.textContent = `${pct}%`;
  view.bar.setAttribute('aria-valuenow', String(pct));
  view.status.textContent = [...STEPS].reverse().find(([at]) => p >= at)?.[1] ?? STEPS[0][1];
}
