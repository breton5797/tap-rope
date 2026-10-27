# LASER ESCAPE v7 — 보스전 · 스토리 컷신 · 온라인 랭킹/업적 (승인: 2026-10-27)

v6(`docs/GDD-v6.md`)의 아트 원칙(§1: 시네마틱 잠입, 유치함 금지, 3색 강조, iPad 7세대 60fps, 메모리 iPhone ≤35MB / iPad ≤55MB)을 그대로 따른다.
게임플레이 수치(판정·생성기·캠페인·저장 키)는 **불변**. 공통 규격: `src/types.ts` v7 블록.

## 1. 보스전 (구역 10단계 = 보스, 3구간 = 3페이즈)
| 구역 | BossId | 이름 / 코드명 | 실체 | 공격 연출 |
|---|---|---|---|---|
| 1 | warden | 정문 경비대장 / SENTINEL-01 | 2족 중장갑 경비 메크(화면 오른쪽 뒤편, 레인 위로 우뚝) | 팔 레이저포 → beam, 발 구르기 → floor |
| 2 | sewer-eye | 수로 감시 드론 / OCULUS | 대형 탐조등 드론(상단 비행) | 탐조등 스캔 → drone, 낙하 → lane |
| 3 | lab-ai | 연구소 보안 AI / ARGUS | 천장 포탑 배열 + 중앙 렌즈 | 천장 포탑 → ceiling, 레이저 → beam |
| 4 | core | 서버 코어 / NEXUS | 레이저 격자 제어 기둥(배경, 케이블) | 격자 → floor/pulse, 드론 → drone |
| 5 | jailer | 간수장 로봇 / WARDEN-X | 진압 방패 든 대형 인간형 로봇 | 방패 돌진 → lane(guard), 전기봉 → floor |
| 6 | apc | 경비대 장갑차 / RHINO | 장갑차(뒤에서 추격, 왼쪽) | 기관포 → beam(back), 드론 사출 → chaser |
| 7 | chimera | 실험 병기 / CHIMERA | 4족 보행 실험 병기 | 도약 착지 → lane(drop), 레이저 → beam |
| 8 | crane | 공장 크레인·프레스 / TITAN | 천장 크레인 + 프레스 | 화물 낙하 → lane(drop), 프레스 → ceiling |
| 9 | sniper | 옥상 저격 드론 / RAVEN | 저격 소총 단 고고도 드론 | 조준선(레이저 사이트) → beam, 섬광 → floor |
| 10 | gunship | 무장 헬기 / VULTURE | 무장 헬기(배경 하늘) | 기관포 → beam, 로켓 착탄 → lane |
- **판정·박자는 v6 그대로**. 보스는 연출 레이어: 다음 하자드 beat를 `BossAttackKind`로 매핑(`beam`: beam/high, `floor`: floor/pulse/gate의 floor, `ceiling`: ceiling, `drone`: drone(단독), `lane`: guard/drop/chaser)하고 도착 1.6s 전부터 **예고(차지)** 애니메이션 → 발사 연출이 실제 장애물과 동기.
- HP = 1 − (처리한 하자드 / 전체 하자드). 페이즈 = section(문). 문 통과 시 `stagger`(피격·파손 연출 1.2s, 'boss-stagger' 효과음), 마지막 beat 후 `defeated`(폭발·쓰러짐 2s, 'boss-down'), 첫 beat 2s 전 `intro`('boss-intro').
- 화면 배치: 보스는 레인 뒤(배경 깊이) 또는 상단에 그려 레인 가독성을 가리지 않는다. 크기 ~화면 폭 40–60%. 실사 톤: AI 생성 보스 이미지(`public/art/boss-<id>.webp`, 투명 배경 PNG→WebP 알파) + 코드 애니메이션(관절 회전, 발광 센서, 머즐 플래시). 이미지가 없으면 절차 실루엣.
- HUD: 상단 보스 바(코드명 · 이름 · HP 게이지 · 페이즈 칸 3).
- `core/boss.ts`: `BOSSES: BossMeta[]`, `bossFor(stage): BossMeta | null`, `bossView(stage, beats, doors, t, hazardDone, hazardTotal): BossView | null` (순수, 테스트).

