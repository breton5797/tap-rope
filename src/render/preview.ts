// Visual QA harness (v2): animated mock scenes for the renderer (render-preview.html).
// Query: ?world=0..3&skin=kid&mode=long|solo
//        &scene=idle|jump2|jump3|tumble|side|cross|back|ring|ball|hurdles|bird|fever|dd|hit
//        &at=<sec> (freeze) &shield=1 &slow=1 &mood=<Mood> &rm=1 &ui=0
import {
  LANE_LEAD, SCROLL_SPEED,
  type Lane, type LaneItem, type Level, type Mood, type MoveId, type ObstacleKind, type PlayerState,
  type RenderSnapshot, type RopeMode, type SkinId, type VisibleObstacle, type WorldId,
} from '../types';
import { createRenderer } from './index';

interface Item {
  readonly kind: ObstacleKind;
  readonly lane?: Lane;
}

interface BeatSpec {
  readonly items: readonly Item[];
  readonly level: Level;
  readonly move: MoveId;
}

interface SceneCfg {
  readonly omega: number;
  readonly pattern: readonly BeatSpec[];
  readonly mode: RopeMode;
  readonly dd?: boolean;
  readonly fever?: boolean;
  readonly hit?: boolean;
  readonly backward?: boolean;
  readonly mood?: Mood;
}

const R: Item = { kind: 'rope' };
const it = (kind: ObstacleKind, lane: Lane = 0): Item => ({ kind, lane });
const b = (items: readonly Item[], level: Level, move: MoveId = 'jump'): BeatSpec => ({ items, level, move });

const SCENES: Readonly<Record<string, SceneCfg>> = {
  idle: { omega: 4.6, mode: 'long', pattern: [b([R], 1)] },
  jump2: { omega: 4.2, mode: 'long', pattern: [b([R], 2, 'double')], mood: 'happy' },
  jump3: { omega: 4.3, mode: 'long', pattern: [b([R], 3, 'triple')], mood: 'cheer' },
  tumble: { omega: 3.8, mode: 'long', pattern: [b([it('ring')], 2, 'tumble'), b([R], 1)] },
  ring: { omega: 3.8, mode: 'long', pattern: [b([it('ring')], 2, 'tumble'), b([R, it('coin', 1)], 1), b([it('ring'), it('coin')], 2, 'tumble'), b([R, it('bird')], 1, 'bird')] },
  side: { omega: 4.0, mode: 'long', pattern: [b([R, it('ball', 0)], 1, 'side'), b([R, it('ball', 1)], 1, 'side'), b([R], 1)] },
  ball: { omega: 3.6, mode: 'long', pattern: [b([it('ball', -1), it('ball', 0)], 1, 'side'), b([R, it('coin', 1)], 1), b([it('ball', 1)], 1, 'side'), b([R], 1)] },
  cross: { omega: 4.2, mode: 'solo', pattern: [b([R], 1, 'cross'), b([R], 1), b([R], 2, 'cross')] },
  back: { omega: 4.4, mode: 'solo', pattern: [b([R], 1, 'back')], backward: true },
  hurdles: {
    omega: 4.0, mode: 'long',
    pattern: [b([R, it('hurdle')], 1), b([it('hurdle'), it('coin', -1)], 2, 'double'), b([R, it('hurdle')], 3, 'triple'), b([R, it('bird')], 1, 'bird'), b([R, it('shield', 1)], 2, 'double'), b([it('hurdle'), it('heart')], 2, 'double'), b([R, it('slow', -1)], 1)],
  },
  bird: { omega: 4.4, mode: 'long', pattern: [b([R, it('bird')], 1, 'bird'), b([R], 1), b([R, it('coin')], 1)], mood: 'worried' },
  fever: { omega: 4.6, mode: 'long', pattern: [b([R], 1), b([R], 2, 'double'), b([R, it('coin')], 1), b([R], 3, 'triple')], fever: true, mood: 'cheer' },
  dd: { omega: 3.7, mode: 'long', pattern: [b([R], 1, 'dd')], dd: true, mood: 'happy' },
  hit: { omega: 4.6, mode: 'long', pattern: [b([R], 1), b([R, it('hurdle')], 1)], hit: true },
};

