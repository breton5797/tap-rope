// Operative outfits (GDD-v6 §3): six skins, ids unchanged, reinterpreted as adult tactical looks,
// plus the rescued scientist in an orange jumpsuit. Colours are muted; one small accent at most.
import type { SkinId } from '../types';

export type LookId = SkinId | 'prisoner';

/** how the head is covered: bare face + hair, hood, balaclava, slit mask, helmet, android head */
export type HeadStyle = 'hair' | 'hood' | 'balaclava' | 'slit' | 'helmet' | 'android';

export interface AgentLook {
  readonly suit: string; // base cloth colour (limbs, torso)
  readonly suitDark: string; // far-side limbs / shadow planes
  readonly suitLight: string; // key-light planes
  readonly vest: string | null; // plate carrier / tactical vest over the torso
  readonly vestLight: string;
  readonly skin: string; // exposed face / hands when bare
  readonly hair: string; // hair, hood or mask colour
  readonly head: HeadStyle;
  readonly gloves: string;
  readonly boots: string;
  readonly accent: string; // lens / LED / visor glow
  readonly nvg: boolean; // night-vision mount on the head
  readonly backpack: boolean;
  readonly holster: boolean;
  readonly metal: boolean; // plate seams instead of cloth folds (android)
}

export const LOOKS: Readonly<Record<LookId, AgentLook>> = {
  // Agent K: black tactical suit, plate carrier, NVG
  kid: {
    suit: '#30363E', suitDark: '#1A1E23', suitLight: '#55606C', vest: '#3A424B', vestLight: '#5C6874',
    skin: '#B98C70', hair: '#17140F', head: 'hair', gloves: '#121417', boots: '#0D0F11', accent: '#3FE0D0',
    nvg: true, backpack: false, holster: true, metal: false,
  },
  // Black Cat: matte stealth suit, full hood + goggles
  cat: {
    suit: '#1E2024', suitDark: '#0E0F12', suitLight: '#3C4048', vest: null, vestLight: '#26282D',
    skin: '#9E7660', hair: '#0E0F12', head: 'balaclava', gloves: '#0B0C0E', boots: '#08090A', accent: '#3FE0D0',
    nvg: true, backpack: false, holster: false, metal: false,
  },
  // Hacker: charcoal hoodie, cargo pants, backpack with antenna
  bunny: {
    suit: '#454A52', suitDark: '#2A2D32', suitLight: '#646B75', vest: null, vestLight: '#4D535C',
    skin: '#C49A7C', hair: '#2E3136', head: 'hood', gloves: '#1E2024', boots: '#1A1C1F', accent: '#3FE0D0',
    nvg: false, backpack: true, holster: false, metal: false,
  },
  // R-7: combat android, brushed metal shell, red sensor strip
  robot: {
    suit: '#6E757E', suitDark: '#41464D', suitLight: '#A2A9B2', vest: '#555B63', vestLight: '#8A919A',
    skin: '#8A9199', hair: '#2A2E33', head: 'android', gloves: '#3A3F45', boots: '#2A2E33', accent: '#FF2A3A',
    nvg: false, backpack: false, holster: false, metal: true,
  },
  // Shadow: deep navy suit, face mask with an eye slit
  ninja: {
    suit: '#243048', suitDark: '#121A2A', suitLight: '#3D4C6C', vest: null, vestLight: '#2C3750',
    skin: '#A27C64', hair: '#121826', head: 'slit', gloves: '#0E1320', boots: '#0B0F18', accent: '#FFB020',
    nvg: false, backpack: false, holster: true, metal: false,
  },
  // Special forces: olive fatigues, helmet, plate carrier
  astro: {
    suit: '#4A5238', suitDark: '#303624', suitLight: '#646E4C', vest: '#3B4230', vestLight: '#56604A',
    skin: '#B08468', hair: '#3A4030', head: 'helmet', gloves: '#2A2E22', boots: '#1E2018', accent: '#FFB020',
    nvg: true, backpack: false, holster: true, metal: false,
  },
  // the rescued scientist: orange prison jumpsuit, grey hair
  prisoner: {
    suit: '#C2622A', suitDark: '#8A4119', suitLight: '#DE8146', vest: null, vestLight: '#DE8146',
    skin: '#C79A7E', hair: '#8E8C88', head: 'hair', gloves: '#C79A7E', boots: '#3A3530', accent: '#FFB020',
    nvg: false, backpack: false, holster: false, metal: false,
  },
};

export function lookFor(id: LookId): AgentLook {
  return LOOKS[id] ?? LOOKS.kid;
}
