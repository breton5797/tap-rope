// Office build stand-in for src/render/lane-style.ts (build/office-swaps.ts): the rhythm lane as a light
// pastel card with a dark comic outline and hard shadow (palette of src/office/styles/office.css); the
// lane icons keep their own high-contrast chips.
import type { LaneStyle } from '../../render/lane-style';

export type { LaneStyle } from '../../render/lane-style';

export const LANE_STYLE: LaneStyle = {
  fill: 'rgba(255,251,243,0.96)', // --panel
  edge: '#3a2e3f', // --outline
  edgeW: 2,
  radius: 12,
  accent: null,
  shadow: '#3a2e3f', // --shadow: 0 4px 0 var(--outline)
  tick: 'rgba(58,46,63,0.3)', // --line, a touch stronger
  rule: 'rgba(58,46,63,0.14)',
  ring: '#3a2e3f',
  ringLit: '#13806f', // --teal
};
