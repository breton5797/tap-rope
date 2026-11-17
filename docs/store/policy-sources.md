# 정책 출처 — 확인 날짜 2026-11-18

`listing.md`, `questionnaires.md`, `release-checklist.md`, `public-office/privacy.html`이 기댄 공식 문서 목록이에요.
확인 방법: 웹 검색(WebSearch, standard 모드)의 결과 요약과 공식 페이지 제목·URL. **WebFetch로 원문 전체를 열지 않았어요**(작업 규칙).
그래서 문항 문구·표의 세부 항목은 제출 직전에 각 페이지에서 다시 확인해야 해요. "2차"는 공식이 아닌 보조 출처예요.

## Apple

| # | 문서 | URL | 쓴 곳 / 확인한 내용 |
|---|---|---|---|
| S1 | App Store Connect 도움말 — Age ratings (values and definitions) | https://developer.apple.com/help/app-store-connect/reference/age-ratings | 연령 설문 문항 구역(앱 내 제어·기능·광고 등), 4+/9+/13+/16+/18+ |
| S2 | Apple Developer News — Updated age ratings in App Store Connect | https://developer.apple.com/news/?id=ks775ehf | 2025 개편, 새 문항 미응답 시 2026-01-31 이후 업데이트 제출 차단 |
| S3 | App Store Connect 도움말 — 앱 연령 등급 설정 (한국어) | https://developer.apple.com/kr/help/app-store-connect/manage-app-information/set-an-app-age-rating/ | 설문 입력 위치(앱 정보), 지역별 등급 |
| S4 | Apple Developer News — Updates to age ratings for the Republic of Korea / Upcoming regional age ratings in Australia and South Korea | https://developer.apple.com/news/?id=oj3r9pvw · https://developer.apple.com/news/?id=7byvco78 | GRAC 등급분류번호로 한국 등급 덮어쓰기(2026-08-12~), 드문 비속어·암시적 주제 12+ 상향(2026-10 예정, 적용 여부 미확인) |
| S12′ | App privacy details on the App Store (개발자 안내) | https://developer.apple.com/support/app-privacy-on-the-app-store | 개인정보 라벨 신고 의무, 제3자 SDK 포함 |
| S13 | Apple 지원 — About privacy information on the App Store | https://support.apple.com/102399 | "추적" 정의(다른 회사 데이터와 연결해 광고에 쓰거나 데이터 브로커와 공유) |
| S14 | Apple Developer News — Tax and price updates (한국 세금·가격 변경) | https://developer.apple.com/news?id=y3w8ck7j · https://developer.apple.com/kr/news/?id=3g0zsfvn | 2026-05-28 한국 가격 자동 조정 (₩3,300 가격 포인트 존재 여부는 **미확인**, 콘솔에서 확인) |
| S15 | Complying with Encryption Export Regulations | https://developer.apple.com/documentation/security/complying-with-encryption-export-regulations | OS 제공 HTTPS(URLSession 등)는 문서 제출 면제, `ITSAppUsesNonExemptEncryption` |
| S16 | App Review Guidelines (1.3 Kids Category, 3.1.1 IAP, 4.2 Minimum Functionality, 5.1.4 Kids) | https://developer.apple.com/app-store/review/guidelines/ | 1.3 "Apps in the Kids Category should not include third-party analytics or third-party advertising"(제한적 예외), 기기 정보 제3자 전송 금지; 4.2 "repackaged website" 이상 요구; 5.1.4 아동 개인정보 법 준수 |
| S17 | Apple Developer News — Updates to the App Store Review Guidelines (2019-06) / App Updates in the Kids Category (2020-01) / Design safe and age-appropriate experiences | https://developer.apple.com/news/?id=06032019j · https://developer.apple.com/news/?id=01212020b · https://developer.apple.com/kids/ | 키즈 카테고리 광고·분석 제한 도입 경위, 보호자 확인(parental gate) 요구 |
| S21 | App Store Connect 도움말 — Screenshot specifications | https://developer.apple.com/help/app-store-connect/reference/screenshot-specifications/ | iPhone 6.9" 1320×2868(세로), 1~10장, jpeg/png; 작은 크기는 자동 축소. iPad 13" 2064×2752 / 2048×2732는 2차 출처 다수가 같은 값 — 이 페이지에서 재확인 |
| — | Apple 개인정보 처리방침 (한국) | https://www.apple.com/kr/legal/privacy/ | privacy.html 결제 섹션 링크 (알려진 공식 URL, 이번 검색으로 내용 확인은 안 함) |

## Google Play

