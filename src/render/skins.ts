// Per-skin colors and body accessories (tails, backpacks, chest emblems).
import type { SkinId } from '../types';
import type { FaceStyle } from './face';
import { circle, roundRect, starPath, type Ctx } from './util';

export interface SkinLook {
  readonly head: string;
  readonly headLight: string;
  readonly headShade: string;
  readonly limb: string;
  readonly shirt: string;
  readonly shirtDark: string;
  readonly pants: string;
  readonly shoe: string;
  readonly face: FaceStyle;
}

const DEFAULT_FACE: FaceStyle = { eye: '#2B2140', mouth: '#7A3044', blush: true };

export const LOOKS: Readonly<Record<SkinId, SkinLook>> = {
  kid: {
    head: '#FFD9B8', headLight: '#FFF0E2', headShade: '#F0AF88', limb: '#FFD9B8',
    shirt: '#FFD23F', shirtDark: '#EC9D00', pants: '#3A86FF', shoe: '#FF5E5B', face: DEFAULT_FACE,
  },
  cat: {
    head: '#FFAE52', headLight: '#FFD596', headShade: '#E07F24', limb: '#FFAE52',
    shirt: '#5B8CFF', shirtDark: '#3760D6', pants: '#2E3B70', shoe: '#FFFFFF', face: DEFAULT_FACE,
  },
  bunny: {
    head: '#FFF3F7', headLight: '#FFFFFF', headShade: '#F1C3D4', limb: '#FFF3F7',
    shirt: '#FF8FB8', shirtDark: '#E25E8F', pants: '#9B7BFF', shoe: '#FF5E8E', face: DEFAULT_FACE,
  },
  ninja: {
    head: '#30345A', headLight: '#545A8C', headShade: '#1A1C34', limb: '#30345A',
    shirt: '#30345A', shirtDark: '#1A1C34', pants: '#262947', shoe: '#15172B',
    face: { eye: '#2B2140', mouth: null, blush: false },
  },
  robot: {
    head: '#D8E0EC', headLight: '#FFFFFF', headShade: '#8E9BB4', limb: '#AEB9CC',
    shirt: '#C9D3E2', shirtDark: '#8592AC', pants: '#7D8AA5', shoe: '#4A5570',
    face: { eye: '#5CF2FF', mouth: null, blush: false },
  },
  astro: {
    head: '#FFD9B8', headLight: '#FFF0E2', headShade: '#F0AF88', limb: '#F1F5FB',
    shirt: '#F4F7FB', shirtDark: '#BCC7D8', pants: '#E2E8F2', shoe: '#FF8A3D', face: DEFAULT_FACE,
  },
};

export function lookFor(id: SkinId): SkinLook {
  return LOOKS[id] ?? LOOKS.kid;
}

/** Accessories drawn behind the body (local player coords, feet at origin). */
export function drawBodyBack(ctx: Ctx, id: SkinId, t: number, air: boolean): void {
  if (id === 'cat') {
    const sw = Math.sin(t * (air ? 9 : 4)) * 4;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#B86A1C';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(6, -14);
    ctx.bezierCurveTo(18, -14, 20 + sw, -24, 15 + sw, -32);
    ctx.stroke();
    ctx.strokeStyle = '#FFAE52';
    ctx.lineWidth = 4.2;
    ctx.stroke();
  } else if (id === 'astro') {
    ctx.fillStyle = '#C9D3E2';
    roundRect(ctx, -14, -33, 28, 20, 6);
    ctx.fill();
    ctx.fillStyle = '#FF8A3D';
    roundRect(ctx, -15, -30, 4, 12, 2);
    ctx.fill();
    roundRect(ctx, 11, -30, 4, 12, 2);
    ctx.fill();
  }
}

/** Emblems drawn over the torso. */
export function drawChest(ctx: Ctx, id: SkinId, t: number): void {
  switch (id) {
    case 'kid':
      ctx.fillStyle = '#FFFFFF';
      starPath(ctx, 0, -21, 4.2, 1.9, 5);
      ctx.fill();
      break;
    case 'cat':
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      circle(ctx, 0, -20, 2.4);
      ctx.fill();
      for (const [x, y] of [[-3, -24], [0, -25.4], [3, -24]] as const) {
        circle(ctx, x, y, 1.1);
        ctx.fill();
      }
      break;
    case 'bunny':
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath();
      ctx.moveTo(0, -17.5);
      ctx.bezierCurveTo(-5, -21, -3, -26, 0, -23);
      ctx.bezierCurveTo(3, -26, 5, -21, 0, -17.5);
      ctx.fill();
      break;
    case 'ninja':
      ctx.fillStyle = '#E63946';
      ctx.fillRect(-10, -16.5, 20, 3.4);
      ctx.fillStyle = '#FFD166';
      roundRect(ctx, -2.5, -17.3, 5, 5, 1.2);
      ctx.fill();
      break;
    case 'robot':
      ctx.fillStyle = '#25324D';
      roundRect(ctx, -6, -26, 12, 9, 2.5);
      ctx.fill();
      for (let i = 0; i < 3; i++) {
        const on = Math.floor(t * 4 + i) % 3 === 0;
        ctx.fillStyle = on ? ['#3DDC97', '#FFB627', '#FF5E5B'][i] : '#3D4A66';
        circle(ctx, -3.5 + i * 3.5, -21.5, 1.3);
        ctx.fill();
      }
      break;
    case 'astro':
      ctx.fillStyle = '#FF8A3D';
      roundRect(ctx, -7, -26, 6, 5, 1.5);
      ctx.fill();
      ctx.fillStyle = '#4D96FF';
      roundRect(ctx, 1.5, -26, 5, 5, 2.5);
      ctx.fill();
      ctx.fillStyle = '#9AA7BD';
      ctx.fillRect(-9, -17, 18, 2);
      break;
  }
}
