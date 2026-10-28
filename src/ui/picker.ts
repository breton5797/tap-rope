// First-run character picker (FEATURES.firstRunPick): one portrait card per owned character; a tap picks it.
// Portraits are ./art/op-<skin>.webp over the vector avatar (shop.ts), so missing art still shows a figure.
import { SKINS } from '../core/content';
import { COPY } from '../flavor';
import type { SaveData, SkinId } from '../types';
import { h, type Ctx } from './dom';
import { portrait } from './shop';

export function buildPicker(ctx: Ctx, save: SaveData, onPick: (id: SkinId) => void): HTMLElement {
  const picks = SKINS.filter((s) => save.ownedSkins.includes(s.id)).map((s) => {
    const el = h('button', { cls: `skin card picker__pick${save.skin === s.id ? ' is-selected' : ''}`, attrs: { type: 'button', 'aria-label': s.name } }, [
      h('div', { cls: 'skin__art' }, [portrait(s.id, 'portrait--card')]),
      h('div', { cls: 'skin__name', text: s.name }),
    ]);
    el.addEventListener('click', ctx.tap(() => onPick(s.id)));
    return el;
  });
  return h('section', { cls: 'screen screen--modal screen--picker', attrs: { 'aria-label': COPY.pickTitle, role: 'dialog', 'aria-modal': 'true' } }, [
    h('div', { cls: 'modal modal--picker card pop-in' }, [
      h('div', { cls: 'kicker', text: COPY.pickKicker }),
      h('h2', { cls: 'modal__title', text: COPY.pickTitle }),
      h('p', { cls: 'modal__text', text: COPY.pickHint }),
      h('div', { cls: 'picker__grid' }, picks),
    ]),
  ]);
}
