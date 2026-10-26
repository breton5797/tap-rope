# LASER ESCAPE v5 — 2.5D 3레인 + 구간 문 (승인: 2026-10-26)

v4(`docs/GDD-v4.md`)를 기반으로 한 확장. v4의 판정·물리·캠페인 곡선·피버·파워업·스킨·데일리·엔드리스·PWA·iOS는 유지.
공통 규격: `src/types.ts` (v5 필드 추가, 리드 소유). 저장 키·별·코인·스킨은 그대로 유지(`controlsSeen`만 추가, 없으면 false).

## 1. 시점 — 2.5D (카메라 약 20° 내려다봄)
- 복도 바닥이 원근 평면으로 보이고 그 위에 **3개 레인**: 0 = 먼 쪽(화면 위), 1 = 가운데(시작), 2 = 가까운 쪽(화면 아래).
- 레인 바닥선 y는 가운데 = `GROUND_Y`(470), 레인 간격 화면상 약 38px, 깊이 스케일 0.9 / 1.0 / 1.1. 요원 x = `PLAYER_X` 고정.
- 렌더러는 `project(x, lane(실수 허용), height) → {x, y, scale}` 하나로 요원·그림자·장애물·픽업·문을 그린다. 뒤쪽 레인부터 그린다(페인터 순서).
- v4의 전체 폭 레이저(floor/beam/high/ceiling/drone)는 세 레인을 가로지르는 "막"(앞뒤 깊이를 가진 평행사변형 빔)으로 그린다.
- 배경 타일 캐시는 유지. 메모리 상한: iPhone ~30MB, iPad ~53MB 수준을 넘기지 않는다(전환 중에만 이전 장면 캐시 1벌 추가 허용, 끝나면 해제).

## 2. 조작 — 화면 좌우 분할
| 입력 | 동작 |
|---|---|
| 왼쪽 절반 ↑ 스와이프 | 레인 −1 (먼 쪽) — 탭은 아무 동작 없음 |
| 왼쪽 절반 ↓ 스와이프 | 레인 +1 (가까운 쪽) |
| 오른쪽 절반 탭 / ↓ 스와이프 | v4와 동일: 점프(공중 탭 = 단 추가) / 슬라이딩·급강하 |
| 키보드 | ↑ / ↓ = 레인, Space·Enter = 점프, Shift·S = 슬라이딩, Esc·P = 일시정지 |
- 분할 기준: 캔버스 CSS 폭의 절반(포인터 다운 위치). 왼쪽 스와이프 최소 거리 22px, 시간 제한 300ms(손가락을 떼지 않아도 인식). 한 터치당 1회.
- 레인 이동은 공중·슬라이딩 중에도 가능, 즉시 판정 반영(target lane), 애니메이션 `LANE_SWITCH_TIME`(0.12s). 끝 레인에서 바깥으로 = 'none'(살짝 튕김 연출).
- 첫 플레이(`controlsSeen` false)에 양손 조작 카드(`Ui.showControls`) — 확인하면 저장.

## 3. 장애물
### 3.1 전체 폭 레이저 (v4 그대로, 점프/슬라이딩)
floor · beam(1~3단, 앞/뒤) · high(앞/뒤) · ceiling · drone · gate(floor+drone) · pulse.
### 3.2 레인 장애물 (v5, 레인 이동으로만 회피 — 점프·슬라이딩 무효)
| kind | 방향 | 막는 레인 | 연출 |
|---|---|---|---|
| guard | 앞(바닥과 함께 스크롤) | 1~2 | 붉은 눈 경비로봇, 레이저 방패 |
| drop | 위(천장) | 1~2 | 화물 상자/집게가 떨어짐. **돌발** |
| chaser | 뒤 | 1 | 추격 드론이 레인을 따라 돌진. **돌발** |
- 절대 3레인을 다 막지 않는다(안전 레인 ≥ 1). 한 beat에 레인 장애물 종류는 하나.
- 픽업은 v5에서 한 레인에 떠 있다(`lanes=[l]`). 해당 레인 + 공중 + level ≥ L 일 때 획득.
### 3.3 돌발 공격 경고
- 돌발(sudden) = drop, chaser, 뒤에서 오는 beam/high.
- 도착 `WARN_LEAD`(1.0s) 전부터 대상 레인 위(요원 머리 높이 근처)에 빨간 **"!"** 배지 점멸 + `alert` 효과음 1회. drop은 바닥 착지 지점 그림자가 점점 진해진다. chaser/뒤 빔은 화면 왼쪽 가장자리 해당 레인 높이에도 "!".
- reduced motion: 점멸 대신 고정 표시.

