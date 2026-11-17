# 칼퇴근 대작전 — 수익 모델 + 스토어 출시 설계

작성 2026-11-18 · 브랜치 `feat/office-monetization-store` · 기준 main `e791d1b`
지침: `../../AD_MONETIZATION.md`(0장 우선), `GAME_PSYCHOLOGY.md` P1~P7, `.claude/rules/store-policy.md`

## 0. 결정 (대표님 2026-11-18)

| 항목 | 결정 |
|---|---|
| 수익 구성 | 보상형 광고 + 확정형 1회 구매 "칼퇴 패스" (광고 없이 보상 받기). **전면형·배너 없음** |
| 대상 연령 | 전 연령 가족 유지 (P4) → 아동 대상 광고 설정, ATT 요청 없음, 결제 유도 팝업 없음 |
| Google Play | 법인 계정 있음 → 비공개 테스트 12명 요건 없음, 내부 테스트 → 프로덕션 심사 |
| AdMob | 계정 없음 → Google 공개 **테스트 광고 ID**로 구현·검증, 운영 ID는 출시 직전에 대표님이 입력 |
| 웹(Pages) | 광고·결제 없음 그대로 (H5 광고 네트워크 선정은 승인 게이트 — 이번 범위 밖) |

## 1. 광고 지면 표

| 지면 | 포맷 | 조건 | 보상 | 상한 (원격 설정 기본값) |
|---|---|---|---|---|
| 오늘의 미션 결과 화면 | 보상형 (선택) | 오늘 미션 클리어 후, 그날 1회 | 그날 미션 포인트 한 번 더 (+85 ₵) | 1회/일 |
| 스테이지 클리어 결과 화면 | 보상형 (선택) | 캠페인 스테이지 클리어 후, 신규 유예 180 s 이후 | +30 ₵ | `rewarded_daily_limit` 5회/일 |

- 버튼 문구는 보상과 조건을 먼저 보여 준다: "광고 보고 +30 ₵ (오늘 3/5)". 누르지 않아도 손해 없음 — 기존 보상은 그대로.
- 보상은 AdMob **정식 보상 콜백**(`RewardAdPluginEvents.Rewarded` / `showRewardVideoAd` resolve)에서만, 라이브 장부 `pay()`의
  고유 키(`ad:daily:<날짜>`, `ad:stage:<날짜>:<n>`)로 1회만 지급. 닫힘 이벤트로 지급하지 않는다.
- 광고가 없거나(미충족·오프라인·동의 거부 후 요청 불가) 실패하면 버튼은 "지금은 광고가 없어요"로 비활성, 게임은 정상.
- 전역 노출 잠금: 동시에 한 광고만, 표시 중 입력·음악 정지 후 복귀.
- 경제 영향(추정): 하루 최대 +235 ₵ → 복지몰 아이템 획득 주기가 2~3일 → 약 1~2일. 가족 루틴을 깨지 않도록 상한은 원격 설정.

## 2. 칼퇴 패스 (확정형 비소모성 구매, P1 준수)

- 내용(설명 문구와 1:1): ① 위 두 보상을 **광고 시청 없이** 바로 받기(같은 상한) ② 패스 전용 꾸미기 1종(트레일 "정시 퇴근 별빛").
- 가격 제안 ₩3,300 (스토어 가격 등급에서 대표님 확정). 무작위 요소·한정 판매·카운트다운 없음 (P4: CD6·CD8 미사용).
- 노출 위치: 설정 화면과 복지몰 하단의 차분한 카드 1개. 결과 화면·실패 화면에 구매 유도 없음.
- 구매 복원 버튼(애플 필수), 결제는 StoreKit 2 / Play Billing 7 (`@capgo/native-purchases`), 비소모성 `kaltoe.pass`.
- 권한은 로컬 저장 + 실행 시 스토어 영수증(`getPurchases`)으로 재확인. 서버 검증은 보상 가치가 낮아(꾸미기·포인트) 이번엔 생략.

## 3. 구조 (원문 5장, 게임 코드는 광고 SDK를 직접 부르지 않음)

