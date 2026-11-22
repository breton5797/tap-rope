# 스토어 등록 문구 — 칼퇴근 대작전 (ko · en)

작성 2026-11-18 · 근거 설계: `docs/superpowers/specs/2026-11-18-office-monetization-store-design.md`
글자 수는 `python3 gen_listing.py`(작업 임시 폴더)로 셌어요. 스토어 콘솔은 유니코드 글자 수로 세지만, iOS 키워드는 바이트 기준이라는 보고도 있어 UTF-8 바이트도 함께 적었어요(콘솔이 거부하면 키워드 끝부터 줄이기).

## 0. 원칙 점검

- 다른 게임 이름, 순위·"최고"·보장성 문구 없음 (스크립트가 금지어 검사: 1위, 최고의, No.1, #1, best, guarantee, 보장).
- 광고(보상형, 선택)와 인앱 구매(칼퇴 패스, 비소모성)를 설명에 그대로 밝힘. 패스 내용은 현재 빌드 문구(`src/office/monetization/copy.ts` passPerks, 전용 꾸미기 `stamp-pass` "칼퇴 패스 도장")와 맞춤 — 설계서의 트레일 "정시 퇴근 별빛"에서 바뀌었으므로 최종 빌드와 다시 대조. 패스는 "광고 제거"가 아니라 "광고 없이 같은 보상 받기 + 꾸미기 1종"이라 그렇게만 씀.
- 무작위 요소 없음, 기간 한정·카운트다운 문구 없음 (P1·P4).
- 앱 화면은 현재 **한국어 전용** → 영어 설명에 "Korean only"를 명시. 영어 스토어 등록 여부는 대표님 결정(아래 6장).
- 설명의 "문의" 줄은 스토어의 지원 URL·이메일 칸을 가리킴. 개인 이메일을 설명 본문에 넣지 않음.

## 1. 글자 수 확인 결과

### 한국어
| 항목 | 글자 수 | UTF-8 바이트 | 한도 | 결과 |
|---|---:|---:|---:|---|
| 앱 이름 (iOS 이름 / Play 앱 이름) | 7 | 19 | 30 | OK |
| 부제 (iOS) | 18 | 42 | 30 | OK |
| 간단한 설명 (Play) | 61 | 143 | 80 | OK |
| 키워드 (iOS, 쉼표 구분·공백 없음) | 61 | 151 | 100 | OK |
| 프로모션 텍스트 (iOS) | 71 | 161 | 170 | OK |
| 새로운 기능 / 업데이트 내용 | 132 | 288 | 4000 | OK |
| 전체 설명 (iOS 설명 / Play 자세한 설명) | 935 | 2152 | 4000 | OK |

### English
| 항목 | 글자 수 | UTF-8 바이트 | 한도 | 결과 |
|---|---:|---:|---:|---|
| 앱 이름 (iOS 이름 / Play 앱 이름) | 29 | 29 | 30 | OK |
| 부제 (iOS) | 30 | 30 | 30 | OK |
| 간단한 설명 (Play) | 77 | 77 | 80 | OK |
| 키워드 (iOS, 쉼표 구분·공백 없음) | 94 | 94 | 100 | OK |
| 프로모션 텍스트 (iOS) | 128 | 128 | 170 | OK |
| 새로운 기능 / 업데이트 내용 | 228 | 228 | 4000 | OK |
| 전체 설명 (iOS 설명 / Play 자세한 설명) | 1772 | 1772 | 4000 | OK |

## 2. 한국어 (ko-KR · 기본 언어)

#### 앱 이름 (iOS 이름 / Play 앱 이름) (≤30)

```text
칼퇴근 대작전
```

#### 부제 (iOS) (≤30)

```text
상사를 피해 6시 정각 퇴근 러너
```

#### 간단한 설명 (Play) (≤80)

```text
6시 땡! 상사들의 '잠깐만' 공격을 피해 퇴근길을 달리는 코믹 러너. 로그인 없이 오프라인으로 바로 플레이.
```

#### 키워드 (iOS, 쉼표 구분·공백 없음) (≤100)

```text
러너,달리기,퇴근,칼퇴,직장인,회사원,상사,야근,점프,피하기,캐주얼,가족,오프라인,한손,짧은게임,코믹,아케이드
```

#### 프로모션 텍스트 (iOS) (≤170)

```text
상사의 "잠깐만, 이것 좀…"을 피해 6시 정각에 퇴근! 오늘의 칼퇴 미션과 주간 출근 카드로 하루 1분, 가볍게 달려 보세요.
```

#### 새로운 기능 / 업데이트 내용 (≤4000)

```text
칼퇴근 대작전 앱 첫 출시!
· 1부 사무실 탈출 + 2부 퇴근길 탈출, 모두 10단계
· 오늘의 칼퇴 미션과 주간 출근 카드
· 사원 복지몰 꾸미기 (정해진 가격, 뽑기 없음)
· 원할 때만 보는 보상형 광고와 1회 구매 "칼퇴 패스"
```

#### 전체 설명 (iOS 설명 / Play 자세한 설명) (≤4000)

```text
퇴근 시간 6시. 그런데 상사들이 자꾸 붙잡아요!
신입 사원이 되어 "잠깐만, 이것 좀…" 공격을 피하고 제시간에 퇴근해 보세요.

■ 이런 게임이에요
· 왼손은 줄 바꾸기, 오른손은 점프·숙이기. 짧고 쉬운 조작
· 1부 "사무실 탈출"과 2부 "퇴근길 탈출", 모두 10단계
· 단계마다 다른 상사와 대사: 결재 서류, 회식 권유, 퇴근 직전 설문지…
· 성격과 능력치가 다른 신입 사원 4명 중 한 명을 골라 달리기
· 새 동작은 단계를 따라 하나씩 배우고, 아직 배우지 않은 동작은 나오지 않아요

■ 매일·매주 즐길거리
· 오늘의 칼퇴 미션: 날마다 바뀌는 1분 남짓한 짧은 코스
· 주간 출근 카드: 미션을 깬 날마다 도장 한 개. 빠진 날이 있어도 잃는 것은 없어요
· 사원 복지몰: 모은 칼퇴 포인트로 꾸미기 아이템을 정해진 가격에 교환해요. 뽑기는 없어요

■ 마음 편한 플레이
· 인터넷 없이도 플레이할 수 있어요 (광고를 볼 때만 인터넷이 필요해요)
· 회원가입·로그인이 없어요. 진행 기록은 기기에만 저장돼요
· 온 가족이 함께 즐기도록 만들었어요

■ 광고와 인앱 구매 안내
· 보상형 광고가 있어요. 스테이지 클리어나 오늘의 미션 결과 화면에서 원할 때만 버튼을 눌러 보고, 칼퇴 포인트를 더 받아요. 보지 않아도 기본 보상은 그대로이고, 하루 횟수 제한이 있어요.
· 저절로 뜨는 광고(전면 광고·배너)는 없어요.
· 광고는 아동 대상 설정으로 요청하며, 관심 기반 맞춤형 광고는 요청하지 않아요.
· 인앱 구매 "칼퇴 패스" (1회 구매, 영구 적용)
  ① 광고를 보지 않고도 같은 보상을 같은 하루 횟수 안에서 바로 받기
  ② 패스 전용 도장 꾸미기 "칼퇴 패스 도장" 1종
  무작위 아이템은 없어요. 사원 복지몰의 칼퇴 패스 카드에서 구매를 복원할 수 있어요.

■ 안내
· 게임 화면은 현재 한국어로 제공돼요.
· 문의: 개발자 이메일로 보내 주세요.
```

#### 키워드 대체안 (콘솔이 바이트로 세어 거부할 때, 32자 · 78바이트)

```text
러너,퇴근,칼퇴,직장인,상사,야근,점프,피하기,캐주얼,가족
```

## 3. English (en-US)

#### 앱 이름 (iOS 이름 / Play 앱 이름) (≤30)

```text
Clock-Out Dash: Office Runner
```

#### 부제 (iOS) (≤30)

```text
Dodge the bosses, leave at six
```

#### 간단한 설명 (Play) (≤80)

```text
It's six! Dodge your bosses' "Got a minute?" and run home. Offline, no login.
```

#### 키워드 (iOS, 쉼표 구분·공백 없음) (≤100)

```text
runner,office,boss,dodge,jump,lane,casual,family,offline,arcade,commute,work,quick,daily,funny
```

#### 프로모션 텍스트 (iOS) (≤170)

```text
Dodge every "Got a minute?" and leave right at six! A one-minute daily mission and a weekly attendance card keep each day fresh.
```

#### 새로운 기능 / 업데이트 내용 (≤4000)

```text
First app release!
- Part 1 Office Escape + Part 2 Way Home: 10 stages
- Daily mission and weekly attendance card
- Staff shop cosmetics at fixed prices (no random draws)
- Optional rewarded ads and the one-time "Clock-Out Pass"
```

#### 전체 설명 (iOS 설명 / Play 자세한 설명) (≤4000)

```text
It's six o'clock, but your bosses keep stopping you!
Play as a new hire, dodge every "Got a minute?" and make it out on time.

HOW IT PLAYS
- Left thumb switches lanes, right thumb jumps and ducks. Short, simple controls
- Part 1 "Office Escape" and Part 2 "Way Home": 10 stages in all
- A different boss with their own lines in every stage: approval forms, after-work dinner invitations, a last-minute survey...
- Pick one of four new hires, each with a different personality and stats
- New moves are taught one at a time; you never face a move you haven't learned

EVERY DAY, EVERY WEEK
- Daily mission: a short course of about a minute that changes every day
- Weekly attendance card: one stamp for each day you clear the mission. Missing a day costs you nothing
- Staff shop: trade the points you earn for cosmetics at fixed prices. No random draws

RELAXED PLAY
- Plays without an internet connection (watching an ad needs one)
- No sign-up and no login. Progress is saved only on your device
- Made for the whole family

ADS AND IN-APP PURCHASE
- Contains rewarded ads. On the stage-clear or daily-mission result screen you can choose to watch one for extra points. Skipping it never reduces your normal reward, and there is a daily limit.
- No ads appear on their own (no interstitials, no banners).
- Ads are requested as child-directed and never as interest-based (personalized) ads.
- In-app purchase "Clock-Out Pass" (one-time, permanent)
  1. Get the same ad rewards instantly without watching ads, within the same daily limit
  2. One pass-only cosmetic stamp, "Clock-Out Pass Stamp"
  No random items. You can restore the purchase from the Clock-Out Pass card in the staff shop.

PLEASE NOTE
- The game is currently available in Korean only.
- Questions: please contact the developer email.
```

## 4. 카테고리

| 스토어 | 제안 | 이유 |
|---|---|---|
| App Store | 기본: 게임 › **액션**, 보조: 게임 › **캐주얼** | 3레인 러너(회피·점프)는 액션, 짧은 세션·쉬운 조작은 캐주얼. "가족" 하위 카테고리도 가능하지만 키즈 카테고리와는 별개(키즈 카테고리는 넣지 않음 — questionnaires.md 9장) |
| Google Play | 앱 유형 게임 › 카테고리 **아케이드** | Play에는 러너가 주로 아케이드에 등록됨. 태그(최대 5개): 러너, 캐주얼, 오프라인, 싱글 플레이어, 스타일: 만화 |

## 5. 기타 등록 칸

| 칸 | 값 / 할 일 |
|---|---|
| 개인정보처리방침 URL | `https://breton5797.github.io/tap-rope/office/privacy.html` (이번에 앱 섹션 추가) |
| 지원 URL (iOS 필수) | 같은 사이트의 문의 안내 페이지 또는 privacy.html 1장(연락처) — 대표님 결정 |
| 마케팅 URL (iOS) / 웹사이트 (Play) | `https://breton5797.github.io/tap-rope/office/` (app-ads.txt가 있는 `breton5797.github.io` 도메인) |
| 저작권 (iOS) | `2026 <개발자 법인명>` — 대표님 입력 |
| 인앱 구매 표시 이름 | ko "칼퇴 패스" / en "Clock-Out Pass" |
| 인앱 구매 설명 (≤45자 권장) | ko "광고 없이 같은 보상 받기 + 전용 도장 1종" / en "Ad rewards without ads + 1 exclusive stamp" |

## 6. 영어 이름 — "Clock-Out Dash: Office Runner" 확정 (2026-11-18, 상표 검색은 출시 전 별도)

2026-11-18 웹 검색 결과 (근거 링크는 `policy-sources.md` 6장):

| 후보 | 검색 결과 | 의견 |
|---|---|---|
| Office Escape | App Store에 "Computer Office Escape", "Escape Plan - Office Escape", "Office Building Escape", "Night Office Escape" 등 **방탈출 장르** 앱이 다수 | 겹치는 이름이 많고, 방탈출 게임으로 오해받기 쉬워 **비추천** |
| Clock Out! / Clock Out | "Clock Out!!"(iOS 아케이드 격투), "Clock Out!"(웹 게임, 상사에게 잡히기 전에 날아가는 게임), 시간 기록 앱 다수 | 주제가 비슷한 게임이 이미 있어 **비추천** |
| **Clock-Out Dash** (+ ": Office Runner") | 같은 제목의 앱·게임 검색 결과 없음 (itch.io에 "Clocking Out", "Deadline Dash" 등 비슷한 단어 조합만 있음) | **추천안**. 장르(러너)가 이름에 드러나고 30자 안 (29자) |
| Six O'Clock Dash | 같은 제목 검색 안 함(예비안) | 예비안 |

- 위는 앱 이름 중복 검색일 뿐이고 상표 판단이 아니에요. 출시 전 KIPRIS·USPTO 상표 검색과 `studio/reports/naming/` 기록이 필요해요(licensing 규칙).
- 앱 화면이 한국어뿐이라, 영어 등록을 하지 않고 **한국어만 등록**하는 선택지도 있어요. 영어 등록 시 설명에 한국어 전용임을 반드시 남겨 주세요.
