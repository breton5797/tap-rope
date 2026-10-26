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
  const wall = ctx.createLinearGradient(0, 0, 0, innerHeight);
  wall.addColorStop(0, '#1a2448');
  wall.addColorStop(0.7, '#0f1630');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let x = 0; x < innerWidth; x += 90) ctx.fillRect(x, 0, 3, innerHeight * 0.73);
  ctx.fillStyle = '#1c2546';
  ctx.fillRect(0, innerHeight * 0.73, innerWidth, innerHeight);
  ctx.fillStyle = '#2ee6ff';
  ctx.fillRect(0, innerHeight * 0.73, innerWidth, 2);
  ctx.fillStyle = 'rgba(255,59,92,0.85)';
  ctx.fillRect(innerWidth * 0.62, innerHeight * 0.6, 4, innerHeight * 0.13);
}

const base = defaultSave();
const save: SaveData = {
  ...base,
  coins: 1280,
  // chapters 1-2 cleared, chapter 3 up to stage 6
  stars: Object.fromEntries(
    Array.from({ length: 26 }, (_, i) => [`w${Math.floor(i / 10) + 1}-s${(i % 10) + 1}`, (i * 7) % 3 + 1]),
  ),
  bestScores: { 'w1-s1': 12450, 'w1-s2': 9800, 'w1-s3': 15320, 'w1-s4': 7400, 'w3-s5': 21800, endless: 23810 },
  ownedSkins: ['kid', 'cat', 'robot'],
  skin: 'cat',
};

const hud: HudState = {
  hearts: 2, maxHearts: 3, score: 12340, combo: 14, progress: 0.46, feverGauge: 0.72,
  fever: screen === 'fever', shield: true, slowMo: screen === 'fever', title: '3-3 · 하얀 복도', coins: 12,
  sliding: screen === 'slide',
  section: Number(params.get('section') ?? 1), sections: Number(params.get('sections') ?? 3),
};

const result: ResultInfo = {
  mode: screen === 'endless' ? 'endless' : 'stage',
  stageId: ({ boss: 'w7-s10', rescue: 'w5-s10', escape: 'w10-s10' } as Record<string, string>)[screen] ?? 'w1-s3',
  title: ({ endless: '무한 탈출', boss: '7-10 · 비상구 돌파', rescue: '5-10 · 감옥 블록의 문지기', escape: '10-10 · 헬기 탈출' } as Record<string, string>)[screen] ?? '1-3 · 첫 잠입',
  cleared: ['result', 'boss', 'rescue', 'escape'].includes(screen), stars: screen === 'result' ? 2 : screen === 'fail' ? 0 : 3, score: 15320, best: 14800,
  newRecord: screen !== 'fail', perfects: 32, goods: 11, misses: 2, maxCombo: 27, coinsEarned: 24, hasNext: screen !== 'escape',
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
  stages: () => {
    ui.showStageSelect(save);
    const c = params.get('chapter');
    if (c) document.querySelectorAll<HTMLButtonElement>('.chap')[Number(c) - 1]?.click();
    const y = Number(params.get('scroll') ?? 0);
    if (y) setTimeout(() => document.querySelector('.screen--stages .scroll')?.scrollTo(0, y), 50);
  },
  shop: () => ui.showShop(save),
  settings: () => ui.showSettings(save),
  hud: () => (ui.showHud(), ui.updateHud(hud)),
  fever: () => (ui.showHud(), ui.updateHud(hud)),
  pause: () => (ui.showHud(), ui.updateHud(hud), ui.showPause()),
  result: () => ui.showResult(result),
  fail: () => ui.showResult(result),
  boss: () => ui.showResult(result),
  rescue: () => ui.showResult(result),
  escape: () => ui.showResult(result),
  briefing: () => (ui.showHud(), ui.updateHud({ ...hud, combo: 0 }), ui.showBriefing(Number(params.get('chapter') ?? 1) - 1), ui.showCountdown(3)),
  endless: () => ui.showResult(result),
  tutorial: () => (ui.showHud(), ui.updateHud({ ...hud, combo: 0 }), ui.showTutorial((params.get('move') ?? 'double') as MoveId)),
  countdown: () => (ui.showHud(), ui.updateHud({ ...hud, combo: 0 }), ui.showCountdown(Number(params.get('n') ?? 3))),
  slide: () => (ui.showHud(), ui.updateHud({ ...hud, combo: 0 })),
  guide: () => {
    ui.showTitle(save);
    document.querySelector<HTMLButtonElement>('.btn--guide')?.click();
  },
  toast: () => (ui.showTitle(save), ui.toast('코인이 부족해요!')),
  controls: () => (ui.showHud(), ui.updateHud({ ...hud, combo: 0, progress: 0 }), ui.showControls(() => ui.toast('controls done'))),
  audio: () => {
    const audio = createAudio();
    audio.unlock();
    const names: SfxName[] = ['jump', 'boost', 'land', 'perfect', 'good', 'hit', 'coin', 'powerup', 'combo', 'fever', 'clear', 'fail', 'click', 'count', 'slide', 'warn', 'zap', 'rescue', 'lane', 'alert', 'door'];
    names.forEach((n, i) => setTimeout(() => audio.sfx(n, 2), i * 120));
    ([0, 1, 2, 3] as const).forEach((w, i) => setTimeout(() => audio.startMusic(120, w, 0.3 + i), i * 500));
    setTimeout(() => audio.setFever(true), 900);
    setTimeout(() => (audio.stopMusic(), (document.title = 'audio-ok')), 2200);
  },
};
(show[screen] ?? show.title)();