## 2. 스토리 컷신
| id | 트리거 | 샷(2–4) |
|---|---|---|
| op-start | 1-1 첫 진입(브리핑 전) | 야간 기지 원경 → 요원 장비 점검 클로즈업 → 레이저 펜스 |
| boss-N | 각 N-10 첫 진입(브리핑 대신) | 보스 등장 2샷(실루엣 → 정면) |
| rescue | 5-10 첫 클리어 | 감방 문 개방 → 포로(과학자)와 요원 → "탈출 경로 확보" |
| escape-end | 10-10 첫 클리어 | 헬기 탑승 → 이륙, 기지 원경 → 엔딩 카드 "임무 완료" |
- 이미지: `public/art/cut/<name>.webp` 1080×1920 세로(또는 1920 가로 크롭) ~20장, 총 ≤ 2MB. 사람은 실루엣/뒷모습/헬멧 위주(얼굴 클로즈업 금지), 글자·로고 없음.
- 플레이어: 전체 화면, 샷마다 Ken Burns(줌·패닝), 하단 자막(타자 효과, 화자 라벨), 시네마틱 레터박스, 'SKIP' 버튼(+Esc/탭 길게), 샷 간 0.4s 디졸브. 모션 줄이기: 줌·패닝 없이 정지 + 페이드.
- 한 번 본 컷신은 자동 재생 안 함(`save.seenCutscenes`), 타이틀 메뉴 "기록 보관소"에서 재생(본 것만, 나머지 잠김 표시).
- `core/cutscenes.ts`: `CUTSCENES: Cutscene[]`, `cutsceneBefore(stage, save)`, `cutsceneAfter(stageId, cleared, save)`.

## 3. 업적 · 온라인
### 3.1 업적 (`core/achievements.ts`, 로컬 우선)
| id | 이름 | 조건 |
|---|---|---|
| first-clear | 첫 임무 | 아무 단계 클리어 |
| zone-1/3/5/7/10 | 구역 n 돌파 | n-10 클리어 |
| rescue / escape | 포로 구출 / 탈출 성공 | 5-10 / 10-10 클리어 |
| flawless-boss | 무결점 제압 | 보스 단계 무피격 클리어 |
| perfect-stage | 완벽한 침투 | MISS·GOOD 0으로 단계 클리어 |
| chain-50 / chain-100 | 50 / 100 체인 | maxCombo ≥ 50 / 100 |
| overdrive-3 | 과부하 | 한 판에 오버드라이브 3회 |
| all-stars-zone | 구역 완전 제압 | 한 구역 10단계 모두 별 3 |
| stars-150 | 베테랑 | 별 합계 ≥ 150 |
| endless-60 / endless-180 | 생존 1분 / 3분 | 무한 침투 60s / 180s 생존 |
| daily-1 / daily-7 | 일일 작전 / 7일 연속 | 일일 작전 클리어 1회 / 7일 연속 |
| all-operators | 전 요원 확보 | 스킨 6종 보유 |
| archivist | 기록 보관 | 컷신 13종 모두 시청 |
- `evaluateAchievements(save, run: RunSummary | null): AchievementId[]`(새로 달성한 것만), 해제 시 배너 + 'achieve' 효과음, 업적 화면(달성/미달성, 달성일).

