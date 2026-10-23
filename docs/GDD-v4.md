# LASER ESCAPE v4 — 레이저 탈출작전 (승인: 2026-10-23)

줄넘기 게임을 **횡스크롤 구출·탈출 액션**으로 전면 개편. 박자 동기 판정 엔진, 100단계 캠페인 구조·밸런스 테스트,
피버·파워업·스킨·데일리·엔드리스·PWA·iOS는 유지. 공통 규격: `src/types.ts` (v4로 재작성).

## 1. Concept
특수요원이 적 기지에 잠입해 포로를 구출하고(1부, 1~50단계), 함께 탈출한다(2부, 51~100단계).
요원은 화면 왼쪽 1/3(PLAYER_X=108)에서 오른쪽으로 계속 달리고 복도가 왼쪽으로 흐른다. 레이저는 상하좌우에서
나타나 정확히 박자에 맞춰 요원 위치에 도착한다. 나타나기 VISIBLE_LEAD(2.0s) 전부터 해당 방향 화면 가장자리에 경고.

## 2. Controls (탭은 터치 순간 즉시 반응)
| 입력 | 동작 |
|---|---|
| 탭 (땅) | 점프 (level 1) |
| 탭 (공중) | 한 단 더 (level+1, 최대 3) — 착지 직전(하강 중 < 26px) 탭은 착지 즉시 점프로 버퍼 |
| ↓ 스와이프, 땅에서 시작한 점프 직후(lastTap='jump', airTime ≤ 0.25s) | 그 점프를 **슬라이딩으로 전환** (height 0, grounded, sliding) |
| ↓ 스와이프, 공중 | **급강하**(vy = −fallV) → 착지하자마자 슬라이딩 (pendingSlide) |
| 슬라이딩 중 탭 | 슬라이딩 취소 + 점프 |
| 키보드 | Space/W/↑ = 탭, ↓/S = 슬라이딩(탭 없이) |
슬라이딩 지속 slideTime = 0.55s. 착지 시 level 0, lastTap 'none'.

## 3. Lasers & judge — `judgeBeat(beat, player)`
판정 순서: drone → slide 필요(high/ceiling) → 점프 필요(floor/beam) .
- drone: 공중 && level ≥ 2 → miss 'drone'
- high/ceiling: !sliding → miss 'standing'
- floor/beam L: sliding → miss 'slide'; grounded || height < CLEAR_H → 'low'; level < L → 'level'
- 통과 grade: 점프 beat는 height ≥ PERFECT_H → perfect, 아니면 good. 슬라이드 beat는 slideAge ∈ [0.05, 0.35] → perfect,
  아니면 good. drone 단독 통과 → perfect.
- 픽업: 공중 && level ≥ L (hit이면 획득 없음).
- 같은 beat에 jump-필요와 slide-필요를 동시에 두지 않는다(생성기 보장). gate = floor + drone.

## 4. Generator rules (v1~v3 규칙 유지 + 아래)
- 점프 beat: floor(L1) 또는 beam(L1~3, from front|back). slide beat: ceiling(top) 또는 high(front|back).
- 간격: 점프 L 뒤 → 다음 hazard ≥ airtime(L) + 0.18. slide 뒤 → 다음 hazard ≥ 0.6. slide 앞 → 직전이 점프 L이면
  ≥ airtime(L) + 0.18 (땅에 있어야 슬라이딩 시작). drone 단독 뒤 ≥ 0.5.
- pulse 구간: 4~8개 연속 floor(L1), 간격 airtime(1)+0.18, 전체의 ≤ 35%.
- 금지: drone + level≥2, 같은 beat에 slide 필요 + jump 필요, pulse 안에 slide/drone.
- rear(뒤에서 오는 빔)는 판정은 앞과 같고 연출·경고만 다르다.