```
src/office/monetization/
  config.ts      MonetizationConfig: 기본값 + 범위 검증 + 원격 JSON(./monetization.json, Pages) 실패 시 기본값, ads_enabled 긴급 중지
  policy.ts      AdPolicy: 동의·패스·유예·일일 상한·전역 잠금 → allow/deny(이유)       (순수 함수, TDD)
  rewards.ts     RewardService: 정식 콜백 → pay() 고유 키, 중복 콜백 무시              (순수, TDD)
  ad-service.ts  상태기계 idle→loading→ready→showing→closed/failed, 제한 재시도(최대 2회, 지수 대기)
  adapters/test.ts    TestAdAdapter (웹 dev·vitest·e2e: 즉시 보상/실패/미충족 시나리오)
  adapters/admob.ts   AdMob 어댑터 (앱 빌드만, 동적 import)
  purchases.ts   PassService + adapters (test / native-purchases)
  haptics.ts     Capacitor Haptics (보상·클리어 피드백, iOS 4.2 네이티브 요소)
```
- 빌드 분기: `office-app` 모드에서만 AdMob·결제 어댑터가 번들에 들어감(`swapModules` 패턴). 웹 office·v8 번들에는 0 바이트.
- 원격 설정 키: 원문 6장 + 0.4 기본값 — `ads_enabled true`, `rewarded_enabled true`, `interstitial_enabled false`(가족),
  `new_user_ad_grace_seconds 180`, `rewarded_daily_limit 5`, `stage_reward_points 30`. 형식·범위 밖 값은 기본값.
- 측정: 분석 SDK를 새로 넣지 않는다(P5, 오프라인 우선). 노출·수익은 AdMob 콘솔, 구매는 각 스토어 콘솔. 앱 안 이벤트 계측은
  다음 단계 과제로 남기고 보고서에 "미계측"으로 명시. 성과 수치는 데이터 전까지 모두 추정치.

## 4. 동의·아동 보호

- 모든 광고 요청에 `tagForChildDirectedTreatment: true`, `maxAdContentRating: 'G'`, 비맞춤형. iOS ATT 요청·IDFA 사용 안 함
  (`NSUserTrackingUsageDescription` 넣지 않음).
- UMP: 실행 시 `requestConsentInfo` → 필요하면 폼 → `canRequestAds`일 때만 광고 요청. 설정에 "광고 개인정보 설정" 다시 열기.
- 개인정보처리방침(`public-office/privacy.html`) 갱신: AdMob(광고 식별 정보, 비맞춤형), 스토어 결제 정보 처리 위탁 고지.

## 5. 네이티브·스토어 준비

- Android 플랫폼 추가(`@capacitor/android` 8), applicationId `com.heesookyang.taprope`, 업로드 키는 저장소 밖에서 생성·보관
  (대표님 백업), AAB, targetSdk 최신 요건 확인.
- iOS: `GADApplicationIdentifier`(테스트 ID → 운영 ID), SKAdNetworkItems, 결제 capability, 버전 2.1 (3).
- 스토어 자료(ko·en): 이름·짧은 설명·설명(타 게임명·과장 금지), 스크린샷(iPhone 6.9"·iPad 13"·Android 폰), 연령 등급 설문 답안,
  구글 데이터 보안 / 애플 개인정보 라벨 답안, 광고 포함·인앱결제 표기. 확인한 공식 정책 링크와 날짜는 릴리스 리포트에 기록.
- app-ads.txt: 스토어 등록 "개발자 웹사이트" 도메인 루트에 필요 → `breton5797.github.io` 루트(별도 저장소) 또는 회사 도메인. 대표님 결정.

## 6. 검증

- TDD 단위 테스트: policy(유예·상한·잠금·동의·패스·긴급 중지), rewards(중복 콜백·다른 날짜·재시작), config(형식 오류·범위), ad-service 상태기계.
- e2e(TestAdAdapter): 보상 버튼 → 1회 지급, 상한 도달, 실패·미충족 시 정상 진행, 패스 보유 시 광고 없이 지급, 웹 번들에 광고 코드 없음.
- 기기: iPad(연결됨)·iPhone 13 mini·Android 에뮬레이터에서 **테스트 광고** 실제 표시·보상, 샌드박스 구매·복원.
- 리뷰: 코드 리뷰 + 보안 리뷰(결제·보상) 통과까지.

## 7. 대표님 수동 작업 (사람 게이트 — 제가 대신하지 않음)

1. AdMob 계정 → 앱 2개(iOS·Android) 등록 → 보상형 광고 단위 2개×2 → ID 전달, UMP 동의 메시지 게시, 앱 "아동 대상" 설정
2. App Store Connect: 인앱 구매 `kaltoe.pass` 생성·가격, 유료 앱 계약·세금·은행, 개인정보 라벨 입력, 심사 제출
3. Play Console: 앱 생성, 인앱 상품 `kaltoe.pass`, 결제 프로필, 대상 연령·콘텐츠 등급·데이터 보안 입력, 내부 테스트 → 프로덕션 심사 제출
4. app-ads.txt 게시 도메인 결정
