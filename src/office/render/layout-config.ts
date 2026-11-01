// Office build stand-in for src/render/layout-config.ts (build/office-swaps.ts), v2 F8: lanes far enough apart
// that a dodge reads as a dodge on a phone (≥ 45% of the hero's 110 px height) and nearer lanes visibly
// larger (0.87 / 1.0 / 1.13). Projection only: beats, judge and hit boxes do not depend on it.
import type { LaneGeometry } from '../../render/layout-config';

export type { LaneGeometry } from '../../render/layout-config';

export const LANE_GEOMETRY: LaneGeometry = { laneStep: 50, depthStep: 0.13 };
