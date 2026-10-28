// Corridor lane geometry (layout.ts): screen px between neighbouring lane floor lines and the depth scale
// change per lane. A re-skinned build swaps this module (projection only; judging never reads it).
export interface LaneGeometry {
  readonly laneStep: number;
  readonly depthStep: number;
}

/** v8: lanes 38px apart, scaled 0.9 / 1.0 / 1.1 */
export const LANE_GEOMETRY: LaneGeometry = { laneStep: 38, depthStep: 0.1 };
