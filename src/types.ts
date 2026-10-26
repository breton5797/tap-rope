// Shared contracts for LASER ESCAPE v5 (2.5D three-lane corridor, GDD-v5). Owned by the lead — teammates must not edit.
// The camera looks down ~20° at a corridor with three depth lanes (0 = far / upper on screen, 1 = middle,
// 2 = near / lower). The agent runs to the right at a fixed screen x (PLAYER_X); the corridor scrolls left.
// Full-width lasers (floor/beam/high/ceiling/drone) span all three lanes and are jumped or slid; lane hazards
// (guard/drop/chaser) block 1–2 lanes and are dodged by changing lanes. Everything reaches the agent exactly
// at a beat's `time`. "height" = px above the floor. Time is seconds of stage time.

export const LOGICAL_W = 360;
export const LOGICAL_H = 640;
export const GROUND_Y = 470; // screen y of the MIDDLE lane's floor line (render/layout owns the 2.5D projection)
export const PLAYER_X = 108; // screen x of the agent's centre (left third: room to see what's ahead)
export const SCROLL_SPEED = 240; // world px/s the corridor (and floor/ceiling emitters) scroll left
export const LANE_LEAD = 2.4; // seconds of preview shown in the rhythm lane
export const VISIBLE_LEAD = 2.0; // seconds before its beat an obstacle becomes visible (warnings start)
/** sudden attacks (drop, chaser, rear beams) show a "!" on their target lane(s) this long before arrival */
export const WARN_LEAD = 1.0;
/** seconds the lane-change animation takes (judging uses the target lane immediately) */
export const LANE_SWITCH_TIME = 0.12;
export const LANE_COUNT = 3;

/** 0 = far (upper on screen), 1 = middle (start lane), 2 = near (lower on screen) */
export type LaneId = 0 | 1 | 2;
export const LANES: readonly LaneId[] = [0, 1, 2];
/** −1 = toward the far lane (swipe up / ↑), +1 = toward the near lane (swipe down / ↓) */
export type LaneDir = -1 | 1;

/** Corridor THEME: 0 security outpost, 1 research lab, 2 prison block, 3 industrial / sewer. */
export type WorldId = 0 | 1 | 2 | 3;
/** Look variant layered on a theme. alarm = red sirens; dark = lights low; steam = vents/fog;
 * night = outdoor night through windows; dawn = sunrise finale. */
export type Variant = 'base' | 'alarm' | 'dark' | 'steam' | 'night' | 'dawn';
/** bonus = easy coin-rich breather (every 5th), boss = long mixed finale (every 10th). */
export type StageKind = 'normal' | 'bonus' | 'boss';
export type Level = 1 | 2 | 3;
export type JumpLevel = 0 | 1 | 2 | 3; // 0 = grounded
/** right half: a swipe modifies the touch that started it, only 'down' (= slide) acts.
 * left half: 'up' / 'down' change lanes (see InputHandlers.onLane). */
export type Swipe = 'up' | 'down' | 'left' | 'right';
/** where a laser comes from: floor emitter, ceiling emitter, flying in from ahead or from behind */
export type LaserFrom = 'bottom' | 'top' | 'front' | 'back';

export type SkinId = 'kid' | 'cat' | 'bunny' | 'robot' | 'ninja' | 'astro';

/**
 * floor   — (from bottom) a floor emitter fires a vertical beam to knee height. Jump: airborne,
 *           height >= CLEAR_H, level >= 1.
 * beam    — (from front/back) 1–3 stacked horizontal beams (knee / waist / chest). Jump with
 *           level >= level.
 * high    — (from front/back) a single head-height beam. Slide: player.sliding at hit time.
 * ceiling — (from top) a ceiling emitter fires down to just above crouch height. Slide.
 * drone   — security drone scanning chest height. FAILS if airborne with level >= 2
 *           (a 1단 hop or staying on the ground is fine; sliding is fine).
 * coin / shield / slow / heart — pickups floating at a height; collected when airborne with
 *           level >= level (level-1 pickups float low). Missing them is harmless.
 * A "laser gate" is a beat with floor + drone (exactly a 1단 jump).
 *
 * v5 LANE HAZARDS — occupy `lanes` (1–2 lanes, never all 3). The agent must be in another lane at the
 * beat time; jumping or sliding does not help. Fails with reason 'lane'.
 * guard   — (from front) security robot patrolling 1–2 lanes, scrolls in with the floor.
 * drop    — (from top) a crate / claw dropping onto 1–2 lanes. SUDDEN: "!" + landing shadow from WARN_LEAD.
 * chaser  — (from back) a pursuit drone dashing along 1 lane from behind. SUDDEN.
 * Rear beams/high (from 'back') are also SUDDEN (they keep the full-width rule).
 * Pickups in v5 float in ONE lane (`lanes` = [lane]); collected only in that lane.
 */
