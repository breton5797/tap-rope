// Character card seams (office v2.2): extra details under a character's name in the picker / character room,
// and the hire on the result card. v8 operators have neither; the office build swaps in
// src/office/ui/hero-card.ts (build/office-swaps.ts).
import type { SkinId } from '../types';

/** role, blurb, star bars and catchphrase under the name (v8: none) */
export function heroDetails(_id: SkinId): HTMLElement | null {
  return null;
}

/** the character on the result card (v8: none) */
export function resultHero(_skin: SkinId | undefined): HTMLElement | null {
  return null;
}
