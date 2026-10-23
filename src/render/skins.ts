// Agent outfits per skin (v4 spy cartoon) + the rescued prisoner.
import type { SkinId } from '../types';
import type { FaceStyle } from './face';

export type LookId = SkinId | 'prisoner';

export interface AgentLook {
  readonly skin: string; // face / head colour
  readonly skinLight: string;
  readonly skinShade: string;
  readonly suit: string;
  readonly suitDark: string;
  readonly accent: string; // tie / emblem / trim
  readonly boot: string;
  readonly hand: string;
  readonly stripes: boolean;
  readonly face: FaceStyle;
}

const FACE: FaceStyle = { eye: '#2B2140', mouth: '#7A3044', blush: true };

export const LOOKS: Readonly<Record<LookId, AgentLook>> = {
  kid: {
    skin: '#FFD9B8', skinLight: '#FFF0E2', skinShade: '#F0AF88', suit: '#2B3045', suitDark: '#171A26',
    accent: '#FF3358', boot: '#12141C', hand: '#FFD9B8', stripes: false, face: FACE,
  },
  cat: {
    skin: '#FFAE52', skinLight: '#FFD596', skinShade: '#E07F24', suit: '#2B3045', suitDark: '#171A26',
    accent: '#FFD23F', boot: '#12141C', hand: '#FFAE52', stripes: false, face: FACE,
  },
  bunny: {
    skin: '#FFF3F7', skinLight: '#FFFFFF', skinShade: '#F1C3D4', suit: '#7B61FF', suitDark: '#5038C8',
    accent: '#3DFFB4', boot: '#2B2140', hand: '#FFF3F7', stripes: false, face: FACE,
  },
  robot: {
    skin: '#D8E0EC', skinLight: '#FFFFFF', skinShade: '#8E9BB4', suit: '#AEB9CC', suitDark: '#6E7A92',
    accent: '#3BF4FF', boot: '#4A5570', hand: '#C9D3E2', stripes: false,
    face: { eye: '#5CF2FF', mouth: null, blush: false },
  },
  ninja: {
    skin: '#30345A', skinLight: '#545A8C', skinShade: '#1A1C34', suit: '#262A48', suitDark: '#14162A',
    accent: '#E63946', boot: '#0E0F1C', hand: '#30345A', stripes: false,
    face: { eye: '#2B2140', mouth: null, blush: false },
  },
  astro: {
    skin: '#FFD9B8', skinLight: '#FFF0E2', skinShade: '#F0AF88', suit: '#5F7A4C', suitDark: '#3C4E30',
    accent: '#C9A24A', boot: '#2A2A22', hand: '#3C4E30', stripes: false, face: FACE,
  },
  prisoner: {
    skin: '#FFD3B0', skinLight: '#FFEBDA', skinShade: '#EAA47E', suit: '#F2F2F4', suitDark: '#C9CCD6',
    accent: '#2B2F3E', boot: '#5A4A3A', hand: '#FFD3B0', stripes: true, face: FACE,
  },
};

export function lookFor(id: LookId): AgentLook {
  return LOOKS[id] ?? LOOKS.kid;
}
