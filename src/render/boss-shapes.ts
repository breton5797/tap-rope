// Procedural boss silhouettes (GDD-v7 §1 fallback until the photo sprites exist): gunmetal plate armour
// in the v6 hazard language, drawn once into a cached sprite in box coordinates (0,0 = top-left, facing
// LEFT toward the agent unless noted). Emissive parts (sensors, muzzles, rotors) are animated live by
// boss.ts at the rig's anchor points, so they are only dark sockets here.
import type { BossId } from '../types';
import { vGrad, type Ctx } from './util';

const DARK = '#0F1214';
const MID = '#22282D';
const PLATE = '#30383F';
const LIT = '#56616B';
const AMBER = '#9C7418';
const SOCKET = '#07080A';

function poly(ctx: Ctx, pts: readonly number[], fill: string | CanvasGradient): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function edge(ctx: Ctx, pts: readonly number[], color = LIT, w = 1.2): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.stroke();
}

function limb(ctx: Ctx, pts: readonly number[], w: number, color = MID): void {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.strokeStyle = color;
  ctx.lineWidth = w;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function rect(ctx: Ctx, x: number, y: number, w: number, h: number, fill: string | CanvasGradient): void {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

function socket(ctx: Ctx, x: number, y: number, r: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = SOCKET;
  ctx.fill();
}

function stripes(ctx: Ctx, x: number, y: number, w: number, h: number): void {
  rect(ctx, x, y, w, h, AMBER);
  ctx.fillStyle = '#15171A';
  for (let i = 0; i < w; i += 6) ctx.fillRect(x + i, y, 3, h);
}

function bolts(ctx: Ctx, x: number, y: number, n: number, dx: number): void {
  ctx.fillStyle = '#9AA3AD';
  for (let i = 0; i < n; i++) ctx.fillRect(x + i * dx, y, 1.4, 1.4);
}

// 1 SENTINEL-01: bipedal heavy guard mech, cannon arm toward the agent (150×200)
function warden(ctx: Ctx): void {
  limb(ctx, [96, 118, 112, 152, 100, 194], 14, DARK); // far leg
  limb(ctx, [70, 118, 56, 152, 66, 194], 16); // near leg
  poly(ctx, [52, 150, 66, 144, 74, 162, 60, 168], PLATE); // knee guard
  rect(ctx, 44, 190, 40, 10, DARK);
  rect(ctx, 88, 190, 34, 10, DARK);
  rect(ctx, 44, 190, 40, 2, LIT);
  poly(ctx, [40, 52, 112, 46, 126, 96, 110, 124, 54, 126, 36, 92], vGrad(ctx, 46, 126, [[0, LIT], [0.35, PLATE], [1, MID]]));
  edge(ctx, [40, 52, 112, 46, 126, 96]);
  poly(ctx, [50, 96, 116, 92, 108, 122, 56, 124], MID); // belly plate
  stripes(ctx, 62, 100, 36, 5);
  bolts(ctx, 48, 58, 6, 11);
  poly(ctx, [48, 22, 86, 18, 90, 48, 46, 52], vGrad(ctx, 18, 52, [[0, PLATE], [1, MID]])); // head
  rect(ctx, 46, 34, 26, 6, SOCKET); // sensor slit
  poly(ctx, [100, 30, 136, 26, 140, 54, 104, 58], PLATE); // shoulder missile pod
  for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) socket(ctx, 110 + i * 9, 36 + j * 10, 3);
  poly(ctx, [30, 60, 52, 56, 56, 84, 32, 88], LIT); // shoulder plate (near)
  limb(ctx, [42, 80, 30, 96], 14, MID); // upper arm
  poly(ctx, [4, 86, 40, 82, 42, 102, 4, 104], vGrad(ctx, 82, 104, [[0, PLATE], [1, DARK]])); // cannon
  rect(ctx, 0, 89, 8, 10, DARK);
  socket(ctx, 4, 94, 3);
  edge(ctx, [4, 86, 40, 82]);
}

// 2 OCULUS: big searchlight drone (180×110)
function sewerEye(ctx: Ctx): void {
  for (const [x, y] of ROTORS_EYE) {
    limb(ctx, [90, 50, x, y + 6], 6, DARK);
    rect(ctx, x - 7, y, 14, 8, MID);
  }
  poly(ctx, [40, 34, 140, 30, 160, 60, 134, 84, 52, 86, 30, 62], vGrad(ctx, 30, 86, [[0, LIT], [0.4, PLATE], [1, DARK]]));
  edge(ctx, [40, 34, 140, 30, 160, 60]);
  stripes(ctx, 70, 72, 48, 5);
  bolts(ctx, 56, 40, 8, 11);
  ctx.beginPath(); // searchlight housing
  ctx.arc(42, 58, 26, 0, Math.PI * 2);
  ctx.fillStyle = DARK;
  ctx.fill();
  ctx.beginPath();
  ctx.arc(40, 58, 19, 0, Math.PI * 2);
  ctx.fillStyle = '#20252A';
  ctx.fill();
  socket(ctx, 38, 58, 13);
  limb(ctx, [96, 86, 92, 100], 4, DARK); // cargo claw
  limb(ctx, [84, 104, 92, 98, 100, 104], 3, MID);
}
const ROTORS_EYE: readonly (readonly [number, number])[] = [[30, 18], [150, 16], [62, 6], [120, 4]];

// 3 ARGUS: ceiling turret array around a central lens (230×100, hangs from its top edge)
function labAi(ctx: Ctx): void {
  rect(ctx, 0, 0, 230, 10, DARK);
  rect(ctx, 0, 8, 230, 2, LIT);
  for (const x of [30, 200]) {
    limb(ctx, [x, 10, x, 60], 7, MID);
    poly(ctx, [x - 16, 60, x + 14, 58, x + 16, 82, x - 18, 84], vGrad(ctx, 58, 84, [[0, PLATE], [1, DARK]]));
    rect(ctx, x - 20, 80, 12, 8, DARK); // barrel (points left/down)
    socket(ctx, x - 18, 88, 3);
  }
  limb(ctx, [115, 10, 115, 30], 12, MID);
  ctx.beginPath(); // central dome
  ctx.arc(115, 56, 34, Math.PI, 0);
  ctx.lineTo(149, 66);
  ctx.lineTo(81, 66);
  ctx.closePath();
  ctx.fillStyle = vGrad(ctx, 22, 66, [[0, LIT], [0.5, PLATE], [1, MID]]);
  ctx.fill();
  stripes(ctx, 90, 62, 50, 4);
  ctx.beginPath();
  ctx.arc(115, 72, 16, 0, Math.PI * 2);
  ctx.fillStyle = DARK;
  ctx.fill();
  socket(ctx, 115, 72, 10);
  bolts(ctx, 92, 36, 5, 11);
}

// 4 NEXUS: server-core control pillar with cable bundles (120×250, stands on the back floor)
function core(ctx: Ctx): void {
  limb(ctx, [10, 0, 6, 120, 18, 246], 5, DARK); // cables
  limb(ctx, [110, 0, 116, 110, 100, 246], 5, DARK);
  limb(ctx, [22, 0, 26, 60], 3, MID);
  rect(ctx, 26, 20, 68, 222, vGrad(ctx, 20, 242, [[0, PLATE], [0.5, MID], [1, DARK]]));
  rect(ctx, 26, 20, 3, 222, LIT);
  for (let y = 40; y < 230; y += 26) rect(ctx, 30, y, 60, 2, 'rgba(0,0,0,0.5)');
  rect(ctx, 18, 236, 84, 14, DARK);
  stripes(ctx, 20, 238, 80, 4);
  for (let i = 0; i < 4; i++) rect(ctx, 34, 96 + i * 12, 52, 7, SOCKET); // core ring slots
  rect(ctx, 30, 14, 60, 10, DARK);
  socket(ctx, 22, 70, 4); // side emitter
  socket(ctx, 100, 58, 4);
  bolts(ctx, 32, 28, 6, 10);
}

// 5 WARDEN-X: large humanoid jailer robot with a riot shield (150×200)
function jailer(ctx: Ctx): void {
  limb(ctx, [88, 120, 96, 158, 92, 196], 14, DARK);
  limb(ctx, [70, 120, 64, 158, 68, 196], 15);
  rect(ctx, 52, 190, 34, 10, DARK);
  rect(ctx, 80, 190, 30, 10, DARK);
  poly(ctx, [56, 52, 112, 50, 118, 120, 60, 124], vGrad(ctx, 50, 124, [[0, LIT], [0.4, PLATE], [1, MID]]));
  bolts(ctx, 62, 58, 5, 10);
  poly(ctx, [66, 16, 100, 14, 104, 48, 64, 50], PLATE); // helmet
  rect(ctx, 66, 30, 30, 6, SOCKET); // visor
  limb(ctx, [110, 60, 126, 80, 120, 44], 10, MID); // baton arm raised
  rect(ctx, 116, 14, 6, 32, DARK); // stun baton
  socket(ctx, 119, 14, 3);
  limb(ctx, [62, 62, 40, 96], 12, MID); // shield arm
  poly(ctx, [6, 54, 40, 50, 44, 168, 8, 172], vGrad(ctx, 50, 172, [[0, '#4A535C'], [1, '#22272C']])); // riot shield
  edge(ctx, [6, 54, 40, 50, 44, 168]);
  rect(ctx, 14, 70, 22, 6, 'rgba(0,0,0,0.45)');
  stripes(ctx, 12, 140, 28, 5);
  socket(ctx, 24, 110, 4); // shield emitter
}

// 6 RHINO: armoured personnel carrier chasing from behind (230×120, faces RIGHT)
function apc(ctx: Ctx): void {
  for (const x of [40, 90, 140, 186]) {
    ctx.beginPath();
    ctx.arc(x, 100, 18, 0, Math.PI * 2);
    ctx.fillStyle = '#0D0F11';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x, 100, 8, 0, Math.PI * 2);
    ctx.fillStyle = MID;
    ctx.fill();
  }
  poly(ctx, [8, 54, 30, 34, 196, 32, 226, 58, 222, 92, 10, 94], vGrad(ctx, 32, 94, [[0, LIT], [0.3, PLATE], [1, DARK]]));
  edge(ctx, [8, 54, 30, 34, 196, 32, 226, 58]);
  rect(ctx, 30, 62, 180, 3, 'rgba(0,0,0,0.45)');
  stripes(ctx, 168, 70, 46, 6);
  for (let i = 0; i < 4; i++) rect(ctx, 50 + i * 30, 44, 18, 6, SOCKET); // vision slits
  poly(ctx, [96, 14, 150, 12, 160, 34, 92, 34], PLATE); // turret
  rect(ctx, 150, 20, 66, 6, DARK); // autocannon barrel → right
  rect(ctx, 210, 18, 10, 10, DARK);
  rect(ctx, 108, 6, 20, 8, MID); // roof hatch (drone bay)
  bolts(ctx, 40, 40, 14, 12);
  socket(ctx, 222, 72, 4); // headlight
}