export type ObstacleKind =
  | 'floor' | 'beam' | 'high' | 'ceiling' | 'drone' | 'guard' | 'drop' | 'chaser'
  | 'coin' | 'shield' | 'slow' | 'heart';
export const HAZARD_KINDS: readonly ObstacleKind[] = ['floor', 'beam', 'high', 'ceiling', 'drone', 'guard', 'drop', 'chaser'];
export const LANE_HAZARD_KINDS: readonly ObstacleKind[] = ['guard', 'drop', 'chaser'];

export interface Obstacle {
  readonly kind: ObstacleKind;
  readonly level: Level; // beam: number of stacked beams; pickups: float height tier; others 1
  /** beam/high only: flies in from ahead ('front') or chases from behind ('back'); others implied */
  readonly from?: LaserFrom;
  /** lane hazards: the 1–2 lanes they block; pickups: their single lane; full-width lasers: absent */
  readonly lanes?: readonly LaneId[];
}

/** One moment on the timeline. Every obstacle in a beat reaches the agent at `time`. */
export interface Beat {
  readonly id: number;
  readonly time: number;
  readonly obstacles: readonly Obstacle[];
  /** max jump level needed by floor/beam obstacles, 0 if none */
  readonly requiredLevel: JumpLevel;
  /** a high/ceiling laser needs a slide at this beat */
  readonly needsSlide: boolean;
  /** true inside a rapid "pulse laser" section (floor lasers on every half beat) */
  readonly pulse: boolean;
  /** v5: union of the lanes blocked by lane hazards at this beat ([] if none; never all 3) */
  readonly blockedLanes: readonly LaneId[];
  /** v5: 0-based section of the stage this beat belongs to (doors separate sections) */
  readonly section: number;
}

/** How the scene changes after a section door. */
export type TransitionKind = 'turn' | 'stairs' | 'elevator';

/** One look of the corridor (a designed theme × variant pair). */
export interface Scene {
  readonly world: WorldId;
  readonly variant: Variant;
}

/** A security door between two sections. The agent passes the doorway at `time`; the scene switches then. */
export interface Door {
  readonly time: number;
  readonly section: number; // the section that starts behind this door (1..sections-1)
  readonly transition: TransitionKind;
  readonly from: Scene;
  readonly to: Scene;
}

export interface PlayerState {
  readonly height: number; // >= 0, px above the floor
  readonly vy: number; // px/s, positive = up
  readonly grounded: boolean;
  readonly level: JumpLevel; // 0 grounded, else 1..3 = taps used in this jump
  readonly airTime: number; // seconds since takeoff (0 when grounded)
  readonly landTimer: number; // seconds since last landing (for squash anim)
  readonly buffer: number; // seconds left on a buffered (pre-landing) jump tap, 0 = none
  readonly sliding: boolean;
  readonly slideTime: number; // seconds of slide remaining (0 when not sliding)
  readonly slideAge: number; // seconds since the slide started (for perfect timing + animation)
  /** fast-falling after an airborne ↓; the slide starts on landing */
  readonly pendingSlide: boolean;
  /** what the most recent tap did; ↓ right after a ground 'jump' converts it into a slide */
  readonly lastTap: 'jump' | 'boost' | 'none';
  /** v5: current (target) lane — judging uses this immediately */
  readonly lane: LaneId;
  /** v5: lane the agent is moving away from (== lane when settled), for the switch animation */
  readonly laneFrom: LaneId;
  /** v5: seconds since the last lane change started (animation progress = laneAge / LANE_SWITCH_TIME) */
  readonly laneAge: number;
}

export interface PhysicsConfig {
  readonly gravity: number; // px/s^2
  readonly jumpV: number; // takeoff velocity from ground
  readonly boostV: number; // velocity SET on each air tap (level up)
  readonly fallV: number; // downward velocity SET by an airborne ↓ (fast fall into a slide)
  readonly slideTime: number; // seconds a slide lasts
}

