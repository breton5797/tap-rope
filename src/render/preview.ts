// Visual QA harness (LASER ESCAPE): animated mock scenes for the renderer.
// Query: ?world=0..3&variant=base|alarm|dark|steam|night|dawn&skin=kid
//        &scene=idle|run|jump2|jump3|slide|dive|floor|beams|rear|ceiling|high|drone|gate|pulse|fever|hit|escort
//               |lanes|guard|drop|chaser|warn|lanejump|sheets|doorTurn|doorStairs|doorElevator
//        &at=<sec> (freeze) &lane=0..2 (start lane) &escort=1 &shield=1 &slow=1 &mood=<Mood> &rm=1 &ui=0
import {
  LANE_LEAD, LANE_SWITCH_TIME, SCROLL_SPEED, VISIBLE_LEAD,
  type DoorView, type LaneId, type LaneItem, type Level, type Mood, type PlayerState, type RenderSnapshot, type Scene,
  type SkinId, type Variant, type VisibleObstacle, type WorldId,
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

const startLane = Math.max(0, Math.min(2, Number(q.get('lane') ?? 1) | 0)) as LaneId;
const IDLE: PlayerState = {
  height: 0, vy: 0, grounded: true, level: 0, airTime: 0, landTimer: 1, buffer: 0,
  sliding: false, slideTime: 0, slideAge: 0, pendingSlide: false, lastTap: 'none',
  lane: startLane, laneFrom: startLane, laneAge: 1,
};
const LANE_HAZARD = new Set(['guard', 'drop', 'chaser']);
const PICKUPS = new Set(['coin', 'shield', 'slow', 'heart']);

/** v5 door schedule: a door every DOOR_EVERY s, alternating between two looks. */
const DOOR_FIRST = 3.6;
const DOOR_EVERY = 4.5;
const LOOKS: readonly Scene[] = [{ world, variant }, { world: ((world + 1) % 4) as WorldId, variant: world === 1 ? 'base' : 'dark' }];

function doorsPassed(t: number): number {
  return scene.door ? Math.max(0, Math.floor((t - DOOR_FIRST) / DOOR_EVERY) + 1) : 0;
}

function doorList(t: number): DoorView[] {
  const kind = scene.door;
  if (!kind) return [];
  const out: DoorView[] = [];
  for (let k = 0; k < 40; k++) {
    const timeUntil = DOOR_FIRST + k * DOOR_EVERY - t;
    if (timeUntil > 3) break;
    if (timeUntil < -1) continue;
    out.push({ timeUntil, section: k + 1, transition: kind, from: LOOKS[k % 2], to: LOOKS[(k + 1) % 2] });
  }
  return out;
}

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
  if (spec.lane !== undefined && spec.lane !== s.p.lane && until <= 0.55 && s.p.laneAge >= LANE_SWITCH_TIME) {
    const to = (s.p.lane + Math.sign(spec.lane - s.p.lane)) as LaneId;
    fx.impact('lane', { dir: to < s.p.lane ? -1 : 1 });
    s.p = { ...s.p, laneFrom: s.p.lane, lane: to, laneAge: 0 };
  }
  const p = s.p;
  if (spec.action === 'slide' && p.grounded && !p.sliding && until <= 0.22 && s.acted !== k) {
    s.p = { ...p, sliding: true, slideTime: SLIDE_TIME, slideAge: 0 };
    s.acted = k;
    fx.burst('dust');
    fx.impact('slide', {});
    return;
  }
  const lead = spec.action === 'dive' ? 0.62 : LEAD[spec.level];
  if ((spec.action === 'jump' || spec.action === 'dive') && p.grounded && until <= lead && s.acted !== k) {
    s.p = { ...p, grounded: false, sliding: false, vy: JUMP_V, level: 1, airTime: 0, lastTap: 'jump' };
    s.acted = k;
    fx.impact('jump', { level: 1 });
    return;
  }
  if (p.grounded || s.acted !== k) return;
  if (spec.action === 'dive' && !p.pendingSlide && p.vy < 60) s.p = { ...p, vy: -FALL_V, pendingSlide: true };
  else if (spec.action === 'jump' && p.level < spec.level && p.vy <= 30) {
    s.p = { ...p, vy: BOOST_V, level: (p.level + 1) as Level, lastTap: 'boost' };
    fx.burst('sparkle');
    fx.impact('boost', { level: p.level + 1 });
  }
}