| # | 문서 | URL | 쓴 곳 / 확인한 내용 |
|---|---|---|---|
| S5 | Play Console 도움말 — Families policies (Designing apps for children and families) | https://support.google.com/googleplay/android-developer/answer/9893335 | 아동 포함 대상이면 인증 광고 SDK만, 맞춤형 광고 금지, 혼합 대상의 중립적 나이 확인, 광고 형식 요건 |
| S6 | Families Self-Certified Ads SDK Program / 인증 SDK 목록 | https://support.google.com/googleplay/android-developer/answer/12918983 · https://support.google.com/googleplay/android-developer/answer/12955712 | Google AdMob(play-services-ads) 인증 목록 포함 (현재 목록 재확인) |
| S7 | AdMob 도움말 — Comply with Google Play's Families Policy using AdMob | https://support.google.com/admob/answer/6223431 | 아동 대상 처리 시 광고 ID 미전송(GMA SDK 20.6.0+), 비인증 광고 소스 차단, 미디에이션 제한 |
| S8 | Play Console 도움말 — Manage target audience and app content settings | https://support.google.com/googleplay/android-developer/answer/9867159 | 대상 연령 선택, 21세 미만 포함 시 현지법상 아동 여부 고려 |
| S9 | Target API level requirements | https://developer.android.com/google/play/requirements/target-sdk · https://support.google.com/googleplay/android-developer/answer/11926878 | 2026-08-31부터 신규·업데이트 API 36(Android 16) 이상 |
| S10 | Play Console 도움말 — Content ratings (IARC) | https://support.google.com/googleplay/android-developer/answer/9898843 | 앱 콘텐츠 › 콘텐츠 등급 설문 절차, 허위 응답 시 삭제 |
| S11 | AdMob — Google Play data disclosure (Android) | https://developers.google.com/admob/android/privacy/play-data-disclosure | SDK 자동 수집: IP 주소, 사용자 상호작용, 진단, 기기 식별자 / TLS 암호화 / 광고 ID는 선택 (데이터 유형 표 전체는 **입력 직전 재확인**) |
| S22 | Play Console 도움말 — Add preview assets to showcase your app | https://support.google.com/googleplay/android-developer/answer/9866151 | 그래픽 이미지 1024×500 필수, 스크린샷 320~3,840px·2:1 이내, 기기 유형별 최대 8장 |
| — | Requirements for distributing apps in specific countries/regions | https://support.google.com/googleplay/android-developer/answer/6223646 | 국가별 추가 요건 (한국 출시 시 참고) |

## Google AdMob · Google 정책

| # | 문서 | URL | 쓴 곳 / 확인한 내용 |
|---|---|---|---|
| S12 | AdMob — App Store data disclosure (iOS) | https://developers.google.com/admob/ios/privacy/data-disclosure | Apple 개인정보 라벨용 SDK 수집 항목(7.68.0 기준 설명), SDK 11.2.0+ 개인정보 매니페스트 포함 (표 세부 **재확인**) |
| S18 | AdMob 도움말 — Set up an app-ads.txt file / Troubleshoot app-ads.txt | https://support.google.com/admob/answer/9363762 · https://support.google.com/admob/answer/9776740 | 개발자 웹사이트 도메인 루트에 게시, Play "웹사이트"·iOS "마케팅 URL"과 같은 도메인, 하위 도메인 1단계까지만 탐색 |
| S19 | AdMob Targeting (Android / iOS) | https://developers.google.com/admob/android/targeting · https://developers.google.com/admob/ios/targeting | 아동 대상 태그(TFCD)는 **폐지 예정(deprecated)**, 새 설정은 `setAgeRestrictedTreatment()` / `ageRestrictedTreatment` (값 child가 TFCD와 같은 효과) — 개발팀 확인 필요 |
| S19′ | AdMob 도움말 — Tag an ad request for EEA, UK, Switzerland users | https://support.google.com/admob/answer/9009425 | TFAT "child" = TFCD/TFUA와 동등, 맞춤형·리마케팅·제3자 광고 업체 요청 비활성 |
| — | How Google uses information from sites or apps that use our services | https://policies.google.com/technologies/partner-sites | privacy.html 광고 섹션 링크: 파트너 앱이 보내는 정보(IP 등)와 용도(광고 측정·사기 방지 등) |
| — | Google 개인정보처리방침 / 개인정보 문의 양식 | https://policies.google.com/privacy · https://support.google.com/policies/contact/general_privacy_form | privacy.html 링크 (알려진 공식 URL) |

## 한국 기관 (privacy.html 권리 구제 안내)

| 문서 | URL | 내용 |
|---|---|---|
| 개인정보보호위원회 안내(분쟁조정) | https://www.pipc.go.kr/np/default/page.do?mCode=D030050000 | 개인정보분쟁조정위원회 1833-6972 |
| 개인정보 포털 | https://www.privacy.go.kr/front/contents/cntntsView.do?contsNo=50 | 개인정보침해신고센터 국번 없이 118 (KISA) |

## 6. 영어 이름 중복 검색 (2026-11-18, 상표 판단 아님)

| 검색어 | 주요 결과 |
|---|---|
| "Office Escape" game app store | https://apps.apple.com/app/id1511899837 (Computer Office Escape) · https://apps.apple.com/us/app/-/id1393795721 (Escape Plan - Office Escape) · https://apps.apple.com/us/app/id1297892395 (Office Building Escape) · https://apps.apple.com/id/app/id6478402780 (Night Office Escape) · https://apps.apple.com/app/id6741680834 (Escape Game Leaving Office) |
| "Clock Out" runner game | https://apps.apple.com/us/app/clock-out/id1570676915 (Clock Out!! — 아케이드 격투) · https://playgama.com/game/clock-out (Clock Out! — 상사에게 잡히기 전에 날아가는 웹 게임) · 시간 기록 앱 다수 |
| "Clock-Out Dash" / "Clock Out Dash" | 같은 제목 없음. 비슷한 단어: https://infigme.itch.io/clocking-out (Clocking Out) · https://deadlinedash.itch.io/deadline-dash (Deadline Dash) |

## 보조(2차) 출처 — 공식 문서와 대조용으로만 사용

- 스크린샷 규격 정리: https://studio.adalo.com/blog/app-store-screenshot-sizes-2026 · https://appradar.com/blog/android-app-screenshot-sizes-and-guidelines-for-google-play
- Apple 연령 등급 개편 보도: https://9to5mac.com/2025/07/24/apple-notifies-developers-of-new-app-store-age-rating-system/
- Apple 4.2 웹 래퍼 해설: https://www.mobiloud.com/blog/app-store-review-guidelines-webview-wrapper
- 한국 App Store 가격 등급(2022) 기사: https://www.asiae.co.kr/en/article/2022092015540911428
