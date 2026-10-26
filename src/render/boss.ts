// Zone bosses (GDD-v7 §1) — a presentation layer over the v6 hazards. drawBoss() paints the boss behind
// the lanes (photo sprite, or the procedural silhouette until it exists) with its idle motion, sensors,
// charge-up glow and state animation (intro reveal, stagger, defeated explosions). drawBossFront() runs
// after the lanes and ties each attack to the real hazard: an aim line while charging, then at the
// moment the hazard actually appears (flying beam enters the screen / emitters arm / "!" warning) a
// muzzle flash plus a tracer from the boss to it. Reduced motion: no shake, no flashes, steady glows.
import {
  PLAYER_X, WARN_LEAD, type BossAttackKind, type BossView, type LaneId, type LaserFrom, type RenderSnapshot,
  type VisibleObstacle,
} from '../types';
import { bossPhoto, bossPhotoFit } from './boss-art';
import { fxSprites, glowAt, puffAt, SCATTER, sparks, type FxSprites } from './boss-fx';
import { BOSS_RIGS, type BossRig, type Pt } from './boss-rigs';
import { BOSS_SHAPES } from './boss-shapes';
import {
  ARM_TIME, BEAM_H, CEIL_H, CEIL_Y, ENTER_TIME, FLOOR_BACK, HIGH_H, beamSpeed, fixedX, flyingX, laneY, projX, projY, visualLane,
} from './layout';
import { beam, LASER_RED } from './lasers';
import { blitScaled, type Sprite, type SpriteCache } from './sprites';
import { clamp, easeOutCubic, oval, vGrad, type Ctx } from './util';
import type { View } from './view';

/**
 * when each attack kind visibly launches (s before the beat): the moment its real hazard appears. A
 * flying beam instead fires when its head passes under the boss's muzzle (beamLaunch, per frame), so
 * the shot visibly drops from the muzzle into the lane and runs on to the agent.
 */
const LAUNCH: Readonly<Record<BossAttackKind, number>> = {
  beam: ENTER_TIME, floor: ARM_TIME, ceiling: ARM_TIME, drone: WARN_LEAD, lane: WARN_LEAD,
};
let beamLaunch = ENTER_TIME;
const CHARGE = 0.7;
const FLASH = 0.3;
const INTRO = 1.4;
const DEFEAT_FADE = 1.4;
const DEFEAT_END = 2.05;
const DRONE_H = 160;

/** the boss pose this frame (screen anchor, scale, rotation, opacity), shared with drawBossFront */
interface Pose {
  ok: boolean;
  x: number;
  y: number;
  s: number;
  rot: number;
  alpha: number;
  ax: number;
  ay: number;
}
const POSE: Pose = { ok: false, x: 0, y: 0, s: 1, rot: 0, alpha: 1, ax: 0, ay: 0 };
const PT = { x: 0, y: 0 };

/** procedural sprite key cache (no string building per frame) */
let shapeKey = '';
let shapeId = '';
let shapeBucket = -1;
let shapeDraw: (ctx: Ctx) => void = () => undefined;

function procedural(sprites: SpriteCache, b: BossView, r: BossRig, s: number): Sprite {
  const bucket = Math.max(1, Math.round(s * 10));
  if (b.id !== shapeId || bucket !== shapeBucket) {
    shapeId = b.id;
    shapeBucket = bucket;
    shapeKey = `boss-${b.id}-${bucket}`;
    const sb = bucket / 10;
    const draw = BOSS_SHAPES[b.id];
    const h = BOSS_RIGS[b.id].h;
    shapeDraw = (ctx) => {
      ctx.scale(sb, sb);
      draw(ctx);
      // grade it into the scene: teal shadow tone, darker toward the floor (background depth)
      ctx.globalCompositeOperation = 'source-atop';
      ctx.fillStyle = vGrad(ctx, 0, h, [[0, 'rgba(20,52,60,0.18)'], [0.6, 'rgba(8,18,22,0.32)'], [1, 'rgba(0,0,0,0.55)']]);
      ctx.fillRect(0, 0, BOSS_RIGS[b.id].w, h);
      ctx.globalCompositeOperation = 'source-over';
    };
  }
  const sb = bucket / 10;
  return sprites.get(shapeKey, Math.ceil(r.w * sb), Math.ceil(r.h * sb), 0, 0, shapeDraw);
}

