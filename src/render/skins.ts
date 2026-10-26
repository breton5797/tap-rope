// Operative outfits (GDD-v6 §3): six skins, ids unchanged, reinterpreted as adult tactical gear in
// near-black / charcoal (variation lives in the gear, not in candy colours), plus the rescued
// scientist in a faded orange jumpsuit. Each material has three tones for plane shading.
import type { SkinId } from '../types';
import type { Tone } from './rig-parts';

export type LookId = SkinId | 'prisoner';

/** head covering: NVG + balaclava, stealth hood with visor slit, hoodie hood, android shell,
 * cloth wrap with eye slit, ballistic helmet, bare head (the scientist) */
export type HeadStyle = 'nvg' | 'visor' | 'hood' | 'android' | 'wrap' | 'helmet' | 'bare';

export interface AgentLook {
  readonly id: LookId;
  readonly suit: Tone; // torso + arms
  readonly legs: Tone; // trousers
  readonly vest: Tone | null; // plate carrier
  readonly vestLight: string; // straps / buckles
  readonly gloves: Tone;
  readonly boots: Tone;
  readonly sole: string;
  readonly head: HeadStyle;
  readonly headGear: Tone; // mask / hood / helmet / android shell
  readonly skin: Tone; // the sliver of face that shows (or the scientist's face and hands)
  readonly hair: string; // scientist only
  readonly accent: string; // lens / LED / visor / sensor colour
  /** emissive point on the head (head frame: x forward, y down) that glows, strongest in dark scenes */
  readonly glow: Glow | null;
  readonly belt: string | null;
  readonly sash: string | null; // cloth sash with knot tails (Shadow)
  readonly backpack: boolean;
  readonly holster: boolean;
  readonly metal: boolean; // android plates and seams
}

export interface Glow {
  readonly color: string;
  readonly x: number;
  readonly y: number;
}

const tone = (base: string, light: string, dark: string): Tone => ({ base, light, dark });

const SKIN_OPERATIVE = tone('#8E6A55', '#A8806A', '#5E4536');
const BLACK_GLOVE = tone('#141619', '#2A2E33', '#0A0B0D');
const BLACK_BOOT = tone('#121417', '#2B2F34', '#08090A');

