// Office live events: what the equipped cosmetics and this week's theme change in a run. The live hook
// (src/office/game/live-hook.ts) sets it when a run starts or the player equips something; the office renderer
// reads it every frame. v8 never imports this module.

export interface LiveLook {
  /** the equipped trail cosmetic's sprite key (art/cosmetic/<key>.webp), null = none */
  readonly trail: string | null;
  /** the equipped jump-effect cosmetic's sprite key, null = the plain take-off rings */
  readonly jump: string | null;
  /** rainy-commute week on a part-2 stage: a light rain over the background */
  readonly rain: boolean;
  /** speed-clockout week: the office clock reads urgent earlier */
  readonly clock: boolean;
}

export const NO_LOOK: LiveLook = { trail: null, jump: null, rain: false, clock: false };

let current: LiveLook = NO_LOOK;

export function liveLook(): LiveLook {
  return current;
}

export function setLiveLook(look: LiveLook): void {
  current = look;
}
