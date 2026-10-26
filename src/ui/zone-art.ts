// Zone imagery: v6 uses photographic cuts (public/art/zone-{n}.webp, GDD-v6 §2) with a per-theme
// gradient fallback chosen by CSS (`zone--t{theme}-{variant}`), replacing the v4 SVG scenes.
import type { Variant, WorldId } from '../types';
import { artImage } from './title';

export function zoneKey(theme: WorldId, variant: Variant): string {
  return `t${theme}-${variant}`;
}

/** Zone photo for chapter `id` (0..9); the fallback gradient stays visible until/unless it loads. */
export function zoneArt(id: number): HTMLElement {
  return artImage(`./art/zone-${id}.webp`, 'art--zone');
}
