// Shared contracts for TAP ROPE. Owned by the lead — teammates must not edit.
// Coordinates: logical portrait canvas LOGICAL_W x LOGICAL_H. "height" values are
// pixels ABOVE the ground line (positive = up). Time is seconds of stage time.

export const LOGICAL_W = 360;
export const LOGICAL_H = 640;
export const GROUND_Y = 470; // screen y of the ground line
export const PLAYER_X = 180; // screen x of the player's center
export const SCROLL_SPEED = 240; // px/s that hurdles/birds/pickups travel leftwards
export const LANE_LEAD = 2.4; // seconds of preview shown in the rhythm lane

export type WorldId = 0 | 1 | 2 | 3;
export type Level = 1 | 2 | 3;
export type JumpLevel = 0 | 1 | 2 | 3; // 0 = grounded

export type SkinId = 'kid' | 'cat' | 'bunny' | 'robot' | 'ninja' | 'astro';

/**
 * rope   — the long rope turned by two turners; needs jumpLevel >= level (1단/2단/3단).
 * hurdle — stacked blocks sliding in from the right; needs jumpLevel >= level.
 * bird   — ceiling hazard flying at head height; FAILS if airborne with jumpLevel >= 2.
 * coin / shield / slow / heart — pickups floating at a height; collected when
 *          airborne with jumpLevel >= level at hit time. Missing them is harmless.
 */
export type ObstacleKind = 'rope' | 'hurdle' | 'bird' | 'coin' | 'shield' | 'slow' | 'heart';
export const HAZARD_KINDS: readonly ObstacleKind[] = ['rope', 'hurdle', 'bird'];

export interface Obstacle {
  readonly kind: ObstacleKind;
  readonly level: Level;
}

/** One moment on the timeline. Every obstacle in a beat reaches the player at `time`. */
export interface Beat {
  readonly id: number;
  readonly time: number;
  readonly obstacles: readonly Obstacle[];
  /** max level of rope/hurdle obstacles, 0 if none */
  readonly requiredLevel: JumpLevel;
  /** true while a Double-Dutch section is active (two ropes alternate visually) */
  readonly doubleDutch: boolean;
}

export interface PlayerState {
  readonly height: number; // >= 0, px above ground
  readonly vy: number; // px/s, positive = up
  readonly grounded: boolean;
  readonly level: JumpLevel; // 0 grounded, else 1..3 = taps used in this jump
  readonly airTime: number; // seconds since takeoff (0 when grounded)
  readonly landTimer: number; // seconds since last landing (for squash anim)
  readonly buffer: number; // seconds left on a buffered (pre-landing) jump tap, 0 = none
}

export interface PhysicsConfig {
  readonly gravity: number; // px/s^2
  readonly jumpV: number; // takeoff velocity from ground
  readonly boostV: number; // velocity SET on each air tap (level up)
}

export type Grade = 'perfect' | 'good' | 'miss' | 'none'; // none = pickup-only beat

export interface JudgeResult {
  readonly beatId: number;
  readonly grade: Grade;
  readonly hit: boolean; // a hazard hit the player
  readonly reason: 'low' | 'level' | 'bird' | null;
  readonly collected: readonly ObstacleKind[]; // pickups collected
}

export interface ScoreState {
  readonly score: number;
  readonly combo: number;
  readonly maxCombo: number;
  readonly perfects: number;
  readonly goods: number;
  readonly misses: number;
  readonly feverGauge: number; // 0..1
  readonly feverTime: number; // seconds of fever remaining, 0 = off
  readonly coins: number; // coins earned this run
}

export interface StageDef {
  readonly id: string; // e.g. "w1-s3"
  readonly world: WorldId;
  readonly index: number; // 0..4 inside the world
  readonly name: string; // Korean display name
  readonly bpm: number;
  readonly hazardBeats: number; // number of hazard beats to clear
  readonly seed: number;
  readonly levelWeights: readonly [number, number, number]; // weights for 1단/2단/3단
  readonly mix: {
    readonly hurdle: number; // 0..1 chance a hazard beat uses a hurdle instead of the rope
    readonly bird: number; // 0..1 chance of a bird (alone or combined with a 1단)
    readonly combo: number; // 0..1 chance a beat combines rope + hurdle
    readonly doubleDutch: number; // 0..1 chance of a Double-Dutch section
  };
  readonly pickupRate: number; // 0..1 chance of a pickup beat between hazards
}

export interface WorldMeta {
  readonly id: WorldId;
  readonly name: string;
  readonly subtitle: string;
  readonly gravityScale: number; // world 3 (moon) is low gravity
}

export interface SkinMeta {
  readonly id: SkinId;
  readonly name: string;
  readonly price: number; // coins, 0 = free
}

export interface Settings {
  readonly sound: boolean;
  readonly music: boolean;
  readonly vibration: boolean;
  readonly reducedMotion: boolean;
}

export interface SaveData {
  readonly version: 1;
  readonly stars: Readonly<Record<string, number>>; // stageId -> 0..3
  readonly bestScores: Readonly<Record<string, number>>; // stageId | 'endless' | 'daily:YYYY-MM-DD'
  readonly coins: number;
  readonly ownedSkins: readonly SkinId[];
  readonly skin: SkinId;
  readonly settings: Settings;
  readonly tutorialDone: boolean;
}

