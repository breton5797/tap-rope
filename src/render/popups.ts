// Floating judgement / combo / info text with scale-pop and fade.
import { PLAYER_X, type PopupStyle } from '../types';
import { easeOutBack, easeOutCubic, FONT, outlinedText, starPath, type Ctx } from './util';

interface Popup {
  text: string;
  style: PopupStyle;
  age: number;
  life: number;
  bump: number;
  y0: number;
  active: boolean;
}

const SLOTS = 8;

interface StyleDef {
  readonly size: number;
  readonly baseY: number;
  readonly stroke: string;
  readonly fill: string;
  readonly fill2: string;
  readonly life: number;
  readonly group: number;
}

const STYLES: Readonly<Record<PopupStyle, StyleDef>> = {
  perfect: { size: 34, baseY: 280, stroke: '#7A3300', fill: '#FFF3A6', fill2: '#FFB21E', life: 0.85, group: 0 },
  good: { size: 28, baseY: 280, stroke: '#0B5A3A', fill: '#C8FFE6', fill2: '#2FD08A', life: 0.75, group: 0 },
  miss: { size: 30, baseY: 280, stroke: '#5C0F14', fill: '#FFC2C0', fill2: '#FF4B48', life: 0.8, group: 0 },
  combo: { size: 22, baseY: 246, stroke: '#5A1FC2', fill: '#FFFFFF', fill2: '#E6D9FF', life: 1.0, group: 1 },
  info: { size: 18, baseY: 214, stroke: 'rgba(30,20,60,0.9)', fill: '#FFFFFF', fill2: '#FFFFFF', life: 1.4, group: 2 },
};

export class PopupPool {
  readonly items: Popup[] = [];

  constructor() {
    for (let i = 0; i < SLOTS; i++) {
      this.items.push({ text: '', style: 'info', age: 0, life: 1, bump: 0, y0: 0, active: false });
    }
  }

  /** playerTop: logical y of the top of the player's head when the popup spawns */
  add(text: string, style: PopupStyle, playerTop: number): void {
    const def = STYLES[style];
    let slot = this.items.find((p) => !p.active);
    if (!slot) slot = this.items.reduce((a, b) => (a.age > b.age ? a : b));
    for (const p of this.items) if (p.active && STYLES[p.style].group === def.group) p.bump += def.size + 4;
    slot.text = text;
    slot.style = style;
    slot.age = 0;
    slot.life = def.life;
    slot.bump = 0;
    slot.y0 = Math.min(STYLES.perfect.baseY, playerTop - 34) - (STYLES.perfect.baseY - def.baseY);
    slot.active = true;
  }

  update(dt: number): void {
    for (const p of this.items) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) p.active = false;
    }
  }
}

const gradCache = new Map<PopupStyle, CanvasGradient>();

function fillFor(ctx: Ctx, style: PopupStyle, def: StyleDef): CanvasGradient {
  let g = gradCache.get(style);
  if (!g) {
    g = ctx.createLinearGradient(0, -def.size * 0.55, 0, def.size * 0.4);
    g.addColorStop(0, def.fill);
    g.addColorStop(1, def.fill2);
    gradCache.set(style, g);
  }
  return g;
}

function sparkles(ctx: Ctx, w: number, age: number): void {
  ctx.fillStyle = '#FFFFFF';
  for (let i = 0; i < 2; i++) {
    const s = 3 + 3 * Math.abs(Math.sin(age * 9 + i * 1.7));
    starPath(ctx, (i ? 1 : -1) * (w / 2 + 8), -12 + i * 10, s, s * 0.3, 4);
    ctx.fill();
  }
}

export function drawPopups(ctx: Ctx, pool: PopupPool): void {
  for (const p of pool.items) {
    if (!p.active) continue;
    const def = STYLES[p.style];
    const f = p.age / p.life;
    const pop = p.age < 0.18 ? Math.max(0.01, easeOutBack(p.age / 0.18)) : 1;
    const y = p.y0 - 22 * easeOutCubic(f) - p.bump;
    const wob = p.style === 'miss' ? Math.sin(p.age * 55) * 3 * (1 - f) : 0;
    ctx.save();
    ctx.globalAlpha = f > 0.7 ? 1 - (f - 0.7) / 0.3 : 1;
    ctx.translate(PLAYER_X + wob, y);
    ctx.scale(pop, pop);
    if (p.style === 'perfect') ctx.rotate(Math.sin(p.age * 6) * 0.03);
    ctx.font = `900 ${def.size}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(20,10,40,0.35)';
    ctx.fillText(p.text, 0, 3);
    outlinedText(ctx, p.text, 0, 0, fillFor(ctx, p.style, def), def.stroke, def.size * 0.22);
    if (p.style === 'perfect') sparkles(ctx, ctx.measureText(p.text).width, p.age);
    ctx.restore();
  }
}
