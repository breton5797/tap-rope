// UI root: owns the overlay layers and routes between screens.
import type { HudState, ResultInfo, SaveData, Settings, Ui, UiCallbacks } from '../types';
import { buildAchievements, buildArchive } from './archive';
import { buildCutscene } from './cutscene';
import { buildLeaderboard } from './leaderboard';
import { buildNickname } from './nickname';
import { buildPicker } from './picker';
import { h, holdFocus, swallowInput, type Ctx } from './dom';
import { createHud } from './hud';
import { renderBriefing } from './briefing';
import { buildControls } from './controls';
import { buildGuide } from './guide';
import { renderLoading } from './loading';
import {
  buildPause, renderBossLine, renderCountdown, renderTutorial, renderTutorialStop, showAchievementBanner, showToast,
} from './overlays';
import { createToastQueue } from './toast-queue';
import { buildResult, patchOnline, resultKey } from './result';
import { buildSettings } from './settings';
import { buildShop } from './shop';
import { buildStageSelect } from './stages';
import { buildTitle } from './title';

/** v8 (A6): screens that are modal dialogs take focus when mounted */
const MODALS = new Set(['pause', 'result', 'controls', 'picker']);

interface Layers {
  readonly screen: HTMLElement;
  readonly hud: HTMLElement;
  readonly fx: HTMLElement;
  readonly tutorial: HTMLElement;
  readonly briefing: HTMLElement;
  readonly toast: HTMLElement;
  readonly loading: HTMLElement;
  /** v7: modal cards over any screen (nickname) */
  readonly overlay: HTMLElement;
  /** v7: full-screen cutscene player */
  readonly cutscene: HTMLElement;
}

function createLayers(root: HTMLElement): Layers {
  const layers: Layers = {
    hud: h('div', { cls: 'layer layer--hud', attrs: { hidden: '' } }),
    fx: h('div', { cls: 'layer layer--fx', attrs: { 'aria-live': 'assertive' } }),
    tutorial: h('div', { cls: 'layer layer--tutorial', attrs: { 'aria-live': 'polite' } }),
    briefing: h('div', { cls: 'layer layer--briefing', attrs: { 'aria-live': 'polite' } }),
    screen: h('div', { cls: 'layer layer--screen' }),
    toast: h('div', { cls: 'layer layer--toast', attrs: { 'aria-live': 'polite' } }),
    loading: h('div', { cls: 'layer layer--loading' }),
    overlay: h('div', { cls: 'layer layer--overlay' }),
    cutscene: h('div', { cls: 'layer layer--cutscene' }),
  };
  swallowInput(layers.loading);
  swallowInput(layers.screen);
  root.replaceChildren(layers.hud, layers.briefing, layers.fx, layers.tutorial, layers.screen, layers.overlay, layers.cutscene, layers.toast, layers.loading);
  return layers;
}