export type Grade = 'perfect' | 'good' | 'miss' | 'none'; // none = pickup-only beat

export interface JudgeResult {
  readonly beatId: number;
  readonly grade: Grade;
  readonly hit: boolean; // a hazard hit the agent
  readonly reason: 'low' | 'level' | 'drone' | 'slide' | 'standing' | 'lane' | null;
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

/** Player-facing moves, used for tutorials, lane icons and stage badges. */
export type MoveId =
  | 'jump' | 'beam' | 'double' | 'slide' | 'drone' | 'triple' | 'high' | 'rear' | 'gate' | 'pulse'
  // v5 lane moves: lane = dodge a guard, drop = dodge a falling crate, chaser = dodge a rear dash,
  // lanejump = a lane hazard plus a full-width laser in the same beat (change lane AND jump/slide)
  | 'lane' | 'drop' | 'chaser' | 'lanejump';

export interface StageDef {
  readonly id: string; // "w{chapter+1}-s{index+1}", e.g. "w7-s3"
  readonly world: WorldId; // theme (renderer, music)
  readonly chapter: number; // 0..9 (the player-facing "zone" number − 1); endless/daily use 0
  readonly variant: Variant;
  readonly kind: StageKind;
  readonly index: number; // 0..9 inside the chapter
  readonly name: string; // Korean display name
  /** moves this stage uses — drives tutorial cards and the stage-select badges */
  readonly moves: readonly MoveId[];
  readonly bpm: number;
  readonly hazardBeats: number; // number of hazard beats to clear
  readonly seed: number;
  readonly levelWeights: readonly [number, number, number]; // weights for 1/2/3-level jumps
  readonly mix: {
    readonly beam: number; // 0..1 chance a jump beat uses flying beams instead of a floor laser
    readonly slide: number; // 0..1 chance a hazard beat is a slide beat (ceiling or high beam)
    readonly high: number; // 0..1 share of slide beats that are head-height beams (vs ceiling)
    readonly rear: number; // 0..1 chance a beam/high flies in from behind
    readonly drone: number; // 0..1 chance of a drone (alone, or as a gate with a floor laser)
    readonly gate: number; // 0..1 chance a drone beat is a gate (floor + drone)
    readonly pulse: number; // 0..1 chance of a pulse-laser section
    readonly lane: number; // v5: 0..1 chance a hazard beat is a lane-hazard beat
    readonly drop: number; // v5: 0..1 share of lane beats that are drops
    readonly chaser: number; // v5: 0..1 share of lane beats that are chasers (rest = guards)
    readonly laneCombo: number; // v5: 0..1 chance a lane beat also carries a full-width laser
  };
  /** v5: number of sections (1–3) separated by doors; normal 2, boss 3, bonus 1 */
  readonly sections: number;
  readonly pickupRate: number; // 0..1 chance of a pickup beat between hazards
}

/** One of the 10 player-facing zones ("구역") of 10 stages each. Part 1 = rescue, part 2 = escape. */
export interface ChapterMeta {
  readonly id: number; // 0..9
  readonly part: 1 | 2;
  readonly name: string; // e.g. "감옥 블록"
  readonly subtitle: string;
  /** mission briefing shown when entering the zone (1–2 short Korean sentences) */
  readonly briefing: string;
  readonly theme: WorldId;
  readonly variant: Variant;
}

export interface WorldMeta {
  readonly id: WorldId;
  readonly name: string;
  readonly subtitle: string;
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
  /** chapters whose briefing card has been shown */
  readonly briefed: readonly number[];
  /** v5: the two-thumb controls card was shown (old saves load as false) */
  readonly controlsSeen: boolean;
}

// ---------- Rendering contract ----------

export interface VisibleObstacle {
  readonly id: string; // stable across frames: `${beatId}-${index}`
  readonly kind: ObstacleKind;
  readonly level: Level;
  readonly from: LaserFrom | null; // null for pickups
  /** seconds until it reaches the agent (≤ VISIBLE_LEAD; negative = already passed, kept ~0.4s) */
  readonly timeUntil: number;
  readonly height: number; // px above the floor of its bottom (pickups/drones float)
  /** v5: lanes it occupies (lane hazards, pickups); null = full width */
  readonly lanes: readonly LaneId[] | null;
  /** v5: a sudden attack (drop, chaser, rear beam/high): draw "!" on its lanes once timeUntil ≤ WARN_LEAD */
  readonly sudden: boolean;
}

/** v5: a door in view (from 3.0s before the agent reaches it until 1.0s after). */
export interface DoorView {
  readonly timeUntil: number;
  readonly section: number;
  readonly transition: TransitionKind;
  readonly from: Scene;
  readonly to: Scene;
}

export interface LaneItem {
  readonly beatId: number;
  readonly timeUntil: number; // seconds until it reaches the hit line (−0.25..LANE_LEAD)
  readonly kinds: readonly ObstacleKind[];
  readonly level: JumpLevel; // requiredLevel of the beat
  readonly move: MoveId; // the move to use (badge on the lane icon)
  readonly from: LaserFrom | null; // main hazard's direction (arrow on the icon), null for pickups
  /** v5: lanes blocked at this beat (mini 3-lane marker on the icon) */
  readonly blocked: readonly LaneId[];
}

export type Mood = 'idle' | 'happy' | 'hurt' | 'cheer' | 'worried';

export interface RenderSnapshot {
  readonly time: number; // stage time
  readonly realTime: number; // wall-clock seconds, for idle animation
  readonly world: WorldId;
  readonly variant: Variant;
  readonly player: PlayerState;
  readonly skin: SkinId;
  readonly obstacles: readonly VisibleObstacle[];
  readonly lane: readonly LaneItem[];
  /** the rescued prisoner runs behind the agent (part 2 of the campaign) */
  readonly escort: boolean;
  readonly fever: boolean;
  readonly feverGauge: number;
  readonly invulnerable: boolean; // blink the agent
  readonly shield: boolean;
  readonly slowMo: boolean;
  readonly mood: Mood;
  readonly reducedMotion: boolean;
  /** corridor scroll in world px (= time · SCROLL_SPEED while running); drives parallax */
  readonly scroll: number;
  readonly running: boolean; // false on menus: agent idles in place, corridor stops
  /** v5: doors near the agent (see DoorView); world/variant above already switch at the door time */
  readonly doors: readonly DoorView[];
}

export type BurstKind = 'dust' | 'sparkle' | 'hit' | 'coin' | 'confetti' | 'powerup';
export type PopupStyle = 'perfect' | 'good' | 'miss' | 'combo' | 'info';

export interface EffectsApi {
  burst(kind: BurstKind, x?: number, y?: number): void; // defaults: agent body
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
  readonly progress: number; // 0..1, endless shows 0
  readonly feverGauge: number;
  readonly fever: boolean;
  readonly shield: boolean;
  readonly slowMo: boolean;
  readonly title: string; // "7-3 · 이름" / "엔드리스" / "오늘의 도전"
  readonly coins: number; // coins earned this run
  readonly sliding: boolean; // highlight the slide hint while sliding
  readonly section: number; // v5: current section (0-based)
  readonly sections: number; // v5: section count (endless: 1, pips hidden)
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
  /** move tutorial card (gesture illustration + one-line Korean hint); null = hide */
  showTutorial(move: MoveId | null): void;
  /** v5: two-thumb controls card (left = lanes, right = jump/slide); onDone when dismissed */
  showControls(onDone: () => void): void;
  /** mission briefing card for a chapter (non-blocking, over the countdown); null = hide */
  showBriefing(chapter: number | null): void;
  showCountdown(n: number | null): void; // 3,2,1, 0 = "GO!", null = hide
  hideAll(): void;
  toast(msg: string): void;
}

// ---------- Audio contract ----------

export type SfxName =
  | 'jump' | 'boost' | 'land' | 'perfect' | 'good' | 'hit' | 'coin'
  | 'powerup' | 'combo' | 'fever' | 'clear' | 'fail' | 'click' | 'count'
  | 'slide' | 'warn' | 'zap' | 'rescue'
  // v5: lane change whoosh, "!" sudden-attack alert, security door opening
  | 'lane' | 'alert' | 'door';

export interface AudioApi {
  unlock(): void; // call inside a user gesture
  setEnabled(sound: boolean, music: boolean): void;
  /** start the procedural loop; beat 0 of the loop aligns with stage time `fromTime` modulo 60/bpm */
  startMusic(bpm: number, world: WorldId, fromTime: number): void;
  stopMusic(): void;
  setFever(on: boolean): void;
  sfx(name: SfxName, level?: number): void;
}
