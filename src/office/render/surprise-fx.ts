// Office surprise visuals (office spec §6, §9): blackout darkness (the props come back as silhouettes, see
// props.ts), fire-drill red flash, high-five popup, broadcast banner and the superiors' speech bubbles. Drawn
// over the finished v8 frame in logical coordinates; hit boxes and "!" warnings are the v8 ones.
import { FLOOR_BACK, depthScale, laneY, projX } from '../../render/layout';
import { ACTION_COLORS, type ActionCue } from './props';
import { roundRect, type Ctx } from '../../render/util';
import { PLAYER_X } from '../../types';
import { officeImage } from './images';
import { clockY, laneTopY } from './clock';
import { placeBubble, type Rect } from './surprise';
import { hintSegments } from './readability';
import { PERSON_ASPECT, PERSON_FX, personWidth } from './boss-rigs';
import type { View } from '../../render/view';

/** how far below the face a bubble may be pushed by the DOM HUD before it waits */
const MAX_DROP = 40;
const BUBBLE_H = 26;
const BUBBLE_FONT = '700 12px ui-rounded, system-ui, sans-serif';

/** the blackout darkness over the world (the rhythm lane stays lit); the props come back as silhouettes */
export function drawBlackout(ctx: Ctx, v: View, scene: number): void {
  ctx.fillStyle = `rgba(6,8,22,${scene})`;
  ctx.fillRect(v.x0, v.y0, v.w, laneTopY(v) - v.y0);
}

/** fire drill: pulsing red edge wash + "소방훈련!" banner (the rear hazard keeps its v8 "!") */
export function drawFireDrill(ctx: Ctx, v: View, age: number, reduced: boolean): void {
  const pulse = reduced ? 0.6 : 0.5 + 0.5 * Math.sin(age * Math.PI * 6);
  const g = ctx.createRadialGradient(v.x0 + v.w / 2, v.y0 + v.h / 2, Math.min(v.w, v.h) * 0.3, v.x0 + v.w / 2, v.y0 + v.h / 2, Math.max(v.w, v.h) * 0.7);
  g.addColorStop(0, 'rgba(255,40,60,0)');
  g.addColorStop(1, `rgba(255,40,60,${0.35 * pulse})`);
  ctx.fillStyle = g;
  ctx.fillRect(v.x0, v.y0, v.w, v.h);
  banner(ctx, v, '소방훈련! 뒤에서 와요', '#FF4D6A', bannerY(v));
}

/** surprise banners sit in the free band just above the clock (below every DOM HUD row) */
export function bannerY(v: View): number {
  return clockY(v) - 34 / v.s;
}

/** high five: "같이 퇴근하자!" popup over the hero, kept inside the view and under the DOM HUD rows */
export function drawHighFive(ctx: Ctx, v: View, x: number, y: number, age: number, below: number): void {
  const text = '하이파이브! 같이 퇴근하자!';
  ctx.font = BUBBLE_FONT;
  const half = Math.min(230, ctx.measureText(text).width + 22) / 2;
  const k = Math.min(1, age / 0.15);
  ctx.save();
  ctx.translate(Math.max(v.x0 + half + 6, Math.min(v.x0 + v.w - half - 6, x)), Math.max(below + 22, y - 20 * k));
  ctx.scale(0.6 + 0.4 * k, 0.6 + 0.4 * k);
  bubble(ctx, 0, 0, text, '#FFE45C', '#3A2A00', 'down');
  ctx.restore();
}

/** company broadcast: banner across the top */
export function drawBroadcast(ctx: Ctx, v: View): void {
  banner(ctx, v, '사내방송: 사장님 깜짝 순시 중', '#5CC8FF', bannerY(v));
}