function physics(s: Sim, dt: number): void {
  s.p = { ...s.p, laneAge: s.p.laneAge + dt };
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
    s.p = { ...IDLE, lane: p.lane, laneFrom: p.laneFrom, laneAge: p.laneAge, landTimer: 0, sliding: slide, slideTime: slide ? SLIDE_TIME : 0 };
    fx.burst('dust');
    fx.impact('land', { level: Math.max(1, p.level) });
    if (slide) fx.impact('slide', {});
    return;
  }
  s.p = { ...p, vy, height, airTime: p.airTime + dt };
}

function judge(s: Sim): void {
  const k = Math.floor((s.t - t0) / scene.interval);
  const spec = specOf(k);
  if (k < 0 || k <= s.judged || !spec || !scene.running) return;
  s.judged = k;
  const laneOk = !spec.items.some((i) => LANE_HAZARD.has(i.kind) && i.lanes?.includes(s.p.lane));
  if (spec.action === 'none') {
    if (spec.items.some((i) => LANE_HAZARD.has(i.kind)) && laneOk) {
      fx.popup('PERFECT!', 'perfect');
      fx.impact('graze', { zone: 'side', level: 0 });
    }
    return;
  }
  const ok = laneOk && (spec.action === 'jump' ? !s.p.grounded : s.p.sliding);
  if (!ok) return;
  s.combo++;
  const perfect = spec.action !== 'jump' || s.p.height >= 40;
  fx.popup(perfect ? 'PERFECT!' : 'GOOD', perfect ? 'perfect' : 'good');
  if (perfect) fx.burst('sparkle');
  const zone = spec.items.some((i) => LANE_HAZARD.has(i.kind)) ? 'side' : spec.action === 'jump' ? 'low' : 'high';
  fx.impact(perfect ? 'graze' : 'pass', { zone, level: spec.action === 'jump' ? spec.level : 0 });
  if (s.combo % 5 === 0) fx.popup(`${s.combo} COMBO!`, 'combo');
  if (spec.items.some((i) => i.kind === 'coin')) fx.burst('coin');
}

function hitEvents(s: Sim): void {
  if (!scene.hit || s.t < s.nextHit) return;
  s.nextHit += 2;
  fx.burst('hit');
  fx.impact('hit', {});
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
      const sudden = i.kind === 'drop' || i.kind === 'chaser' || ((i.kind === 'beam' || i.kind === 'high') && i.from === 'back');
      const lanes = i.lanes ?? (PICKUPS.has(i.kind) ? [1 as LaneId] : null);
      out.push({ id: `${k}-${idx}`, kind: i.kind, level: i.level, from: i.from, timeUntil, height: heightOf(i.kind, i.level), lanes, sudden });
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
      blocked: [...new Set(spec.items.filter((i) => LANE_HAZARD.has(i.kind)).flatMap((i) => i.lanes ?? []))].sort(),
    });
  }
  return out;
}

function snapshot(s: Sim): RenderSnapshot {
  const hurt = s.t < s.hurtUntil;
  const look = LOOKS[doorsPassed(s.t) % 2];
  return {
    time: s.t, realTime: s.t, world: look.world, variant: look.variant, player: s.p, skin, doors: doorList(s.t), boss: null,
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

// QA hooks: canvas backing-store bytes, and a ready flag for screenshot scripts
const qa = window as unknown as { __mem: () => unknown; __ready: boolean; __frameMs: number[] };
qa.__mem = () => (renderer as unknown as { memoryBytes(): unknown }).memoryBytes();
qa.__ready = false;
qa.__frameMs = [];

let last = performance.now();
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (freezeAt === null) step(sim, dt);
  const t0 = performance.now();
  renderer.render(snapshot(sim));
  qa.__frameMs.push(performance.now() - t0);
  if (qa.__frameMs.length > 600) qa.__frameMs.shift();
  requestAnimationFrame(frame);
}

async function boot(): Promise<void> {
  if (q.get('art') !== '0') {
    await renderer.load();
    // one render starts decoding the theme's photos; give the decode a moment before freezing
    renderer.render(snapshot(sim));
    await new Promise((r) => setTimeout(r, 400));
    renderer.render(snapshot(sim));
  }
  if (freezeAt !== null) {
    let n = 0;
    while (sim.t < freezeAt) {
      step(sim, 1 / 120);
      if (n++ % 6 === 0) renderer.render(snapshot(sim));
    }
  }
  qa.__ready = true;
  last = performance.now();
  requestAnimationFrame(frame);
}
void boot();