/** box point → local (boss-transform) coordinates */
/**
 * Rig anchors are fractions of the subject's bounds. With a photo the trimmed subject may sit inside
 * the box with margins (aspect mismatch), so anchors are remapped through its fitted rect.
 */
const FITTED = { w: 1, h: 1, fx: 0, fy: 0, fw: 1, fh: 1 };

function bx(p: Pt): number {
  return (FITTED.fx + (p[0] / FITTED.w) * FITTED.fw) * FITTED.w;
}

function by(p: Pt): number {
  return (FITTED.fy + (p[1] / FITTED.h) * FITTED.fh) * FITTED.h;
}

function lx(p: Pt): number {
  return (bx(p) - POSE.ax) * POSE.s;
}

function ly(p: Pt): number {
  return (by(p) - POSE.ay) * POSE.s;
}

/** box point → screen (through POSE), written to PT */
function toScreen(p: Pt): Readonly<{ x: number; y: number }> {
  const lx = (bx(p) - POSE.ax) * POSE.s;
  const ly = (by(p) - POSE.ay) * POSE.s;
  const c = Math.cos(POSE.rot);
  const sn = Math.sin(POSE.rot);
  PT.x = POSE.x + lx * c - ly * sn;
  PT.y = POSE.y + lx * sn + ly * c;
  return PT;
}

function anchorOf(r: BossRig, v: View, s: number): void {
  POSE.ax = r.w / 2;
  POSE.ay = r.place === 'air' ? r.h / 2 : r.place === 'ceiling' ? 0 : r.h;
  POSE.x = v.x0 + v.w * r.fx;
  POSE.y = r.place === 'air' ? CEIL_Y + 30 + (r.h / 2) * s : r.place === 'ceiling' ? CEIL_Y - 4 : FLOOR_BACK + 2;
}

/** charge 0..1 before launch, flash 1..0 just after it (both 0 when no attack) */
interface AttackPhase {
  charge: number;
  flash: number;
}
const PHASE: AttackPhase = { charge: 0, flash: 0 };

function attackPhase(b: BossView): Readonly<AttackPhase> {
  PHASE.charge = 0;
  PHASE.flash = 0;
  const a = b.attack;
  if (!a || b.state !== 'fight') return PHASE;
  const l = a.kind === 'beam' ? beamLaunch : LAUNCH[a.kind];
  if (a.timeUntil >= l) PHASE.charge = clamp(1 - (a.timeUntil - l) / CHARGE, 0, 1);
  else PHASE.flash = clamp(1 - (l - a.timeUntil) / FLASH, 0, 1);
  return PHASE;
}

