// UI root: owns the overlay layers and routes between screens.
import type { HudState, ResultInfo, SaveData, Settings, Ui, UiCallbacks } from '../types';
import { h, swallowInput, type Ctx } from './dom';
import { createHud } from './hud';
import { renderBriefing } from './briefing';
import { buildControls } from './controls';
import { buildGuide } from './guide';
import { buildPause, renderCountdown, renderTutorial, showToast } from './overlays';
import { buildResult } from './result';
import { buildSettings } from './settings';
import { buildShop } from './shop';
import { buildStageSelect } from './stages';
import { buildTitle } from './title';

interface Layers {
  readonly screen: HTMLElement;
  readonly hud: HTMLElement;
  readonly fx: HTMLElement;
  readonly tutorial: HTMLElement;
  readonly briefing: HTMLElement;
  readonly toast: HTMLElement;
}

function createLayers(root: HTMLElement): Layers {
  const layers: Layers = {
    hud: h('div', { cls: 'layer layer--hud', attrs: { hidden: '' } }),
    fx: h('div', { cls: 'layer layer--fx', attrs: { 'aria-live': 'assertive' } }),
    tutorial: h('div', { cls: 'layer layer--tutorial', attrs: { 'aria-live': 'polite' } }),
    briefing: h('div', { cls: 'layer layer--briefing', attrs: { 'aria-live': 'polite' } }),
    screen: h('div', { cls: 'layer layer--screen' }),
    toast: h('div', { cls: 'layer layer--toast', attrs: { 'aria-live': 'polite' } }),
  };
  swallowInput(layers.screen);
  root.replaceChildren(layers.hud, layers.briefing, layers.fx, layers.tutorial, layers.screen, layers.toast);
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

type MenuUi = Pick<Ui, 'showTitle' | 'showStageSelect' | 'showShop' | 'showSettings'>;
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
    toGuide: () => {
      // overlays the title instead of replacing it, so closing needs no rebuild
      const sheet = buildGuide(ctx, () => sheet.remove());
      layers.screen.appendChild(sheet);
    },
  };
  const menu: MenuUi = {
    showTitle: (s) => mount(buildTitle(ctx, remember(s), nav), 'title'),
    showStageSelect: (s) => mount(buildStageSelect(ctx, remember(s), back), 'stages'),
    showShop: (s) => mount(buildShop(ctx, remember(s), back), 'shop'),
    showSettings: (s) => mount(buildSettings(ctx, remember(s), back, localSettings), 'settings'),
  };
  return menu;
}

function gameScreens({ layers, ctx, mount, setHud }: Shared): GameUi {
  const hud = createHud(ctx);
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
      setHud(false);
      renderTutorial(layers.tutorial, ctx, null);
      renderBriefing(layers.briefing, null, true);
      mount(buildResult(ctx, r), 'result');
    },
    showTutorial: (step) => renderTutorial(layers.tutorial, ctx, step),
    showControls(onDone) {
      const card = buildControls(ctx, () => {
        if (layers.screen.firstElementChild === card) mount(null, layers.hud.hidden ? 'none' : 'hud');
        onDone();
      });
      mount(card, 'controls');
    },
    showBriefing: (chapter) => renderBriefing(layers.briefing, chapter, ctx.reducedMotion()),
    showCountdown: (n) => renderCountdown(layers.fx, n),
    hideAll() {
      setHud(false);
      mount(null, 'none');
      renderCountdown(layers.fx, null);
      renderTutorial(layers.tutorial, ctx, null);
      renderBriefing(layers.briefing, null, true);
    },
    toast: (msg) => showToast(layers.toast, msg),
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
    },
    setHud(visible) {
      layers.hud.hidden = !visible;
    },
  };
  return { ...menuScreens(shared), ...gameScreens(shared) };
}
