// Office character cards (v2.2 spec §3), swapped in for src/ui/hero-card.ts: the type tag, one-line blurb,
// five star bars and catchphrase under a hire's name (picker + character room), and the hire's portrait on
// the result card. Portraits are ./art/op-<id>.webp over the vector avatar, so missing art still shows a figure.
import type { SkinId } from '../../types';
import { h } from '../../ui/dom';
import { portrait } from '../../ui/shop';
import { STAR_AXES, characterFor, type Character } from '../core/characters';

const MAX_STARS = 5;

function starRow(label: string, n: number): HTMLElement {
  const pips = Array.from({ length: MAX_STARS }, (_, i) => h('i', { cls: `hero-stars__pip${i < n ? ' is-on' : ''}` }));
  return h('li', { cls: 'hero-stars__row', attrs: { 'aria-label': `${label} ${n}/${MAX_STARS}` } }, [
    h('span', { cls: 'hero-stars__label', text: label }),
    h('span', { cls: 'hero-stars__bar', attrs: { 'aria-hidden': 'true' } }, pips),
  ]);
}

export function heroStars(c: Character): HTMLElement {
  return h('ul', { cls: 'hero-stars' }, STAR_AXES.map((a) => starRow(a.label, c.stars[a.key])));
}

export function heroDetails(id: SkinId): HTMLElement {
  const c = characterFor(id);
  return h('div', { cls: 'hero-card__info', style: { '--accent': c.accent } }, [
    h('div', { cls: 'hero-card__role', text: c.role }),
    h('p', { cls: 'hero-card__blurb', text: c.blurb }),
    heroStars(c),
    h('p', { cls: 'hero-card__quote', text: `“${c.catchphrase}”` }),
  ]);
}

export function resultHero(skin: SkinId | undefined): HTMLElement | null {
  if (!skin) return null;
  const c = characterFor(skin);
  return h('div', { cls: 'report__hero', style: { '--accent': c.accent } }, [
    portrait(c.id, 'portrait--result'),
    h('div', { cls: 'report__hero-text' }, [
      h('span', { cls: 'report__hero-role', text: c.role }),
      h('span', { cls: 'report__hero-name', text: c.name }),
    ]),
  ]);
}
