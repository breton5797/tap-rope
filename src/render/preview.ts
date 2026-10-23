// Visual QA harness (LASER ESCAPE): animated mock scenes for the renderer.
// Query: ?world=0..3&variant=base|alarm|dark|steam|night|dawn&skin=kid
//        &scene=idle|run|jump2|jump3|slide|dive|floor|beams|rear|ceiling|high|drone|gate|pulse|fever|hit|escort
//        &at=<sec> (freeze) &escort=1 &shield=1 &slow=1 &mood=<Mood> &rm=1 &ui=0
import {
  LANE_LEAD, SCROLL_SPEED, VISIBLE_LEAD,
  type LaneItem, type Level, type Mood, type PlayerState, type RenderSnapshot, type SkinId, type Variant,
  type VisibleObstacle, type WorldId,
} from '../types';
import { createRenderer } from './index';
import { SCENES, type BeatSpec } from './preview-scenes';

const SKINS: readonly SkinId[] = ['kid', 'cat', 'bunny', 'robot', 'ninja', 'astro'];
const MOODS: readonly Mood[] = ['idle', 'happy', 'hurt', 'cheer', 'worried'];
const VARIANTS: readonly Variant[] = ['base', 'alarm', 'dark', 'steam', 'night', 'dawn'];
const G = 3000;
const JUMP_V = 660;
const BOOST_V = 700;
const FALL_V = 1100;
const SLIDE_TIME = 0.55;
const LEAD = [0, 0.22, 0.45, 0.62];
const PICKUP_H = [0, 40, 110, 180];

const q = new URLSearchParams(location.search);
const pick = <T extends string>(key: string, list: readonly T[], def: T): T =>
  (list as readonly string[]).includes(q.get(key) ?? '') ? (q.get(key) as T) : def;
const world = Math.max(0, Math.min(3, Number(q.get('world') ?? 0) | 0)) as WorldId;
const variant = pick('variant', VARIANTS, 'base');
const skin = pick('skin', SKINS, 'kid');
const sceneName = pick('scene', Object.keys(SCENES), 'run');
const scene = SCENES[sceneName];
const forcedMood = q.has('mood') ? pick('mood', MOODS, 'idle') : null;
const freezeAt = q.has('at') ? Math.max(0, Number(q.get('at')) || 0) : null;

const canvas = document.getElementById('c');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('preview: #c canvas missing');
const renderer = createRenderer(canvas);
const fx = renderer.fx;

const t0 = 1.4;
const beatTime = (k: number): number => t0 + k * scene.interval;
const specOf = (k: number): BeatSpec | null => (scene.pattern.length ? scene.pattern[k % scene.pattern.length] : null);

const IDLE: PlayerState = {
  height: 0, vy: 0, grounded: true, level: 0, airTime: 0, landTimer: 1, buffer: 0,
  sliding: false, slideTime: 0, slideAge: 0, pendingSlide: false, lastTap: 'none',
};

interface Sim {
  t: number;
  p: PlayerState;
  acted: number;
  judged: number;
  combo: number;
  hurtUntil: number;
  nextHit: number;
}
const sim: Sim = { t: 0, p: IDLE, acted: -1, judged: -1, combo: 0, hurtUntil: 0, nextHit: 1.9 };

function nextBeat(s: Sim): number {
  return Math.max(0, Math.ceil((s.t - t0) / scene.interval - 0.05));
}

function control(s: Sim): void {
  const k = nextBeat(s);
  const spec = specOf(k);
  if (!spec || !scene.running) return;
  const until = beatTime(k) - s.t;
  const p = s.p;
  if (spec.action === 'slide' && p.grounded && !p.sliding && until <= 0.22 && s.acted !== k) {
    s.p = { ...p, sliding: true, slideTime: SLIDE_TIME, slideAge: 0 };
    s.acted = k;
    fx.burst('dust');
    return;
  }
  const lead = spec.action === 'dive' ? 0.62 : LEAD[spec.level];
  if ((spec.action === 'jump' || spec.action === 'dive') && p.grounded && until <= lead && s.acted !== k) {
    s.p = { ...p, grounded: false, sliding: false, vy: JUMP_V, level: 1, airTime: 0, lastTap: 'jump' };
    s.acted = k;
    return;
  }
  if (p.grounded || s.acted !== k) return;
  if (spec.action === 'dive' && !p.pendingSlide && p.vy < 60) s.p = { ...p, vy: -FALL_V, pendingSlide: true };
  else if (spec.action === 'jump' && p.level < spec.level && p.vy <= 30) {
    s.p = { ...p, vy: BOOST_V, level: (p.level + 1) as Level, lastTap: 'boost' };
    fx.burst('sparkle');
  }
}

