// Classified dossier ("MISSION BRIEFING") with a zone photo strip and a typewriter reveal. Non-blocking.
import { CHAPTERS } from '../core/content';
import { COPY, fillCopy, stageVars } from '../flavor';
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
  const zone = fillCopy(COPY.zoneTag, stageVars({ chapter: c.id, index: 0 }));
  layer.replaceChildren(
    h('div', { cls: `brief brief--p${c.part}`, attrs: { role: 'status' } }, [
      h('div', { cls: 'brief__card' }, [
        h('div', { cls: 'brief__photo' }, [zoneArt(c.id), h('span', { cls: 'brief__photo-tag mono', text: `${zone} // ${COPY.briefTag}` })]),
        h('span', { cls: 'brief__stamp', text: COPY.briefStamp }),
        h('div', { cls: 'brief__head' }, [
          h('span', { cls: 'brief__kicker' }, [icons.book(), h('span', { text: COPY.briefKicker })]),
          h('span', { cls: 'brief__part mono', text: c.part === 1 ? COPY.briefPart1 : COPY.briefPart2 }),
        ]),
        h('h2', { cls: 'brief__zone' }, [h('span', { cls: 'brief__no mono', text: zone }), c.name]),
        text,
        h('div', { cls: 'brief__foot', text: `${COPY.briefFrom} // ${c.subtitle}` }),
      ]),
    ]),
  );
  typewrite(text, c.briefing, reduced);
}