/** a superior's speech bubble beside the figure's face, kept under the DOM HUD rows and the phase line; returns its bottom (popups stay below it) */
export function drawBossBubble(ctx: Ctx, v: View, text: string, below: number, avoid: Rect | null): number {
  const w = personWidth(v.w);
  const faceY = FLOOR_BACK - (w / PERSON_ASPECT) * 0.8;
  const x = Math.max(v.x0 + 120, v.x0 + v.w * PERSON_FX - w * 0.35 - 70);
  const y = Math.max(faceY, below + 18);
  // a DOM card (briefing, tutorial) covering the face: wait instead of dropping onto the hero
  if (y > faceY + MAX_DROP) return Number.NEGATIVE_INFINITY;
  ctx.font = BUBBLE_FONT;
  const bw = Math.min(230, ctx.measureText(text).width + 22);
  // never under the countdown digit: just above it (below the HUD) or just below it
  const cy = placeBubble({ x, y, w: bw, h: BUBBLE_H }, avoid, below + 4);
  bubble(ctx, x, cy, text, '#FFFFFF', '#1E2238', 'right');
  return cy + BUBBLE_H / 2 + 10;
}

function banner(ctx: Ctx, v: View, text: string, color: string, y: number): void {
  ctx.font = '800 13px ui-rounded, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = Math.min(v.w - 16, ctx.measureText(text).width + 28);
  const x = v.x0 + v.w / 2;
  ctx.fillStyle = color;
  roundRect(ctx, x - w / 2, y - 12, w, 24, 12);
  ctx.fill();
  ctx.fillStyle = '#10121E';
  ctx.fillText(text, x, y + 1, w - 16);
}

/** rounded bubble centred on (x, y) with a tail pointing down or down-right */
function bubble(ctx: Ctx, x: number, y: number, text: string, fill: string, ink: string, tail: 'down' | 'right'): void {
  ctx.font = BUBBLE_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const w = Math.min(230, ctx.measureText(text).width + 22);
  const h = BUBBLE_H;
  ctx.fillStyle = fill;
  ctx.strokeStyle = ink;
  ctx.lineWidth = 2;
  roundRect(ctx, x - w / 2, y - h / 2, w, h, 12);
  ctx.fill();
  ctx.stroke();
  const tx = tail === 'down' ? x : x + w / 2 - 22;
  ctx.beginPath();
  ctx.moveTo(tx - 6, y + h / 2 - 1);
  ctx.lineTo(tx + (tail === 'down' ? 0 : 10), y + h / 2 + 10);
  ctx.lineTo(tx + 6, y + h / 2 - 1);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = ink;
  ctx.fillText(text, x, y + 1, w - 12);
}

const CONFETTI = ['#FF9F1C', '#3B8BFF', '#E8344B', '#2FD27A', '#9B5CFF', '#FFE45C'];
const CONFETTI_N = 36;
/** a mission stamp's confetti burst lasts this long (s) */
export const CONFETTI_TIME = 1.4;

/** confetti burst from the top centre, `age` s after a mission stamp (no allocation) */
export function drawConfetti(ctx: Ctx, v: View, age: number, top: number): void {
  if (age < 0 || age > CONFETTI_TIME) return;
  const fade = Math.min(1, (CONFETTI_TIME - age) / 0.4);
  ctx.save();
  for (let i = 0; i < CONFETTI_N; i++) {
    const dir = ((i * 73) % 100) / 100 - 0.5; // −0.5..0.5
    const speed = 120 + ((i * 41) % 90);
    const x = v.x0 + v.w / 2 + dir * speed * 2 * age;
    const y = top + 10 - speed * 1.2 * age + 380 * age * age;
    const spin = age * (6 + (i % 5)) + i;
    ctx.globalAlpha = fade;
    ctx.fillStyle = CONFETTI[i % CONFETTI.length];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(spin);
    ctx.fillRect(-3, -1.5, 6, 3);
    ctx.restore();
  }
  ctx.restore();
}

/** F10 callout copy per prop (the superior shouts its attack) */
const PROP_NAMES: Readonly<Record<string, string>> = {
  postit: '포스트잇 폭풍!', papers: '서류 더미!', 'coffee-tray': '커피 쟁반!', 'paper-plane': '종이비행기!',
  clipboard: '결재판 부메랑!', 'paper-jam': '용지 걸림!', door: '회의실 문 벌컥!', whiteboard: '화이트보드 돌진!',
  pointer: '레이저 포인터!', golf: '나이스 샷!', 'latte-bubble': '라떼는 말이야!', elevator: '엘리베이터 띵!',
  'doc-tornado': '서류 회오리!', necktie: '넥타이 채찍!', 'corp-card': '법인카드!', 'ceo-screen': '화상회의!',
  'revolving-door': '회전문 가속!', envelope: '금일봉 비!', cart: '카트 질주!', robot: '청소 로봇!',
};