/** Pose for this frame: placement + idle motion + state animation + launch recoil. */
function pose(b: BossView, r: BossRig, v: View, t: number, reduced: boolean): void {
  const s = clamp((v.w * r.frac) / r.w, 0.7, 1.7);
  anchorOf(r, v, s);
  POSE.s = s;
  POSE.rot = 0;
  POSE.alpha = 1;
  POSE.ok = true;
  const from: LaserFrom = r.facesRight ? 'back' : 'front';
  const mx = toScreen(r.src.beam).x;
  beamLaunch = clamp(Math.abs(mx - PLAYER_X) / beamSpeed(from, v), 0.15, ENTER_TIME);
  const away = r.facesRight ? -1 : 1; // recoil direction (away from the agent)
  if (!reduced) {
    if (r.idle === 'breathe') POSE.y += Math.sin(t * 1.7) * 1.5 * s;
    else if (r.idle === 'hover') {
      POSE.y += Math.sin(t * 1.3) * 4 * s;
      POSE.rot = Math.sin(t * 0.9) * 0.025;
    } else if (r.idle === 'servo') POSE.x += Math.sin(t * 0.6) * 4 * s;
    else {
      POSE.x += Math.sin(t * 23) * 0.6;
      POSE.y += Math.sin(t * 31) * 0.5;
    }
    const f = attackPhase(b).flash;
    POSE.x += away * f * f * 7 * s;
  }
  const age = b.stateAge;
  if (b.state === 'intro') {
    const e = easeOutCubic(clamp(age / INTRO, 0, 1));
    POSE.alpha = clamp(age / 0.6, 0, 1);
    if (r.place === 'ground') POSE.y += (1 - e) * r.h * 0.55 * s;
    else if (r.place === 'rear') POSE.x -= (1 - e) * 180;
    else POSE.y -= (1 - e) * (r.place === 'air' ? 160 : 120);
  } else if (b.state === 'stagger' && !reduced) {
    const k = clamp(1 - age / 0.6, 0, 1);
    POSE.x += away * k * k * 12 * s;
    POSE.rot += away * k * k * 0.07;
  } else if (b.state === 'defeated') {
    const k = clamp((age - 0.5) / 1.3, 0, 1);
    POSE.alpha = 1 - clamp((age - DEFEAT_FADE) / (DEFEAT_END - DEFEAT_FADE - 0.05), 0, 1);
    if (r.place === 'air') {
      POSE.y += k * k * 220;
      POSE.rot += away * k * 0.6;
    } else if (r.place === 'ceiling') POSE.y += k * k * 140;
    else if (r.place === 'rear') POSE.x -= k * k * 90;
    else {
      POSE.y += k * k * r.h * 0.3 * s;
      POSE.rot += away * k * 0.2;
    }
    if (!reduced && age < 1.4) POSE.x += Math.sin(age * 60) * 1.5;
  }
}

