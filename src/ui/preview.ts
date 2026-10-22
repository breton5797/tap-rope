// Visual QA harness for the UI layer (ui-preview.html?screen=...). Not shipped.
import '../styles/main.css';
import { defaultSave } from '../core/storage';
import type { HudState, MoveId, ResultInfo, SaveData, UiCallbacks } from '../types';
import { createUi } from './index';
import { createAudio } from '../audio/index';
import type { SfxName } from '../types';

const params = new URLSearchParams(location.search);
const screen = params.get('screen') ?? 'title';
const app = document.getElementById('app') as HTMLElement;
if (params.get('reduced') === '1') app.classList.add('reduced-motion');

function paintBackdrop(): void {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  canvas.width = innerWidth;
  canvas.height = innerHeight;
  const sky = ctx.createLinearGradient(0, 0, 0, innerHeight);
  sky.addColorStop(0, '#7fd3ff');
  sky.addColorStop(0.7, '#c9f0ff');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  ctx.fillStyle = '#5ccf6e';
  ctx.fillRect(0, innerHeight * 0.73, innerWidth, innerHeight);
  ctx.fillStyle = '#3d2f7a';
  ctx.fillRect(0, innerHeight * 0.82, innerWidth, innerHeight);
}

const base = defaultSave();
const save: SaveData = {
  ...base,
  coins: 1280,
  stars: { 'w1-s1': 3, 'w1-s2': 2, 'w1-s3': 3, 'w1-s4': 1 },
  bestScores: { 'w1-s1': 12450, 'w1-s2': 9800, 'w1-s3': 15320, 'w1-s4': 7400, endless: 23810 },
  ownedSkins: ['kid', 'cat', 'robot'],
  skin: 'cat',
};

const hud: HudState = {
  hearts: 2, maxHearts: 3, score: 12340, combo: 14, progress: 0.46, feverGauge: 0.72,
  fever: screen === 'fever', shield: true, slowMo: screen === 'fever', title: '1-3 줄넘기 계단', coins: 12,
  ropeMode: screen === 'back' || params.get('mode') === 'solo' ? 'solo' : 'long', backward: screen === 'back',
};

const result: ResultInfo = {
  mode: screen === 'endless' ? 'endless' : 'stage', stageId: 'w1-s3', title: screen === 'endless' ? '엔드리스' : '1-3 줄넘기 계단',
  cleared: screen === 'result', stars: screen === 'result' ? 2 : 0, score: 15320, best: 14800,
  newRecord: screen !== 'fail', perfects: 32, goods: 11, misses: 2, maxCombo: 27, coinsEarned: 24, hasNext: true,
};

const log = (name: string) => (): void => ui.toast(name);
const cb: UiCallbacks = {
  onStartStage: (id) => ui.toast(`start ${id}`), onStartEndless: log('endless'), onStartDaily: log('daily'),
  onPause: () => ui.showPause(), onResume: log('resume'), onRetry: log('retry'), onQuit: () => ui.showStageSelect(save),
  onNextStage: log('next'), onBuySkin: (id) => ui.toast(`buy ${id}`), onSelectSkin: (id) => ui.showShop({ ...save, skin: id }),
  onSettingsChange: (s) => app.classList.toggle('reduced-motion', s.reducedMotion), onTutorialDone: log('tutorial done'), onUiClick: () => undefined,
};

paintBackdrop();
const ui = createUi(document.getElementById('ui') as HTMLElement, cb);

const show: Record<string, () => void> = {
  title: () => ui.showTitle(save),
  stages: () => ui.showStageSelect(save),
  shop: () => ui.showShop(save),
  settings: () => ui.showSettings(save),
  hud: () => (ui.showHud(), ui.updateHud(hud)),
  fever: () => (ui.showHud(), ui.updateHud(hud)),
  pause: () => (ui.showHud(), ui.updateHud(hud), ui.showPause()),
  result: () => ui.showResult(result),
  fail: () => ui.showResult(result),
  endless: () => ui.showResult(result),
  tutorial: () => (ui.showHud(), ui.updateHud({ ...hud, combo: 0 }), ui.showTutorial((params.get('move') ?? 'double') as MoveId)),
  countdown: () => (ui.showHud(), ui.updateHud({ ...hud, combo: 0 }), ui.showCountdown(Number(params.get('n') ?? 3))),
  back: () => (ui.showHud(), ui.updateHud({ ...hud, combo: 0 })),
  guide: () => {
    ui.showTitle(save);
    document.querySelector<HTMLButtonElement>('.btn--guide')?.click();
  },
  toast: () => (ui.showTitle(save), ui.toast('코인이 부족해요!')),
  audio: () => {
    const audio = createAudio();
    audio.unlock();
    const names: SfxName[] = ['jump', 'boost', 'land', 'perfect', 'good', 'hit', 'coin', 'powerup', 'combo', 'fever', 'clear', 'fail', 'click', 'count', 'tumble', 'side', 'cross', 'reverse'];
    names.forEach((n, i) => setTimeout(() => audio.sfx(n, 2), i * 120));
    ([0, 1, 2, 3] as const).forEach((w, i) => setTimeout(() => audio.startMusic(120, w, 0.3 + i), i * 500));
    setTimeout(() => audio.setFever(true), 900);
    setTimeout(() => (audio.stopMusic(), (document.title = 'audio-ok')), 2200);
  },
};
(show[screen] ?? show.title)();
