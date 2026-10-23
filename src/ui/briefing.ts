// "MISSION BRIEFING" dossier card with a typewriter reveal. Non-blocking (pointer-events none).
import { CHAPTERS } from '../core/content';
import { h } from './dom';
import { icons } from './icons';

const TYPE_MS = 34;
let typing: ReturnType<typeof setInterval> | null = null;

function stopTyping(): void {
  if (typing !== null) clearInterval(typing);
  typing = null;
}

function typewrite(el: HTMLElement, text: string, reduced: boolean): void {
  if (reduced) {
    el.textContent = text;
    return;
  }
  const chars = Array.from(text);
  let shown = 0;
  el.textContent = '';
  typing = setInterval(() => {
    shown += 1;
    el.textContent = chars.slice(0, shown).join('');
    if (shown >= chars.length) {
      stopTyping();
      el.classList.add('is-done');
    }
  }, TYPE_MS);
}

export function renderBriefing(layer: HTMLElement, chapter: number | null, reduced: boolean): void {
  stopTyping();
  const c = chapter === null ? undefined : CHAPTERS[chapter];
  if (!c) {
    layer.replaceChildren();
    return;
  }
  const text = h('p', { cls: 'brief__text', attrs: { 'aria-label': c.briefing } });
  const zone = String(c.id + 1).padStart(2, '0');
  layer.replaceChildren(
    h('div', { cls: `brief brief--p${c.part}`, attrs: { role: 'status' } }, [
      h('div', { cls: 'brief__card' }, [
        h('span', { cls: 'brief__clip' }),
        h('span', { cls: 'brief__stamp', text: 'TOP SECRET' }),
        h('div', { cls: 'brief__head' }, [
          h('span', { cls: 'brief__kicker' }, [icons.book(), h('span', { text: 'MISSION BRIEFING' })]),
          h('span', { cls: 'brief__part', text: c.part === 1 ? '1부 · 구출' : '2부 · 탈출' }),
        ]),
        h('h2', { cls: 'brief__zone' }, [h('span', { cls: 'brief__no', text: `ZONE ${zone}` }), c.name]),
        text,
        h('div', { cls: 'brief__foot', text: `— 본부 · ${c.subtitle}` }),
      ]),
    ]),
  );
  typewrite(text, c.briefing, reduced);
}
