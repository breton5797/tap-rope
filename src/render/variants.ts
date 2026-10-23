// Look variants layered on any theme: sky swap + one-time colour grade of the pre-rendered
// scene + baked extras + animated layers under / over the stage. Designed for the chapter
// pairs (playground night/autumn/rainbow, beach night, neon rain, moon eclipse) but every
// theme × variant combination renders.
import type { Variant, WorldId } from '../types';
import type { TileSpec, WorldArt } from './scenery';
import type { SpriteCache } from './sprites';
import type { Ctx, Stops } from './util';
import { bonfire, fireflies, leaves, lightning, rain, ripples, sparkles } from './variant-fx';
import { bonfireBase, fairyLights, fallenLeaves, lamps, lightPool, neonSmears } from './variant-props';
import { drawEclipse, drawMoon, drawRainbowArch, drawWarmSun, STARS, stormClouds } from './variant-sky';
import type { View } from './view';

export interface VariantLook {
  /** replaces the theme sky when set */
  readonly sky: Stops | null;
  /** translucent tint painted over the pre-rendered scene (source-atop) */
  readonly grade: string | null;
  /** keep the theme's own sun / Earth backdrop */
  keepBackdrop(world: WorldId): boolean;
  /** keep the theme's drifting sky tiles (clouds) */
  keepTiles(world: WorldId): boolean;
  readonly tiles: readonly TileSpec[];
  /** static extras baked into the scene after grading */
  scene(ctx: Ctx, v: View, world: WorldId, art: WorldArt): void;
  backdrop(ctx: Ctx, t: number, sprites: SpriteCache, world: WorldId): void;
  /** animated, under the stage */
  ground(ctx: Ctx, v: View, t: number, world: WorldId, reduced: boolean): void;
  /** animated, over the stage */
  overlay(ctx: Ctx, v: View, t: number, world: WorldId, reduced: boolean): void;
}

const none = (): void => undefined;
const yes = (): boolean => true;
const moonOnly = (w: WorldId): boolean => w === 3;

const BASE: VariantLook = {
  sky: null, grade: null, keepBackdrop: yes, keepTiles: yes, tiles: [],
  scene: none, backdrop: none, ground: none, overlay: none,
};

const NIGHT: VariantLook = {
  sky: [[0, '#030616'], [0.55, '#0B1540'], [1, '#26326E']],
  grade: 'rgba(30,30,115,0.48)',
  keepBackdrop: moonOnly,
  keepTiles: moonOnly,
  tiles: [STARS],
  scene(ctx, _v, world, art) {
    if (world !== 2) lamps(ctx);
    fairyLights(ctx, art.anchors);
    if (world === 1) bonfireBase(ctx);
    lightPool(ctx, 0, 10, 200, 130, 'rgba(255,225,170,0.22)');
  },
  backdrop(ctx, t, sprites, world) {
    if (world !== 3) drawMoon(ctx, world, t, sprites);
  },
  ground(ctx, v, t, world, reduced) {
    if (world === 1) bonfire(ctx, t, reduced);
    if (world === 0) fireflies(ctx, v, t, reduced ? 6 : 14);
  },
  overlay: none,
};

const AUTUMN: VariantLook = {
  sky: [[0, '#5E9BD6'], [0.55, '#F2C58C'], [1, '#FFE0B0']],
  grade: 'rgba(255,140,50,0.10)',
  keepBackdrop: moonOnly,
  keepTiles: yes,
  tiles: [],
  scene(ctx) {
    fallenLeaves(ctx);
  },
  backdrop(ctx, t, sprites, world) {
    if (world !== 3) drawWarmSun(ctx, t, sprites);
  },
  ground: none,
  overlay(ctx, v, t, _world, reduced) {
    leaves(ctx, v, t, reduced ? 8 : 22);
  },
};

const RAIN: VariantLook = {
  sky: [[0, '#07070F'], [0.6, '#15172C'], [1, '#2A2A48']],
  grade: 'rgba(10,10,38,0.42)',
  keepBackdrop: () => false,
  keepTiles: () => false,
  tiles: [],
  scene(ctx, v) {
    stormClouds(ctx, v);
    neonSmears(ctx);
    lightPool(ctx, 0, 10, 190, 120, 'rgba(180,200,255,0.14)');
  },
  backdrop: none,
  ground(ctx, _v, t, _world, reduced) {
    ripples(ctx, t, reduced ? 8 : 18);
  },
  overlay(ctx, v, t, _world, reduced) {
    rain(ctx, v, t, reduced ? 30 : 80);
    if (!reduced) lightning(ctx, v, t);
  },
};

let eclipseRim: CanvasGradient | null = null;

const ECLIPSE: VariantLook = {
  sky: [[0, '#06010C'], [0.55, '#200A30'], [1, '#5A1640']],
  grade: 'rgba(100,10,60,0.38)',
  keepBackdrop: () => false,
  keepTiles: moonOnly,
  tiles: [STARS],
  scene(ctx) {
    lightPool(ctx, 0, 10, 200, 130, 'rgba(255,130,180,0.2)');
  },
  backdrop(ctx, t, sprites, world) {
    drawEclipse(ctx, world, t, sprites);
  },
  ground: none,
  overlay(ctx, v) {
    if (!eclipseRim) {
      eclipseRim = ctx.createLinearGradient(0, -100, 0, 320);
      eclipseRim.addColorStop(0, 'rgba(255,90,150,0.22)');
      eclipseRim.addColorStop(1, 'rgba(255,90,150,0)');
    }
    ctx.fillStyle = eclipseRim;
    ctx.fillRect(v.x0, v.y0, v.w, 320 - v.y0);
  },
};

const RAINBOW: VariantLook = {
  sky: [[0, '#9FD8FF'], [0.45, '#D9C8FF'], [0.8, '#FFD3E8'], [1, '#FFF2C8']],
  grade: 'rgba(255,215,245,0.12)',
  keepBackdrop: () => false,
  keepTiles: yes,
  tiles: [],
  scene: none,
  backdrop(ctx, _t, sprites) {
    drawRainbowArch(ctx, sprites);
  },
  ground: none,
  overlay(ctx, v, t, _world, reduced) {
    sparkles(ctx, v, t, reduced ? 10 : 28);
  },
};

const LOOKS: Readonly<Record<Variant, VariantLook>> = {
  base: BASE, night: NIGHT, autumn: AUTUMN, rain: RAIN, eclipse: ECLIPSE, rainbow: RAINBOW,
};

export function lookOf(variant: Variant): VariantLook {
  return LOOKS[variant] ?? BASE;
}
