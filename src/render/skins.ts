// Per-skin colors and body accessories (tails, backpacks, chest emblems).
import type { SkinId } from '../types';
import type { FaceStyle } from './face';
import type { Ctx } from './util';

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

/** Cat tail curling out from behind the hips (seen from above). */
export function drawTail(ctx: Ctx, id: SkinId, t: number, air: boolean): void {
  if (id !== 'cat') return;
  const sw = Math.sin(t * (air ? 9 : 4)) * 3;
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#B86A1C';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(5, -10);
  ctx.bezierCurveTo(16, -10, 20 + sw, -18, 15 + sw, -24);
  ctx.stroke();
  ctx.strokeStyle = '#FFAE52';
  ctx.lineWidth = 4.2;
  ctx.stroke();
}