const SKINS: readonly SkinId[] = ['kid', 'cat', 'bunny', 'robot', 'ninja', 'astro'];
const MOODS: readonly Mood[] = ['idle', 'happy', 'hurt', 'cheer', 'worried'];
const GRAVITY = 3000;
const JUMP_V = 660;
const BOOST_V = 700;
const TUMBLE_V = 980;
const LEAD = [0, 0.22, 0.45, 0.62];
const TUMBLE_LEAD = 0.33;
const PICKUP_H = [0, 50, 120, 185];
const LANE_SPEED = 9;

const q = new URLSearchParams(location.search);
const pick = <T extends string>(key: string, list: readonly T[], def: T): T =>
  (list as readonly string[]).includes(q.get(key) ?? '') ? (q.get(key) as T) : def;
const world = Math.max(0, Math.min(3, Number(q.get('world') ?? 0) | 0)) as WorldId;
const skin = pick('skin', SKINS, 'kid');
const sceneName = pick('scene', Object.keys(SCENES), 'idle');
const scene = SCENES[sceneName];
const mode = pick<RopeMode>('mode', ['long', 'solo'], scene.mode);
const forcedMood = q.has('mood') ? pick('mood', MOODS, 'idle') : null;
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
const ballLanes = (spec: BeatSpec): Lane[] => spec.items.filter((i) => i.kind === 'ball').map((i) => i.lane ?? 0);
const has = (spec: BeatSpec, kind: ObstacleKind): boolean => spec.items.some((i) => i.kind === kind);

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
  player: {
    height: 0, vy: 0, grounded: true, level: 0, airTime: 0, landTimer: 1, buffer: 0,
    lane: 0, laneX: 0, tumble: false, cross: false, backward: scene.backward ?? false, lastTap: 'none', pendingSwipe: null,
  },
  lastJumpBeat: -1, judged: -1, combo: 0, hurtUntil: 0, invulnUntil: 0, nextHit: 1.6,
};

function safeLane(lane: Lane, blocked: readonly Lane[]): Lane {
  const free = ([-1, 0, 1] as const).filter((l) => !blocked.includes(l));
  return free.reduce((best, l) => (Math.abs(l - lane) < Math.abs(best - lane) ? l : best), free[0]);
}

function takeoff(s: Sim, spec: BeatSpec, k: number): void {
  const p = s.player;
  const tumble = has(spec, 'ring');
  const lane = ballLanes(spec).includes(p.lane) ? safeLane(p.lane, ballLanes(spec)) : p.lane;
  s.player = { ...p, grounded: false, vy: tumble ? TUMBLE_V : JUMP_V, level: 1, airTime: 0, tumble, lane, lastTap: 'jump' };
  s.lastJumpBeat = k;
  if (tumble) fx.burst('sparkle');
}

function control(s: Sim): void {
  const k = Math.max(0, Math.ceil((s.t - t0) / interval - 0.05));
  const spec = beatSpec(k);
  const p = s.player;
  const lead = has(spec, 'ring') ? TUMBLE_LEAD : LEAD[spec.level];
  if (p.grounded && beatTime(k) - s.t <= lead && s.lastJumpBeat !== k) return takeoff(s, spec, k);
  if (p.grounded || s.lastJumpBeat !== k || p.tumble) return;
  if (spec.move === 'cross' && !p.cross && p.vy < 200) s.player = { ...p, cross: true };
  else if (p.level < spec.level && p.vy <= 30) {
    s.player = { ...p, vy: BOOST_V, level: (p.level + 1) as Level, lastTap: 'boost' };
    fx.burst('sparkle');
  }
}