### 3.2 결정적 재생 (anti-cheat 전제)
- 세션 시간은 **고정 격자** `TICK = 1/240`s와 beat 시각에서만 경계를 가진다: 한 번의 `step()`은 목표 시각 이하의 마지막 경계까지만 진행하고 나머지는 다음 프레임으로 넘긴다(누적). 경계 시각은 `(k+1)·TICK` 또는 beat.time을 **대입**(덧셈 누적 금지) → 같은 입력 열이면 프레임 타이밍과 무관하게 비트 단위로 같은 상태.
- 입력은 항상 경계 시각에 적용되고 `[time, code]`로 기록(`RunInput`). 슬로모는 실시간→스테이지 시간 변환에만 영향.
- `game/replay.ts`: `simulateRun(record): { score, endTime, status }` — 기록된 입력을 같은 세션 코드로 재생(순수, Node/Deno 공용). 테스트: 봇 플레이 기록 → 재생 점수 = 라이브 점수(엔드리스·데일리 여러 시드, 서로 다른 프레임 레이트 30/60/120/불규칙).
- `SIM_VERSION` 상수(게임 로직 변경 시 증가). 서버는 다른 버전 기록을 거부.

### 3.3 서버 (Supabase 프로젝트 `laser-escape`, ref bmstuotifpmaspszrgyi, ap-northeast-2)
- **신원**: 익명 로그인 대신 기기 비밀값. 클라이언트가 최초 실행 시 랜덤 256bit `deviceSecret` 생성(localStorage `laserescape.device.v1`). 서버는 `sha256(secret)`만 저장. 모든 쓰기는 Edge Function 경유(헤더 `x-device-secret`), 테이블 직접 쓰기 금지(RLS로 anon insert/update/delete 차단).
- **테이블**: `players(id uuid pk, secret_hash text unique, nickname text unique null, created_at)`, `runs(id bigserial, player_id, board text, score int, sim text, inputs jsonb, created_at)`(검증된 기록만), `best_scores(player_id, board, score, run_id, updated_at, pk(player_id, board))`, `achievements(player_id, achievement_id, unlocked_at, pk)`. 공개 읽기용 view/RPC `leaderboard(board, limit)`(nickname, score, rank — 닉네임 없는 플레이어는 "요원-XXXX").
- **Edge Functions**: `register`(secret_hash 등록 → player id), `nickname`(2–12자, 한글/영문/숫자/_, 금칙어, 유니크), `submit-run`(크기 제한 inputs ≤ 20k, endTime ≤ 3600s, 분당 6회 제한 → `simulateRun` 재생 → 서버 점수로 runs·best_scores 갱신, daily는 date가 서버 기준 ±1일, 주간 보드는 ISO 주), `achievements`(동기화, id 화이트리스트), `leaderboard`(읽기, 캐시 30s). 시뮬레이터는 `vite build --mode sim`으로 `src/game/replay.ts` 등을 단일 ESM으로 번들해 함수와 함께 배포.
- **클라이언트** `src/platform/online.ts`: `OnlineApi` 구현(fetch만, supabase-js 미사용 — 번들 크기), URL·publishable key는 빌드 타임 상수(`import.meta.env.VITE_SUPABASE_URL` 등, 공개 값). 오프라인 큐(localStorage, 최대 20건, 지수 백오프).
- **보안 체크**: RLS 전 테이블 활성 + advisors 0 경고, service role 키는 함수 환경변수에만, 비밀값 해시 비교는 상수 시간, CORS는 Pages 도메인 + localhost만.

## 4. UI (ui 팀)
- 타이틀 메뉴에 "기록 보관소 · 업적 · 랭킹" 추가, 결과 화면(무한 침투·일일 작전)에 "랭킹 등록됨 #n / 오프라인 — 대기 중" 상태, 최초 랭킹 진입 시 닉네임 카드.
- 랭킹 화면: 탭(무한 침투 · 주간 · 오늘의 일일 작전), 상위 50 + 내 순위 고정 행, 로딩/오프라인 상태.

## 5. 통합 (lead)
- app: 컷신 트리거(전·후), 보스 스냅샷/HUD, 입력 기록 + RunRecord 제출, 업적 평가·배너·동기화, 닉네임 흐름, 기록 보관소 재생.
- snapshot: `boss` (RenderSnapshot·HudState).
