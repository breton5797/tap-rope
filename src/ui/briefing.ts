// Classified dossier ("MISSION BRIEFING") with a zone photo strip and a typewriter reveal. Non-blocking.
import { CHAPTERS } from '../core/content';
import { h } from './dom';
import { icons } from './icons';
import { zoneArt } from './zone-art';

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
        h('div', { cls: 'brief__photo' }, [zoneArt(c.id), h('span', { cls: 'brief__photo-tag mono', text: `ZONE ${zone} // SURVEILLANCE` })]),
        h('span', { cls: 'brief__stamp', text: 'TOP SECRET' }),
        h('div', { cls: 'brief__head' }, [
          h('span', { cls: 'brief__kicker' }, [icons.book(), h('span', { text: 'CLASSIFIED' })]),
          h('span', { cls: 'brief__part mono', text: c.part === 1 ? 'PHASE 1 · 구출' : 'PHASE 2 · 탈출' }),
        ]),
        h('h2', { cls: 'brief__zone' }, [h('span', { cls: 'brief__no mono', text: `ZONE ${zone}` }), c.name]),
        text,
        h('div', { cls: 'brief__foot', text: `발신: 작전 본부 // ${c.subtitle}` }),
      ]),
    ]),
  );
  typewrite(text, c.briefing, reduced);
}
