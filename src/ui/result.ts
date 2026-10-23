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

function headline(r: ResultInfo): { kicker: string; title: string; tone: string; sub?: string } {
  if (r.mode !== 'stage') {
    return { kicker: r.title, title: r.newRecord ? '최고 기록!' : '작전 종료', tone: r.newRecord ? 'win' : 'lose' };
  }
  return r.cleared
    ? { kicker: r.title, title: 'MISSION CLEAR!', tone: 'win' }
    : { kicker: '작전 실패', title: '아쉬워요!', tone: 'lose', sub: r.title };
}

interface StoryBeat {
  readonly ribbon: string;
  readonly line: string;
  readonly icon: () => SVGElement;
}

/** Story banner after a boss: rescue (zone 5), final escape (zone 10), or the next zone opening. */
function storyBeat(r: ResultInfo): StoryBeat | null {
  const stage = STAGES.find((s) => s.id === r.stageId);
  if (r.mode !== 'stage' || !r.cleared || stage?.kind !== 'boss') return null;
  if (r.stageId === 'w5-s10') return { ribbon: '포로 구출 성공!', line: '2부 탈출작전 개시 · ZONE 06', icon: icons.unlock };
  if (r.stageId === 'w10-s10' || !r.hasNext) return { ribbon: '탈출 성공! 임무 완료', line: '모든 작전 완료! 최고의 요원이에요', icon: icons.star };
  return { ribbon: '구역 돌파!', line: `다음 구역 열림 · ZONE ${String(stage.chapter + 2).padStart(2, '0')}`, icon: icons.unlock };
}

function chapterClear(r: ResultInfo): HTMLElement | null {
  const beat = storyBeat(r);
  if (!beat) return null;
  return h('div', { cls: 'chapter-clear' }, [
    h('span', { cls: 'chapter-clear__ribbon' }, [icons.crown(), h('span', { text: beat.ribbon })]),
    h('span', { cls: 'chapter-clear__line' }, [beat.icon(), h('span', { text: beat.line })]),
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
    label: r.mode !== 'stage' ? '메뉴로' : '작전 지도',
    variant: 'glass',
    icon: icons.grid(),
    aria: r.mode === 'stage' ? '작전 지도' : '메뉴로',
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
    head.sub ? h('div', { cls: 'result__sub', text: head.sub }) : null,
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
