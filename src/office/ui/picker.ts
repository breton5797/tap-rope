// Office character picker (v2.2 spec §3), swapped in for src/ui/picker.ts: four hire cards (key art, name, type
// tag, blurb, five star bars, catchphrase). A tap selects (the card grows and its catchphrase pops as a speech
// bubble, the `perfect` sound plays); the confirm button hires the selected one (`mission-ok`). Starts on the
// saved hire. The selected card also plays the hero's run cycle (run-preview.ts).
import { SKINS } from '../../core/content';
import { COPY } from '../../flavor';
import type { SaveData, SkinId } from '../../types';
import { button, h, type Ctx } from '../../ui/dom';
import { portrait } from '../../ui/shop';
import { characterFor } from '../core/characters';
import { heroDetails } from './hero-card';
import { createRunPreview } from './run-preview';

const confirmLabel = (id: SkinId): string => `${characterFor(id).name}(으)로 출근!`;

export function buildPicker(ctx: Ctx, save: SaveData, onPick: (id: SkinId) => void): HTMLElement {
  const hires = SKINS.filter((s) => save.ownedSkins.includes(s.id));
  let chosen: SkinId = hires.some((s) => s.id === save.skin) ? save.skin : hires[0]?.id ?? 'kid';
  const confirm = button({ label: confirmLabel(chosen), variant: 'sun', size: 'lg', cls: 'picker__confirm', onPress: ctx.tap(() => {
    ctx.cb.onUiSfx?.('mission-ok');
    onPick(chosen);
  }) });
  const confirmText = confirm.querySelector('.btn__label');
  const preview = createRunPreview({ reduced: () => ctx.reducedMotion() });
  const cards = hires.map((s) => {
    const el = h('button', {
      cls: 'skin card picker__pick hero-card',
      style: { '--accent': characterFor(s.id).accent },
      attrs: { type: 'button', 'aria-label': s.name, 'data-hire': s.id },
    }, [
      h('div', { cls: 'skin__art' }, [portrait(s.id, 'portrait--card')]),
      h('div', { cls: 'hero-card__body' }, [h('div', { cls: 'skin__name', text: s.name }), heroDetails(s.id)]),
    ]);
    el.addEventListener('click', ctx.tap(() => {
      ctx.cb.onUiSfx?.('perfect');
      select(s.id);
    }));
    return el;
  });
  const select = (id: SkinId): void => {
    chosen = id;
    cards.forEach((c) => {
      const on = c.dataset.hire === id;
      c.classList.toggle('is-selected', on);
      c.setAttribute('aria-pressed', String(on));
      if (on) c.append(preview.el);
    });
    preview.show(id);
    if (confirmText) confirmText.textContent = confirmLabel(id);
    confirm.setAttribute('aria-label', confirmLabel(id));
  };
  select(chosen);
  return h('section', { cls: 'screen screen--modal screen--picker', attrs: { 'aria-label': COPY.pickTitle, role: 'dialog', 'aria-modal': 'true' } }, [
    h('div', { cls: 'modal modal--picker card pop-in' }, [
      h('div', { cls: 'kicker', text: COPY.pickKicker }),
      h('h2', { cls: 'modal__title', text: COPY.pickTitle }),
      h('p', { cls: 'modal__text', text: COPY.pickHint }),
      h('div', { cls: 'picker__grid picker__grid--hires' }, cards),
      confirm,
    ]),
  ]);
}