export const LOOKS: Readonly<Record<LookId, AgentLook>> = {
  // Agent K: black tactical, plate carrier, balaclava, NVG on a low-cut helmet
  kid: {
    id: 'kid',
    suit: tone('#23272C', '#3A4148', '#15181B'), legs: tone('#202428', '#363D44', '#131518'),
    vest: tone('#2C3137', '#47505A', '#1A1D21'), vestLight: '#4E5862',
    gloves: BLACK_GLOVE, boots: BLACK_BOOT, sole: '#050506',
    head: 'nvg', headGear: tone('#1B1E22', '#353B42', '#0F1113'), skin: SKIN_OPERATIVE, hair: '#000000',
    accent: '#7CFF6A', belt: '#111316', sash: null, backpack: false, holster: true, metal: false,
    glow: { color: '#7CFF6A', x: 8.4, y: -1.3 },
  },
  // Black Cat: one-piece matte stealth suit, smooth cowl with a visor slit
  cat: {
    id: 'cat',
    suit: tone('#16181B', '#2C3035', '#0B0C0E'), legs: tone('#16181B', '#2C3035', '#0B0C0E'),
    vest: null, vestLight: '#2C3035',
    gloves: tone('#0F1012', '#24272B', '#08090A'), boots: tone('#0E0F11', '#25282C', '#060607'), sole: '#040405',
    head: 'visor', headGear: tone('#17191C', '#30343A', '#0B0C0E'), skin: SKIN_OPERATIVE, hair: '#000000',
    accent: '#3FE0D0', belt: null, sash: null, backpack: false, holster: false, metal: false,
    glow: { color: '#3FE0D0', x: 3.8, y: -1.0 },
  },
  // Hacker: dark hoodie, cargo trousers, backpack rig with a cable to the wrist deck
  bunny: {
    id: 'bunny',
    suit: tone('#2C3035', '#444A52', '#1A1C20'), legs: tone('#1F2226', '#353A40', '#131518'),
    vest: null, vestLight: '#3A3F45',
    gloves: tone('#1A1C1F', '#30343A', '#0E0F11'), boots: tone('#1A1C1F', '#33373D', '#0D0E10'), sole: '#3A3C3F',
    head: 'hood', headGear: tone('#2A2E33', '#424850', '#17191C'), skin: SKIN_OPERATIVE, hair: '#000000',
    accent: '#3FE0D0', belt: null, sash: null, backpack: true, holster: false, metal: false,
    glow: { color: '#3FE0D0', x: 4.6, y: -0.6 },
  },
  // R-7: combat android, gunmetal plates, red sensor line
  robot: {
    id: 'robot',
    suit: tone('#3A3F46', '#646C76', '#22262B'), legs: tone('#353A40', '#5C646E', '#1F2227'),
    vest: null, vestLight: '#5C646E',
    gloves: tone('#2A2E33', '#4D545C', '#17191C'), boots: tone('#25292E', '#474E56', '#141619'), sole: '#0C0D0F',
    head: 'android', headGear: tone('#3E434A', '#6C747E', '#24282D'), skin: tone('#3E434A', '#6C747E', '#24282D'),
    hair: '#000000', accent: '#FF2A3A', belt: null, sash: null, backpack: false, holster: false, metal: true,
    glow: { color: '#FF2A3A', x: 3.8, y: -1.0 },
  },
  // Shadow: navy-black wraps, face mask with an eye slit, cloth sash
  ninja: {
    id: 'ninja',
    suit: tone('#161B26', '#2B3446', '#0C0F16'), legs: tone('#141924', '#283142', '#0A0D13'),
    vest: null, vestLight: '#2B3446',
    gloves: tone('#0F131B', '#232B3A', '#080A0E'), boots: tone('#0E1219', '#222A38', '#07090D'), sole: '#040507',
    head: 'wrap', headGear: tone('#151A24', '#2A3344', '#0B0E14'), skin: SKIN_OPERATIVE, hair: '#000000',
    accent: '#FFB020', belt: null, sash: '#0E1119', backpack: false, holster: true, metal: false,
    glow: { color: '#FFB020', x: -0.6, y: 0.8 },
  },
  // Special forces: ranger-green fatigues, plate carrier, ballistic helmet, eye pro
  astro: {
    id: 'astro',
    suit: tone('#3A4130', '#545E45', '#24291D'), legs: tone('#363C2C', '#4F5841', '#22261B'),
    vest: tone('#30362A', '#4A5340', '#1E221A'), vestLight: '#5A6450',
    gloves: tone('#26291F', '#3E4334', '#171912'), boots: tone('#2A2620', '#453F35', '#191612'), sole: '#0E0D0B',
    head: 'helmet', headGear: tone('#3E4533', '#5C664B', '#262B1F'), skin: SKIN_OPERATIVE, hair: '#000000',
    accent: '#FFB020', belt: '#1C1F17', sash: null, backpack: false, holster: true, metal: false,
    glow: { color: '#7CFF6A', x: -4.8, y: -6.4 },
  },
  // the rescued scientist: faded orange prison jumpsuit, grey hair, bare hands, worn shoes
  prisoner: {
    id: 'prisoner',
    suit: tone('#A85A2E', '#C7763F', '#713A1C'), legs: tone('#A3572C', '#C2713C', '#6C371A'),
    vest: null, vestLight: '#C7763F',
    gloves: tone('#B88A6E', '#D2A487', '#8A6450'), boots: tone('#2E2B28', '#4A4642', '#1C1A18'), sole: '#BDB6AA',
    head: 'bare', headGear: tone('#8F8B85', '#B2ADA6', '#5F5C58'), skin: tone('#B88A6E', '#D2A487', '#8A6450'),
    hair: '#8F8B85', accent: '#FFB020', belt: null, sash: null, backpack: false, holster: false, metal: false,
    glow: null,
  },
};

export function lookFor(id: LookId): AgentLook {
  return LOOKS[id] ?? LOOKS.kid;
}
