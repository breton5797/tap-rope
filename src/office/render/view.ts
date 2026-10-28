// Office build stand-in for src/render/view.ts (build/office-swaps.ts): a camera pulled back from the v8
// framing (playtest: hero, scene and hazards seen from a little farther, more corridor ahead). Phones zoom
// 1.05 instead of 1.35 with the hero further left and the floor lower (the scene fills the space between the
// HUD and the rhythm lane); wide screens (iPad) drop below the fit scale. Projection
// only: beats, judge timing and hit boxes do not depend on the view.
import { computeViewWith, type Camera, type View } from '../../render/view';

export * from '../../render/view';

export const OFFICE_CAMERA: Camera = { wideZoom: 0.8, portraitZoom: 1.05, agentFrac: 0.2, floorFrac: 0.76 };

export function computeView(cssW: number, cssH: number, dprRaw: number, safeBottom = 0): View {
  return computeViewWith(OFFICE_CAMERA, cssW, cssH, dprRaw, safeBottom);
}
