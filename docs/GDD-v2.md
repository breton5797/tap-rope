# TAP ROPE v2 — 비스듬한 탑뷰 + 다양한 줄넘기 기술 (승인: 2026-10-23)

v1 문서(`GDD.md`)의 모든 규칙은 유지하고, 아래 항목만 바뀌거나 추가된다. 공통 규격은 `src/types.ts`.

## 7. View
머리 위 약 60° 비스듬한 탑뷰. 바닥은 3D 평면(좌·중·우 3레인, 레인 간격 `LANE_W`), 장애물은 화면 위쪽(먼 쪽, z>0)에서
플레이어 쪽(z→0)으로 다가온다. 줄은 3D 곡선(회전축 = 좌우 방향)을 투영해 그린다. 높이는 몸이 화면 위로
올라가는 정도 + 바닥 그림자 크기로 읽힌다. 투영은 렌더러 소관 — 게임 로직은 (lane, z, height)만 넘긴다.

## 8. Rope modes (`StageDef.ropeMode`)
- **long**: 친구 둘이 좌우에서 긴 줄을 돌림 → 1~3단, 덤블링(ring), 옆 이동(ball), 허들, 새, 더블더치.
- **solo**: 아이가 직접 줄을 돌림 → 이단·삼단뛰기(level 2/3), 엇걸어뛰기(cross), 뒤로넘기(back), ball, 새.

## 9. Input — 탭은 터치 순간 즉시 점프, 스와이프는 그 점프의 "수식어"
| 입력 | 터치가 땅에서 시작 (`lastTap==='jump'`, airTime ≤ SWIPE_WINDOW 0.25s) | 터치가 공중에서 시작 (`lastTap==='boost'`) |
|---|---|---|
| 탭 | 점프 (level 1) | 한 단 더 (level+1, 최대 3) |
| ↑ 스와이프 | **덤블링**: vy = tumbleV − g·airTime, tumble=true, 유효 level 2 | — |
| ←/→ 스와이프 | **옆 이동**: lane ±1 (점프하며 옆 칸으로) | **엇걸어**: cross = true |
| ↓ 스와이프 | **뒤로넘기 전환** (solo만): backward = !backward | — |
- 덤블링 중 탭은 무시('none'). 착지 시 tumble/cross 초기화, lastTap='none'. backward는 다시 ↓ 할 때까지 유지.
- 키보드: Space=탭, ↑/←/→/↓ = 탭 + 해당 스와이프.

## 10. Judge v2 — `judgeBeat(beat, player, mode)`
유효 level = tumble ? 2 : player.level. 판정 순서: bird → ball → ring → rope/hurdle(높이·레벨) → cross → dir.
- bird: 공중 && (level ≥ 2 || tumble) → miss 'bird'
- ball(lane L): player.lane === L → miss 'ball' (점프로 못 넘음)
- ring: !tumble → miss 'tumble'
- rope/hurdle L: grounded || height < CLEAR_H → 'low'; 유효 level < L → 'level'
- rope.cross && !player.cross → 'cross'
- solo 모드 rope: (rope.back ?? false) !== player.backward → 'dir' (long 모드는 방향 무시)
- 통과: height ≥ PERFECT_H, ball/bird만 있는 beat, 또는 덤블링으로 넘은 ring → perfect, 아니면 good.
- 픽업: player.lane === (o.lane ?? 0) && 공중 && 유효 level ≥ L (hit이면 획득 없음)

## 11. Generator v2 rules
- ring: long 전용, bird와 동시 금지. 다음 hazard까지 ≥ airtimeTumble + 0.18.
- ball: beat당 1~2개 레인(3개 금지). 2개면 직전 hazard와 ≥ 2·airtime(1) + 0.3(옆 이동 두 번). 1개면 ≥ airtime(1) + 0.18.
  ball은 1단 rope와 동시 가능(옆 이동 점프가 줄도 넘음).
