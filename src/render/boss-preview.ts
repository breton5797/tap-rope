// Boss QA harness (GDD-v7 §1): a running corridor with one zone boss and its attack pattern.
// Query: ?boss=<BossId>&state=intro|fight|stagger|defeated&attack=beam|floor|ceiling|drone|lane|mix
//        &world=0..3&variant=…&hp=0..1&phase=0..2&at=<sec> (freeze) &rm=1 &lane=0..2
//        &overlay=1 → draw the boss on top of the frame (before index.ts wires drawBoss/drawBossFront)
import {
  SCROLL_SPEED, VISIBLE_LEAD,
  type BossAttackKind, type BossId, type BossState, type BossView, type LaneId, type ObstacleKind, type PlayerState,
  type RenderSnapshot, type Variant, type VisibleObstacle, type WorldId,
} from '../types';
import { bossBytes, drawBoss, drawBossFront } from './boss';
import { createRenderer } from './index';
import type { SpriteCache } from './sprites';
import type { Ctx } from './util';
import type { View } from './view';

const IDS: readonly BossId[] = ['warden', 'sewer-eye', 'lab-ai', 'core', 'jailer', 'apc', 'chimera', 'crane', 'sniper', 'gunship'];
const STATES: readonly BossState[] = ['intro', 'fight', 'stagger', 'defeated'];
const KINDS: readonly BossAttackKind[] = ['beam', 'floor', 'ceiling', 'drone', 'lane'];
const VARIANTS: readonly Variant[] = ['base', 'alarm', 'dark', 'steam', 'night', 'dawn'];

const q = new URLSearchParams(location.search);
const pick = <T extends string>(key: string, list: readonly T[], def: T): T =>
  (list as readonly string[]).includes(q.get(key) ?? '') ? (q.get(key) as T) : def;
const id = pick('boss', IDS, 'warden');
const state = pick('state', STATES, 'fight');
const attackQ = q.get('attack') ?? 'mix';
const world = Math.max(0, Math.min(3, Number(q.get('world') ?? 0) | 0)) as WorldId;
const variant = pick('variant', VARIANTS, 'base');
const hp = Number(q.get('hp') ?? 0.7);
const phase = Math.max(0, Math.min(2, Number(q.get('phase') ?? 1) | 0)) as 0 | 1 | 2;
const lane = Math.max(0, Math.min(2, Number(q.get('lane') ?? 1) | 0)) as LaneId;
const freezeAt = q.has('at') ? Math.max(0, Number(q.get('at')) || 0) : null;
const reduced = q.get('rm') === '1';
const overlay = q.get('overlay') === '1';

const INTERVAL = 2.0;
const T0 = 2.0;
const kindAt = (k: number): BossAttackKind =>
  (KINDS as readonly string[]).includes(attackQ) ? (attackQ as BossAttackKind) : KINDS[k % KINDS.length];

function hazard(kind: BossAttackKind): { kind: ObstacleKind; level: 1 | 2 | 3; from: VisibleObstacle['from']; lanes: LaneId[] | null; height: number } {
  if (kind === 'beam') return { kind: 'beam', level: 2, from: id === 'apc' ? 'back' : 'front', lanes: null, height: 0 };
  if (kind === 'floor') return { kind: 'floor', level: 1, from: 'bottom', lanes: null, height: 0 };
  if (kind === 'ceiling') return { kind: 'ceiling', level: 1, from: 'top', lanes: null, height: 0 };
  if (kind === 'drone') return { kind: 'drone', level: 1, from: 'top', lanes: null, height: 82 };
  return { kind: id === 'apc' ? 'chaser' : id === 'jailer' ? 'guard' : 'drop', level: 1, from: id === 'apc' ? 'back' : 'top', lanes: [lane], height: 0 };
}

