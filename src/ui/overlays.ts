// Pause menu, countdown, tutorial hints and toasts.
import { button, h, svg, swallowInput, type Ctx } from './dom';
import { icons } from './icons';

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

const TUTORIAL = [
  { text: '화면을 탭하면 점프!', tag: 'TAP' },
  { text: '공중에서 한 번 더 탭 → 2단 점프', tag: '×2' },
  { text: '세 번 탭 → 3단 점프! 숫자를 확인하세요', tag: '×3' },
  { text: '새가 오면 낮게! 2단 이상 뛰면 부딪혀요', tag: '!' },
] as const;

/** Figure lift (px above the ground line) per tutorial step. */
const FIGURE_LIFT = [10, 22, 34, 4] as const;
const GROUND = 64;

function bird(): SVGElement {
  return svg('g', { class: 'tut__bird', transform: 'translate(44 13)' }, [
    svg('ellipse', { cx: 0, cy: 0, rx: 9, ry: 6.5, fill: '#5b8cff' }),
    svg('path', { d: 'M-3 -2 L4 -11 L6 -1z', fill: '#3d6be0', class: 'tut__wing' }),
    svg('path', { d: 'M-8 -1 L-14 1 L-8 3z', fill: '#ffb020' }),
    svg('circle', { cx: -4, cy: -1.5, r: 1.6, fill: '#1f1a4d' }),
  ]);
}

function figure(lift: number): SVGElement {
  const y = GROUND - 22 - lift;
  return svg('g', { transform: `translate(40 ${y})` }, [
    svg('g', { class: 'tut__fig' }, [
      svg('rect', { x: -6.5, y: 2, width: 13, height: 14, rx: 5.5, fill: '#ff5d6c' }),
      svg('circle', { cx: 0, cy: -5, r: 7.5, fill: '#ffd9b8' }),
      svg('path', { d: 'M-7.5 -6 Q0 -16 7.5 -6 Q0 -10 -7.5 -6z', fill: '#4a2c2a' }),
      svg('circle', { cx: -2.6, cy: -4, r: 1.1, fill: '#2a2350' }),
      svg('circle', { cx: 2.6, cy: -4, r: 1.1, fill: '#2a2350' }),
    ]),
  ]);
}

function liftMarks(step: number, lift: number): SVGElement[] {
  if (step === 3) return [];
  return Array.from({ length: step + 1 }, (_, i) =>
    svg('path', { d: `M28 ${GROUND - 4 - (i * lift) / (step + 1)} h-6`, stroke: '#7b5cff', 'stroke-width': 2.4, 'stroke-linecap': 'round', opacity: 0.35 + i * 0.25 }),
  );
}

function illustration(step: number): SVGElement {
  const warn = step === 3;
  const lift = FIGURE_LIFT[step] ?? 10;
  const taps = warn ? 1 : step + 1;
  return svg('svg', { class: 'tut__art', viewBox: '0 0 80 80', 'aria-hidden': 'true' }, [
    svg('defs', {}, [
      svg('clipPath', { id: `tut-clip-${step}` }, [svg('rect', { width: 80, height: 80, rx: 22 })]),
      svg('linearGradient', { id: `tut-bg-${step}`, x1: 0, y1: 0, x2: 0, y2: 1 }, [
        svg('stop', { offset: 0, 'stop-color': warn ? '#ffe9ee' : '#e8f6ff' }),
        svg('stop', { offset: 1, 'stop-color': warn ? '#ffc7d4' : '#bfe4ff' }),
      ]),
    ]),
    svg('g', { 'clip-path': `url(#tut-clip-${step})` }, [
      svg('rect', { x: 0, y: 0, width: 80, height: 80, fill: `url(#tut-bg-${step})` }),
      svg('rect', { x: 0, y: GROUND, width: 80, height: 16, fill: '#7fd68a' }),
      warn ? svg('path', { d: 'M4 25 H76', stroke: '#ff4d6d', 'stroke-width': 2, 'stroke-dasharray': '3 4', 'stroke-linecap': 'round' }) : null,
    ]),
    svg('path', { d: `M6 ${GROUND - 14} Q40 ${GROUND + 14} 74 ${GROUND - 14}`, fill: 'none', stroke: '#ff5da2', 'stroke-width': 3, 'stroke-linecap': 'round' }),
    warn ? bird() : null,
    ...liftMarks(step, lift),
    figure(lift),
    svg('g', { transform: warn ? 'translate(66 44)' : 'translate(64 18)' }, [
      ...Array.from({ length: taps }, (_, i) =>
        svg('circle', { r: 5 + i * 3.5, fill: 'none', stroke: '#4f6bff', 'stroke-width': 1.8, class: 'tut__ring', style: `animation-delay:${i * 0.16}s` }),
      ),
      svg('circle', { r: 4, fill: '#4f6bff' }),
    ]),
  ]);
}

export function renderTutorial(layer: HTMLElement, ctx: Ctx, step: number | null): void {
  const data = step === null ? undefined : TUTORIAL[step];
  if (step === null || data === undefined) {
    layer.replaceChildren();
    return;
  }
  const skip = h('button', { cls: 'tut__skip', text: '건너뛰기', attrs: { type: 'button' } });
  swallowInput(skip);
  skip.addEventListener('click', () => {
    ctx.cb.onUiClick();
    ctx.cb.onTutorialDone();
  });
  const dots = h('div', { cls: 'tut__dots' }, TUTORIAL.map((_, i) => h('i', { cls: i === step ? 'is-on' : '' })));
  layer.replaceChildren(
    h('div', { cls: `tut${step === 3 ? ' tut--warn' : ''}`, attrs: { role: 'status' } }, [
      h('div', { cls: 'tut__card' }, [
        illustration(step),
        h('div', { cls: 'tut__body' }, [
          h('span', { cls: 'tut__tag', text: data.tag }),
          h('p', { cls: 'tut__text', text: data.text }),
          dots,
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