## 4. 판정 — `judgeBeat(beat, player)`
순서: **lane → drone → slide → jump** (v4 순서 앞에 lane 추가).
- lane: 레인 장애물(guard/drop/chaser)의 `lanes`에 `player.lane` 포함 → miss 'lane'.
- 이후 v4 그대로. 레인 장애물만 있는 beat를 통과하면 perfect.
- 픽업: `lanes`가 있으면 player.lane ∈ lanes 조건 추가.

## 5. 생성기 규칙 (v4 §4 + 아래)
- 하자드 beat 중 `mix.lane` 확률로 레인 beat. 종류는 `mix.drop` / `mix.chaser` / 나머지 guard. 막는 레인: guard 1~2, drop 1~2, chaser 1.
- `mix.laneCombo` 확률로 레인 beat에 전체 폭 점프 레이저(floor L1 또는 beam L1) 또는 slide 레이저를 같이 둔다(= lanejump). 이 경우 드론은 섞지 않는다.
- 간격: 레인 단독 beat 뒤 다음 하자드 ≥ `LANE_GAP` 0.45s. 연속 레인 beat 사이 안전 레인이 하나도 겹치지 않으면 ≥ 0.6s(2칸 이동 여유). 레인+점프 복합은 기존 점프 간격과 max.
- pulse 안에는 레인 장애물 없음. 패턴(PATTERNS)에는 레인 토큰 'L' 추가 가능(예: [1,'L',1], ['L','L']) — 레인 해금 후.
- **피로도**: 점프만 필요한 beat 비율이 v4보다 낮아야 한다. 레인 해금 이후 일반 단계에서 레인 beat 비중 0.2 + 0.15·d
  (레인 계열 도입 단계 lane/drop/chaser/lanejump는 0.5, **다른 기술의 도입 단계는 절반** — 새 기술이 묻히지 않게).
  측정(일반 단계, 2단계 이후): 레인 beat 평균 22%, 점프만 필요한 beat 57% (v4 70%).
- 각 단계(엔드리스 청크·데일리 포함)의 첫 레인 beat는 시작 레인(1)을 막는다 → 레인 이동을 반드시 한 번 쓴다.
- 레인 도달성: 연속된 레인 beat들 사이에서 사람 속도(레인 1칸 ≈ 0.3s, 2칸은 ≥ LANE_SWAP_GAP)로 안전 레인에 도달 가능한 경로가
  항상 존재해야 한다(쌍이 아니라 연쇄 전체 기준).
- `blockedLanes` = 레인 장애물 lanes 합집합(정렬), `section` = 구간 번호.

## 6. 구간과 문
- `StageDef.sections`: bonus 1, normal 2, boss 3 (데일리 2, 엔드리스 1 — 엔드리스는 청크 경계마다 문).
- 하자드 spec을 구간 수로 거의 균등 분할. 구간 사이 쉬는 시간 `DOOR_BREAK` = 2.4s(이전 beat의 gapAfter 이후 추가 + 박자 격자 스냅). 문은 쉬는 구간 중앙(`door.time`)에 있다.
- 문 연출: door.time 3.0s 전 문틀이 화면 오른쪽에서 스크롤 → 1.0s 전 보안문 좌우로 열림(+`door` 효과음) → door.time 통과 순간 장면 전환 연출 0.6s.
  - turn(코너 회전): 화면이 옆으로 밀리며 새 배경, stairs(계단): 위로 밀리며, elevator: 문이 닫혔다 흔들리고 열림.
