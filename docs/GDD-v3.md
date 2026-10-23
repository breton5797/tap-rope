# TAP ROPE v3 — 100단계 밸런스 캠페인 (승인: 2026-10-23)

v1(`GDD.md`), v2(`GDD-v2.md`) 규칙은 모두 유지. 공통 규격 변경은 `src/types.ts`
(`Variant`, `StageKind`, `ChapterMeta`, `StageDef.chapter/variant/kind`, `RenderSnapshot.variant`).

## 15. Structure — 10 chapters × 10 stages
`WorldId`(0..3)는 **테마**(배경·음악·중력)로 유지하고, 플레이어가 보는 "월드"는 **챕터** 10개.

| 챕터 | 이름(예) | theme | variant | 비고 |
|---|---|---|---|---|
| 1 | 놀이터 | 0 | base | 튜토리얼 |
| 2 | 노을 해변 | 1 | base | |
| 3 | 네온 시티 | 2 | base | |
| 4 | 달 기지 | 3 | base | 저중력 |
| 5 | 놀이터의 밤 | 0 | night | |
| 6 | 가을 놀이터 | 0 | autumn | |
| 7 | 밤바다 | 1 | night | |
| 8 | 비 오는 네온 | 2 | rain | |
| 9 | 일식의 달 | 3 | eclipse | 저중력 |
| 10 | 무지개 피날레 | 0 | rainbow | 최종 |

- stage id: `w{chapter+1}-s{index+1}` (w1-s1 … w10-s10). 잠금 해제: 직전 단계 ★1 이상 (100단계 일렬).
- 단계 번호 n = chapter·10 + index + 1 (1..100). **n % 10 == 5 → bonus**, **n % 10 == 0 → boss**, 그 외 normal.

## 16. Move introduction (첫 등장 = 해당 기술 위주의 부드러운 단계)
| n | 새 기술 | 줄 |
|---|---|---|
| 1 | jump | long |
| 2 | (허들) | long |
| 4 | double (이단) | solo |
| 6 | side (공) | long |
| 8 | bird | long |
| 11 | tumble (링) | long |
| 13 | cross (엇걸어) | solo |
| 16 | triple (삼단) | long |
| 21 | back (뒤로넘기) | solo |
| 24 | dd (더블더치) | long |
n ≥ 25: 지금까지 나온 기술을 조합. 줄 종류는 다양하게 섞되(연속 3단계 이상 같은 종류 금지), 각 단계의 moves는 그 줄에서 가능한 기술만.

## 17. Difficulty curve
d(n) ∈ [0,1]: **전체 상승 + 챕터 안 오르막 + 쉼표**
- base = 0.80·(n−1)/99 + 0.20·(index/9)  — 챕터 안에서 오르다가
- 챕터 첫 단계는 직전 보스보다 쉬움(새 챕터의 숨 고르기)
- boss: +0.08, 장애물 수 ×1.4 (최대 60), 그 챕터에서 쓰는 기술 전부
- bonus: d − 0.25, 장애물 12~16, pickupRate 0.8, 코인 위주(쉬운 보상 단계)
매핑 예: bpm = 88 + 62·d (최대 150), hazardBeats ≈ 14 + 34·d, levelWeights·mix 는 d와 해금된 기술에 비례.

## 18. Balance verification (자동 테스트)
- `stageDifficulty(stage, beats)` 점수: 초당 hazard 수, 평균 최소 간격의 역수, 기술 전환율(연속 beat의 move가 바뀌는 비율), 2·3단 비율, 복합 beat 비율의 가중합.
- 챕터별 normal 단계 평균 점수가 **챕터마다 엄격히 증가**.
- bonus는 같은 챕터 normal 평균보다 쉽고, boss는 그 챕터 normal 최댓값 이상.
- 인접 normal 단계 점수 급등 제한(직전 대비 +X% 이하, 수치는 테스트로 고정).
- 사람 반응 한계: 연속 hazard beat 간격 ≥ 0.45s (v1/v2 간격 규칙으로 이미 ≥ airtime+0.18).
- 봇이 100단계 전부를 스와이프 지연 0.1s 조건에서 무피격 클리어(tests/game, 리드 담당).

## 19. Endless / Daily
- 엔드리스: 청크마다 theme 0..2와 variant를 순환(달 테마 제외 → 중력 고정).
- 오늘의 도전: seed로 chapter(→ theme/variant) 선택, 난이도 d ≈ 0.55.

## 20. Visual variants (렌더러)
night(어두운 하늘·별·가로등 불빛), autumn(주황·빨강 나무, 떨어지는 낙엽), rain(빗줄기, 젖은 반사, 어두운 구름),
eclipse(가려진 태양/지구 코로나, 붉은 틴트), rainbow(파스텔 하늘, 큰 무지개 아치, 반짝이). 테마별 사전 렌더 캐시 키에 variant 포함.

## 21. UI
스테이지 선택: 10개 챕터 탭(가로 스크롤 칩), 챕터 카드는 테마+variant 그라데이션, 노드 10개 경로.
bonus 노드 = 선물상자 아이콘·골드, boss 노드 = 왕관·큰 원. 전체 별 /300. HUD 제목 "7-3 이름".
