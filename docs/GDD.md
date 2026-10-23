# TAP ROPE — 탭탭 줄넘기 · Game Design Doc v1

캐주얼 모바일 아케이드. **화면 탭 = 점프, 공중 탭 = 한 단 더(2단/3단)**. 두 명의 친구가 돌리는 긴 줄과
장애물(허들·새)이 1단/2단/3단/복합 패턴으로 다가오고, 리듬에 맞춰 뛰어넘어 스테이지를 클리어한다.

## 1. Core loop
1. 탭 → 1단 점프 (jumpLevel 1). 공중에서 탭 → 속도 재설정(부스트), jumpLevel 2. 한 번 더 → 3단.
2. 각 Beat가 플레이어에 도달하는 순간 판정 (`judgeBeat`).
   - rope/hurdle 레벨 L: `!grounded && height >= CLEAR_H(12) && level >= L` 이면 통과.
   - bird: `!grounded && level >= 2` 이면 실패 (너무 높이 뛰면 새에 부딪힘). 1단 + 새 = "낮게 뛰어라" 복합.
   - 통과 시 `height >= PERFECT_H(40)` → PERFECT, 아니면 GOOD.
   - 픽업(coin/shield/slow/heart): `!grounded && level >= L` 이면 획득.
3. 실패 → 하트 -1 (실드가 있으면 실드 소모), 0.9초 무적, 콤보 리셋. 하트 3개 모두 잃으면 게임오버.
4. 모든 hazard beat 통과 → CLEAR. 별: 3★ = 무피격 & PERFECT ≥ 60%, 2★ = 피격 ≤ 1, 1★ = 클리어.

## 2. Physics targets (`DEFAULT_PHYSICS`)
gravity 3000, jumpV 660, boostV 700. 1단 체공 ≈ 0.44s / 최고 ≈ 73px, 2단 ≈ 0.8s, 3단 ≈ 1.15s
(부스트를 정점 근처에서 했을 때). 월드 4(달)는 gravityScale 0.82.
- **입력 버퍼**: 하강 중 height < 26px 에서의 탭은 부스트가 아니라 착지 즉시 점프로 예약 (0.12s).
- 착지 판정 시 `landTimer` 리셋 → 렌더러가 스쿼시 애니메이션.

## 3. Content
- 4 Worlds × 5 Stages = 20 stages + 엔드리스 + 오늘의 도전(날짜 시드).
  - W1 놀이터 (낮) · W2 노을 해변 · W3 네온 시티 (밤) · W4 달 기지 (저중력)
- Beat 시간은 BPM 그리드(반박 단위)에 양자화 → 절차적 음악과 리듬 동기화.
- 간격 규칙: 레벨 L beat 이후 다음 hazard까지 ≥ airtime(L) + 0.18s.
- 복합 패턴: rope+hurdle 동시, 1단+bird, 1-1-2, 1-2-3 계단, 3-1-1 등 사전 정의 패턴 + 더블더치 구간.

## 4. Ideas reflected (≥5)
1. **리듬 레인 프리뷰** — 하단 레인에 ①②③ 아이콘이 히트라인으로 흘러옴 + BPM 동기 절차적 음악.
2. **공중 연타 다단 점프 + 입력 버퍼** — 한 번의 탭 문법으로 1/2/3단 표현, 착지 직전 탭 예약.
3. **천장 장애물 '새'** — "높이 뛰면 실패"라는 절제 판단을 강제하는 복합 패턴.
4. **PERFECT 콤보 → FEVER** — 게이지 충전 시 8초간 점수 2배, 무지개 줄·배경 효과.
5. **파워업** — 실드(1회 보호), 슬로모 시계(5초 0.7배속), 하트 회복.
6. **4개 테마 월드** — 달 월드는 저중력으로 체공감이 바뀜.
7. **더블더치** — 두 줄이 번갈아 도는 고난도 구간.
8. **스킨 상점** — 코인으로 고양이/토끼/로봇/닌자/우주인 해금.
9. **오늘의 도전 + 엔드리스** — 날짜 시드로 모두 같은 패턴, 최고기록 저장.
10. **손맛(juice) + 접근성** — 햅틱, 화면 흔들림, 스쿼시&스트레치, 파티클 / 모션 줄이기 옵션, 숫자 아이콘으로 색각 무관 식별.

