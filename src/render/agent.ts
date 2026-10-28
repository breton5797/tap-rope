// The operative (and the escorted scientist): picks a rig pose from the player state and draws it
// (GDD-v6 §3, v7.1 §1–2). Agent: run cycle locked to the scroll, take-off crouch → stretch, leap /
// tucked front flip with a twist (2단) / flip with arm drive, pirouette and kick-out (3단),
// feet-first drop, knee slide with a planted hand and a pop-up exit, landing absorb scaled by the
// jump level, lane banking with a crossover step, edge-bump stagger, PERFECT evasive tucks, hit
// recoil with a red invulnerability outline, spring-lagged loose gear, overdrive aura and ghost
// trails. Reactions are timed from the impact cues (cues.ts). Civilian (escort): run, one hurdle
// for any jump, crouch-run under slides, stumble on hits.
import type { Mood, PlayerState } from '../types';
import { cueAge, cueInfo } from './cues';
import { laneProgress } from './layout';
import { drawRig, newPose, RIG_SIZE, STRIDE, type Paint, type Pose } from './rig';
import { GhostTrail } from './rig-ghost';
import {
  applyBank, applyBump, applyEvade, applySlidePop, applyTakeoff, bankHop, boostTwist, bumpWobble, crouchK,
  evadeTwist, landCurve, landDepth, takeoffStretch,
} from './rig-motion';
import {
  applyLand, applyRecoil, applyStumble, hitCurve, poseAir, poseCivRun, poseCrouchRun, poseIdle, poseRun, poseSlide,
  poseVault,
} from './rig-poses';
import { J, P } from './rig-skeleton';
import { newSpring, springKick, springStep } from './rig-spring';
import { lookFor, tintLook, type AgentLook, type LookId } from './skins';
import { clamp, oval, type Ctx } from './util';

const SPIN_2 = 0.46;
const SPIN_3 = 0.58;
/** cue ages past this are stale (a cue from before this reaction window) */
const HIT_WINDOW = 1.2;
const GHOST_FEVER = '#FFB020';
const GHOST_LANE = '#BFEFFF';

export interface AgentFrame {
  readonly x: number;
  readonly id: LookId;
  readonly p: PlayerState;
  readonly mood: Mood;
  readonly t: number;
  readonly scroll: number;
  readonly running: boolean;
  /** invulnerable after a hit: red outline pulse (v7.1; was a blink) */
  readonly blink: boolean;
  readonly torch: boolean;
  /** final drawing scale (rig scale × lane depth scale); the figure is drawn RIG_SIZE × this */
  readonly scale: number;
  /** screen y of the floor under the figure (its lane's floor line) */
  readonly floorY: number;
  /** lane depth scale, applied to the jump height */
  readonly depth: number;
  /** radians of lean while switching lanes */
  readonly lean: number;
  /** scene rim-light colour */
  readonly rim: string;
  /** civilian motion set (the escorted scientist): no flips, no knee slides */
  readonly civilian?: boolean;
  /** v7.1 overdrive: amber aura + ghost trail */
  readonly fever?: boolean;
  /** v7.1 reduced motion: no ghost trails, smaller rotations */
  readonly reduced?: boolean;
  /** v8 (A5) cosmetics: accent (visor / LED) colour variant and ghost-trail colour; null = the skin's own */
  readonly tint?: string | null;
  readonly trail?: string | null;
}

/** soft contact shadow: radial falloff in a unit circle, stretched per draw (built once) */
let shadowGrad: CanvasGradient | null = null;

function shadowFill(ctx: Ctx): CanvasGradient {
  if (!shadowGrad) {
    shadowGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    shadowGrad.addColorStop(0, 'rgba(0,0,0,0.62)');
    shadowGrad.addColorStop(0.45, 'rgba(0,0,0,0.38)');
    shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  }
  return shadowGrad;
}

/** overdrive aura: unit amber falloff (built once) */
let auraGrad: CanvasGradient | null = null;