## 5. Campaign — 10구역 × 10단계 (보너스 5번째, 보스 10번째, v3 곡선·밸런스 테스트 유지)
| # | 부 | 구역 | theme | variant | 브리핑(예) |
|---|---|---|---|---|---|
| 1 | 1 구출 | 외곽 경비구역 | 0 | base | 포로가 잡혀 있는 기지에 잠입한다. 레이저를 넘어라! |
| 2 | 1 | 지하 수로 | 3 | steam | 경비를 피해 증기 가득한 수로로. |
| 3 | 1 | 연구동 | 1 | base | 하얀 실험실, 보안 레이저가 촘촘하다. |
| 4 | 1 | 서버실 | 1 | dark | 불이 꺼진 서버실. 드론을 조심해. |
| 5 | 1 | 감옥 블록 | 2 | base | 포로가 있는 곳! 보스를 넘으면 구출 성공. |
| 6 | 2 탈출 | 경보 발령 | 2 | alarm | 경보가 울렸다! 포로와 함께 달려라. |
| 7 | 2 | 연구동 비상탈출 | 1 | alarm | 붉은 비상등 아래 출구를 찾아라. |
| 8 | 2 | 공장 라인 | 3 | base | 쉬지 않는 기계 사이로. |
| 9 | 2 | 옥상 | 0 | night | 밤하늘 아래 마지막 경비선. |
| 10 | 2 | 헬기 탈출 | 0 | dawn | 동이 튼다. 헬기까지 전력 질주! |
설계된 theme×variant 쌍: 0 base|night|dawn, 1 base|dark|alarm, 2 base|alarm, 3 base|steam (엔드리스·데일리도 이 쌍만).

기술 도입(첫 등장 단계 번호): jump 1 · beam 2 · double 4 · slide(ceiling) 6 · drone 8 · triple 11 · high 13 · rear 16 · gate 21 · pulse 24.
2부(chapter ≥ 5) 단계·데일리에서 escort = true (구출한 포로가 뒤따라 달림).

## 6. Story moments
- 구역 첫 진입 시 브리핑 카드(save.briefed에 기록, 이후 1-1처럼 index 0 단계에서는 다시 보여도 됨).
- w5-s10 클리어 → "포로 구출 성공!" 결과 연출, w10-s10 클리어 → "탈출 성공! 임무 완료".

## 7. Visual direction — 귀여운 스파이 카툰
어두운 기지 복도(벽 패널, 파이프, 철창, 모니터), 네온 빨강·청록 레이저(글로우), 발사기 하드웨어(바닥 슬롯·천장 노즐·
벽 포트), 경고 표시(가장자리 화살표 + 빨간 점멸). 요원 = 귀여운 chibi 스파이(수트·고글·이어피스), 스킨 6종 재해석:
kid=요원 K, cat=고양이 요원, bunny=토끼 해커, robot=로봇 R-7, ninja=닌자 요원, astro=특수부대. 포로 = 줄무늬 수감복.
리듬 레인: 레이저 아이콘 + 방향 화살표 + 기술 배지(1/2/3, ↓ 슬라이드, 드론, 게이트, 펄스).

## 8. Core API v4 (signatures the integration calls)
```ts
// physics.ts
export const DEFAULT_PHYSICS: PhysicsConfig;   // gravity 3000, jumpV 660, boostV 700, fallV 1400, slideTime 0.55
export const CLEAR_H = 12; export const PERFECT_H = 40; export const SWIPE_WINDOW = 0.25;
export function physicsForWorld(world: WorldId): PhysicsConfig;   // all themes = DEFAULT_PHYSICS
export function initialPlayer(): PlayerState;
export function tapPlayer(p, cfg): { player; action: 'jump' | 'boost' | 'buffered' | 'none' };   // tap while sliding = jump
export function swipePlayer(p, dir: Swipe, cfg): { player; action: 'slide' | 'dive' | 'none' }; // only 'down' acts
export function slidePlayer(p, cfg): { player; action: 'slide' | 'dive' | 'none' };             // keyboard ↓ (no tap)
export function stepPlayer(p, dt, cfg): { player; landed: boolean; autoJumped: boolean; slideStarted: boolean };
export function airtimeForLevel(level: Level, cfg): number;
// judge.ts
export function judgeBeat(beat: Beat, p: PlayerState): JudgeResult;
// timeline.ts
export function visibleObstacles(beats, t): VisibleObstacle[];   // VISIBLE_LEAD window, keep passed ones 0.4s
export function laneItems(beats, t): LaneItem[];
export function moveForBeat(beat): MoveId;   // pulse→pulse, gate→gate, drone→drone, high→high, ceiling→slide, rear(back)→rear, L3→triple, L2→double, beam→beam, floor→jump
// scoring.ts, rng.ts — unchanged
// content.ts: WORLDS (4), CHAPTERS (10, ChapterMeta incl. part/briefing), SKINS (6, spy names), STAGES (100), stageById, nextStageId
// campaign.ts, difficulty.ts, spacing.ts, specs.ts, levels.ts — v3 structure re-targeted to the v4 kinds
// levels.ts: generateBeats(stage, cfg, startTime?), endlessStage(chunk, seed), dailyStage(dateIso)
// storage.ts: key 'laserescape.save.v1' (fresh game), SaveData.briefed, recordResult, isStageUnlocked, buySkin
```
