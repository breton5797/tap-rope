// Visual QA harness for the UI layer (ui-preview.html?screen=...). Not shipped.
import '../styles/main.css';
import { defaultSave } from '../core/storage';
import type { HudState, LeaderboardRow, MoveId, ResultInfo, SaveData, UiCallbacks } from '../types';
import { CUTSCENES } from '../core/cutscenes';
import { ACHIEVEMENTS } from '../core/achievements';
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
  wall.addColorStop(0, '#1a2126');
  wall.addColorStop(0.7, '#0d1114');
  ctx.fillStyle = wall;
  ctx.fillRect(0, 0, innerWidth, innerHeight);
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  for (let x = 0; x < innerWidth; x += 90) ctx.fillRect(x, 0, 3, innerHeight * 0.73);
  ctx.fillStyle = '#14191d';
  ctx.fillRect(0, innerHeight * 0.73, innerWidth, innerHeight);
  ctx.fillStyle = 'rgba(196,214,224,0.25)';
  ctx.fillRect(0, innerHeight * 0.73, innerWidth, 2);
  ctx.fillStyle = 'rgba(255,42,58,0.9)';
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
  seenCutscenes: ['op-start', 'boss-1', 'boss-2', 'rescue'],
  achievements: { 'first-clear': Date.parse('2026-10-20T10:00:00'), 'zone-1': Date.parse('2026-10-22T10:00:00'), 'chain-50': Date.parse('2026-10-26T21:00:00'), rescue: Date.parse('2026-10-27T09:00:00') },
};

const hud: HudState = {
  hearts: 2, maxHearts: 3, score: 12340, combo: 14, progress: Number(params.get('p') ?? 0.46), feverGauge: Number(params.get('g') ?? 0.72),
  fever: screen === 'fever', shield: true, slowMo: screen === 'fever', title: '3-3 · 하얀 복도', coins: 12,
  sliding: screen === 'slide',
  section: Number(params.get('section') ?? 1), sections: Number(params.get('sections') ?? 3),
  boss: params.get('boss') ? { name: '정문 경비대장', codename: 'SENTINEL-01', hp: Number(params.get('boss')), phase: Number(params.get('section') ?? 1) } : null,
};

const result: ResultInfo = {
  mode: screen === 'endless' ? 'endless' : 'stage',
  stageId: ({ boss: 'w7-s10', rescue: 'w5-s10', escape: 'w10-s10' } as Record<string, string>)[screen] ?? 'w1-s3',
  title: ({ endless: '무한 탈출', boss: '7-10 · 비상구 돌파', rescue: '5-10 · 감옥 블록의 문지기', escape: '10-10 · 헬기 탈출' } as Record<string, string>)[screen] ?? '1-3 · 첫 잠입',
  cleared: ['result', 'boss', 'rescue', 'escape'].includes(screen), stars: screen === 'result' ? 2 : screen === 'fail' ? 0 : 3, score: 15320, best: 14800,
  newRecord: screen !== 'fail', perfects: 32, goods: 11, misses: 2, maxCombo: 27, coinsEarned: Number(params.get('coins') ?? 24), hasNext: screen !== 'escape',
};

const log = (name: string) => (): void => ui.toast(name);
const cb: UiCallbacks = {
  onStartStage: (id) => ui.toast(`start ${id}`), onStartEndless: log('endless'), onStartDaily: log('daily'),
  onPause: () => ui.showPause(), onResume: log('resume'), onRetry: log('retry'), onQuit: () => ui.showStageSelect(save),
  onNextStage: log('next'), onBuySkin: (id) => ui.toast(`buy ${id}`), onSelectSkin: (id) => ui.showShop({ ...save, skin: id }),
  onSettingsChange: (s) => app.classList.toggle('reduced-motion', s.reducedMotion), onTutorialDone: log('tutorial done'), onUiClick: () => undefined,
  onOpenArchive: () => ui.showArchive(save), onPlayCutscene: (id) => ui.showCutscene(CUTSCENES.find((c) => c.id === id) ?? CUTSCENES[0], () => ui.toast('cutscene done')),
  onOpenAchievements: () => ui.showAchievements(save), onOpenLeaderboard: (b) => ui.showLeaderboard(b, board()), onOpenNickname: () => ui.showNickname('GHOST_07', fakeSubmit),
};

