// Visual QA harness: animated mock scenes for the renderer (render-preview.html).
// Query: ?world=0..3&skin=kid&scene=idle|jump2|jump3|hurdles|bird|fever|dd|hit
//        &at=<sec> (freeze at a time) &shield=1 &slow=1 &mood=<Mood> &rm=1 &ui=0
import {
  LANE_LEAD, PLAYER_X, SCROLL_SPEED,
  type LaneItem, type Level, type Mood, type ObstacleKind, type PlayerState, type RenderSnapshot,
  type SkinId, type VisibleObstacle, type WorldId,
} from '../types';
import { createRenderer } from './index';

interface BeatSpec {
  readonly kinds: readonly ObstacleKind[];
  readonly level: Level;
}

interface SceneCfg {
  readonly omega: number;
  readonly pattern: readonly BeatSpec[];
  readonly dd: boolean;
  readonly fever: boolean;
  readonly hit: boolean;
  readonly mood: Mood;
}

const b = (kinds: readonly ObstacleKind[], level: Level): BeatSpec => ({ kinds, level });

const SCENES: Readonly<Record<string, SceneCfg>> = {
  idle: { omega: 4.6, pattern: [b(['rope'], 1)], dd: false, fever: false, hit: false, mood: 'idle' },
  jump2: { omega: 4.2, pattern: [b(['rope'], 2)], dd: false, fever: false, hit: false, mood: 'happy' },
  jump3: { omega: 4.3, pattern: [b(['rope'], 3)], dd: false, fever: false, hit: false, mood: 'cheer' },
  hurdles: {
    omega: 4.2,
    pattern: [b(['rope', 'hurdle'], 1), b(['hurdle', 'coin'], 2), b(['rope', 'hurdle'], 3), b(['rope', 'bird'], 1), b(['rope', 'shield'], 2), b(['hurdle', 'heart'], 2), b(['rope', 'slow'], 1)],
    dd: false, fever: false, hit: false, mood: 'idle',
  },
  bird: { omega: 4.4, pattern: [b(['rope', 'bird'], 1), b(['rope'], 1), b(['rope', 'coin'], 1)], dd: false, fever: false, hit: false, mood: 'worried' },
  fever: { omega: 4.6, pattern: [b(['rope'], 1), b(['rope'], 2), b(['rope', 'coin'], 1), b(['rope'], 3)], dd: false, fever: true, hit: false, mood: 'cheer' },
  dd: { omega: 3.7, pattern: [b(['rope'], 1)], dd: true, fever: false, hit: false, mood: 'happy' },
  hit: { omega: 4.6, pattern: [b(['rope'], 1), b(['rope', 'hurdle'], 1)], dd: false, fever: false, hit: true, mood: 'idle' },
};

const SKINS: readonly SkinId[] = ['kid', 'cat', 'bunny', 'robot', 'ninja', 'astro'];
const MOODS: readonly Mood[] = ['idle', 'happy', 'hurt', 'cheer', 'worried'];
const GRAVITY = 3000;
const JUMP_V = 660;
const BOOST_V = 700;
const LEAD = [0, 0.22, 0.45, 0.62];
const PICKUP_H = [0, 44, 112, 176];
const BIRD_H = 92;

const q = new URLSearchParams(location.search);
const world = Math.max(0, Math.min(3, Number(q.get('world') ?? 0) | 0)) as WorldId;
const skin = (SKINS as readonly string[]).includes(q.get('skin') ?? '') ? (q.get('skin') as SkinId) : 'kid';
const sceneName = q.get('scene') && SCENES[q.get('scene') ?? ''] ? (q.get('scene') as string) : 'idle';
const scene = SCENES[sceneName];
const forcedMood = (MOODS as readonly string[]).includes(q.get('mood') ?? '') ? (q.get('mood') as Mood) : null;
const freezeAt = q.has('at') ? Math.max(0, Number(q.get('at')) || 0) : null;
const gScale = world === 3 ? 0.82 : 1;

const canvas = document.getElementById('c');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('preview: #c canvas missing');
const renderer = createRenderer(canvas);
const fx = renderer.fx;

const interval = (scene.dd ? Math.PI : Math.PI * 2) / scene.omega;
const t0 = interval;
const beatTime = (k: number): number => t0 + k * interval;
const beatSpec = (k: number): BeatSpec => scene.pattern[k % scene.pattern.length];

interface Sim {
  t: number;
  player: PlayerState;
  lastJumpBeat: number;
  judged: number;
  combo: number;
  hurtUntil: number;
  invulnUntil: number;
  nextHit: number;
}

const sim: Sim = {
  t: 0,
  player: { height: 0, vy: 0, grounded: true, level: 0, airTime: 0, landTimer: 1, buffer: 0 },
  lastJumpBeat: -1,
  judged: -1,
  combo: 0,
  hurtUntil: 0,
  invulnUntil: 0,
  nextHit: 1.6,
};

function control(s: Sim): void {
  const k = Math.max(0, Math.ceil((s.t - t0) / interval - 0.05));
  const spec = beatSpec(k);
  const p = s.player;
  if (p.grounded && beatTime(k) - s.t <= LEAD[spec.level] && s.lastJumpBeat !== k) {
    s.player = { ...p, grounded: false, vy: JUMP_V, level: 1, airTime: 0 };
    s.lastJumpBeat = k;
  } else if (!p.grounded && s.lastJumpBeat === k && p.level < spec.level && p.vy <= 30) {
    s.player = { ...p, vy: BOOST_V, level: (p.level + 1) as Level };
    fx.burst('sparkle', PLAYER_X, 470 - p.height);
  }
}

