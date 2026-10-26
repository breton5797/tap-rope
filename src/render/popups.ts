// Floating judgement / combo / info readouts, tactical-HUD style (GDD-v6 §5): condensed caps,
// one accent colour per style, a thin underline bar, quick settle-in and fade. No outlines/sparkles.
import { PLAYER_X, type PopupStyle } from '../types';
import { HUD_FONT } from './lane-icons';
import { easeOutCubic, type Ctx } from './util';

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
  readonly color: string;
  readonly life: number;
  readonly group: number;
}

const STYLES: Readonly<Record<PopupStyle, StyleDef>> = {
  perfect: { size: 26, baseY: 280, color: '#3FE0D0', life: 0.8, group: 0 },
  good: { size: 22, baseY: 280, color: '#E8ECEF', life: 0.7, group: 0 },
  miss: { size: 24, baseY: 280, color: '#FF2A3A', life: 0.8, group: 0 },
  combo: { size: 16, baseY: 250, color: '#FFB020', life: 1.0, group: 1 },
  info: { size: 14, baseY: 222, color: '#E8ECEF', life: 1.4, group: 2 },
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
    // the same text fired again within a moment (e.g. two beats judged together): refresh, don't stack
    for (const p of this.items) {
      if (p.active && p.text === text && p.style === style && p.age < 0.2) {
        p.age = 0;
        return;
      }
    }
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
    // older popups of the group must sit fully above the new one (spawn heights differ when airborne)
    for (const p of this.items) {
      if (p === slot || !p.active || STYLES[p.style].group !== def.group) continue;
      p.bump = Math.max(p.bump, p.y0 - slot.y0 + def.size + 4);
    }
  }

  update(dt: number): void {
    for (const p of this.items) {
      if (!p.active) continue;
      p.age += dt;
      if (p.age >= p.life) p.active = false;
    }
  }
}

export function drawPopups(ctx: Ctx, pool: PopupPool): void {
  for (const p of pool.items) {
    if (!p.active) continue;
    const def = STYLES[p.style];
    const f = p.age / p.life;
    // settle from 1.12× to 1× (no overshoot), drift up, fade out
    const k = Math.min(1, p.age / 0.12);
    const sc = 1.12 - 0.12 * easeOutCubic(k);
    const y = p.y0 - 16 * easeOutCubic(f) - p.bump;
    const glitch = p.style === 'miss' && p.age < 0.2 ? (Math.floor(p.age * 60) % 2 ? 2 : -2) : 0;
    ctx.save();
    ctx.globalAlpha = (f > 0.7 ? 1 - (f - 0.7) / 0.3 : 1) * Math.min(1, p.age / 0.05);
    ctx.translate(PLAYER_X + glitch, y);
    ctx.scale(sc, sc);
    ctx.font = `700 ${def.size}px ${HUD_FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(p.text, 1, 1.5);
    ctx.fillStyle = def.color;
    ctx.fillText(p.text, 0, 0);
    const w = ctx.measureText(p.text).width;
    ctx.fillRect(-w / 2, def.size * 0.5, w * Math.min(1, p.age / 0.15), 1.5);
    ctx.restore();
  }
}
