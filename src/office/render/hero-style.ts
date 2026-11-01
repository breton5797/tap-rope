// Office v2.2 four heroes (spec 2026-11-02-office-four-heroes-design.md §1–3): which frame set a skin draws,
// its FX accent colour (jump ring, collect burst, lane streaks) and the take-off ring size from its jump stat.
// Read from src/office/core/characters.ts (CHARACTERS accent, statsFor jump speed), cached once per hero.
import { DEFAULT_PHYSICS } from '../../core/physics';
import { characterFor, statsFor } from '../core/characters';

export type HeroSkin = 'kid' | 'cat' | 'bunny' | 'robot';
export const HERO_SKINS: readonly HeroSkin[] = ['kid', 'cat', 'bunny', 'robot'];

interface HeroLook {
  readonly accent: string;
  /** jump take-off speed multiplier (spec §2: ×1.00–×1.12) */
  readonly jump: number;
}

const LOOKS = Object.fromEntries(
  HERO_SKINS.map((id) => [id, { accent: characterFor(id).accent, jump: statsFor(id).physics.jumpV / DEFAULT_PHYSICS.jumpV }]),
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