function obstacles(t: number): VisibleObstacle[] {
  const out: VisibleObstacle[] = [];
  if (state !== 'fight') return out;
  for (let k = 0; k < 400; k++) {
    const tu = T0 + k * INTERVAL - t;
    if (tu < -0.4) continue;
    if (tu > VISIBLE_LEAD) break;
    const h = hazard(kindAt(k));
    out.push({ id: `${k}`, kind: h.kind, level: h.level, from: h.from, timeUntil: tu, height: h.height, lanes: h.lanes, sudden: h.lanes !== null || h.from === 'back' });
  }
  return out;
}

function bossView(t: number): BossView {
  let attack: BossView['attack'] = null;
  if (state === 'fight') {
    const k = Math.max(0, Math.ceil((t - T0) / INTERVAL - 0.075));
    const tu = T0 + k * INTERVAL - t;
    if (tu <= 1.7) {
      const kind = kindAt(k);
      attack = { kind, timeUntil: tu, lanes: kind === 'lane' ? [lane] : null };
    }
  }
  const age = state === 'stagger' ? t % 1.8 : state === 'defeated' ? t % 2.6 : t;
  return { id, phase, hp, state, stateAge: age, attack };
}

const PLAYER: PlayerState = {
  height: 0, vy: 0, grounded: true, level: 0, airTime: 0, landTimer: 1, buffer: 0, sliding: false, slideTime: 0, slideAge: 0,
  pendingSlide: false, lastTap: 'none', lane, laneFrom: lane, laneAge: 1,
};

function snapshot(t: number): RenderSnapshot {
  return {
    time: t, realTime: t, world, variant, player: PLAYER, skin: 'kid', doors: [], obstacles: obstacles(t), lane: [],
    escort: false, fever: false, feverGauge: 0.3, invulnerable: false, shield: false, slowMo: false, mood: 'idle',
    reducedMotion: reduced, scroll: t * SCROLL_SPEED, running: true, boss: bossView(t),
  };
}

const canvas = document.getElementById('c');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('boss-preview: #c canvas missing');
const renderer = createRenderer(canvas);
/** the renderer's internals, for the pre-wiring overlay mode only */
const inner = renderer as unknown as { ctx: Ctx; view: View; sprites: SpriteCache };

function draw(t: number): void {
  const snap = snapshot(t);
  renderer.render(snap);
  if (overlay) {
    drawBoss(inner.ctx, inner.view, snap, t, inner.sprites);
    drawBossFront(inner.ctx, inner.view, snap, t, inner.sprites);
  }
}

function resize(): void {
  renderer.resize(window.innerWidth, window.innerHeight, window.devicePixelRatio || 1);
}
window.addEventListener('resize', resize);
resize();

const qa = window as unknown as { __ready: boolean; __mem: () => unknown; __frameMs: number[] };
qa.__ready = false;
qa.__frameMs = [];
qa.__mem = () => (renderer as unknown as { memoryBytes(): unknown }).memoryBytes();
/** bytes of the boss-owned sprites (procedural body + effect sprites) and the baked photo */
(qa as unknown as { __bossMem: () => number }).__bossMem = () => {
  const map = (inner.sprites as unknown as { map: Map<string, { canvas: HTMLCanvasElement }> }).map;
  let b = bossBytes();
  for (const [k, sp] of map) if (k.startsWith('boss')) b += sp.canvas.width * sp.canvas.height * 4;
  return b;
};

let t = 0;
let last = performance.now();
function frame(now: number): void {
  if (freezeAt === null) t += Math.min(0.05, (now - last) / 1000);
  last = now;
  const s0 = performance.now();
  draw(t);
  qa.__frameMs.push(performance.now() - s0);
  if (qa.__frameMs.length > 300) qa.__frameMs.shift();
  requestAnimationFrame(frame);
}

async function boot(): Promise<void> {
  if (q.get('art') !== '0') {
    await renderer.load();
    draw(0);
    await new Promise((r) => setTimeout(r, 400));
  }
  if (freezeAt !== null) {
    t = freezeAt;
    draw(t);
    await new Promise((r) => setTimeout(r, 300)); // boss photo fetch / bake
    draw(t);
  }
  qa.__ready = true;
  last = performance.now();
  requestAnimationFrame(frame);
}
void boot();