// 7 CHIMERA: quadruped experimental weapon (230×150)
function chimera(ctx: Ctx): void {
  limb(ctx, [150, 70, 176, 104, 160, 146], 11, DARK); // far legs
  limb(ctx, [70, 70, 52, 108, 66, 146], 11, DARK);
  poly(ctx, [40, 50, 190, 44, 214, 66, 196, 92, 54, 96, 30, 74], vGrad(ctx, 44, 96, [[0, LIT], [0.35, PLATE], [1, MID]]));
  edge(ctx, [40, 50, 190, 44, 214, 66]);
  for (let i = 0; i < 5; i++) rect(ctx, 70 + i * 22, 52, 14, 3, 'rgba(0,0,0,0.4)');
  stripes(ctx, 100, 82, 50, 5);
  limb(ctx, [176, 76, 200, 112, 184, 146], 13); // near legs
  limb(ctx, [84, 78, 60, 114, 76, 146], 13);
  limb(ctx, [210, 60, 226, 30, 218, 12], 5, MID); // tail cable
  poly(ctx, [0, 52, 40, 40, 50, 70, 8, 80], vGrad(ctx, 40, 80, [[0, PLATE], [1, DARK]])); // head
  rect(ctx, 6, 56, 22, 5, SOCKET); // sensor strip
  rect(ctx, 0, 66, 12, 9, DARK); // laser maw
  socket(ctx, 4, 70, 3);
}

