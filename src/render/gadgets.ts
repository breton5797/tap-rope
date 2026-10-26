// Security quadcopters and floating pickups — world-fixed, scrolling with the floor (GDD-v6 §4).
// Drones are full-width hazards: a squad of one matte quadcopter per lane, each sweeping a red
// scan beam down its own lane, so the fail zone reads in every lane (drawn in each lane's painter
// pass). Pickups (credit chips, shield emitters, chrono modules, armour plates) float in one lane
// over a faint teal projection ring.
import { type VisibleObstacle } from '../types';
import { emissive } from './hazards';
import { clockIcon, creditChip, heartIcon, shieldIcon } from './icons';
import { fixedX, laneY, project } from './layout';
import { blitScaled, type SpriteCache } from './sprites';
import { oval, type Ctx } from './util';

const PICK_KEYS = ['pick0', 'pick1', 'pick2'];

function seedOf(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return (h & 1023) / 163;
}

/** Side view of a matte quadcopter (anchor = body centre): arms, motor pods, sensor gimbal. */
function droneBody(ctx: Ctx): void {
  ctx.fillStyle = '#1B1E22';
  ctx.fillRect(-19, -3, 38, 3); // arms
  for (const x of [-18, 18]) {
    ctx.fillStyle = '#26292E';
    ctx.fillRect(x - 3, -7, 6, 5); // motor pods
    ctx.fillStyle = '#3B4047';
    ctx.fillRect(x - 3, -7, 6, 1);
  }
  ctx.fillStyle = '#2A2E33';
  ctx.beginPath();
  ctx.moveTo(-10, -5);
  ctx.lineTo(10, -5);
  ctx.lineTo(8, 4);
  ctx.lineTo(-8, 4);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#41474F';
  ctx.fillRect(-10, -5, 20, 1.4);
  // gimbal + lens
  ctx.fillStyle = '#16181B';
  ctx.beginPath();
  ctx.arc(2, 6, 3.6, 0, Math.PI * 2);
  ctx.fill();
  // landing skids
  ctx.strokeStyle = '#16181B';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-7, 4);
  ctx.lineTo(-9, 9);
  ctx.moveTo(7, 4);
  ctx.lineTo(9, 9);
  ctx.moveTo(-11, 9);
  ctx.lineTo(-5, 9);
  ctx.moveTo(5, 9);
  ctx.lineTo(11, 9);
  ctx.stroke();
}

/** Downward scan cone (anchor = apex), fading toward the floor. */
function scanSprite(ctx: Ctx): void {
  const g = ctx.createLinearGradient(0, 0, 0, 120);
  g.addColorStop(0, 'rgba(255,42,58,0.42)');
  g.addColorStop(1, 'rgba(255,42,58,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-16, 120);
  ctx.lineTo(16, 120);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,90,100,0.55)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-16, 120);
  ctx.moveTo(0, 0);
  ctx.lineTo(16, 120);
  ctx.stroke();
}

/** Drones hover above a 1단 hop: their scan covers the 2단/3단 zone (the fail rule). */
const DRONE_MIN_H = 150;
/** drones of a squad are drawn a bit smaller so the three lanes' drones don't merge */
const SQUAD_SCALE = 0.86;

function drone(ctx: Ctx, o: VisibleObstacle, lane: number, t: number, sprites: SpriteCache): void {
  const seed = seedOf(o.id) + lane * 1.7;
  const p = project(fixedX(o.timeUntil), lane, Math.max(o.height, DRONE_MIN_H) + 10);
  const s = p.scale * SQUAD_SCALE;
  const x = p.x;
  const y = p.y + Math.sin(t * 2.6 + seed) * 2;
  ctx.fillStyle = '#000000';
  ctx.globalAlpha = 0.25;
  oval(ctx, x, laneY(lane) + 2, 13 * s, 2.6 * s);
  ctx.fill();
  // scan beam sweeping slightly forward / back
  const sweep = Math.sin(t * 2.2 + seed) * 0.18;
  ctx.save();
  ctx.translate(x + 2 * s, y + 6 * s);
  ctx.rotate(sweep);
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = 0.8;
  blitScaled(ctx, sprites.get('droneScan', 36, 124, 18, 2, scanSprite), 0, 0, s, s * 0.85);
  ctx.restore();
  ctx.globalAlpha = 1;
  blitScaled(ctx, sprites.get('droneBody', 44, 22, 22, 10, droneBody), x, y, s, s);
  // rotor blur discs
  ctx.fillStyle = '#9AA3AD';
  ctx.globalAlpha = 0.28;
  for (let dx = -18; dx <= 18; dx += 36) {
    oval(ctx, x + dx * s, y - 8 * s, 9 * s, 1.1 * s);
    ctx.fill();
  }
  // sensor + nav light
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#FF2A3A';
  ctx.fillRect(x + 1.2 * s, y + 5.2 * s, 1.6 * s, 1.6 * s);
  emissive(ctx, sprites, x + 2 * s, y + 6 * s, 5 * s, 0.85);
  emissive(ctx, sprites, x + 18 * s, y - 6 * s, 2.4 * s, 0.7);
  if (Math.sin(t * 6 + seed) > 0.6) emissive(ctx, sprites, x - 18 * s, y - 6 * s, 3 * s, 0.95, true);
}

function coinSprite(ctx: Ctx): void {
  creditChip(ctx, 5.6);
}

function pickupSprite(ctx: Ctx, kind: number): void {
  if (kind === 0) shieldIcon(ctx, 8);
  else if (kind === 1) clockIcon(ctx, 7.5);
  else heartIcon(ctx, 8);
}

function pickup(ctx: Ctx, o: VisibleObstacle, lane: number, t: number, sprites: SpriteCache): void {
  if (o.timeUntil < -0.05) return;
  const seed = seedOf(o.id);
  const p = project(fixedX(o.timeUntil), lane, o.height + 14);
  const y = p.y + Math.sin(t * 2.2 + seed) * 1.5;
  // teal projection ring on the floor of its lane
  ctx.strokeStyle = '#3FE0D0';
  ctx.globalAlpha = 0.35;
  ctx.lineWidth = 1;
  oval(ctx, p.x, laneY(lane) + 1, 10 * p.scale, 2.8 * p.scale);
  ctx.stroke();
  ctx.globalAlpha = 1;
  if (o.kind === 'coin') {
    const sx = Math.max(0.2, Math.abs(Math.cos(t * 2.4 + seed)));
    blitScaled(ctx, sprites.get('coin', 14, 12, 7, 6, coinSprite), p.x, y, sx * p.scale, p.scale);
    return;
  }
  const idx = o.kind === 'shield' ? 0 : o.kind === 'slow' ? 1 : 2;
  blitScaled(ctx, sprites.get(PICK_KEYS[idx], 24, 24, 12, 12, pickupSprite, idx), p.x, y, p.scale, p.scale);
}

const isPickup = (o: VisibleObstacle): boolean =>
  o.kind === 'coin' || o.kind === 'shield' || o.kind === 'slow' || o.kind === 'heart';

/** The drone of every drone squad in lane `lane`, and the pickups floating in that lane. */
export function drawGadgets(ctx: Ctx, obs: readonly VisibleObstacle[], t: number, sprites: SpriteCache, lane: number): void {
  for (const o of obs) {
    if (o.kind === 'drone') {
      drone(ctx, o, lane, t, sprites);
    } else if (isPickup(o) && (o.lanes?.[0] ?? 1) === lane) pickup(ctx, o, lane, t, sprites);
  }
}