## 5. Module ownership
| Area | Files | Owner |
|---|---|---|
| Contracts | `src/types.ts`, `docs/GDD.md` | lead |
| Core logic (pure, tested) | `src/core/*`, `tests/core/*` | core teammate |
| Rendering (canvas) | `src/render/*`, `render-preview.html` | render teammate |
| UI / audio / platform | `index.html`, `src/ui/*`, `src/styles/*`, `src/audio/*`, `src/platform/*`, `public/*` | ui teammate |
| Integration | `src/game/*`, `src/main.ts` | lead |

## 6. Core API (exact signatures the integration calls)
```ts
// src/core/physics.ts
export const DEFAULT_PHYSICS: PhysicsConfig;
export const CLEAR_H: number; export const PERFECT_H: number;
export function physicsForWorld(world: WorldId): PhysicsConfig;           // applies gravityScale
export function initialPlayer(): PlayerState;
export function tapPlayer(p: PlayerState, cfg: PhysicsConfig): { player: PlayerState; action: 'jump' | 'boost' | 'buffered' | 'none' };
export function stepPlayer(p: PlayerState, dt: number, cfg: PhysicsConfig): { player: PlayerState; landed: boolean; autoJumped: boolean };
export function airtimeForLevel(level: Level, cfg: PhysicsConfig): number;  // boosts at apex

// src/core/judge.ts
export function judgeBeat(beat: Beat, p: PlayerState): JudgeResult;

// src/core/scoring.ts
export const FEVER_DURATION: number;
export function initialScore(): ScoreState;
export function applyJudge(s: ScoreState, r: JudgeResult): { score: ScoreState; feverStarted: boolean; comboMilestone: number | null };
export function tickScore(s: ScoreState, dt: number): ScoreState;          // fever countdown
export function computeStars(s: ScoreState, hitsTaken: number, cleared: boolean): number;

// src/core/content.ts
export const WORLDS: readonly WorldMeta[]; export const SKINS: readonly SkinMeta[];
export const STAGES: readonly StageDef[];                                     // 20, ordered
export function stageById(id: string): StageDef | undefined;
export function nextStageId(id: string): string | null;

// src/core/levels.ts
export function generateBeats(stage: StageDef, cfg: PhysicsConfig, startTime?: number): Beat[];
export function endlessStage(chunk: number, seed: number): StageDef;        // difficulty ramps with chunk
export function dailyStage(dateIso: string): StageDef;                       // 'YYYY-MM-DD', deterministic

// src/core/timeline.ts
export function ropeState(beats: readonly Beat[], t: number): RopeState;
export function visibleObstacles(beats: readonly Beat[], t: number): VisibleObstacle[];
export function laneItems(beats: readonly Beat[], t: number): LaneItem[];

// src/core/rng.ts
export function mulberry32(seed: number): () => number; export function hashString(s: string): number;

// src/core/storage.ts
export function defaultSave(): SaveData;
export function parseSave(raw: unknown): SaveData;                           // validates, never throws
export function loadSave(store?: Pick<Storage, 'getItem'>): SaveData;
export function writeSave(data: SaveData, store?: Pick<Storage, 'setItem'>): void;
export function recordResult(save: SaveData, key: string, stars: number, score: number, coins: number): SaveData;
export function isStageUnlocked(save: SaveData, stageIndex: number): boolean; // index into STAGES
export function buySkin(save: SaveData, id: SkinId): SaveData | null;       // null if unaffordable/owned
```