const rows: LeaderboardRow[] = Array.from({ length: 50 }, (_, i) => ({ rank: i + 1, nickname: i === 6 ? 'GHOST_07' : ['NIGHTHAWK', '요원-3F2A', 'VIPER_9', '섀도우런', 'K_ECHO', 'RAZOR', 'OPAL'][i % 7] + (i > 6 ? `_${i}` : ''), score: 98000 - i * 1530, me: i === 6 }));
function board(): Parameters<typeof ui.showLeaderboard>[1] {
  const st = params.get('lb') ?? 'data';
  if (st === 'loading' || st === 'offline') return st;
  if (st === 'empty') return { top: [], mine: null };
  if (st === 'far') return { top: rows.map((r) => ({ ...r, me: false })), mine: { rank: 214, nickname: 'GHOST_07', score: 21400, me: true } };
  return { top: rows, mine: rows[6] };
}
async function fakeSubmit(name: string): Promise<string | null> {
  await new Promise((r) => setTimeout(r, Number(params.get('delay') ?? 600)));
  return name.toLowerCase().includes('taken') ? '이미 사용 중인 호출명.' : null;
}

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
  toast: () => (ui.showTitle(save), ui.toast('자금 부족')),
  cutscene: () => (ui.showTitle(save), ui.showCutscene(CUTSCENES.find((c) => c.id === (params.get('id') ?? 'op-start')) ?? CUTSCENES[0], () => ui.toast('cutscene done'))),
  archive: () => (ui.showTitle(save), ui.showArchive(save)),
  achievements: () => (ui.showTitle(save), ui.showAchievements(save)),
  leaderboard: () => (ui.showTitle(save), ui.showLeaderboard(params.get('board') === 'week' ? 'endless-week' : 'endless', board())),
  nickname: () => {
    ui.showTitle(save);
    ui.showLeaderboard('endless', board());
    ui.showNickname(params.get('name') ?? null, fakeSubmit);
    const err = params.get('err');
    if (err) setTimeout(() => { const i = document.querySelector<HTMLInputElement>('.nick__input'); if (i) { i.value = err; document.querySelector<HTMLButtonElement>('.nick__submit')?.click(); } }, 200);
  },
  achtoast: () => (ui.showTitle(save), ACHIEVEMENTS.slice(0, Number(params.get('n') ?? 2)).forEach((a, i) => setTimeout(() => ui.toastAchievement(a), i * 150))),
  online: () => ui.showResult({ ...result, mode: 'endless', title: '무한 침투', cleared: false, online: { state: (params.get('state') ?? 'ranked') as 'ranked', rank: 37 } } as ResultInfo),
  bosshud: () => (ui.showHud(), ui.updateHud({ ...hud, combo: 0, boss: hud.boss ?? { name: '정문 경비대장', codename: 'SENTINEL-01', hp: 0.58, phase: 1 } })),
  loading: () => (ui.showTitle(save), ui.showLoading(Number(params.get('p') ?? 0.42))),
  controls: () => (ui.showHud(), ui.updateHud({ ...hud, combo: 0, progress: 0 }), ui.showControls(() => ui.toast('controls done'))),
  audio: () => {
    const audio = createAudio();
    audio.unlock();
    const names: SfxName[] = ['jump', 'boost', 'land', 'perfect', 'good', 'hit', 'coin', 'powerup', 'combo', 'fever', 'clear', 'fail', 'click', 'count', 'slide', 'warn', 'zap', 'rescue', 'lane', 'alert', 'door', 'boss-intro', 'boss-charge', 'boss-stagger', 'boss-down', 'achieve'];
    names.forEach((n, i) => setTimeout(() => audio.sfx(n, 2), i * 120));
    ([0, 1, 2, 3] as const).forEach((w, i) => setTimeout(() => audio.startMusic(120, w, 0.3 + i), i * 500));
    setTimeout(() => audio.setFever(true), 900);
    setTimeout(() => (audio.stopMusic(), (document.title = 'audio-ok')), 2200);
  },
};
(show[screen] ?? show.title)();
