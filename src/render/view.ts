import { GROUND_Y, LOGICAL_H, LOGICAL_W, PLAYER_X } from '../types';

/**
 * Mapping between the 360x640 logical scene and the device canvas. The logical rect
 * is scaled uniformly and centered; x0/y0/w/h describe the full visible area in
 * logical units (it extends beyond 0..360 / 0..640 on tall or wide screens).
 * v8 (GDD-v8 A2): tall portrait screens zoom the camera in (up to PORTRAIT_ZOOM), put the floor
 * line at FLOOR_FRAC of the height and the agent at AGENT_FRAC of the width; the rhythm lane has
 * its own unzoomed transform (ls / lox / loy) docked to the bottom safe area, its hit ring under the agent.
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
  /** v8: camera zoom over the fit-to-screen scale (1 = none) */
  readonly zoom: number;
  /** v8 rhythm lane: css px per lane logical px and the css offset of its logical origin */
  readonly ls: number;
  readonly lox: number;
  readonly loy: number;
}

export const MAX_DPR = 2.5;
/** v8: full portrait zoom at aspect (w/h) ≤ ZOOM_FULL_AT, none at ≥ ZOOM_NONE_AT (iPad, landscape) */
export const PORTRAIT_ZOOM = 1.35;
const ZOOM_FULL_AT = 0.5;
const ZOOM_NONE_AT = 0.64;
/** zoomed framing: floor line at this fraction of the height, agent at this fraction of the width */
export const FLOOR_FRAC = 0.635;
export const AGENT_FRAC = 0.25;
/** rhythm lane (render/lane.ts): logical top/height of its panel, css gap above the bottom safe area */
export const LANE_TOP = 542;
export const LANE_HEIGHT = 68;
const LANE_GAP = 10;

/** 0 (no zoom) .. 1 (full portrait zoom) for a css viewport */
export function zoomAmount(cssW: number, cssH: number): number {
  const a = Math.max(1, cssW) / Math.max(1, cssH);
  return Math.max(0, Math.min(1, (ZOOM_NONE_AT - a) / (ZOOM_NONE_AT - ZOOM_FULL_AT)));
}

/** camera framing: zoom over the fit scale on wide (t = 0) and tall portrait (t = 1) screens, and where the
 * agent / floor sit on the full portrait framing (fractions of the screen) */
export interface Camera {
  readonly wideZoom: number;
  readonly portraitZoom: number;
  readonly agentFrac: number;
  readonly floorFrac: number;
}

/** v8 (GDD-v8 A2) */
export const V8_CAMERA: Camera = { wideZoom: 1, portraitZoom: PORTRAIT_ZOOM, agentFrac: AGENT_FRAC, floorFrac: FLOOR_FRAC };

export function computeView(cssW: number, cssH: number, dprRaw: number, safeBottom = 0): View {
  return computeViewWith(V8_CAMERA, cssW, cssH, dprRaw, safeBottom);
}

export function computeViewWith(cam: Camera, cssW: number, cssH: number, dprRaw: number, safeBottom = 0): View {
  const cw = Math.max(1, cssW);
  const ch = Math.max(1, cssH);
  const dpr = Math.min(MAX_DPR, Math.max(1, Number.isFinite(dprRaw) ? dprRaw : 1));
  const fit = Math.min(cw / LOGICAL_W, ch / LOGICAL_H);
  const t = zoomAmount(cw, ch);
  const zoom = cam.wideZoom + (cam.portraitZoom - cam.wideZoom) * t;
  const s = fit * zoom;
  // blend the centred fit framing toward the zoomed framing (agent / floor anchored)
  const agentFit = ((cw - LOGICAL_W * fit) / 2 + PLAYER_X * fit) / cw;
  const floorFit = ((ch - LOGICAL_H * fit) / 2 + GROUND_Y * fit) / ch;
  const ox = (agentFit + (cam.agentFrac - agentFit) * t) * cw - PLAYER_X * s;
  const oy = (floorFit + (cam.floorFrac - floorFit) * t) * ch - GROUND_Y * s;
  // rhythm lane: fit scale, hit ring under the agent; docked to the bottom safe area when zoomed
  const ls = fit;
  const lox = ox + PLAYER_X * s - PLAYER_X * ls;
  const fitTop = (ch - LOGICAL_H * fit) / 2 + LANE_TOP * fit;
  const dockTop = ch - Math.max(0, safeBottom) - LANE_GAP - LANE_HEIGHT * ls;
  const loy = fitTop + (Math.max(fitTop, dockTop) - fitTop) * t - LANE_TOP * ls;
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
    zoom,
    ls,
    lox,
    loy,
  };
}