- cross: rope level 1~2만. 탭 → 공중 스와이프가 필요하므로 앞 간격 ≥ airtime(2) + 0.18.
- back(solo): 3~8개 연속 back rope 구간(level 1; W3-S5 이후 level 2 허용). 구간 첫 beat와 구간 직후 첫 beat가 ↓ 스와이프 신호.
- 기존 규칙 유지: BPM 반박 그리드, 간격 규칙, bird + level≥2 금지, DD ≤ 35%(long 전용), 픽업은 레인 지정.
- 엔드리스: 짝수 청크 long / 홀수 청크 solo. 오늘의 도전: seed로 결정.

## 12. Stages v2 (기술 도입 순서, 굵게 = 새 기술)
| | S1 | S2 | S3 | S4 | S5 |
|---|---|---|---|---|---|
| W1 놀이터 | long 점프 | long 허들 | **solo 이단뛰기** | **long 옆 이동(ball)** | long 종합 |
| W2 해변 | **long 덤블링(ring)** + 새 | **solo 엇걸어** | long 3단·ring | solo 엇걸어+삼단 | long 종합 |
| W3 네온 | **solo 뒤로넘기** | **long 더블더치** | solo 뒤로+엇걸어 | long DD+ball+ring | solo 종합 |
| W4 달 | long 전부 | solo 전부 | long 전부 | solo 전부 | long 피날레 |

## 13. Core API v2 (changed / added)
```ts
// physics.ts
export const DEFAULT_PHYSICS: PhysicsConfig;              // + tumbleV ≈ 980
export const SWIPE_WINDOW = 0.25;
export function swipePlayer(p: PlayerState, dir: Swipe, cfg: PhysicsConfig, mode: RopeMode):
  { player: PlayerState; action: 'tumble' | 'side' | 'cross' | 'reverse' | 'none' };
export function airtimeTumble(cfg: PhysicsConfig): number;
// tapPlayer: sets lastTap ('jump' | 'boost'); returns 'none' while tumbling.
// stepPlayer: eases laneX toward lane (≈ 9 lanes/s); on landing resets tumble, cross, lastTap='none'.
// initialPlayer: lane 0, laneX 0, tumble/cross/backward false, lastTap 'none'.

// judge.ts
export function judgeBeat(beat: Beat, p: PlayerState, mode: RopeMode): JudgeResult;

// timeline.ts
export function ropeState(beats: readonly Beat[], t: number, mode: RopeMode): RopeState;
export function moveForBeat(beat: Beat): MoveId;
//   ring→tumble, ball→side, rope.cross→cross, rope.back→back, L3→triple, L2→double, bird-only→bird, dd→dd, else jump
// visibleObstacles: z = (beat.time − t)·SCROLL_SPEED, keep −80 ≤ z ≤ 900, lane = o.lane ?? 0.
//   heights: hurdle/ring/ball 0, bird 110, pickups by level 50 / 120 / 185.
// laneItems: adds move (moveForBeat) and ballLanes.

// levels.ts / content.ts
// StageDef gains ropeMode, moves, mix.{ball, ring, cross, back}.
// endlessStage(chunk, seed): ropeMode = chunk even ? 'long' : 'solo'; dailyStage picks by seed.
```

## 14. New ideas surfaced in v2
1. 탑뷰라서 가능한 **3레인 옆 이동** — 굴러오는 큰 공은 점프로 못 넘고 옆으로 비켜야 함.
2. **스와이프 = 점프 수식어** — 터치 순간 반응(지연 0)을 유지하면서 기술 4종을 한 손으로.
3. **덤블링 전용 무지개 링** + 새가 같이 오면 덤블링 금지 → 판단 싸움.
4. **뒤로넘기 구간** — 리듬 레인에 ↺ 아이콘, 구간 시작/끝에서 ↓ 스와이프.
5. 리듬 레인 아이콘에 **기술 배지**(↑ ✕ ↺ ←→)로 미리 준비.