function physics(s: Sim, dt: number): void {
  const p = s.player;
  const dl = p.lane - p.laneX;
  const laneX = Math.abs(dl) < LANE_SPEED * dt ? p.lane : p.laneX + Math.sign(dl) * LANE_SPEED * dt;
  if (p.grounded) {
    s.player = { ...p, laneX, landTimer: p.landTimer + dt };
    return;
  }
  const vy = p.vy - GRAVITY * gScale * dt;
  const height = p.height + vy * dt;
  if (height <= 0 && vy < 0) {
    s.player = { ...p, laneX, height: 0, vy: 0, grounded: true, level: 0, airTime: 0, landTimer: 0, tumble: false, cross: false, lastTap: 'none' };
    fx.burst('dust');
    return;
  }
  s.player = { ...p, laneX, vy, height, airTime: p.airTime + dt };
}

function judge(s: Sim): void {
  const k = Math.floor((s.t - t0) / interval);
  if (k < 0 || k <= s.judged) return;
  s.judged = k;
  const p = s.player;
  if (p.grounded) return;
  s.combo++;
  const perfect = p.height >= 40 || p.tumble;
  fx.popup(perfect ? 'PERFECT!' : 'GOOD', perfect ? 'perfect' : 'good');
  if (perfect) fx.burst('sparkle');
  if (s.combo % 5 === 0) fx.popup(`${s.combo} COMBO!`, 'combo');
  if (s.combo % 12 === 0) fx.burst('confetti', 180, 260);
  const spec = beatSpec(k);
  if (spec.items.some((i) => i.kind === 'coin' && (i.lane ?? 0) === p.lane)) fx.burst('coin');
}

function hitEvents(s: Sim): void {
  if (!scene.hit || s.t < s.nextHit) return;
  s.nextHit += 2;
  fx.burst('hit');
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

function heightOf(kind: ObstacleKind, level: Level): number {
  if (kind === 'bird') return 110;
  if (kind === 'hurdle' || kind === 'ring' || kind === 'ball') return 0;
  return PICKUP_H[level];
}

function obstacleList(t: number): VisibleObstacle[] {
  const out: VisibleObstacle[] = [];
  const kFirst = Math.max(0, Math.floor((t - t0) / interval) - 1);
  for (let k = kFirst; k < kFirst + 8; k++) {
    const z = (beatTime(k) - t) * SCROLL_SPEED;
    if (z < -80 || z > 900) continue;
    const spec = beatSpec(k);
    spec.items.forEach((i, idx) => {
      if (i.kind === 'rope') return;
      out.push({ id: `${k}-${idx}`, kind: i.kind, level: spec.level, lane: i.lane ?? 0, z, height: heightOf(i.kind, spec.level) });
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
    const kinds = spec.items.map((i) => i.kind);
    const level = has(spec, 'rope') || has(spec, 'hurdle') ? spec.level : 0;
    out.push({ beatId: k, timeUntil, kinds, level, move: spec.move, ballLanes: ballLanes(spec) });
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
    rope: { phaseA, phaseB: scene.dd && mode === 'long' ? phaseA + Math.PI : null, speed: scene.omega, mode },
    obstacles: obstacleList(s.t),
    lane: laneList(s.t),
    fever: scene.fever ?? false,
    feverGauge: scene.fever ? 1 : 0.4,
    invulnerable: s.t < s.invulnUntil,
    shield: q.get('shield') === '1',
    slowMo: q.get('slow') === '1',
    mood: forcedMood ?? (hurt ? 'hurt' : s.player.grounded ? scene.mood ?? 'idle' : 'happy'),
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
  const link = (key: string, val: string, cur: string): string => {
    const p = new URLSearchParams(location.search);
    p.set(key, val);
    return `<a href="?${p.toString()}" class="${cur === val ? 'on' : ''}">${val}</a>`;
  };
  nav.innerHTML = [
    ['0', '1', '2', '3'].map((w) => link('world', w, String(world))).join('') + link('mode', 'long', mode) + link('mode', 'solo', mode),
    Object.keys(SCENES).map((sc) => link('scene', sc, sceneName)).join(''),
    SKINS.map((sk) => link('skin', sk, skin)).join(''),
  ].map((row) => `<div>${row}</div>`).join('');
}

window.addEventListener('resize', resize);
resize();
buildNav();

if (freezeAt !== null) {
  let n = 0;
  while (sim.t < freezeAt) {
    step(sim, 1 / 120);
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
