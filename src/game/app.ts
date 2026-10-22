/**
 * App controller: wires renderer, UI, audio and the pure Session together and
 * owns the screen flow (menu demo → countdown → play ⇄ pause → result).
 */
import type { GameMode, ResultInfo, SaveData, Settings, SkinId, StageDef } from '../types';
import { createRenderer } from '../render/index';
import { createUi } from '../ui/index';
import { createAudio } from '../audio/index';
import { createHaptics } from '../platform/haptics';
import { registerServiceWorker } from '../platform/pwa';
import { nextStageId, stageById } from '../core/content';
import { buySkin, loadSave, recordResult, writeSave } from '../core/storage';
import { stepPlayer } from '../core/physics';
import { createSession, sessionStars, step, tap, type Session } from './session';
import { botShouldTap } from './bot';
import { toHud, toSnapshot } from './snapshot';
import { playFeedback } from './feedback';
import { HINT_DURATION, upcomingHint } from './hints';
import { bindInput } from './input';

type Screen = 'menu' | 'countdown' | 'play' | 'paused' | 'result';

const COUNT_STEP = 0.6;
const RESULT_DELAY = 1.3;

function todayIso(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function demoSession(): Session {
  return createSession('endless', null, { seed: Math.floor(Math.random() * 1e9) });
}

export function startApp(): void {
  const appEl = document.getElementById('app') as HTMLElement;
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const uiRoot = document.getElementById('ui') as HTMLElement;

  const renderer = createRenderer(canvas);
  const audio = createAudio();
  const haptics = createHaptics();
  const deps = { fx: renderer.fx, audio, haptics };

  let save: SaveData = loadSave();
  let screen: Screen = 'menu';
  let session: Session = demoSession();
  let run: { mode: GameMode; stage: StageDef | null; date: string } = { mode: 'stage', stage: null, date: '' };
  let countdown = 0;
  let endTimer = -1;
  let hintTimer = 0;
  let pendingTaps = 0;
  const seenHints = new Set<number>();

  const persist = (next: SaveData): void => {
    save = next;
    writeSave(save);
  };

  const applySettings = (s: Settings): void => {
    audio.setEnabled(s.sound, s.music);
    haptics.setEnabled(s.vibration);
    appEl.classList.toggle('reduced-motion', s.reducedMotion);
  };

  const toMenu = (show: (s: SaveData) => void): void => {
    screen = 'menu';
    audio.stopMusic();
    audio.setFever(false);
    session = demoSession();
    ui.hideAll();
    show(save);
  };

  const startRun = (mode: GameMode, stage: StageDef | null): void => {
    const date = todayIso();
    run = { mode, stage, date };
    session = createSession(mode, stage, { date, seed: Math.floor(Math.random() * 1e9) });
    audio.stopMusic();
    audio.setFever(false);
    ui.hideAll();
    ui.showHud();
    ui.updateHud(toHud(session));
    beginCountdown();
    if (!save.tutorialDone && mode === 'stage') {
      ui.showTutorial(0);
      hintTimer = HINT_DURATION + 1.8;
      persist({ ...save, tutorialDone: true });
    }
  };

  const beginCountdown = (): void => {
    screen = 'countdown';
    countdown = 3 * COUNT_STEP;
    endTimer = -1;
    pendingTaps = 0;
    ui.showCountdown(3);
    audio.sfx('count', 3);
  };

  const pause = (): void => {
    if (screen !== 'play' && screen !== 'countdown') return;
    screen = 'paused';
    audio.stopMusic();
    ui.showCountdown(null);
    ui.showPause();
  };

  const finishRun = (): void => {
    screen = 'result';
    audio.stopMusic();
    audio.setFever(false);
    const cleared = session.status === 'cleared';
    const stars = sessionStars(session);
    const key = run.mode === 'stage' ? session.stage.id : run.mode === 'endless' ? 'endless' : `daily:${run.date}`;
    const prevBest = save.bestScores[key] ?? 0;
    const score = session.score.score;
    persist(recordResult(save, key, run.mode === 'stage' ? stars : 0, score, session.score.coins));
    const next = run.mode === 'stage' ? nextStageId(session.stage.id) : null;
    const info: ResultInfo = {
      mode: run.mode,
      stageId: run.mode === 'stage' ? session.stage.id : null,
      title: toHud(session).title,
      cleared,
      stars: run.mode === 'stage' ? stars : 0,
      score,
      best: Math.max(prevBest, score),
      newRecord: score > prevBest && score > 0,
      perfects: session.score.perfects,
      goods: session.score.goods,
      misses: session.score.misses,
      maxCombo: session.score.maxCombo,
      coinsEarned: session.score.coins,
      hasNext: cleared && next !== null,
    };
    ui.showTutorial(null);
    ui.showResult(info);
  };

  const ui = createUi(uiRoot, {
    onStartStage: (id) => {
      const st = stageById(id);
      if (st) startRun('stage', st);
    },
    onStartEndless: () => startRun('endless', null),
    onStartDaily: () => startRun('daily', null),
    onPause: pause,
    onResume: () => {
      if (screen !== 'paused') return;
      ui.hideAll();
      ui.showHud();
      beginCountdown();
    },
    onRetry: () => startRun(run.mode, run.stage),
    onQuit: () => toMenu((s) => ui.showStageSelect(s)),
    onNextStage: () => {
      const id = run.stage ? nextStageId(run.stage.id) : null;
      const st = id ? stageById(id) : undefined;
      if (st) startRun('stage', st);
      else toMenu((s) => ui.showStageSelect(s));
    },
    onBuySkin: (id: SkinId) => {
      const bought = buySkin(save, id);
      if (!bought) {
        ui.toast('코인이 부족해요!');
        return;
      }
      persist({ ...bought, skin: id });
      audio.sfx('powerup');
      ui.toast('새 스킨 획득!');
      ui.showShop(save);
    },
    onSelectSkin: (id: SkinId) => {
      if (!save.ownedSkins.includes(id)) return;
      persist({ ...save, skin: id });
      ui.showShop(save);
    },
    onSettingsChange: (s: Settings) => {
      persist({ ...save, settings: s });
      applySettings(s);
    },
    onTutorialDone: () => persist({ ...save, tutorialDone: true }),
    onUiClick: () => {
      audio.unlock();
      audio.sfx('click');
    },
  });

  const tickCountdown = (dt: number): void => {
    const before = Math.ceil(countdown / COUNT_STEP);
    countdown -= dt;
    const after = Math.ceil(countdown / COUNT_STEP);
    if (countdown <= 0) {
      screen = 'play';
      ui.showCountdown(0);
      audio.sfx('count', 0);
      audio.startMusic(session.stage.bpm, session.world, session.time);
      if (session.score.feverTime > 0) audio.setFever(true);
      window.setTimeout(() => ui.showCountdown(null), 550);
    } else if (after !== before) {
      ui.showCountdown(after);
      audio.sfx('count', after);
    }
  };

  const tickHints = (dt: number): void => {
    if (hintTimer > 0) {
      hintTimer -= dt;
      if (hintTimer <= 0) ui.showTutorial(null);
      return;
    }
    const inEarlyWorlds = run.mode === 'stage' && (run.stage?.world ?? 9) <= 1;
    if (!inEarlyWorlds) return;
    const h = upcomingHint(session, seenHints);
    if (h === null) return;
    seenHints.add(h);
    ui.showTutorial(h);
    hintTimer = HINT_DURATION;
  };

  const tickPlay = (dt: number): void => {
    const wasFever = session.score.feverTime > 0;
    for (; pendingTaps > 0; pendingTaps--) {
      const out = tap(session);
      session = out.session;
      playFeedback(deps, out.events);
    }
    const out = step(session, dt);
    session = out.session;
    playFeedback(deps, out.events);
    if (wasFever && session.score.feverTime <= 0) audio.setFever(false);
    ui.updateHud(toHud(session));
    tickHints(dt);
    if (session.status !== 'playing') {
      endTimer = endTimer < 0 ? RESULT_DELAY : endTimer - dt;
      if (endTimer <= 0) finishRun();
    }
  };

  const tickMenu = (dt: number): void => {
    if (botShouldTap(session)) session = tap(session).session;
    const out = step(session, dt);
    session = out.session;
    playFeedback(deps, out.events, true);
    if (session.status !== 'playing' || session.time > 240) session = demoSession();
  };

  const tickResult = (dt: number): void => {
    // let the character finish its jump / keep idling behind the result card
    session = { ...session, player: stepPlayer(session.player, dt, session.cfg).player, time: session.time + dt };
  };

  bindInput(canvas, {
    onTap: () => {
      audio.unlock();
      if (screen === 'play') pendingTaps = Math.min(pendingTaps + 1, 3);
    },
    onPauseKey: () => (screen === 'paused' ? undefined : pause()),
  });

  const resize = (): void => {
    const r = appEl.getBoundingClientRect();
    renderer.resize(r.width, r.height, window.devicePixelRatio || 1);
  };
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  resize();
  applySettings(save.settings);
  registerServiceWorker();
  ui.showTitle(save);

  let last = performance.now();
  const frame = (now: number): void => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    if (screen === 'menu') tickMenu(dt);
    else if (screen === 'countdown') tickCountdown(dt);
    else if (screen === 'play') tickPlay(dt);
    else if (screen === 'result') tickResult(dt);
    renderer.fx.update(dt);
    renderer.render(toSnapshot(session, save.skin, now / 1000, save.settings.reducedMotion));
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