// ---------- Rendering contract ----------

export interface VisibleObstacle {
  readonly id: string; // stable across frames: `${beatId}-${index}`
  readonly kind: Exclude<ObstacleKind, 'rope'>;
  readonly level: Level;
  readonly x: number; // screen x of the obstacle center
  readonly height: number; // px above ground of its bottom (pickups/birds float)
}

export interface LaneItem {
  readonly beatId: number;
  readonly timeUntil: number; // seconds until it reaches the hit line (0..LANE_LEAD)
  readonly kinds: readonly ObstacleKind[];
  readonly level: JumpLevel; // requiredLevel of the beat
}

export interface RopeState {
  /** radians; rope midpoint is at the BOTTOM (touching ground at the player) when phase % 2π == 0 */
  readonly phaseA: number;
  /** second rope for Double-Dutch, null when inactive */
  readonly phaseB: number | null;
  readonly speed: number; // rad/s of rope A, for motion blur/whoosh
}

export type Mood = 'idle' | 'happy' | 'hurt' | 'cheer' | 'worried';

export interface RenderSnapshot {
  readonly time: number; // stage time
  readonly realTime: number; // wall-clock seconds, for idle animation
  readonly world: WorldId;
  readonly player: PlayerState;
  readonly skin: SkinId;
  readonly rope: RopeState;
  readonly obstacles: readonly VisibleObstacle[];
  readonly lane: readonly LaneItem[];
  readonly fever: boolean;
  readonly feverGauge: number;
  readonly invulnerable: boolean; // blink the player
  readonly shield: boolean;
  readonly slowMo: boolean;
  readonly mood: Mood;
  readonly reducedMotion: boolean;
  readonly showTurners: boolean; // false on menu backdrop if desired
}

export type BurstKind = 'dust' | 'sparkle' | 'hit' | 'coin' | 'confetti' | 'powerup';
export type PopupStyle = 'perfect' | 'good' | 'miss' | 'combo' | 'info';

export interface EffectsApi {
  burst(kind: BurstKind, x?: number, y?: number): void; // defaults: player feet
  popup(text: string, style: PopupStyle): void;
  shake(intensity: number): void; // 0..1
  flash(color: string): void;
  update(dt: number): void;
}

export interface Renderer {
  resize(cssWidth: number, cssHeight: number, dpr: number): void;
  render(snap: RenderSnapshot): void;
  readonly fx: EffectsApi;
}

// ---------- UI contract ----------

export interface HudState {
  readonly hearts: number;
  readonly maxHearts: number;
  readonly score: number;
  readonly combo: number;
  readonly progress: number; // 0..1, endless shows distance instead
  readonly feverGauge: number;
  readonly fever: boolean;
  readonly shield: boolean;
  readonly slowMo: boolean;
  readonly title: string; // stage name / "엔드리스" / "오늘의 도전"
  readonly coins: number; // coins earned this run
}

export type GameMode = 'stage' | 'endless' | 'daily';

export interface ResultInfo {
  readonly mode: GameMode;
  readonly stageId: string | null;
  readonly title: string;
  readonly cleared: boolean;
  readonly stars: number; // 0..3
  readonly score: number;
  readonly best: number;
  readonly newRecord: boolean;
  readonly perfects: number;
  readonly goods: number;
  readonly misses: number;
  readonly maxCombo: number;
  readonly coinsEarned: number;
  readonly hasNext: boolean;
}

export interface UiCallbacks {
  onStartStage(stageId: string): void;
  onStartEndless(): void;
  onStartDaily(): void;
  onPause(): void;
  onResume(): void;
  onRetry(): void;
  onQuit(): void; // back to stage select
  onNextStage(): void;
  onBuySkin(id: SkinId): void;
  onSelectSkin(id: SkinId): void;
  onSettingsChange(s: Settings): void;
  onTutorialDone(): void;
  onUiClick(): void; // play click sfx
}

export interface Ui {
  showTitle(save: SaveData): void;
  showStageSelect(save: SaveData): void;
  showShop(save: SaveData): void;
  showSettings(save: SaveData): void;
  showHud(): void;
  updateHud(h: HudState): void;
  showPause(): void;
  showResult(r: ResultInfo): void;
  showTutorial(step: number | null): void; // 0..3 cards, null = hide
  showCountdown(n: number | null): void; // 3,2,1, 0 = "GO!", null = hide
  hideAll(): void;
  toast(msg: string): void;
}

// ---------- Audio contract ----------

export type SfxName =
  | 'jump' | 'boost' | 'land' | 'perfect' | 'good' | 'hit' | 'coin'
  | 'powerup' | 'combo' | 'fever' | 'clear' | 'fail' | 'click' | 'count';

export interface AudioApi {
  unlock(): void; // call inside a user gesture
  setEnabled(sound: boolean, music: boolean): void;
  /** start the procedural loop; beat 0 of the loop aligns with stage time `fromTime` modulo 60/bpm */
  startMusic(bpm: number, world: WorldId, fromTime: number): void;
  stopMusic(): void;
  setFever(on: boolean): void;
  sfx(name: SfxName, level?: number): void;
}
