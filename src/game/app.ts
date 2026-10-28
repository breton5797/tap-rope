/**
 * App controller: wires renderer, UI, audio and the pure Session together and
 * owns the screen flow (menu demo → countdown → play ⇄ pause → result).
 */
import type {
  Board, BossView, Cutscene, CutsceneId, GameMode, LaneDir, MoveId, Renderer, ResultInfo, SaveData, Settings, SkinId,
  StageDef, Swipe, Ui,
} from '../types';
import { createRenderer } from '../render/index';
import { createUi } from '../ui/index';
import { createAudio } from '../audio/index';
import { createHaptics } from '../platform/haptics';
import { registerServiceWorker } from '../platform/pwa';
import { nextStageId, stageById } from '../core/content';
import {
  buySkin, loadSave, markBriefed, markCutsceneSeen, recordResult, setStorageNotice, watchSave, writeSave,
} from '../core/storage';
import { cosmeticsOf } from '../core/economy';
import { parseChallenge, type ChallengeLink } from '../ui/share';
import { CUTSCENES, cutsceneAfter, cutsceneBefore } from '../core/cutscenes';
import { createOnline } from '../platform/online';
import { stepPlayer } from '../core/physics';
import { createSession, lane, sessionStars, slide, step, swipe, tap, type Session, type StepOutput } from './session';
import { botAction, type BotAction } from './bot';
import { sessionBoss, toHud, toSnapshot } from './snapshot';
import { createRunLog, type RunLog } from './runlog';
import { bossCues } from './boss-cues';
import { createProgress } from './progress';
import { playFeedback, resetFeedback, type FeedbackDeps } from './feedback';
import { resetCues } from '../render/cues';
import { HINT_DURATION, introducedMoves, upcomingHint } from './hints';
import { bindInput } from './input';
import { hitStop, slowMo, stepWarp, WARP0, type Warp } from './timewarp';
import { TutorialRun, tutorialStops, type TutorialStep } from './tutorial';
import { FINISHER_SLOW, finisherStarts, phaseLineDue } from './boss-lines';
import { autoplayResult, takeChallenge, withoutChallenge } from './run-policy';

/** controls = the first-run two-thumb card is up; cutscene = a story cutscene plays (GDD-v7 §2) */
type Screen = 'menu' | 'controls' | 'cutscene' | 'countdown' | 'play' | 'paused' | 'result';

const COUNT_STEP = 0.6;
/** the mission briefing card reads for this long before 3-2-1 starts */
const BRIEFING_TIME = 2.6;
const STORY_BOSSES = new Set(['w5-s10', 'w10-s10']);
const RESULT_DELAY = 1.3;
/** v8 (A6): static screens (menus behind opaque cards, pause, result, cutscenes) redraw the canvas at this rate */
const STATIC_FPS = 15;
/** boot never waits longer than this for the photographic art (the procedural look covers the rest) */
const ART_WAIT_MS = 8000;
/** `?autoplay=1` lets the bot play real runs (QA / demo recordings). */
const AUTOPLAY = new URLSearchParams(window.location.search).has('autoplay');

