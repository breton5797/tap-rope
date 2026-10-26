// v5 two-thumb controls: left half = lanes, right half = jump / slide.
// Shown as a blocking card on first play and reused (compact) at the top of the guide sheet.
import { button, h, svg, type Child, type Ctx } from './dom';
import { icons } from './icons';

const FINGER = '#3fe0d0';
const LINE = { fill: 'none', stroke: FINGER, 'stroke-width': 2, 'stroke-linecap': 'square', 'stroke-linejoin': 'miter' } as const;

/** Left thumb: three lanes with an up/down swipe. */
function laneThumbArt(): SVGElement {
  return svg('svg', { class: 'ctl__art', viewBox: '0 0 72 64', 'aria-hidden': 'true' }, [
    svg('path', { d: 'M6 16H40M6 32H40M6 48H40', stroke: '#85929b', 'stroke-width': 1.2, 'stroke-dasharray': '4 4' }),
    svg('rect', { x: 18, y: 26, width: 8, height: 12, fill: '#d5dde2', class: 'ctl__agent' }),
    svg('path', { ...LINE, d: 'M56 8V56M50 14L56 8L62 14M50 50L56 56L62 50', opacity: 0.6 }),
    svg('circle', { cx: 56, cy: 32, r: 5, fill: 'none', stroke: FINGER, 'stroke-width': 2, class: 'ctl__finger' }),
  ]);
}

/** Right thumb: tap = jump, swipe down = slide. */
function actionThumbArt(): SVGElement {
  return svg('svg', { class: 'ctl__art', viewBox: '0 0 72 64', 'aria-hidden': 'true' }, [
    svg('path', { d: 'M4 56H68', stroke: '#85929b', 'stroke-width': 1.2 }),
    svg('g', { transform: 'translate(20 26)' }, [
      svg('circle', { r: 8, fill: 'none', stroke: FINGER, 'stroke-width': 1.4, class: 'tut__ring' }),
      svg('circle', { r: 13, fill: 'none', stroke: FINGER, 'stroke-width': 1.4, class: 'tut__ring', style: 'animation-delay:.18s' }),
      svg('circle', { r: 3.5, fill: FINGER }),
    ]),
    svg('g', { transform: 'translate(52 30)' }, [
      svg('path', { ...LINE, d: 'M0 -16V12M-6 6L0 12L6 6', opacity: 0.6 }),
      svg('circle', { r: 5, fill: 'none', stroke: FINGER, 'stroke-width': 2, class: 'tut__finger tut__finger--down' }),
    ]),
  ]);
}

function half(side: 'left' | 'right', hand: string, art: SVGElement, label: readonly Child[], aria: string): HTMLElement {
  return h('div', { cls: `ctl__half ctl__half--${side}`, attrs: { role: 'group', 'aria-label': aria } }, [
    h('span', { cls: 'ctl__hand', text: hand }),
    art,
    h('p', { cls: 'ctl__label' }, label),
  ]);
}

/** The split illustration (left = lanes, right = jump/slide). */
export function controlsDiagram(compact = false): HTMLElement {
  return h('div', { cls: `ctl__split${compact ? ' ctl__split--compact' : ''}` }, [
    half('left', '왼쪽', laneThumbArt(), [h('b', { text: '위·아래로 밀기' }), h('br'), '레인 이동'], '화면 왼쪽: 위나 아래로 밀어 레인 이동'),
    h('i', { cls: 'ctl__divider', attrs: { 'aria-hidden': 'true' } }),
    half(
      'right',
      '오른쪽',
      actionThumbArt(),
      [h('b', { text: '탭' }), ' 점프', h('br'), h('b', { text: '아래로 밀기' }), h('br'), '슬라이딩'],
      '화면 오른쪽: 탭하면 점프, 아래로 밀면 슬라이딩',
    ),
  ]);
}

function keyLine(): HTMLElement {
  const key = (k: string): HTMLElement => h('kbd', { cls: 'ctl__kbd', text: k });
  const group = (parts: readonly Child[]): HTMLElement => h('span', { cls: 'ctl__keygroup' }, parts);
  return h('p', { cls: 'ctl__keys', attrs: { 'aria-label': '키보드: 위아래 화살표 레인, 스페이스 점프, 시프트 또는 S 슬라이딩' } }, [
    group([key('↑↓'), ' 레인']), ' · ', group([key('Space'), ' 점프']), ' · ', group([key('Shift'), '/', key('S'), ' 슬라이딩']),
  ]);
}

/** Keyboard while the card is open: Tab cycles inside it, Escape confirms like "확인".
 * Window capture phase so the game's own Escape (= pause) never sees it. Self-removes once detached. */
function trapKeys(screen: HTMLElement, close: () => void): () => void {
  const onKey = (e: KeyboardEvent): void => {
    if (!screen.isConnected) {
      release();
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      const items = Array.from(screen.querySelectorAll<HTMLElement>('button, [href], [tabindex]:not([tabindex="-1"])'));
      if (items.length === 0) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey ? (i <= 0 ? items.length - 1 : i - 1) : (i + 1) % items.length;
      e.preventDefault();
      items[next].focus();
    }
  };
  const release = (): void => window.removeEventListener('keydown', onKey, true);
  window.addEventListener('keydown', onKey, true);
  return release;
}

/** Blocking first-play card. `onDone` fires once, on "확인" or Escape. */
export function buildControls(ctx: Ctx, onDone: () => void): HTMLElement {
  let done = false;
  let release = (): void => undefined;
  const close = ctx.tap(() => {
    if (done) return;
    done = true;
    release();
    onDone();
  });
  const ok = button({ label: '확인', variant: 'sun', size: 'lg', icon: icons.play(), cls: 'ctl__ok', onPress: close });
  const screen = h('section', { cls: 'screen screen--modal screen--controls', attrs: { role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'ctl-title' } }, [
    h('div', { cls: 'ctl card pop-in' }, [
      h('div', { cls: 'kicker', text: 'CONTROL SCHEME' }),
      h('h2', { cls: 'ctl__title', text: '양손 조작 체계', attrs: { id: 'ctl-title' } }),
      controlsDiagram(),
      keyLine(),
      ok,
    ]),
  ]);
  release = trapKeys(screen, close);
  // focus once mounted so Enter/Space confirm and screen readers land on the action
  requestAnimationFrame(() => ok.focus({ preventScroll: true }));
  return screen;
}