function auraFill(ctx: Ctx): CanvasGradient {
  if (!auraGrad) {
    auraGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
    auraGrad.addColorStop(0, 'rgba(255,176,32,0.55)');
    auraGrad.addColorStop(0.5, 'rgba(255,140,20,0.2)');
    auraGrad.addColorStop(1, 'rgba(255,120,0,0)');
  }
  return auraGrad;
}

export class AgentPainter {
  private prevLevel = 0;
  private spinStart = -1;
  private prevMood: Mood = 'idle';
  private hitStart = Number.NEGATIVE_INFINITY;
  private readonly pose = newPose();
  /** reused paint settings (no per-frame allocation) */
  private readonly paint: Paint = { look: lookFor('kid'), rim: '', torch: false, sway: 0, bob: 0, outline: 0, flat: '' };
  /** per-frame figure transform extras (horizontal / vertical scale, lift in rig px, extra tilt) */
  private sx = 1;
  private sy = 1;
  private lift = 0;
  private tilt = 0;
  /** secondary motion: body height (rig px) and torso pitch followed by lagging springs */
  private readonly bobS = newSpring();
  private readonly swayS = newSpring();
  private lastT = Number.NEGATIVE_INFINITY;
  private bodyY = 0;
  private lastLandAge = Number.POSITIVE_INFINITY;
  private lastHitAge = Number.POSITIVE_INFINITY;
  private lastLandTimer = 0;
  private readonly ghosts = new GhostTrail();
  /** v8: the tinted look for the last (skin, tint) pair (one object per change, not per frame) */
  private tinted: { id: LookId; tint: string; look: AgentLook } | null = null;
  private ghostColor = GHOST_LANE;

  /** the skin's look, with the accent swapped for an equipped colour variant (cached per pair) */
  private lookOf(id: LookId, tint: string | null): AgentLook {
    if (!tint) return lookFor(id);
    if (!this.tinted || this.tinted.id !== id || this.tinted.tint !== tint) {
      this.tinted = { id, tint, look: tintLook(lookFor(id), tint) };
    }
    return this.tinted.look;
  }