function drawRotors(ctx: Ctx, r: BossRig, s: number, t: number, reduced: boolean): void {
  ctx.fillStyle = '#9AA3AD';
  for (let i = 0; i < r.rotors.length; i++) {
    const ro = r.rotors[i];
    const x = (ro[0] - POSE.ax) * s;
    const y = (ro[1] - POSE.ay) * s;
    ctx.globalAlpha = reduced ? 0.22 : 0.16 + 0.1 * Math.abs(Math.sin(t * 40 + i));
    oval(ctx, x, y, ro[2] * s, Math.max(1.2, ro[2] * 0.08 * s));
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

/** searchlight cone from the eye (anchor = apex, pointing −x, slightly down) */
function coneSprite(ctx: Ctx): void {
  const g = ctx.createLinearGradient(0, 0, -150, 0);
  g.addColorStop(0, 'rgba(255,244,214,0.32)');
  g.addColorStop(1, 'rgba(255,244,214,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, -3);
  ctx.lineTo(-150, -22);
  ctx.lineTo(-150, 34);
  ctx.lineTo(0, 3);
  ctx.closePath();
  ctx.fill();
}

/** sensors, rotors, charge glow, launch flare, hit flash, damage smoke (inside the boss transform) */
function overlays(ctx: Ctx, b: BossView, r: BossRig, fx: Readonly<FxSprites>, body: Sprite | HTMLCanvasElement, sprites: SpriteCache, t: number, reduced: boolean): void {
  const s = POSE.s;
  const ph = attackPhase(b);
  drawRotors(ctx, r, s, t, reduced);
  // eye: powers on during the intro (flicker), brighter in later phases and while charging
  let eye = 0.55 + 0.15 * b.phase + 0.3 * ph.charge;
  if (b.state === 'intro') eye *= b.stateAge < 0.8 ? 0 : reduced ? 1 : Math.sin(b.stateAge * 47) > -0.2 || b.stateAge > 1.3 ? 1 : 0.2;
  if (b.state === 'defeated') eye *= clamp(1 - b.stateAge / 0.9, 0, 1);
  if (!reduced && b.state === 'fight') eye *= 0.9 + 0.1 * Math.sin(t * 5);
  glowAt(ctx, fx.glowR, lx(r.eye), ly(r.eye), r.eyeR * 2.2 * s, 16, eye);
  if (r.searchlight && b.state !== 'defeated' && eye > 0.2) {
    ctx.save();
    ctx.translate(lx(r.eye), ly(r.eye));
    ctx.rotate(reduced ? -0.45 : -0.45 + Math.sin(t * 0.8) * 0.18); // down-left, sweeping
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = Math.min(1, eye);
    blitScaled(ctx, sprites.get('bossCone', 152, 60, 151, 24, coneSprite), 0, 0, s * 1.4, s * 1.4);
    ctx.restore();
  }
  const a = b.attack;
  if (a && b.state === 'fight') {
    const p = r.src[a.kind];
    const pulse = reduced ? 1 : 0.8 + 0.2 * Math.sin(t * 30);
    glowAt(ctx, fx.glowR, lx(p), ly(p), (5 + 12 * ph.charge) * s * pulse, 16, ph.charge);
    if (ph.flash > 0) {
      if (reduced) glowAt(ctx, fx.glowR, lx(p), ly(p), 14 * s, 16, ph.flash);
      else glowAt(ctx, fx.flare, lx(p), ly(p), 34 * s * (0.6 + 0.4 * ph.flash), 30, ph.flash);
    }
  }
  // hit flash on stagger: the body redrawn additively
  if (b.state === 'stagger' && !reduced && b.stateAge < 0.2) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.65 * (1 - b.stateAge / 0.2);
    ctx.drawImage(body instanceof HTMLCanvasElement ? body : body.canvas, -POSE.ax * s, -POSE.ay * s, r.w * s, r.h * s);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }
  if (b.state === 'stagger') {
    for (let i = 0; i < 3; i++) {
      const px = (SCATTER[i * 3] * 0.7 + 0.15) * r.w;
      const py = (SCATTER[i * 3 + 1] * 0.6 + 0.2) * r.h;
      sparks(ctx, (px - POSE.ax) * s, (py - POSE.ay) * s, 9, clamp((b.stateAge - i * 0.12) / 0.5, 0, 1), 26 * s, i * 9);
    }
  }
  // battle-damage smoke: during the stagger and once hp is low
  const smoky = b.state === 'stagger' ? 1 : b.state === 'fight' ? clamp((0.55 - b.hp) * 2.5, 0, 1) : 0;
  if (smoky > 0) {
    for (let j = 0; j < 3; j++) {
      const p = ((reduced ? 0.3 : t * 0.55) + j / 3) % 1;
      puffAt(ctx, fx.smoke, lx(r.damage) + p * 10 * s, ly(r.damage) - p * 46 * s, (6 + 16 * p) * s, 32, 0.6 * (1 - p) * smoky);
    }
  }
}

/** explosion chain while defeated (inside the boss transform) */
function explosions(ctx: Ctx, b: BossView, r: BossRig, fx: Readonly<FxSprites>, reduced: boolean): void {
  const s = POSE.s;
  const age = b.stateAge;
  for (let i = 0; i < 9; i++) {
    const e = (age - i * 0.15) / 0.6;
    if (e < 0 || e > 1.6) continue;
    const x = ((SCATTER[i * 2 + 11] * 0.8 + 0.1) * r.w - POSE.ax) * s;
    const y = ((SCATTER[i * 2 + 12] * 0.7 + 0.15) * r.h - POSE.ay) * s;
    puffAt(ctx, fx.smoke, x, y - e * 18 * s, (14 + 22 * e) * s, 32, 0.7 * clamp(1.6 - e, 0, 1));
    if (e <= 1) glowAt(ctx, fx.fire, x, y, (8 + 26 * easeOutCubic(e)) * s, 32, 1 - e * e);
    if (e <= 1) sparks(ctx, x, y, 7, e, 30 * s, i * 5);
  }
  // final blast
  const f = (age - 1.25) / 0.5;
  if (f >= 0 && f <= 1) glowAt(ctx, fx.fire, 0, (r.h / 2 - POSE.ay) * s, (40 + 70 * f) * s, 32, (reduced ? 0.6 : 1) * (1 - f));
}

/** Boss body + glows + state effects, behind the lanes. */
export function drawBoss(ctx: Ctx, v: View, snap: RenderSnapshot, t: number, sprites: SpriteCache): void {
  POSE.ok = false;
  const b = snap.boss;
  if (!b || (b.state === 'defeated' && b.stateAge > DEFEAT_END)) return;
  const r = BOSS_RIGS[b.id];
  const reduced = snap.reducedMotion;
  pose(b, r, v, t, reduced);
  const s = POSE.s;
  const fx = fxSprites(sprites);
  const photo = bossPhoto(b.id, r.w * s, r.h * s, v.k);
  const fit = bossPhotoFit();
  FITTED.w = r.w;
  FITTED.h = r.h;
  FITTED.fx = photo ? fit.x : 0;
  FITTED.fy = photo ? fit.y : 0;
  FITTED.fw = photo ? fit.w : 1;
  FITTED.fh = photo ? fit.h : 1;
  const body: Sprite | HTMLCanvasElement = photo ?? procedural(sprites, b, r, s);
  ctx.save();
  if (r.place === 'ground' || r.place === 'rear') {
    // contact shadow on the back floor edge
    ctx.fillStyle = '#000000';
    ctx.globalAlpha = 0.4 * POSE.alpha;
    oval(ctx, POSE.x, FLOOR_BACK + 3, r.w * 0.42 * s, 5 * s);
    ctx.fill();
    ctx.globalAlpha = 1;
    // rising in from behind the floor edge: never paint over the floor
    if (b.state === 'intro' || b.state === 'defeated') {
      ctx.beginPath();
      ctx.rect(v.x0, v.y0, v.w, FLOOR_BACK + 4 - v.y0);
      ctx.clip();
    }
  }
  ctx.translate(POSE.x, POSE.y);
  ctx.rotate(POSE.rot);
  ctx.globalAlpha = POSE.alpha;
  if (photo) ctx.drawImage(photo, -POSE.ax * s, -POSE.ay * s, r.w * s, r.h * s);
  else ctx.drawImage((body as Sprite).canvas, -POSE.ax * s, -POSE.ay * s, r.w * s, r.h * s);
  ctx.globalAlpha = 1;
  if (POSE.alpha > 0.05) overlays(ctx, b, r, fx, body, sprites, t, reduced);
  if (b.state === 'defeated') explosions(ctx, b, r, fx, reduced);
  ctx.restore();
}

// ---------- attack → hazard link (in front of the lanes) ----------

function matching(obs: readonly VisibleObstacle[], kind: BossAttackKind, tu: number): VisibleObstacle | null {
  for (const o of obs) {
    if (Math.abs(o.timeUntil - tu) > 0.03) continue;
    if (kind === 'beam' && (o.kind === 'beam' || o.kind === 'high')) return o;
    if (kind === 'floor' && o.kind === 'floor') return o;
  }
  return null;
}

/** where the attack's hazard is (or will appear) in lane `lane`, written to TGT */
const TGT = { x: 0, y: 0 };

function hazardPoint(kind: BossAttackKind, tu: number, lane: number, o: VisibleObstacle | null, v: View, launched: boolean): void {
  if (kind === 'beam') {
    const h = o && o.kind === 'high' ? HIGH_H : BEAM_H[0];
    const from: LaserFrom = o && o.from === 'back' ? 'back' : 'front';
    TGT.y = projY(lane, h);
    TGT.x = launched ? projX(flyingX(from, tu, v), lane) : PLAYER_X;
    return;
  }
  if (kind === 'lane') {
    TGT.x = projX(PLAYER_X + 44, lane);
    TGT.y = laneY(lane);
    return;
  }
  TGT.x = clamp(projX(fixedX(tu), lane), v.x0 + 8, v.x0 + v.w - 8);
  TGT.y = kind === 'floor' ? laneY(lane) : kind === 'ceiling' ? projY(lane, CEIL_H) : projY(lane, DRONE_H);
}

const AIM_DASH = [5, 4];
const NO_DASH: number[] = [];

function aimLine(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, a: number): void {
  ctx.strokeStyle = LASER_RED;
  ctx.lineWidth = 1;
  ctx.globalAlpha = a;
  ctx.setLineDash(AIM_DASH);
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
  ctx.setLineDash(NO_DASH);
  ctx.globalAlpha = 1;
}

function link(ctx: Ctx, b: BossView, r: BossRig, snap: RenderSnapshot, v: View, fx: Readonly<FxSprites>, lane: number, t: number, reduced: boolean): void {
  const a = b.attack;
  if (!a) return;
  const ph = attackPhase(b);
  if (ph.charge <= 0.15 && ph.flash <= 0) return;
  const src = toScreen(r.src[a.kind]);
  const sx = src.x;
  const sy = src.y;
  const o = matching(snap.obstacles, a.kind, a.timeUntil);
  hazardPoint(a.kind, a.timeUntil, lane, o, v, ph.flash > 0);
  if (ph.flash <= 0) {
    // charging: a laser sight / aim line onto where the hazard will hit
    const k = (ph.charge - 0.15) / 0.85;
    aimLine(ctx, sx, sy, TGT.x, TGT.y, (reduced ? 0.5 : 0.3 + 0.35 * Math.abs(Math.sin(t * 9))) * k);
    glowAt(ctx, fx.glowR, TGT.x, TGT.y, 6 + 4 * k, 16, 0.5 * k);
    return;
  }
  // launch: tracer from the boss to the hazard + a flash where it lands
  const f = ph.flash;
  if (a.kind === 'floor' && (r.place === 'ground' || r.place === 'rear')) {
    // stomp: shock ring at the foot + a crack of light along the floor to the emitters
    ctx.strokeStyle = '#FFB020';
    ctx.lineWidth = 2;
    ctx.globalAlpha = f;
    oval(ctx, sx, FLOOR_BACK + 2, (1 - f) * 70 + 10, ((1 - f) * 70 + 10) * 0.12);
    ctx.stroke();
    ctx.globalAlpha = 1;
    beam(ctx, sx, FLOOR_BACK + 2, TGT.x, TGT.y, '#FFB020', f * 0.8);
  } else beam(ctx, sx, sy, TGT.x, TGT.y, LASER_RED, f * 0.9);
  glowAt(ctx, fx.glowR, TGT.x, TGT.y, 18 * (0.5 + 0.5 * f), 16, f);
  if (!reduced) sparks(ctx, TGT.x, TGT.y, 8, 1 - f, 22, 21);
  const lanes = a.lanes;
  if (a.kind === 'lane' && lanes && lanes.length > 1) {
    hazardPoint('lane', a.timeUntil, lanes[1], null, v, true);
    beam(ctx, sx, sy, TGT.x, TGT.y, LASER_RED, f * 0.9);
  }
}

/** Telegraph lines, launch tracers and impact flashes over the lanes (call after drawBoss). */
export function drawBossFront(ctx: Ctx, v: View, snap: RenderSnapshot, t: number, sprites: SpriteCache): void {
  const b = snap.boss;
  if (!b || !POSE.ok || b.state !== 'fight' || !b.attack) return;
  const r = BOSS_RIGS[b.id];
  const lanes = b.attack.lanes;
  const lane: number = b.attack.kind === 'lane' && lanes && lanes.length > 0 ? (lanes[0] as LaneId) : visualLane(snap.player);
  link(ctx, b, r, snap, v, fxSprites(sprites), lane, t, snap.reducedMotion);
}

export { bossBytes } from './boss-art';