/** the attack telegraph as a boss-bubble-sized callout: prop icon, attack name, action hint in its colour; returns its bottom y */
export function drawAttackCallout(
  ctx: Ctx, v: View, icon: HTMLImageElement | null, propId: string, cue: ActionCue, hint: string, below: number, avoid: Rect | null,
): number {
  const name = PROP_NAMES[propId] ?? '기습!';
  const color = ACTION_COLORS[cue];
  ctx.font = CALLOUT_FONT;
  const textW = ctx.measureText(name).width;
  ctx.font = HINT_FONT;
  // a combo beat (lane + jump / slide) gets one colour chip per move, so each half reads in its hazard colour
  const segs = hintSegments(hint);
  const combo = segs.length > 1;
  const segW = segs.map((g) => ctx.measureText(g.text).width + (combo ? CHIP_PAD * 2 : 0));
  const hintW = segW.reduce((a, b) => a + b, 0) + (segs.length - 1) * CHIP_GAP;
  const w = Math.min(v.w - 16, 44 + textW + 10 + hintW + 14);
  const h = 34;
  const bw = personWidth(v.w);
  const faceY = FLOOR_BACK - (bw / PERSON_ASPECT) * 0.8;
  const cx = Math.min(v.x0 + v.w - w / 2 - 6, Math.max(v.x0 + w / 2 + 6, v.x0 + v.w * PERSON_FX - bw * 0.3 - w / 2 + 20));
  const cy = placeBubble({ x: cx, y: Math.max(faceY, below + 22), w, h }, avoid, below + 4);
  ctx.save();
  ctx.fillStyle = '#FFFBF3';
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  roundRect(ctx, cx - w / 2, cy - h / 2, w, h, 12);
  ctx.fill();
  ctx.stroke();
  if (icon) {
    const ih = 26;
    const iw = (ih * icon.naturalWidth) / icon.naturalHeight;
    ctx.drawImage(icon, cx - w / 2 + 8, cy - ih / 2, iw, ih);
  }
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#2E2433';
  ctx.font = CALLOUT_FONT;
  ctx.fillText(name, cx - w / 2 + 40, cy + 1);
  ctx.font = HINT_FONT;
  let x = cx - w / 2 + 40 + textW + 10;
  segs.forEach((g, i) => {
    if (combo) {
      ctx.fillStyle = g.color;
      roundRect(ctx, x, cy - 11, segW[i], 22, 11);
      ctx.fill();
      ctx.fillStyle = '#FFFFFF';
      ctx.fillText(g.text, x + CHIP_PAD, cy + 1);
    } else {
      ctx.fillStyle = g.color;
      ctx.fillText(g.text, x, cy + 1);
    }
    x += segW[i] + CHIP_GAP;
  });
  ctx.restore();
  return cy + h / 2;
}

/** combo hint chips: inner padding and the gap between chips (css px) */
const CHIP_PAD = 6;
const CHIP_GAP = 4;
const CALLOUT_FONT = '900 15px ui-rounded, system-ui, sans-serif';
const HINT_FONT = '900 13px ui-rounded, system-ui, sans-serif';

/** the colleague runs in one lane-step away from the hero (nearer when there is room, else farther) */
export function colleagueLane(lane: number): number {
  return lane <= 1.4 ? lane + 0.6 : lane - 0.6;
}

/** high five: the colleague (prop-colleague) runs in beside the hero for ~1 s; nothing when the art is missing */
export function drawColleague(ctx: Ctx, lane: number, age: number): void {
  const img = officeImage('prop-colleague');
  if (!img || age > 1.1) return;
  const inK = Math.min(1, age / 0.2);
  const out = age > 0.9 ? (age - 0.9) / 0.2 : 0;
  const d = colleagueLane(lane);
  const s = depthScale(d);
  const h = 96 * s;
  const w = (h * img.naturalWidth) / img.naturalHeight;
  ctx.save();
  ctx.globalAlpha *= inK * (1 - out);
  ctx.drawImage(img, projX(PLAYER_X + 34 - 40 * (1 - inK), d) - w / 2, laneY(d) - h, w, h);
  ctx.restore();
}
