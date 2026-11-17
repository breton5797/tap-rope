// 칼퇴 패스 card at the foot of 사원 복지몰 (monetization spec §2): what it gives in plain words, the store price,
// buy / restore, and the ad privacy choices. A calm card — no countdown, no "limited", no pop-up (P4).
import { button, h, type Ctx } from '../../../ui/dom';
import { MON_COPY, fillMon } from '../../monetization/copy';
import type { Monetization } from '../../monetization/index';

export interface PassCardDeps {
  readonly m: Monetization;
  /** the pass became owned (buy / restore): grant its exclusive cosmetic and redraw */
  readonly onOwned: () => void;
}

const BUY_NOTE = { bought: MON_COPY.passBought, pending: MON_COPY.passPending, cancelled: MON_COPY.passCancelled, failed: MON_COPY.passFailed } as const;

export function passCard(ctx: Ctx, d: PassCardDeps): HTMLElement | null {
  if (!d.m.passAvailable) return null;
  const card = h('section', { cls: 'pass-card card', attrs: { 'aria-label': MON_COPY.passTitle } });
  const note = h('p', { cls: 'pass-card__note', attrs: { role: 'status', 'aria-live': 'polite' } });
  let busy = false;

  const act = (fn: () => Promise<string>): void => {
    if (busy) return;
    busy = true;
    render();
    void fn().then((msg) => {
      busy = false;
      note.textContent = msg;
      if (d.m.passOwned()) d.onOwned();
      render();
    });
  };

  const render = (): void => {
    const owned = d.m.passOwned();
    const price = d.m.passPrice();
    const buy = owned
      ? h('span', { cls: 'pass-card__owned', text: MON_COPY.passOwned })
      : button({
        label: price ? fillMon(MON_COPY.passBuy, { price }) : MON_COPY.passBuyNoPrice, variant: 'sun', size: 'sm', cls: 'pass-card__buy',
        onPress: ctx.tap(() => act(async () => BUY_NOTE[await d.m.buyPass()])),
      });
    const restore = button({
      label: MON_COPY.passRestore, variant: 'glass', size: 'sm', cls: 'pass-card__restore',
      onPress: ctx.tap(() => act(async () => ((await d.m.restorePass()) ? MON_COPY.passRestored : MON_COPY.passNotFound))),
    });
    const privacy = d.m.available
      ? button({ label: MON_COPY.privacy, variant: 'ghost', size: 'sm', cls: 'pass-card__privacy', onPress: ctx.tap(() => void d.m.privacyOptions()) })
      : null;
    for (const b of [buy, restore]) if (busy && b instanceof HTMLButtonElement) b.disabled = true;
    card.replaceChildren(
      h('h3', { cls: 'pass-card__title', text: MON_COPY.passTitle }),
      h('p', { cls: 'pass-card__body', text: MON_COPY.passBody }),
      h('ul', { cls: 'pass-card__perks' }, MON_COPY.passPerks.map((p) => h('li', { text: p }))),
      h('div', { cls: 'pass-card__row' }, [buy, restore]),
      note,
      ...(privacy ? [privacy] : []),
    );
  };

  render();
  void d.m.ready.then(render);
  return card;
}
