# App Review 대응 — 칼퇴근 대작전 iOS 2.1 (3)

- 제출: 2026-11-19 14:44 KST (제출 ID 5f9d86f1-2b85-4944-8641-37ec78c34c8a)
- 결과: 2026-11-20 08:28 KST **Guideline 2.1 - Information Needed - New App Submission** (심사를 통과하지 못함)
- 인앱 구매 `kaltoe.pass`: "심사 준비됨" (앱 버전과 함께 재제출하면 됨)

## 원인

버그·충돌·정책 위반 지적이 **아님**. 신규 앱이라 Apple이 앱을 이해하기 위한 **추가 정보**를 요구했다.
기존 심사 메모에는 광고·인앱 구매 위치만 있고, Apple이 요구한 6개 항목 중
① 실기기 화면 녹화 ② 앱 목적·대상 ③ 사용 방법 ④ 외부 서비스 목록 ⑤ 지역별 차이 ⑥ 규제 문서 가 빠져 있었다.

## 해결 방법

1. 대표님: 아래 "녹화 가이드"대로 **최신 iOS 실기기(iPhone)** 에서 화면 녹화 1개 (2~4분).
   - 현재 연결된 iPad Pro 10.5(iPad7,3)는 iOS 17.7이 최종 지원 버전이라 "latest operating system" 조건을 못 채움 → iOS 26 iPhone 사용.
   - 앱은 TestFlight로 **심사에 낸 빌드 2.1 (3)** 을 설치(운영 AdMob 빌드). 구매는 샌드박스 계정으로 결제 시트까지 보여 주면 됨.
2. 녹화 파일을 ASC 제출 화면의 **"앱 심사에 회신"** 에 첨부하고, 아래 영문 메모를 회신 본문 + **앱 심사 정보 › 메모** 칸에 붙여 넣는다.
3. 버전 페이지에서 **"앱 심사에 다시 제출"** (2.1 (3) + kaltoe.pass 그대로, 새 빌드 불필요).

## 녹화 가이드 (순서대로, 끊지 말고 한 번에)

> 2026-11-23부터 자동: `docs/store/review-scenario.json` + studio-harness `tools/app-review/review-video.ts`가 아래 흐름을 실기기에서 녹화한다.

1. 홈 화면에서 앱 아이콘을 눌러 **실행하는 장면부터** 시작 (제어 센터 › 화면 기록, 마이크 끔).
2. 첫 실행 → 타이틀 → 지도 → **1단계** 시작, 탭(점프)·아래로 스와이프(슬라이드)로 스테이지 한 판 클리어.
3. 결과 화면(도장·점수) → 지도 → 다른 스테이지 하나 잠깐 플레이 (실패해도 됨, 재시도 장면 포함).
4. 타이틀의 **오늘의 미션** 진입해 잠깐 플레이.
5. **복지몰** 열어 꾸미기 아이템 둘러보기(포인트로 교환, 무작위 없음).
6. **보상형 광고**: 결과 화면의 "광고 보고 +₵30 더 받기" → 한 번 보고 포인트가 1회 들어오는 장면. (첫 3분 유예 때문에 버튼이 안 보이면 3분 넘게 플레이 후 촬영)
   - 버튼 첫 탭 시 나오는 안내(14세 미만·Google 고지) 화면도 그대로 녹화.
7. **유료 기능**: 사원 복지몰 맨 아래 "칼퇴 패스" 카드 → 구매 버튼 → Apple 결제 시트(샌드박스) 표시 → 구매 완료. 이어서 같은 카드의 **구매 복원** 탭. (2026-11-23 코드 확인: 패스 카드는 설정이 아니라 복지몰에만 있음)
8. 설정 화면의 개인정보처리방침·이용약관 링크까지 보여 주고 종료.

(로그인·계정 생성·사용자 생성 콘텐츠가 없으므로 계정 삭제·신고/차단 흐름은 녹화 대상 아님 — 메모에 명시.)

## 영문 메모 (App Review 회신 + 앱 심사 정보 › 메모에 붙여 넣기)

```text
Thank you for the review. Here is the requested information.

1. Screen recording
Attached: a screen recording captured on a physical iPhone running the latest iOS. It starts with launching the app and shows the typical flow: playing and clearing stages, the daily mission, the cosmetic shop, an optional rewarded ad, and the in-app purchase "Clock-Out Pass" (kaltoe.pass) with Restore Purchases.
The app has NO account registration, NO login and NO user-generated content, so there is no account deletion or content reporting/blocking flow.

2. Purpose and target audience
"칼퇴근 대작전" (Clock-Out Dash: Office Runner) is an original, family-friendly (4+) casual runner game in Korean. Two junior office workers try to leave the office on time while dodging their bosses. Players tap to jump and swipe down to slide through 10 short stages (about 1-2 minutes each), plus a date-based daily mission and a weekly attendance card. The value is a light, humorous, short-session game anyone (kids to adults) can enjoy offline in a few minutes, without accounts or data collection.

3. How to use the main features
- No login or demo account is needed. Everything works offline from the first launch.
- Title screen > map > Stage 1. Controls: tap = jump, swipe down = slide. Clearing a stage unlocks the next one.
- Daily mission: title screen > "오늘의 미션".
- Cosmetic shop: "복지몰" (fixed-price exchange with in-game points; no random rewards, no loot boxes).
- Optional rewarded ad (Google AdMob): on a result screen tap "광고 보고 +₵30 더 받기". After the ad finishes the points are added once; closing early gives no reward. New players see no ad button during the first 3 minutes of play. There are no interstitial or banner ads.
- In-app purchase "칼퇴 패스" (Clock-Out Pass, non-consumable, kaltoe.pass): title screen > "사원 복지몰" (staff shop) > scroll to the bottom > "칼퇴 패스" card > "<price> 구매". It gives the ad rewards without watching ads (same daily limit) plus one exclusive cosmetic stamp. Restore: "구매 복원" on the same card.

4. External services used
- Google AdMob (Google Mobile Ads SDK): optional rewarded ads only, requested as child-directed, max content rating G, non-personalized. No ATT prompt, IDFA is not used.
- Apple StoreKit (In-App Purchase): the Clock-Out Pass purchase and restore.
- A static JSON file on GitHub Pages (https://breton5797.github.io/tap-rope/office/monetization.json): remote ad frequency settings (cooldown, daily cap). No personal data is sent.
No login/authentication service, no own server, no analytics SDK, no AI services, no payment processor other than Apple.

5. Regional differences
The app works the same in all available regions (all content is bundled in the app). The UI is in Korean. The app is not offered in China mainland. Prices follow the App Store price tier per region.

6. Regulated industry / third-party material
Not applicable. The app is not in a regulated industry. All characters, story, art, music and sound effects are original content created for this game; fonts are free fonts licensed for app embedding.
```