function physics(s: Sim, dt: number): void {
  const p = s.player;
  if (p.grounded) {
    s.player = { ...p, landTimer: p.landTimer + dt };
    return;
  }
  const vy = p.vy - GRAVITY * gScale * dt;
  const height = p.height + vy * dt;
  if (height <= 0 && vy < 0) {
    s.player = { height: 0, vy: 0, grounded: true, level: 0, airTime: 0, landTimer: 0, buffer: 0 };
    fx.burst('dust', PLAYER_X, 470);
    return;
  }
  s.player = { ...p, vy, height, airTime: p.airTime + dt };
}

function judge(s: Sim): void {
  const k = Math.floor((s.t - t0) / interval);
  if (k < 0 || k <= s.judged) return;
  s.judged = k;
  const p = s.player;
  if (p.grounded) return;
  s.combo++;
  const perfect = p.height >= 40;
  fx.popup(perfect ? 'PERFECT!' : 'GOOD', perfect ? 'perfect' : 'good');
  if (perfect) fx.burst('sparkle', PLAYER_X, 470 - p.height - 20);
  if (s.combo % 5 === 0) fx.popup(`${s.combo} COMBO!`, 'combo');
  if (s.combo % 12 === 0) fx.burst('confetti', PLAYER_X, 300);
  const spec = beatSpec(k);
  if (spec.kinds.includes('coin')) fx.burst('coin', PLAYER_X, 470 - p.height - 30);
  if (spec.kinds.some((kd) => kd === 'shield' || kd === 'slow' || kd === 'heart')) {
    fx.burst('powerup', PLAYER_X, 470 - p.height - 26);
    fx.popup(spec.kinds.includes('shield') ? '실드!' : spec.kinds.includes('slow') ? '슬로모!' : '하트 +1', 'info');
  }
}

function hitEvents(s: Sim): void {
  if (!scene.hit || s.t < s.nextHit) return;
  s.nextHit += 2;
  fx.burst('hit', PLAYER_X, 470 - s.player.height - 26);
  fx.popup('MISS', 'miss');
  fx.shake(0.8);
  fx.flash('rgba(255,70,70,1)');
  s.combo = 0;
  s.hurtUntil = s.t + 0.7;
  s.invulnUntil = s.t + 0.9;
}

function step(s: Sim, dt: number): void {
  s.t += dt;
  control(s);
  physics(s, dt);
  judge(s);
  hitEvents(s);
  fx.update(dt);
}

function obstacleList(t: number): VisibleObstacle[] {
  const out: VisibleObstacle[] = [];
  const kFirst = Math.max(0, Math.floor((t - t0) / interval) - 1);
  for (let k = kFirst; k < kFirst + 6; k++) {
    const x = PLAYER_X + (beatTime(k) - t) * SCROLL_SPEED;
    if (x < -40 || x > 440) continue;
    const spec = beatSpec(k);
    spec.kinds.forEach((kind, i) => {
      if (kind === 'rope') return;
      const height = kind === 'hurdle' ? 0 : kind === 'bird' ? BIRD_H : PICKUP_H[spec.level];
      out.push({ id: `${k}-${i}`, kind, level: spec.level, x, height });
    });
  }
  return out;
}

function laneList(t: number): LaneItem[] {
  const out: LaneItem[] = [];
  const kFirst = Math.max(0, Math.floor((t - t0) / interval) - 1);
  for (let k = kFirst; k < kFirst + 8; k++) {
    const timeUntil = beatTime(k) - t;
    if (timeUntil < -0.3 || timeUntil > LANE_LEAD) continue;
    const spec = beatSpec(k);
    out.push({ beatId: k, timeUntil, kinds: spec.kinds, level: spec.level });
  }
  return out;
}

function snapshot(s: Sim): RenderSnapshot {
  const phaseA = scene.omega * (s.t - t0);
  const hurt = s.t < s.hurtUntil;
  return {
    time: s.t,
    realTime: s.t,
    world,
    player: s.player,
    skin,
    rope: { phaseA, phaseB: scene.dd ? phaseA + Math.PI : null, speed: scene.omega },
    obstacles: obstacleList(s.t),
    lane: laneList(s.t),
    fever: scene.fever,
    feverGauge: scene.fever ? 1 : 0.4,
    invulnerable: s.t < s.invulnUntil,
    shield: q.get('shield') === '1',
    slowMo: q.get('slow') === '1',
    mood: forcedMood ?? (hurt ? 'hurt' : s.player.grounded ? scene.mood : 'happy'),
    reducedMotion: q.get('rm') === '1',
    showTurners: q.get('turners') !== '0',
  };
}

function resize(): void {
  renderer.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
}

function buildNav(): void {
  const nav = document.getElementById('nav');
  if (!nav || q.get('ui') === '0') return;
  const link = (key: string, val: string, label: string): string => {
    const p = new URLSearchParams(location.search);
    p.set(key, val);
    const on = (q.get(key) ?? (key === 'scene' ? 'idle' : key === 'skin' ? 'kid' : '0')) === val;
    return `<a href="?${p.toString()}" class="${on ? 'on' : ''}">${label}</a>`;
  };
  nav.innerHTML = [
    ['0', '1', '2', '3'].map((w) => link('world', w, `W${w}`)).join(''),
    Object.keys(SCENES).map((sc) => link('scene', sc, sc)).join(''),
    SKINS.map((sk) => link('skin', sk, sk)).join(''),
  ].map((row) => `<div>${row}</div>`).join('');
}

window.addEventListener('resize', resize);
resize();
buildNav();

if (freezeAt !== null) {
  const dt = 1 / 120;
  let n = 0;
  while (sim.t < freezeAt) {
    step(sim, dt);
    if (n++ % 6 === 0) renderer.render(snapshot(sim));
  }
}
let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (freezeAt === null) step(sim, dt);
  renderer.render(snapshot(sim));
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
