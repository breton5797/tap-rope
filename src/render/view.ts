import { LOGICAL_H, LOGICAL_W } from '../types';

/**
 * Mapping between the 360x640 logical scene and the device canvas. The logical rect
 * is scaled uniformly and centered; x0/y0/w/h describe the full visible area in
 * logical units (it extends beyond 0..360 / 0..640 on tall or wide screens).
 */
export interface View {
  readonly cssW: number;
  readonly cssH: number;
  readonly dpr: number;
  readonly s: number; // css px per logical px
  readonly k: number; // device px per logical px
  readonly ox: number; // css offset of the logical origin
  readonly oy: number;
  readonly x0: number;
  readonly y0: number;
  readonly w: number;
  readonly h: number;
  readonly key: string;
}

export const MAX_DPR = 2.5;

export function computeView(cssW: number, cssH: number, dprRaw: number): View {
  const cw = Math.max(1, cssW);
  const ch = Math.max(1, cssH);
  const dpr = Math.min(MAX_DPR, Math.max(1, Number.isFinite(dprRaw) ? dprRaw : 1));
  const s = Math.min(cw / LOGICAL_W, ch / LOGICAL_H);
  const ox = (cw - LOGICAL_W * s) / 2;
  const oy = (ch - LOGICAL_H * s) / 2;
  return {
    cssW: cw,
    cssH: ch,
    dpr,
    s,
    k: s * dpr,
    ox,
    oy,
    x0: -ox / s,
    y0: -oy / s,
    w: cw / s,
    h: ch / s,
    key: `${cw}x${ch}@${dpr}`,
  };
}