// 8 TITAN: overhead factory crane with a hydraulic press (230×140, hangs from its top edge)
function crane(ctx: Ctx): void {
  rect(ctx, 0, 0, 230, 16, vGrad(ctx, 0, 16, [[0, LIT], [1, MID]]));
  for (let x = 6; x < 230; x += 18) limb(ctx, [x, 2, x + 9, 14, x + 18, 2], 1.6, DARK); // truss
  rect(ctx, 168, 16, 46, 26, PLATE); // operator cab
  rect(ctx, 174, 22, 22, 10, SOCKET);
  rect(ctx, 44, 16, 32, 12, DARK); // trolley + hook (cargo)
  limb(ctx, [60, 28, 60, 104], 2.4, '#3A4047');
  limb(ctx, [52, 104, 60, 112, 68, 104], 3, MID);
  rect(ctx, 124, 16, 52, 10, DARK); // press frame
  rect(ctx, 136, 26, 8, 70, MID); // hydraulic rams
  rect(ctx, 156, 26, 8, 70, MID);
  rect(ctx, 138, 26, 4, 70, LIT);
  rect(ctx, 118, 96, 64, 30, vGrad(ctx, 96, 126, [[0, PLATE], [1, DARK]])); // press block
  stripes(ctx, 118, 122, 64, 6);
}

