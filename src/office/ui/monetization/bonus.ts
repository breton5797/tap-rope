// The result card's rewarded bonus (monetization spec §1): a clearly labelled, optional button — the run's own
// rewards are already paid, and nothing changes if the player ignores it. The points go into the CURRENT main
// save through UiCallbacks.onMetaUpdate. Hidden in builds without ads / purchases and when no offer applies.
import { button, h, type Ctx } from '../../../ui/dom';
import { createHaptics } from '../../../platform/haptics';
import type { ResultInfo } from '../../../types';
import { parseDailyId, todayKey } from '../../core/live';
import { MON_COPY, fillMon } from '../../monetization/copy';
import type { Monetization, Offer } from '../../monetization/index';
import { bonusPlacement } from '../../monetization/placement';
import { monetization } from '../../monetization/runtime';

const haptics = createHaptics();

/** the one-time notice before the first ad (security review N2): kept on the device only */
const NOTICE_KEY = 'officeescape.adnotice.v1';
const noticeSeen = (): boolean => {
  try {
    return globalThis.localStorage?.getItem(NOTICE_KEY) === '1';
  } catch {
    return false;
  }
};
const markNotice = (): void => {
  try {
    globalThis.localStorage?.setItem(NOTICE_KEY, '1');
  } catch {
    /* asks again next time */
  }
};

function label(o: Offer, placement: 'daily' | 'stage'): string {
  const key = o.kind === 'pass' ? (placement === 'daily' ? 'passDaily' : 'passStage') : placement === 'daily' ? 'adDaily' : 'adStage';
  return fillMon(MON_COPY[key], { points: o.points });
}

export function adBonus(ctx: Ctx, r: ResultInfo, m: Monetization = monetization(), now: Date = new Date()): HTMLElement | null {
  const placement = bonusPlacement(r);
  if (!placement || !m.available) return null;
  const date = (placement === 'daily' && r.stageId ? parseDailyId(r.stageId)?.date : null) ?? todayKey(now);
  const box = h('div', { cls: 'ad-bonus', attrs: { role: 'group', 'aria-label': '보너스' } });
  const note = h('p', { cls: 'ad-bonus__note', attrs: { role: 'status', 'aria-live': 'polite' } });
  let busy = false;
  let done = false;
  /** the first-ad notice is on screen */
  let asking = false;

  const render = (): void => {
    const o = m.offer(placement, date);
    if (done || (o.kind === 'none' && o.reason !== 'limit')) {
      box.replaceChildren(note);
      box.hidden = note.textContent === '';
      return;
    }
    box.hidden = false;
    if (o.kind === 'none') {
      note.textContent = MON_COPY.limit;
      box.replaceChildren(note);
      return;
    }
    if (asking) {
      box.replaceChildren(
        h('p', { cls: 'ad-bonus__notice', text: MON_COPY.noticeText }),
        button({ label: MON_COPY.noticeOk, variant: 'mint', size: 'sm', cls: 'ad-bonus__ok', onPress: ctx.tap(() => { asking = false; markNotice(); void run(); }) }),
        button({ label: MON_COPY.noticeCancel, variant: 'glass', size: 'sm', cls: 'ad-bonus__cancel', onPress: ctx.tap(() => { asking = false; render(); }) }),
      );
      return;
    }
    const count = placement === 'stage' ? h('span', { cls: 'ad-bonus__count mono', text: fillMon(MON_COPY.todayCount, { used: o.used, limit: o.limit }) }) : null;
    const b = button({ label: busy ? MON_COPY.loading : label(o, placement), variant: 'mint', size: 'sm', cls: 'ad-bonus__btn', onPress: ctx.tap(() => void start(o.kind === 'ad')) });
    if (busy) b.setAttribute('disabled', '');
    box.replaceChildren(b, ...(count ? [count] : []), note);
  };

  const start = (withAd: boolean): void => {
    if (withAd && !noticeSeen()) {
      asking = true;
      render();
      return;
    }
    void run();
  };

  const run = async (): Promise<void> => {
    if (busy || done) return;
    busy = true;
    note.textContent = '';
    render();
    const res = await m.claim(placement, date);
    busy = false;
    if (res.result === 'granted') {
      const saved = ctx.cb.onMetaUpdate?.((cur) => ({ ...cur, coins: cur.coins + res.points })) ?? null;
      if (saved) {
        note.textContent = fillMon(MON_COPY.granted, { points: res.points });
        done = true;
        // the reward can come while the ad is still up: the celebration waits until it is closed
        void m.afterAd().then(() => {
          haptics.vibrate([18, 40, 28]);
          ctx.cb.onUiSfx?.('powerup');
        });
      } else {
        // the points were not written: give the grant back so it can be earned again
        res.undo();
        note.textContent = MON_COPY.saveFailed;
      }
    } else {
      note.textContent = res.result === 'skipped' ? MON_COPY.skipped : MON_COPY.unavailable;
    }
    render();
  };

  render();
  void m.ready.then(render);
  return box;
}