- 세션은 door.time에 world/variant를 `to`로 바꾼다(엔드리스 tempoQueue와 같은 방식). 음악 BPM은 단계 안에서 유지.
- HUD: 진행 바에 구간 칸(pips) 표시(`sections` > 1일 때).
### 6.1 구역별 장면 (`CHAPTER_SCENES`, 구간 0/1/2, 전환 1→2 / 2→3)
| 구역 | 장면 0 | 전환 | 장면 1 | 전환 | 장면 2 |
|---|---|---|---|---|---|
| 1 외곽 | 0 base | turn | 3 base | stairs | 3 steam |
| 2 수로 | 3 steam | turn | 3 base | stairs | 1 base |
| 3 연구동 | 1 base | elevator | 1 dark | turn | 1 base |
| 4 서버실 | 1 dark | turn | 1 base | stairs | 2 base |
| 5 감옥 | 2 base | stairs | 3 base | elevator | 2 base |
| 6 경보 | 2 alarm | turn | 1 alarm | stairs | 2 alarm |
| 7 비상탈출 | 1 alarm | turn | 1 dark | elevator | 3 base |
| 8 공장 | 3 base | turn | 3 steam | elevator | 0 night |
| 9 옥상 | 0 night | turn | 1 dark | stairs | 0 night |
| 10 헬기 | 0 dawn | stairs | 0 base | turn | 0 dawn |
장면 0은 항상 구역 대표 look(= ChapterMeta theme/variant). 모두 DESIGNED_LOOKS 안의 쌍.

## 7. 캠페인
기술 첫 등장 단계: jump 1 · **lane 2** · beam 3 · double 4 · slide 6 · drone 8 · **drop 9** · triple 11 · high 13 ·
rear 16 · **chaser 18** · gate 21 · pulse 24 · **lanejump 27**. (5의 배수는 보너스/보스라 도입 불가.)
- 도입 단계 집중도(INTRO_FOCUS): lane 0.5, drop 0.6(레인 beat 중), chaser 1(레인 beat 중), lanejump 0.6.
- 2부(탈출, chapter ≥ 5)는 chaser·뒤 빔 비중 +0.1.
- 도입 단계에는 jump(+이단) + 새 기술에 더해, 해금된 경우 lane도 포함한다.
- 엔드리스 청크는 하자드 18개(14개 기술 + 펄스 4개를 모두 담기 위해, v4 16개).
- 단계 이름: 도입 단계가 바뀐 곳은 이름을 기술에 맞게 조정(예: 1-2 "경비로봇 피하기", 1-3 "날아오는 빔", 1-9 "떨어지는 상자", 2-8 "뒤에서 온다!", 3-7 "피하고 뛰어!").
- 밸런스 테스트(v3/v4)는 v5 규칙으로 갱신: 단조 증가 난이도, 모든 단계 봇 클리어, 모든 move 등장 보장.

## 8. API 추가 (core)
```ts
// physics.ts
export function moveLane(p, dir: LaneDir): { player; action: 'lane' | 'none' };   // initialPlayer().lane === 1
// stepPlayer advances laneAge; laneFrom stays until the next change (renderer interpolates by laneAge)
// judge.ts — §4. spacing.ts — LANE_GAP 0.45, LANE_SWAP_GAP 0.6
// timeline.ts
export function visibleObstacles(beats, t): VisibleObstacle[];   // + lanes, sudden
export function laneItems(beats, t): LaneItem[];                 // + blocked
export function visibleDoors(doors, t): DoorView[];              // timeUntil ∈ [−1.0, 3.0]
// moves.ts: moveForBeat — lanejump (lane hazard + any full-width laser) → chaser → drop → lane(guard), then v4 order
// content.ts: CHAPTER_SCENES (§6.1), sceneFor(stage, section): Scene
// levels.ts
export function generateStage(stage, cfg, startTime?): { beats: Beat[]; doors: Door[] };  // generateBeats = .beats
// endlessStage / dailyStage gain sections (1 / 2)
// storage.ts: controlsSeen (default false, migrates old saves)
```
## 9. 통합 (game)
- input.ts: `onLane(dir)` 추가. 왼쪽 절반 포인터는 탭/슬라이드를 발생시키지 않는다.
- session.ts: `lane(s, dir)` → `{type:'lane', action, lane}` 이벤트; doors 보관, door.time에 장면 변경, 돌발 장애물이 WARN_LEAD를 지날 때 `{type:'alert', lanes}` 이벤트, 문 열림(door.time − 1.0) `{type:'door'}` 이벤트.
- bot.ts: 다음 레인 beat의 안전 레인 중 현재 레인에서 가장 가까운(동률이면 그다음 레인 beat에도 안전한) 레인으로 미리(≥ 0.25s 전) 이동, 한 프레임 한 동작.
- snapshot: doors, HUD section/sections.