function todayIso(): string {
  const d = new Date();
  const p = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

type Input = 'tap' | 'slideKey' | Swipe | { readonly lane: LaneDir };

function botInput(a: BotAction | null): Input[] {
  if (!a) return [];
  if (a.lane) return [{ lane: a.lane }];
  return a.swipe ? ['tap', a.swipe] : ['tap'];
}

function applyInput(s: Session, input: Input): StepOutput {
  if (input === 'tap') return tap(s);
  if (input === 'slideKey') return slide(s);
  if (typeof input === 'object') return lane(s, input.lane);
  return swipe(s, input);
}

/** Loading overlay while the art loads (GDD-v6 §8); the title follows when it settles or after ART_WAIT_MS. */
function bootArt(renderer: Renderer, ui: Ui, done: () => void): void {
  let finished = false;
  const finish = (): void => {
    if (finished) return;
    finished = true;
    ui.showLoading(null);
    done();
  };
  ui.showLoading(0);
  window.setTimeout(finish, ART_WAIT_MS);
  renderer
    .load((loaded, total) => {
      if (!finished) ui.showLoading(total > 0 ? loaded / total : 1);
    })
    .then(finish, finish);
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
  // v7.1 hit stop / slow motion: scales only the real dt fed to step() (session time stays exact for replays)
  let warp: Warp = WARP0;
  const deps: FeedbackDeps = {
    fx: renderer.fx, audio, haptics,
    time: {
      hitStop: (seconds) => { warp = hitStop(warp, seconds, reducedMotion()); },
      slowMo: (seconds, factor) => { warp = slowMo(warp, seconds, factor, reducedMotion()); },
    },
    view: () => session,
  };

  let save: SaveData = loadSave();
  let screen: Screen = 'menu';
  let session: Session = demoSession();
  let run: { mode: GameMode; stage: StageDef | null; date: string } = { mode: 'stage', stage: null, date: '' };
  let countdown = 0;
  let endTimer = -1;
  let hintTimer = 0;
  /** touches since the last frame, in order: a tap, optionally followed by its swipe */
  let pendingInput: Input[] = [];
  let hintsSkipped = false;
  /** first-ever run: the jump card waits until the briefing card has closed */
  let jumpCardPending = false;
  let goTimer = 0;
  let music = { bpm: 0, world: -1 };
  let runLog: RunLog = createRunLog('stage', 0, '');
  let prevBoss: BossView | null = null;
  const online = createOnline();
  const seenHints = new Set<MoveId>();
  /** v8 (A3): last boss phase announced (−1 none); the finisher: 'armed' after the last hazard, then its landing time */
  let bossLine = -1;
  let finisher: 'off' | 'armed' = 'off';
  /** wall-clock seconds of the finisher landing (the stage clock stops after the clear), −1 = none */
  let finisherReal = -1;
  /** v8 (A1): wall-clock seconds the world froze at (the snapshot holds still), −1 = running */
  let frozenReal = -1;
  /** v8: mode + stage of the last run started (a retry gets the short countdown) */
  let lastRunKey = '';
  /** v8 (A5): challenge link not yet played, and whether the current run is the challenge run */
  let challenge: ChallengeLink | null = null;
  let challengeRun = false;
  const osReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  const reducedMotion = (): boolean => save.settings.reducedMotion || Boolean(osReducedMotion?.matches);

  const startMusic = (): void => {
    music = { bpm: session.bpm, world: session.world };
    audio.startMusic(session.bpm, session.world, session.time);
  };
  const clearGoTimer = (): void => {
    window.clearTimeout(goTimer);
    goTimer = 0;
  };

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
    lastRunKey = '';
    tutorial.reset([]); // quitting inside a tutorial freeze must not freeze the menu demo
    frozenReal = -1;
    finisher = 'off';
    finisherReal = -1;
    jumpCardPending = false;
    audio.setBoss(false);
    audio.stopMusic();
    audio.setFever(false);
    session = demoSession();
    ui.hideAll();
    show(save);
  };

  /** plays a cutscene, marks it seen, then continues */
  const playCutscene = (c: Cutscene, then: () => void): void => {
    screen = 'cutscene';
    audio.stopMusic();
    ui.hideAll();
    ui.showCutscene(c, () => {
      persist(markCutsceneSeen(save, c.id));
      if (!AUTOPLAY) progress.recheck(); // bot sessions unlock no achievements
      then();
    });
  };

  /** v8 (A1): steps the first-run tutorial has taught (save) */
  const taught = (): readonly TutorialStep[] => save.tutorialSteps ?? [];
  const tutorial = new TutorialRun({
    show: (stop) => {
      if (stop) ui.showTutorial(null);
      ui.showTutorialStop(stop);
    },
    frozen: () => {
      frozenReal = performance.now() / 1000;
      hintTimer = 0;
      audio.stopMusic();
    },
    learnt: (step) => {
      frozenReal = -1;
      persist({ ...save, tutorialSteps: [...taught(), step] });
      if (session.status === 'playing') startMusic();
    },
  });

  const startRun = (mode: GameMode, stage: StageDef | null): void => {
    const before = mode === 'stage' && stage && save.controlsSeen ? cutsceneBefore(stage, save) : null;
    if (before) {
      playCutscene(before, () => startRun(mode, stage));
      return;
    }
    if (!save.controlsSeen) {
      // first v5 run: teach the split controls before anything moves
      screen = 'controls';
      session = createSession(mode, stage, { date: todayIso(), seed: 1 });
      audio.stopMusic();
      ui.hideAll();
      ui.showControls(() => {
        persist({ ...save, controlsSeen: true });
        startRun(mode, stage);
      });
      return;
    }
    jumpCardPending = false;
    const date = todayIso();
    run = { mode, stage, date };
    // v8 (A5): a challenge link replays its endless course once (endless is seed-deterministic), then is spent
    const taken = takeChallenge(mode, challenge);
    challenge = taken.pending;
    challengeRun = taken.seed !== null;
    const seed = taken.seed ?? Math.floor(Math.random() * 1e9);
    session = createSession(mode, stage, { date, seed });
    runLog = createRunLog(mode, seed, date);
    prevBoss = null;
    bossLine = -1;
    finisher = 'off';
    finisherReal = -1;
    frozenReal = -1;
    // v8 (A1): stage runs freeze at the first jump / slide / lane change not yet taught (never endless / daily / bot)
    tutorial.reset(mode === 'stage' && !AUTOPLAY ? tutorialStops(session.beats, taught(), session.cfg) : []);
    warp = WARP0;
    resetCues(); // no slide sparks / recoil carried over from the last run or the menu demo
    resetFeedback(deps);
    audio.setBoss(sessionBoss(session) !== null); // heavier drum layer on boss stages
    audio.stopMusic();
    audio.setFever(false);
    ui.hideAll();
    ui.showHud();
    ui.updateHud(toHud(session));
    const chapter = stage?.chapter ?? -1;
    const brief = mode === 'stage' && stage !== null && (stage.index === 0 || !save.briefed.includes(chapter));
    if (brief) {
      ui.showBriefing(chapter);
      persist(markBriefed(save, chapter));
    }
    // v8 (fun P1-4): a retry of the same run counts down from 2 (less dead time after a fail)
    const key = `${mode}:${stage?.id ?? ''}`;
    beginCountdown(brief ? BRIEFING_TIME : 0, key === lastRunKey && !brief ? 2 : 3);
    lastRunKey = key;
    if (!save.tutorialDone && mode === 'stage') {
      // v8 (A1): the jump card waits for GO (never over the countdown); the tutorial freeze teaches the jump itself
      jumpCardPending = AUTOPLAY || taught().includes('jump');
      persist({ ...save, tutorialDone: true });
    }
  };

  /** `lead` = extra seconds before "3" (the briefing card is up meanwhile) */
  const showJumpCard = (): void => {
    jumpCardPending = false;
    ui.showTutorial('jump');
    hintTimer = HINT_DURATION + 1.8;
  };

  /** `steps` = the first number shown (3, or 2 for a quick retry) */
  const beginCountdown = (lead = 0, steps = 3): void => {
    screen = 'countdown';
    clearGoTimer();
    countdown = steps * COUNT_STEP + lead;
    endTimer = -1;
    pendingInput = [];
    if (lead > 0) return;
    ui.showCountdown(steps);
    audio.sfx('count', steps);
  };

  const pause = (): void => {
    if (screen !== 'play' && screen !== 'countdown') return;
    if (session.status !== 'playing') return; // run already over: the result card is on its way
    screen = 'paused';
    clearGoTimer();
    audio.stopMusic();
    ui.showCountdown(null);
    ui.showBriefing(null);
    ui.showPause();
  };

  const finishRun = (): void => {
    screen = 'result';
    audio.setBoss(false);
    audio.stopMusic();
    audio.setFever(false);
    const cleared = session.status === 'cleared';
    if (cleared && run.mode === 'stage' && STORY_BOSSES.has(session.stage.id)) audio.sfx('rescue');
    const stars = sessionStars(session);
    const key = run.mode === 'stage' ? session.stage.id : run.mode === 'endless' ? 'endless' : `daily:${run.date}`;
    const prevBest = save.bestScores[key] ?? 0;
    const score = session.score.score;
    const saveBefore = save; // economy pays first-clear / new-star rewards against the save before this run
    // bot runs (?autoplay=1, QA / demo) record nothing: no stars, best, coins, streak or achievements
    if (!AUTOPLAY) persist(recordResult(save, key, run.mode === 'stage' ? stars : 0, score, session.score.coins));
    const stageId = run.mode === 'stage' ? session.stage.id : null;
    const next = stageId ? nextStageId(stageId) : null;
    const base: ResultInfo = {
      mode: run.mode,
      stageId: run.mode === 'stage' ? session.stage.id : null,
      title: toHud(session).title,
      cleared,
      stars: run.mode === 'stage' ? stars : 0,
      score,
      best: Math.max(prevBest, score),
      newRecord: score > prevBest && score > 0,
      perfects: session.score.perfects,
      greats: session.score.greats,
      goods: session.score.goods,
      misses: session.score.misses,
      maxCombo: session.score.maxCombo,
      coinsEarned: session.score.coins,
      hasNext: cleared && next !== null,
    };
    ui.showTutorial(null);
    // bot runs (?autoplay=1, QA/demo) are never submitted to the leaderboard
    const record = AUTOPLAY ? null : runLog.record(session);
    const info = AUTOPLAY ? autoplayResult(base, prevBest) : progress.afterRun(runLog.summary(session, stageId), record, base, saveBefore);
    // the "vs" duel belongs to the challenge run's result only
    if (challengeRun) {
      challengeRun = false;
      progress.setChallenge(null);
    }
    const after = cutsceneAfter(stageId, cleared, save);
    const showResult = (): void => {
      screen = 'result';
      ui.showResult(info);
    };
    if (after) playCutscene(after, showResult);
    else showResult();
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
        ui.toast('자금 부족');
        return;
      }
      persist({ ...bought, skin: id });
      audio.sfx('powerup');
      ui.toast('장비 확보 완료');
      ui.showShop(save);
      progress.recheck();
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
    onTutorialDone: () => {
      hintsSkipped = true;
      hintTimer = 0;
      ui.showTutorial(null);
      persist({ ...save, tutorialDone: true });
    },
    onUiClick: () => {
      audio.unlock();
      audio.sfx('click');
    },
    onOpenArchive: () => ui.showArchive(save),
    onPlayCutscene: (id: CutsceneId) => {
      const c = CUTSCENES.find((x) => x.id === id);
      if (c && save.seenCutscenes.includes(id)) playCutscene(c, () => toMenu((s) => ui.showArchive(s)));
    },
    onOpenAchievements: () => ui.showAchievements(save),
    onOpenLeaderboard: (board: Board) => progress.openLeaderboard(board),
    onOpenNickname: () => progress.openNickname(),
    onMetaUpdate: (update) => {
      const next = update(save); // against the current save, so another tab's progress is never overwritten
      if (next) persist(next);
      return next;
    },
    onOpenShop: () => toMenu((s) => ui.showShop(s)),
  });

  const progress = createProgress({
    ui, audio, online, getSave: () => save, persist, resultShowing: () => screen === 'result',
  });
  setStorageNotice((msg) => ui.toast(msg));
  challenge = parseChallenge(window.location.search);
  progress.setChallenge(challenge);
  // the link is spent by its first endless run: a reload must not pin every later run to the friend's seed
  if (challenge) history.replaceState(history.state, '', `${location.pathname}${withoutChallenge(location.search)}${location.hash}`);
  // v8 (quality P2 #14): another tab saved — adopt it so this tab never overwrites newer progress
  watchSave((s) => {
    save = s;
    if (screen === 'menu' && document.querySelector('.layer--screen')?.getAttribute('data-screen') === 'title') ui.showTitle(save);
  });

  const tickCountdown = (dt: number): void => {
    const before = Math.ceil(countdown / COUNT_STEP);
    countdown -= dt;
    const after = Math.ceil(countdown / COUNT_STEP);
    if (countdown <= 0) {
      screen = 'play';
      ui.showBriefing(null);
      ui.showCountdown(0);
      audio.sfx('count', 0);
      if (session.score.feverTime > 0) audio.setFever(true);
      goTimer = window.setTimeout(() => ui.showCountdown(null), 550);
      if (jumpCardPending) showJumpCard();
      // resumed inside a tutorial freeze: the glyph comes back and the music waits for the input
      if (tutorial.frozen) {
        tutorial.reshow();
        frozenReal = performance.now() / 1000;
      } else startMusic();
    } else if (after !== before && after <= 3) {
      if (after === 3) ui.showBriefing(null); // the briefing had its own read time; 3-2-1 gets the stage
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
    if (run.mode !== 'stage' || hintsSkipped) return;
    const h = upcomingHint(session, seenHints, new Set(introducedMoves(session.stage)));
    if (h === null) return;
    seenHints.add(h);
    ui.showTutorial(h);
    hintTimer = HINT_DURATION;
  };

  const tickPlay = (dt: number): void => {
    const wasFever = session.score.feverTime > 0;
    if (AUTOPLAY) pendingInput = [...pendingInput, ...botInput(botAction(session))];
    // frozen tutorial: only the taught input gets through (applied at the frozen time, so it replays exactly)
    const queued = tutorial.frozen ? tutorial.filter(pendingInput, performance.now()) : pendingInput;
    pendingInput = [];
    for (const input of queued) {
      runLog.input(session, input);
      const out = applyInput(session, input);
      session = out.session;
      playFeedback(deps, out.events);
    }
    if (tutorial.frozen) {
      ui.updateHud(toHud(session));
      return;
    }
    const out = step(session, tutorial.clampDt(session.time, dt));
    session = out.session;
    playFeedback(deps, out.events);
    for (const e of out.events) if (e.type === 'fever') runLog.fever();
    tutorial.afterStep(session.time, session.player);
    const boss = sessionBoss(session);
    for (const cue of bossCues(prevBoss, boss)) audio.sfx(cue);
    tickBossShow(boss);
    prevBoss = boss;
    if (wasFever && session.score.feverTime <= 0) audio.setFever(false);
    if (session.status === 'playing' && (session.bpm !== music.bpm || session.world !== music.world)) startMusic();
    ui.updateHud(toHud(session));
    tickHints(dt);
    if (session.status !== 'playing') {
      endTimer = endTimer < 0 ? RESULT_DELAY : endTimer - dt;
      if (endTimer <= 0) finishRun();
    }
  };

  /** v8 (A3): phase lines, and the finisher (slow motion on the last hazard, the blast as the agent lands) */
  const tickBossShow = (boss: BossView | null): void => {
    const line = phaseLineDue(bossLine, boss);
    if (line) {
      bossLine = line.phase;
      ui.showBossLine(line.kicker, line.text);
    }
    if (finisherStarts(prevBoss, boss)) {
      finisher = 'armed';
      deps.time?.slowMo(FINISHER_SLOW.seconds, FINISHER_SLOW.factor);
    }
    // the blast on the landing — or at once if the stage already cleared mid-air (its clock has stopped)
    if (finisher === 'armed' && (session.player.grounded || session.status !== 'playing')) {
      finisher = 'off';
      finisherReal = performance.now() / 1000;
      renderer.fx.shake(1);
      renderer.fx.flash('#FFB020');
      audio.sfx('boss-down');
    }
  };

  const tickMenu = (dt: number): void => {
    for (const input of botInput(botAction(session))) session = applyInput(session, input).session;
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
      if (screen === 'play' && pendingInput.length < 6) pendingInput = [...pendingInput, 'tap'];
    },
    onSlideKey: () => {
      audio.unlock();
      if (screen === 'play' && pendingInput.length < 6) pendingInput = [...pendingInput, 'slideKey'];
    },
    onSwipe: (dir: Swipe) => {
      if (screen === 'play' && pendingInput.length < 6) pendingInput = [...pendingInput, dir];
    },
    onLane: (dir: LaneDir) => {
      audio.unlock();
      if (screen === 'play' && pendingInput.length < 6) pendingInput = [...pendingInput, { lane: dir }];
    },
    onPauseKey: () => (screen === 'paused' ? undefined : pause()),
  });

  // v8: the rhythm lane docks above the bottom safe area (home indicator); a hidden probe measures it
  const safeProbe = document.createElement('div');
  safeProbe.style.cssText = 'position:fixed;left:0;bottom:0;width:0;height:env(safe-area-inset-bottom,0px);visibility:hidden;pointer-events:none';
  appEl.appendChild(safeProbe);
  const resize = (): void => {
    const r = appEl.getBoundingClientRect();
    renderer.resize(r.width, r.height, window.devicePixelRatio || 1, safeProbe.offsetHeight);
  };
  window.addEventListener('resize', resize);
  window.visualViewport?.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) pause();
  });
  // v8 (A6): iOS Notification / Control Centre, call banners and alt-tab fire no visibilitychange
  window.addEventListener('blur', pause);
  window.addEventListener('pagehide', pause);
  resize();
  applySettings(save.settings);
  registerServiceWorker();
  bootArt(renderer, ui, () => ui.showTitle(save));
  void online.init(); // never throws; flushes runs queued while offline

  let last = performance.now();
  let lastDraw = -Infinity;
  // v8 (A5): equipped cosmetic colours, recomputed only when the save object changes
  let lookSave: SaveData | null = null;
  let look = cosmeticsOf(save);
  let fxPending = 0;
  /** v8 (A6): nothing moves fast behind menus, pause, result or a cutscene: redraw at STATIC_FPS there */
  const staticScreen = (): boolean => screen !== 'play' && screen !== 'countdown';
  const frame = (now: number): void => {
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    let fxDt = dt;
    if (screen === 'menu') tickMenu(dt);
    else if (screen === 'countdown') tickCountdown(dt);
    else if (screen === 'play') {
      const warped = warp !== WARP0;
      const w = stepWarp(warp, dt);
      warp = w.warp;
      tickPlay(w.dt);
      // the music clock kept running through the stop / slow motion: re-anchor it to session time
      if (warped && warp === WARP0 && session.status === 'playing' && !tutorial.frozen) startMusic();
      fxDt = tutorial.frozen ? 0 : Math.max(w.dt, dt * 0.35); // particles crawl (not freeze) through a hit stop
    } else if (screen === 'result') tickResult(dt);
    if (screen !== 'play') warp = WARP0;
    fxPending += fxDt;
    if (lookSave !== save) {
      lookSave = save;
      look = cosmeticsOf(save);
    }
    if (!staticScreen() || now - lastDraw >= 1000 / STATIC_FPS - 1) {
      lastDraw = now;
      renderer.fx.update(fxPending);
      fxPending = 0;
      renderer.render(toSnapshot(session, save.skin, {
        realTime: frozenReal >= 0 ? frozenReal : now / 1000, reducedMotion: reducedMotion(), running: screen !== 'paused',
        bossFinish: finisherReal >= 0 ? now / 1000 - finisherReal : -1, cosmetics: look,
      }));
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
