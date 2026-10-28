// Rhythm lane colours (lane.ts): the v8 dark tactical glass. A re-skinned build swaps this module.
export interface LaneStyle {
  readonly fill: string;
  readonly edge: string;
  readonly edgeW: number;
  readonly radius: number;
  /** short accent bars on two corners (null = none) */
  readonly accent: string | null;
  /** hard drop shadow under the card (comic look), null = none */
  readonly shadow: string | null;
  readonly tick: string;
  readonly rule: string;
  /** hit ring: idle stroke, lit stroke / glow / pulse colour */
  readonly ring: string;
  readonly ringLit: string;
}

export const LANE_STYLE: LaneStyle = {
  fill: 'rgba(6,8,10,0.66)',
  edge: 'rgba(63,224,208,0.32)',
  edgeW: 1,
  radius: 4,
  accent: 'rgba(63,224,208,0.75)',
  shadow: null,
  tick: 'rgba(232,236,239,0.22)',
  rule: 'rgba(232,236,239,0.1)',
  ring: 'rgba(232,236,239,0.75)',
  ringLit: '#3FE0D0',
};