// 9 RAVEN: high-altitude sniper drone (190×90)
function sniper(ctx: Ctx): void {
  for (const [x, y] of ROTORS_RAVEN) {
    limb(ctx, [96, 36, x, y + 4], 4, DARK);
    rect(ctx, x - 6, y, 12, 6, MID);
  }
  poly(ctx, [70, 28, 150, 26, 172, 44, 150, 62, 74, 62, 60, 46], vGrad(ctx, 26, 62, [[0, LIT], [0.4, PLATE], [1, DARK]]));
  edge(ctx, [70, 28, 150, 26, 172, 44]);
  rect(ctx, 4, 44, 70, 5, DARK); // long rifle barrel → left
  rect(ctx, 0, 42, 8, 9, DARK); // muzzle brake
  rect(ctx, 60, 32, 26, 8, MID); // scope
  socket(ctx, 62, 36, 3);
  stripes(ctx, 100, 54, 40, 4);
  limb(ctx, [110, 62, 104, 80], 3, DARK); // gimbal legs
  limb(ctx, [140, 62, 146, 80], 3, DARK);
}
const ROTORS_RAVEN: readonly (readonly [number, number])[] = [[80, 10], [160, 8]];

// 10 VULTURE: armed attack helicopter in the sky (250×110)
function gunship(ctx: Ctx): void {
  limb(ctx, [150, 48, 240, 40], 9, MID); // tail boom
  rect(ctx, 232, 22, 8, 28, PLATE); // tail fin
  poly(ctx, [20, 60, 46, 34, 150, 30, 168, 56, 150, 86, 40, 88], vGrad(ctx, 30, 88, [[0, LIT], [0.35, PLATE], [1, DARK]]));
  edge(ctx, [20, 60, 46, 34, 150, 30, 168, 56]);
  poly(ctx, [24, 58, 48, 38, 74, 38, 66, 62], '#1A2026'); // cockpit glass
  rect(ctx, 96, 70, 64, 6, DARK); // stub wing
  for (let i = 0; i < 2; i++) rect(ctx, 100 + i * 30, 74, 24, 10, MID); // rocket pods
  socket(ctx, 104, 79, 3);
  socket(ctx, 134, 79, 3);
  rect(ctx, 28, 82, 16, 8, DARK); // chin gun
  rect(ctx, 16, 84, 14, 4, DARK);
  stripes(ctx, 90, 40, 40, 5);
  limb(ctx, [96, 30, 96, 18], 5, DARK); // rotor mast
  limb(ctx, [50, 96, 140, 96], 3, DARK); // skids
  limb(ctx, [60, 88, 56, 96], 2, DARK);
  limb(ctx, [130, 88, 134, 96], 2, DARK);
}

export const BOSS_SHAPES: Readonly<Record<BossId, (ctx: Ctx) => void>> = {
  warden, 'sewer-eye': sewerEye, 'lab-ai': labAi, core, jailer, apc, chimera, crane, sniper, gunship,
};
