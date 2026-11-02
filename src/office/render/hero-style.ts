// Office v2.2 four heroes (spec 2026-11-02-office-four-heroes-design.md §1–3): which frame set a skin draws,
// its FX accent colour (jump ring, collect burst, lane streaks) and the take-off ring size from its jump stat.
// Read from src/office/core/characters.ts (CHARACTERS accent, statsFor jump speed), cached once per hero.
import { LANE_SWITCH_TIME } from '../../types';
import { DEFAULT_PHYSICS } from '../../core/physics';
import { characterFor, statsFor } from '../core/characters';

export type HeroSkin = 'kid' | 'cat' | 'bunny' | 'robot';
export const HERO_SKINS: readonly HeroSkin[] = ['kid', 'cat', 'bunny', 'robot'];

interface HeroLook {
  readonly accent: string;
  /** jump take-off speed multiplier (spec §2: ×1.00–×1.12) */
  readonly jump: number;
  /** lane-switch animation seconds (agility) */
  readonly lane: number;
}

const LOOKS = Object.fromEntries(
  HERO_SKINS.map((id) => [id, { accent: characterFor(id).accent, jump: statsFor(id).physics.jumpV / DEFAULT_PHYSICS.jumpV, lane: statsFor(id).physics.laneSwitchTime ?? LANE_SWITCH_TIME }]),
) as Readonly<Record<HeroSkin, HeroLook>>;

/** the frame set a skin draws (old / unknown skin ids fall back to the default hero) */
export function heroSkin(id: string): HeroSkin {
  return id === 'cat' || id === 'bunny' || id === 'robot' ? id : 'kid';
}

export function heroAccent(id: string): string {
  return LOOKS[heroSkin(id)].accent;
}

/** the take-off rings grow with the jump stat (the jumper's rings read bigger) */
export function jumpRingScale(id: string): number {
  return LOOKS[heroSkin(id)].jump;
}

/** the lane-switch animation time for this hero (정시원 is quicker); drawn lane, lean and streaks follow it */
export function laneSwitchFor(id: string): number {
  return LOOKS[heroSkin(id)].lane;
}

/** the switch time for this frame: the hero's while a stage runs, the default on menus / previews (no stale value) */
export function frameLaneSwitch(id: string, running: boolean): number {
  return running ? laneSwitchFor(id) : LANE_SWITCH_TIME;
}

/**
 * Drawn size per hero (feet-anchored, every frame set and the picker preview): 고도약 is the tall hire, but
 * his 512×640 frames can only hold ~1.02× 칼퇴준's pixel height, so he is drawn ×1.12. (Render-only; his
 * hit box is the same as everyone's.) Move to CHARACTERS when core grows a drawScale field.
 */
const DRAW_SCALE: Readonly<Record<HeroSkin, number>> = { kid: 1, cat: 1, bunny: 1.12, robot: 1 };
export const MAX_DRAW_SCALE = Math.max(...HERO_SKINS.map((s) => DRAW_SCALE[s]));

export function heroDrawScale(id: string): number {
  return DRAW_SCALE[heroSkin(id)];
}