function physics(s: Sim, dt: number): void {
  const p = s.p;
  if (p.sliding) {
    const left = p.slideTime - dt;
    s.p = left <= 0 ? { ...p, sliding: false, slideTime: 0 } : { ...p, slideTime: left, slideAge: p.slideAge + dt };
    return;
  }
  if (p.grounded) {
    s.p = { ...p, landTimer: p.landTimer + dt };
    return;
  }
  const vy = p.vy - G * dt;
  const height = p.height + vy * dt;
  if (height <= 0 && vy < 0) {
    const slide = p.pendingSlide;
    s.p = { ...IDLE, landTimer: 0, sliding: slide, slideTime: slide ? SLIDE_TIME : 0 };
    fx.burst('dust');
    return;
  }
  s.p = { ...p, vy, height, airTime: p.airTime + dt };
}

function judge(s: Sim): void {
  const k = Math.floor((s.t - t0) / scene.interval);
  const spec = specOf(k);
  if (k < 0 || k <= s.judged || !spec || !scene.running) return;
  s.judged = k;
  if (spec.action === 'none') return;
  const ok = spec.action === 'jump' ? !s.p.grounded : s.p.sliding;
  if (!ok) return;
  s.combo++;
  const perfect = spec.action !== 'jump' || s.p.height >= 40;
  fx.popup(perfect ? 'PERFECT!' : 'GOOD', perfect ? 'perfect' : 'good');
  if (perfect) fx.burst('sparkle');
  if (s.combo % 5 === 0) fx.popup(`${s.combo} COMBO!`, 'combo');
  if (spec.items.some((i) => i.kind === 'coin')) fx.burst('coin');
}

function hitEvents(s: Sim): void {
  if (!scene.hit || s.t < s.nextHit) return;
  s.nextHit += 2;
  fx.burst('hit');
  fx.popup('MISS', 'miss');
  fx.shake(0.8);
  fx.flash('rgba(120,220,255,1)');
  s.combo = 0;
  s.hurtUntil = s.t + 0.7;
}

function step(s: Sim, dt: number): void {
  s.t += dt;
  control(s);
  physics(s, dt);
  judge(s);
  hitEvents(s);
  fx.update(dt);
}

function heightOf(kind: string, level: Level): number {
  if (kind === 'drone') return 82;
  if (kind === 'coin' || kind === 'shield' || kind === 'slow' || kind === 'heart') return PICKUP_H[level];
  return 0;
}

function obstacleList(t: number): VisibleObstacle[] {
  const out: VisibleObstacle[] = [];
  if (!scene.running) return out;
  const kFirst = Math.max(0, Math.floor((t - t0) / scene.interval) - 1);
  for (let k = kFirst; k < kFirst + 8; k++) {
    const spec = specOf(k);
    const timeUntil = beatTime(k) - t;
    if (!spec || timeUntil < -0.4 || timeUntil > VISIBLE_LEAD) continue;
    spec.items.forEach((i, idx) => {
      out.push({ id: `${k}-${idx}`, kind: i.kind, level: i.level, from: i.from, timeUntil, height: heightOf(i.kind, i.level) });
    });
  }
  return out;
}

function laneList(t: number): LaneItem[] {
  const out: LaneItem[] = [];
  if (!scene.running) return out;
  const kFirst = Math.max(0, Math.floor((t - t0) / scene.interval) - 1);
  for (let k = kFirst; k < kFirst + 10; k++) {
    const spec = specOf(k);
    const timeUntil = beatTime(k) - t;
    if (!spec || timeUntil < -0.25 || timeUntil > LANE_LEAD) continue;
    const main = spec.items.find((i) => i.from !== null) ?? null;
    const jumpy = spec.items.some((i) => i.kind === 'floor' || i.kind === 'beam');
    out.push({
      beatId: k, timeUntil, kinds: spec.items.map((i) => i.kind), level: jumpy ? spec.level : 0,
      move: spec.move, from: main ? main.from : null,
    });
  }
  return out;
}

function snapshot(s: Sim): RenderSnapshot {
  const hurt = s.t < s.hurtUntil;
  return {
    time: s.t, realTime: s.t, world, variant, player: s.p, skin,
    obstacles: obstacleList(s.t), lane: laneList(s.t),
    escort: scene.escort === true || q.get('escort') === '1',
    fever: scene.fever ?? false, feverGauge: scene.fever ? 1 : 0.4,
    invulnerable: hurt, shield: q.get('shield') === '1', slowMo: q.get('slow') === '1',
    mood: forcedMood ?? (hurt ? 'hurt' : s.p.grounded && !s.p.sliding ? 'idle' : 'happy'),
    reducedMotion: q.get('rm') === '1',
    scroll: scene.running ? s.t * SCROLL_SPEED : 120,
    running: scene.running,
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
    ['0', '1', '2', '3'].map((w) => link('world', w, String(world))).join('') + VARIANTS.map((vr) => link('variant', vr, variant)).join(''),
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