  /** Soft, slightly elongated contact shadow on the floor plane (floorY = the lane's floor line). */
  shadow(ctx: Ctx, x: number, floorY: number, height: number, sliding: boolean, scale: number): void {
    const s = scale * RIG_SIZE;
    const f = s / (1 + height / 70);
    const a = Math.min(1, scale / (1 + height / 45));
    ctx.save();
    ctx.globalAlpha *= a;
    ctx.fillStyle = shadowFill(ctx);
    ctx.translate(x + (sliding ? 6 * s : 1.5 * s), floorY + 0.5);
    ctx.scale((sliding ? 34 : 19) * f, 4.2 * f);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  draw(ctx: Ctx, f: AgentFrame): void {
    const { p, t } = f;
    const dt = t > this.lastT ? Math.min(t - this.lastT, 0.1) : 0;
    this.lastT = t;
    if (f.mood === 'hurt' && this.prevMood !== 'hurt') this.hitStart = t;
    this.prevMood = f.mood;
    const moodHit = f.mood === 'hurt' ? t - this.hitStart : -1;
    const pose = this.pose;
    this.sx = 1;
    this.sy = 1;
    this.lift = 0;
    this.tilt = 0;
    let hScale = 1;
    if (f.civilian) {
      this.civilianPose(pose, f, hitCurve(moodHit));
    } else {
      const cueHit = cueAge('hit');
      this.agentPose(pose, f, cueHit < HIT_WINDOW ? cueHit : moodHit);
      // take-off: the drawn body trails the physics for ~0.1s so the crouch reads on the floor
      if (!p.grounded && p.level === 1) hScale = 1 - 0.6 * crouchK(cueAge('jump'));
    }
    const s = f.scale * RIG_SIZE;
    const oy = f.floorY - p.height * f.depth * hScale - this.lift * s;
    this.secondary(f, oy / s, dt);
    const paint = this.paint;
    paint.look = this.lookOf(f.id, f.tint ?? null);
    paint.rim = f.rim;
    paint.torch = f.torch;
    paint.outline = f.blink ? (f.reduced ? 0.6 : 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * Math.PI * 10))) : 0;
    const lean = f.lean + this.tilt;
    const ghosts = !f.civilian && !f.reduced;
    const trail = ghosts && (f.fever === true || laneProgress(p) < 1);
    if (trail) this.ghostColor = f.fever ? GHOST_FEVER : f.trail ?? GHOST_LANE;
    if (f.fever && !f.civilian) this.aura(ctx, f.x, oy - 46 * s, s, t);
    // ghosts already sampled fade out on their own once the trail stops
    if (ghosts) this.ghosts.draw(ctx, paint, this.ghostColor, t, 1, f.fever ? 240 * f.scale : 0);
    ctx.save();
    ctx.translate(f.x, oy);
    if (lean !== 0) ctx.rotate(lean);
    ctx.scale(s * this.sx, s * this.sy);
    drawRig(ctx, pose, paint);
    ctx.restore();
    this.bodyY = J[P.Pelvis + 1];
    if (trail) this.ghosts.sample(pose, t, f.x, oy, lean, s, this.sx, this.sy);
    else if (!ghosts) this.ghosts.clear();
    if (p.sliding && !f.civilian) this.dust(ctx, f);
  }

  private agentPose(pose: Pose, f: AgentFrame, hitAge: number): void {
    const { p, t } = f;
    const reduced = f.reduced === true;
    if (p.level >= 2 && p.level !== this.prevLevel) this.spinStart = t;
    if (p.grounded) this.spinStart = -1;
    this.prevLevel = p.level;
    if (p.sliding) {
      poseSlide(pose, p.slideAge);
      if (p.slideTime < 0.1) applySlidePop(pose, 1 - p.slideTime / 0.1);
    } else if (!p.grounded) {
      const dur = p.level >= 3 ? SPIN_3 : SPIN_2;
      const spin = this.spinStart >= 0 ? clamp((t - this.spinStart) / dur, 0, 1) : 1;
      poseAir(pose, p.level, p.vy, spin, p.pendingSlide, reduced);
      this.airExtras(pose, p.level, spin, reduced);
    } else if (f.running) {
      poseRun(pose, (f.scroll / STRIDE) * Math.PI * 2);
      this.landing(pose);
    } else {
      poseIdle(pose, t);
      this.landing(pose);
    }
    if (!p.sliding && p.grounded) this.laneMove(pose, p, reduced);
    this.evade(pose);
    // no recoil mid-flip: the rotation already carries the motion
    if (pose.rot === 0 && hitAge >= 0) applyRecoil(pose, hitAge);
  }

  /** take-off crouch / stretch and the boost twist */
  private airExtras(pose: Pose, level: number, spin: number, reduced: boolean): void {
    const age = cueAge('jump');
    if (level === 1 && age < 0.25) {
      applyTakeoff(pose, age);
      this.sy = takeoffStretch(age);
      this.sx = 2 - this.sy;
    }
    if (level >= 2 && !reduced) this.sx *= boostTwist(spin, cueInfo('boost').level);
  }

  /** landing absorb: depth from the level of the jump that ended, ~0.12s recovery, a squash */
  private landing(pose: Pose): void {
    const q = landCurve(cueAge('land')) * landDepth(cueInfo('land').level);
    if (q <= 0) return;
    applyLand(pose, q);
    this.sy *= 1 - 0.06 * q;
    this.sx *= 1 + 0.04 * q;
  }

  /** lane switch bank + crossover hop, edge-bump stagger */
  private laneMove(pose: Pose, p: PlayerState, reduced: boolean): void {
    const k = laneProgress(p);
    if (k < 1) {
      applyBank(pose, k, Math.sign(p.lane - p.laneFrom));
      this.lift = bankHop(k);
    }
    const bump = cueAge('bump');
    if (bump < 0.6) {
      applyBump(pose, bump);
      this.tilt = cueInfo('bump').dir * (reduced ? 0.03 : 0.1) * bumpWobble(bump);
    }
  }

  /** PERFECT (graze) / GOOD (pass) evasions: the most recent one wins */
  private evade(pose: Pose): void {
    const g = cueAge('graze');
    const ps = cueAge('pass');
    const perfect = g <= ps;
    const age = perfect ? g : ps;
    if (age > 0.35) return;
    const s = perfect ? 1 : 0.35;
    const zone = cueInfo(perfect ? 'graze' : 'pass').zone;
    applyEvade(pose, age, zone, s);
    if (zone === 'side') this.sx *= evadeTwist(age, s);
  }

  private civilianPose(pose: Pose, f: AgentFrame, hit: number): void {
    const { p } = f;
    const ph = (f.scroll / STRIDE) * Math.PI * 2;
    if (p.sliding) {
      poseCrouchRun(pose, ph);
    } else if (!p.grounded) {
      poseVault(pose, p.vy);
    } else if (f.running) {
      poseCivRun(pose, ph);
      applyLand(pose, p.landTimer < 0.2 ? 1 - p.landTimer / 0.2 : 0);
    } else {
      poseIdle(pose, f.t);
    }
    applyStumble(pose, hit);
  }

  /** Loose gear follows the body on springs (y = body origin in rig px); thumps on land / hit. */
  private secondary(f: AgentFrame, y: number, dt: number): void {
    const p = f.p;
    const target = y + this.bodyY;
    if (dt === 0 || !Number.isFinite(this.bobS.x) || Math.abs(this.bobS.x - target) > 60) {
      this.bobS.x = target;
      this.bobS.v = 0;
    }
    const land = f.civilian ? (p.landTimer < this.lastLandTimer ? 0 : 1) : cueAge('land');
    const hit = f.civilian ? 1 : cueAge('hit');
    this.lastLandTimer = p.landTimer;
    if (land < this.lastLandAge && land < 0.1) {
      const lv = f.civilian ? 1 : cueInfo('land').level;
      springKick(this.bobS, 40 + 25 * lv);
      springKick(this.swayS, 1.5 + lv);
    }
    if (hit < this.lastHitAge && hit < 0.1) {
      springKick(this.bobS, -50);
      springKick(this.swayS, -5);
    }
    this.lastLandAge = land;
    this.lastHitAge = hit;
    springStep(this.bobS, target, 160, 0.28, dt);
    springStep(this.swayS, this.pose.spine + this.pose.rot * 0.15, 110, 0.32, dt);
    const bob = clamp(this.bobS.x - target, -6, 6);
    this.paint.bob = bob;
    this.paint.sway = clamp((this.swayS.x - this.pose.spine) * 1.1 + bob * 0.07, -0.9, 0.9);
  }

  /** Overdrive: a faint pulsing amber glow behind the figure. */
  private aura(ctx: Ctx, x: number, y: number, s: number, t: number): void {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha *= 0.5 + 0.12 * Math.sin(t * 7);
    ctx.fillStyle = auraFill(ctx);
    ctx.translate(x, y);
    ctx.scale(34 * s, 56 * s);
    ctx.beginPath();
    ctx.arc(0, 0, 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /** A low skid of grey dust behind a knee slide. */
  private dust(ctx: Ctx, f: AgentFrame): void {
    const k = clamp(f.p.slideAge * 6, 0, 1);
    const s = f.scale * RIG_SIZE;
    ctx.fillStyle = '#9A9590';
    for (let i = 0; i < 5; i++) {
      const u = (f.t * 2.4 + i / 5) % 1;
      ctx.globalAlpha = (1 - u) * 0.22 * k;
      oval(ctx, f.x - (14 + u * 34) * s, f.floorY - (1 + u * 4) * s, (3 + u * 7) * s, (1.6 + u * 2.4) * s);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