function prefersReducedMotion(root: HTMLElement): boolean {
  if (root.closest('.reduced-motion')) return true;
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

interface Shared {
  readonly layers: Layers;
  readonly ctx: Ctx;
  mount(el: HTMLElement | null, name: string): void;
  setHud(visible: boolean): void;
}

type MenuUi = Pick<Ui, 'showTitle' | 'showStageSelect' | 'showShop' | 'showSettings' | 'showArchive' | 'showAchievements' | 'showLeaderboard'>;
type GameUi = Omit<Ui, keyof MenuUi>;

function menuScreens({ layers, ctx, mount, setHud }: Shared): MenuUi {
  let save: SaveData | null = null;
  const remember = (s: SaveData): SaveData => {
    save = s;
    setHud(false);
    return s;
  };
  const localSettings = (s: Settings): void => {
    if (save) save = { ...save, settings: s };
  };
  const back = (): void => {
    if (save) menu.showTitle(save);
  };
  const nav = {
    toStages: () => save && menu.showStageSelect(save),
    toShop: () => save && menu.showShop(save),
    toSettings: () => save && menu.showSettings(save),
    toArchive: () => ctx.cb.onOpenArchive(),
    toAchievements: () => ctx.cb.onOpenAchievements(),
    toLeaderboard: () => ctx.cb.onOpenLeaderboard('endless'),
    toGuide: () => {
      // overlays the title instead of replacing it, so closing needs no rebuild
      const sheet = buildGuide(ctx, () => sheet.remove());
      layers.screen.appendChild(sheet);
    },
  };
  const menu: MenuUi = {
    showTitle: (s) => mount(buildTitle(ctx, remember(s), nav), 'title'),
    showStageSelect: (s) => mount(buildStageSelect(ctx, remember(s), back), 'stages'),
    showShop: (s) => mount(buildShop(ctx, remember(s), back, (n) => { save = n; }), 'shop'),
    showSettings: (s) => mount(buildSettings(ctx, remember(s), back, localSettings), 'settings'),
    showArchive: (s) => mount(buildArchive(ctx, remember(s), back), 'archive'),
    showAchievements: (s) => mount(buildAchievements(ctx, remember(s), back), 'achievements'),
    showLeaderboard: (board, data) => {
      setHud(false);
      mount(buildLeaderboard(ctx, board, data, back), 'leaderboard');
    },
  };
  return menu;
}

function gameScreens({ layers, ctx, mount, setHud }: Shared): GameUi {
  const hud = createHud(ctx);
  // v8 (A6): achievement banners one at a time, held while the countdown / briefing / a cutscene is up
  const banners = createToastQueue((b) => showAchievementBanner(layers.toast, b));
  const busy = { countdown: false, briefing: false, cutscene: false };
  const setBusy = (key: keyof typeof busy, on: boolean): void => {
    busy[key] = on;
    banners.setBlocked(busy.countdown || busy.briefing || busy.cutscene);
  };
  /** the mounted report, so a follow-up showResult for the same run can patch it in place */
  let lastResult: { readonly key: string; readonly el: HTMLElement } | null = null;
  layers.hud.appendChild(hud.el);
  return {
    showHud() {
      mount(null, 'hud');
      hud.reset();
      setHud(true);
    },
    updateHud: (state: HudState) => hud.update(state),
    showPause: () => mount(buildPause(ctx, () => mount(null, 'hud')), 'pause'),
    showResult(r: ResultInfo) {
      const key = resultKey(r);
      if (lastResult && lastResult.key === key && layers.screen.contains(lastResult.el)) {
        patchOnline(lastResult.el, r); // v7: server answer for the same run — update the status line only
        return;
      }
      setHud(false);
      renderTutorial(layers.tutorial, ctx, null);
      renderBriefing(layers.briefing, null, true);
      setBusy('briefing', false);
      banners.clear(); // the report card shows this run's badges
      const el = buildResult(ctx, r);
      lastResult = { key, el };
      mount(el, 'result');
    },
    showTutorial: (step) => renderTutorial(layers.tutorial, ctx, step),
    showControls(onDone) {
      const card = buildControls(ctx, () => {
        if (layers.screen.firstElementChild === card) mount(null, layers.hud.hidden ? 'none' : 'hud');
        onDone();
      });
      mount(card, 'controls');
    },
    showBriefing(chapter) {
      setBusy('briefing', chapter !== null);
      renderBriefing(layers.briefing, chapter, ctx.reducedMotion());
    },
    showCountdown(n) {
      setBusy('countdown', n !== null);
      renderCountdown(layers.fx, n);
    },
    hideAll() {
      setHud(false);
      mount(null, 'none');
      renderCountdown(layers.fx, null);
      renderTutorial(layers.tutorial, ctx, null);
      renderBriefing(layers.briefing, null, true);
      setBusy('countdown', false);
      setBusy('briefing', false);
    },
    toast: (msg) => showToast(layers.toast, msg),
    toastAchievement: (a) => banners.push(a),
    showTutorialStop: (stop) => renderTutorialStop(layers.tutorial, stop),
    showBossLine: (kicker, text) => renderBossLine(layers.briefing, kicker, text),
    showCutscene(c, onDone) {
      setBusy('cutscene', true);
      const done = (): void => {
        setBusy('cutscene', false);
        onDone();
      };
      const player = buildCutscene(c, { reduced: ctx.reducedMotion(), onClick: () => ctx.cb.onUiClick() }, done);
      layers.cutscene.replaceChildren(player.el);
    },
    showNickname(current, onSubmit) {
      const card = buildNickname(ctx, current, onSubmit, () => card.remove());
      layers.overlay.replaceChildren(card);
    },
    showLoading: (progress) => renderLoading(layers.loading, progress),
    showPicker: (save, onPick) => mount(buildPicker(ctx, save, onPick), 'picker'),
  };
}

export function createUi(root: HTMLElement, cb: UiCallbacks): Ui {
  const layers = createLayers(root);
  const ctx: Ctx = {
    cb,
    tap: (fn) => () => {
      cb.onUiClick();
      fn();
    },
    reducedMotion: () => prefersReducedMotion(root),
  };
  const shared: Shared = {
    layers,
    ctx,
    mount(el, name) {
      layers.screen.dataset.screen = name;
      if (el) layers.screen.replaceChildren(el);
      else layers.screen.replaceChildren();
      if (el && MODALS.has(name)) holdFocus(el);
    },
    setHud(visible) {
      layers.hud.hidden = !visible;
      // v8 (A6): live regions stay quiet while playing (countdown, hints, banners would flood a screen reader)
      for (const el of [layers.fx, layers.tutorial, layers.briefing, layers.toast]) {
        if (!el.dataset.live) el.dataset.live = el.getAttribute('aria-live') ?? 'polite';
        el.setAttribute('aria-live', visible ? 'off' : el.dataset.live);
      }
    },
  };
  return { ...menuScreens(shared), ...gameScreens(shared) };
}
