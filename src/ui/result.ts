// Result screen: stars, score count-up, record ribbon, stats and confetti.
import { STAGES } from '../core/content';
import type { ResultInfo } from '../types';
import { button, formatNumber, h, type Ctx } from './dom';
import { icons } from './icons';

const CONFETTI_COLORS = ['#ff5da2', '#ffc93c', '#4fd8ff', '#2fd6a6', '#7b5cff', '#ff8a3d'] as const;
const COUNT_MS = 1100;

function confetti(): HTMLElement {
  const pieces = Array.from({ length: 42 }, (_, i) =>
    h('i', {
      cls: `confetti__p confetti__p--${i % 3}`,
      style: {
        left: `${(i * 37) % 100}%`,
        background: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        'animation-delay': `${((i * 53) % 900) / 1000}s`,
        'animation-duration': `${2.2 + ((i * 29) % 140) / 100}s`,
        '--drift': `${((i * 41) % 120) - 60}px`,
        '--spin': `${360 + ((i * 67) % 540)}deg`,
      },
    }),
  );
  return h('div', { cls: 'confetti', attrs: { 'aria-hidden': 'true' } }, pieces);
}

function stars(n: number): HTMLElement {
  return h(
    'div',
    { cls: 'result__stars', attrs: { 'aria-label': `별 ${n}개` } },
    [0, 1, 2].map((i) =>
      h('span', { cls: `rstar rstar--${i}${i < n ? ' is-on' : ''}`, style: { 'animation-delay': `${0.35 + i * 0.28}s` } }, [icons.star()]),
    ),
  );
}

function countUp(el: HTMLElement, target: number, reduced: boolean): void {
  if (reduced || target <= 0 || typeof requestAnimationFrame !== 'function') {
    el.textContent = formatNumber(target);
    return;
  }
  const start = performance.now() + 250;
  const tick = (now: number): void => {
    const t = Math.max(0, Math.min(1, (now - start) / COUNT_MS));
    const eased = 1 - Math.pow(1 - t, 3);
    el.textContent = formatNumber(target * eased);
    if (t < 1 && el.isConnected) requestAnimationFrame(tick);
  };
  el.textContent = '0';
  requestAnimationFrame(tick);
}

function statTile(label: string, value: number, cls: string): HTMLElement {
  return h('div', { cls: `stat ${cls}` }, [
    h('span', { cls: 'stat__value', text: formatNumber(value) }),
    h('span', { cls: 'stat__label', text: label }),
  ]);
}

function headline(r: ResultInfo): { kicker: string; title: string; tone: string } {
  if (r.mode !== 'stage') {
    return { kicker: r.title, title: r.newRecord ? '최고 기록!' : 'GAME OVER', tone: r.newRecord ? 'win' : 'lose' };
  }
  return r.cleared
    ? { kicker: r.title, title: 'STAGE CLEAR!', tone: 'win' }
    : { kicker: r.title, title: '아쉬워요!', tone: 'lose' };
}

/** Banner shown after beating a chapter's boss stage. */
function chapterClear(r: ResultInfo): HTMLElement | null {
  const stage = STAGES.find((s) => s.id === r.stageId);
  if (r.mode !== 'stage' || !r.cleared || stage?.kind !== 'boss') return null;
  return h('div', { cls: 'chapter-clear' }, [
    h('span', { cls: 'chapter-clear__ribbon' }, [icons.crown(), h('span', { text: '챕터 클리어!' })]),
    h('span', { cls: 'chapter-clear__line' }, [
      r.hasNext ? icons.unlock() : icons.star(),
      h('span', { text: r.hasNext ? `다음 월드 열림 · WORLD ${stage.chapter + 2}` : '모든 월드 클리어! 최고예요!' }),
    ]),
  ]);
}

function actions(ctx: Ctx, r: ResultInfo): HTMLElement {
  const next =
    r.mode === 'stage' && r.cleared && r.hasNext
      ? button({ label: '다음 스테이지', variant: 'sun', size: 'lg', icon: icons.next(), onPress: ctx.tap(() => ctx.cb.onNextStage()) })
      : null;
  const retry = button({
    label: '다시하기',
    variant: next ? 'sky' : 'sun',
    size: next ? 'md' : 'lg',
    icon: icons.retry(),
    onPress: ctx.tap(() => ctx.cb.onRetry()),
  });
  const quit = button({
    label: r.mode !== 'stage' ? '메뉴로' : next ? '스테이지' : '스테이지 선택',
    variant: 'glass',
    icon: icons.grid(),
    aria: r.mode === 'stage' ? '스테이지 선택' : '메뉴로',
    onPress: ctx.tap(() => ctx.cb.onQuit()),
  });
  return next ? h('div', { cls: 'stack' }, [next, h('div', { cls: 'row' }, [retry, quit])]) : h('div', { cls: 'stack' }, [retry, quit]);
}

export function buildResult(ctx: Ctx, r: ResultInfo): HTMLElement {
  const head = headline(r);
  const reduced = ctx.reducedMotion();
  const score = h('div', { cls: 'result__score' });
  countUp(score, r.score, reduced);
  const win = head.tone === 'win';
  const card = h('div', { cls: `result card pop-in result--${head.tone}` }, [
    h('div', { cls: 'result__kicker', text: head.kicker }),
    h('h2', { cls: 'result__title', text: head.title }),
    chapterClear(r),
    r.mode === 'stage' ? stars(r.stars) : h('div', { cls: 'result__trophy' }, [icons.infinity()]),
    h('div', { cls: 'result__scorebox' }, [
      r.newRecord ? h('div', { cls: 'ribbon', text: 'NEW RECORD' }) : null,
      h('div', { cls: 'result__label', text: 'SCORE' }),
      score,
      h('div', { cls: 'result__best', text: `최고 기록 ${formatNumber(Math.max(r.best, r.score))}` }),
    ]),
    h('div', { cls: 'stats' }, [
      statTile('PERFECT', r.perfects, 'stat--perfect'),
      statTile('GOOD', r.goods, 'stat--good'),
      statTile('MISS', r.misses, 'stat--miss'),
      statTile('최대 콤보', r.maxCombo, 'stat--combo'),
      h('div', { cls: 'stat stat--coin' }, [
        h('span', { cls: 'stat__value' }, [icons.coin(), h('span', { text: `+${formatNumber(r.coinsEarned)}` })]),
        h('span', { cls: 'stat__label', text: '코인' }),
      ]),
    ]),
    actions(ctx, r),
  ]);
  return h('section', { cls: `screen screen--modal screen--result${win ? ' is-win' : ''}`, attrs: { 'aria-label': '결과' } }, [
    win && !reduced ? confetti() : null,
    card,
  ]);
}
