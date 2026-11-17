# 출시 체크리스트 — 칼퇴근 대작전 앱 (대표님 수동 작업)

작성 2026-11-18 · 번들/패키지 `com.heesookyang.taprope` · 인앱 상품 `kaltoe.pass` · 근거 링크 `policy-sources.md` [S#]
사람 게이트(store_submit, ad_spend)는 대표님만 진행해요. 개발 쪽 작업은 **[개발]** 표시. 순서는 위에서 아래로.

> 정책은 자주 바뀌어요. 제출 직전 각 콘솔의 현재 화면과 공식 문서를 다시 확인하고, 확인 날짜와 링크를 릴리스 리포트에 남겨 주세요(store-policy 규칙).

---

## 0. 먼저 정할 것 (대표님 결정)

- [ ] **영어 이름**: 추천 "Clock-Out Dash: Office Runner" (listing.md 6장). 또는 한국어만 등록. 상표 검색(KIPRIS·USPTO) 후 `studio/reports/naming/`에 기록.
- [ ] **칼퇴 패스 가격**: 설계 제안 ₩3,300 → App Store 가격 포인트 확인 후 확정 (questionnaires.md 7장).
- [ ] **개발자 웹사이트 도메인** (app-ads.txt 위치): `breton5797.github.io` 루트(별도 저장소 `breton5797.github.io` 필요) 또는 회사 도메인.
- [ ] **연령 설문의 확인 필요 2칸**(폭력·알코올, questionnaires.md 1·2장): 9단계 컷신 캔·병을 음료로 바꿀지 결정.
- [ ] **이용약관 갱신 담당 지정**: `public-office/terms.html`이 아직 "유료 결제나 광고가 없어요"라고 씀 → 앱 출시 전 수정 필요(이 작업 범위 밖).

## 1. Google AdMob (광고) [S18][S19][S7]

1. [ ] AdMob 계정 생성(회사 Google 계정), 결제·세금 정보 입력. 계정 승인까지 기다림.
2. [ ] 앱 2개 추가: iOS "칼퇴근 대작전", Android "칼퇴근 대작전". 스토어 출시 전이면 "아직 스토어에 없음"으로 추가 → 출시 후 스토어 연결.
3. [ ] 앱 설정에서 **아동 대상(child-directed) 처리** 켜기 / 광고 콘텐츠 등급 **G**. 차단 설정에서 민감 카테고리(도박·데이트 등) 차단 확인.
4. [ ] 광고 단위: 플랫폼별 **보상형 2개** (오늘의 미션 / 스테이지 클리어) = 총 4개. 보상 설정은 앱이 처리하므로 콘솔 보상 값은 기본(1)이어도 무방. 서버 측 확인(SSV)은 이번 범위 밖.
5. [ ] 앱 ID 2개 + 광고 단위 ID 4개를 개발팀에 전달 → **[개발]** 운영 ID 입력은 출시 빌드에서만, 개발·자동 테스트는 계속 테스트 광고 ID.
6. [ ] **개인정보 및 메시지 › UMP 동의 메시지**: GDPR(유럽) 메시지 생성·게시 (필요 지역에서만 표시). 미국 주 법 메시지는 필요 여부 확인. iOS ATT 안내 메시지(IDFA 설명)는 **만들지 않음**(ATT 안 씀).
7. [ ] **app-ads.txt**: AdMob이 주는 한 줄(`google.com, pub-…, DIRECT, f08c47fec0942fa0`)을 개발자 웹사이트 **도메인 루트** `/app-ads.txt`에 게시 → 두 스토어 등록정보의 웹사이트(Play "웹사이트", iOS "마케팅 URL")에 같은 도메인 입력 → AdMob app-ads.txt 탭에서 확인(Play 최대 24시간, iOS는 며칠 걸릴 수 있음). `breton5797.github.io/tap-rope/` 같은 하위 경로에는 둘 수 없어요.
8. [ ] 출시 후: AdMob에서 각 앱을 스토어 앱과 연결(app-ads.txt 확인·광고 게재에 필요).
9. [ ] 테스트 기기 등록(AdMob › 설정 › 테스트 기기)으로 운영 ID에서도 실수 클릭 방지.

## 2. 개발 확인 항목 [개발] (빌드에 들어가야 심사 답안이 사실이 됨)

### 2.1 공통
- [ ] 모든 광고 요청 `tagForChildDirectedTreatment: true`, `maxAdContentRating: 'G'`, 비맞춤형 — e2e/단위 테스트로 고정.
- [ ] Google은 TFCD 태그를 **폐지 예정(deprecated)**으로 표시하고 `ageRestrictedTreatment`(iOS) / `setAgeRestrictedTreatment()`(Android) 값 `child`로 대체 안내 [S19]. 사용 중인 Capacitor AdMob 플러그인·네이티브 SDK 버전에서 어느 쪽이 실제로 적용되는지 확인.
- [ ] 보상은 정식 보상 콜백에서만 1회 지급, 닫힘 이벤트로 지급 안 함 (설계 1장).
- [ ] 구매 복원 버튼(설정 화면) 동작, 패스 설명 문구 = 스토어 설명 문구.
- [ ] 개인정보처리방침 링크를 앱 설정 화면에 노출 (두 스토어 모두 앱 안 링크 요구).

### 2.2 iOS
- [ ] `Info.plist`: `GADApplicationIdentifier`(출시 빌드는 운영 ID), `SKAdNetworkItems`(Google 목록), **`NSUserTrackingUsageDescription` 없음**.
- [ ] `Info.plist`에 `ITSAppUsesNonExemptEncryption` = `NO` 추가 (현재 없음, questionnaires.md 8장).
- [ ] 개인정보 매니페스트: 앱 `PrivacyInfo.xcprivacy`(UserDefaults 등 필수 사유 API) + SDK 매니페스트 포함 확인 — Xcode › Product › Archive 후 "Generate Privacy Report"로 확인.
- [ ] In-App Purchase capability, 버전 2.1 (빌드 번호 증가).
- [ ] iPad 지원 중(`UISupportedInterfaceOrientations~ipad`) → iPad 스크린샷 필요. 세로 고정.

### 2.3 Android
- [ ] targetSdk **36 (Android 16) 이상** — 2026-08-31부터 신규 앱·업데이트 필수 [S9].
- [ ] `AndroidManifest.xml`에 AdMob 앱 ID 메타데이터, **`com.google.android.gms.permission.AD_ID` 권한 제거**(`<uses-permission … tools:node="remove"/>`) — Families 정책 [S5][S7]. 병합된 매니페스트(`app/build/intermediates/merged_manifests`)에서 실제로 빠졌는지 확인.
- [ ] Play Billing 라이브러리 버전이 Play 현재 요구 버전 이상인지 확인.
- [ ] 업로드 키 생성·보관(저장소 밖, 대표님 백업), **Play 앱 서명** 사용, **AAB** 빌드, versionCode 증가.

## 3. App Store Connect (iOS)

1. [ ] **계약·세금·금융**: "유료 앱(Paid Apps)" 계약 동의, 세금 양식, 은행 계좌 → 상태 "활성"이어야 인앱 구매 판매 가능.
2. [ ] 앱 레코드: 이미 "칼퇴근 대작전" 레코드가 있다면 그대로 사용(번들 ID `com.heesookyang.taprope`). 기본 언어 한국어, (선택) 영어 현지화 추가.
3. [ ] **앱 정보**: 이름·부제(listing.md), 카테고리 게임 › 액션 + 캐주얼, 콘텐츠 권한(제3자 콘텐츠 없음), 연령 등급 설문(questionnaires.md 1장), **키즈 카테고리 선택 안 함**.
4. [ ] **가격 및 사용 가능 여부**: 앱 무료, 판매 국가(한국만 / 전 세계 — 앱이 한국어 전용임을 고려).
5. [ ] **앱 개인정보 보호**: 개인정보처리방침 URL, 데이터 수집 라벨(questionnaires.md 5장), 추적 "아니요".
6. [ ] **인앱 구매** › 비소모성 생성: 제품 ID `kaltoe.pass`, 참조 이름, 가격, 현지화(ko/en 표시 이름·설명), **심사용 스크린샷**(패스 카드 화면), 심사 메모 → 상태 "제출 준비 완료". 첫 인앱 구매는 앱 버전 페이지의 "인앱 구매 및 구독" 칸에서 **앱과 함께 선택해 제출**.
7. [ ] **스크린샷** (아래 5장 규격) 업로드: iPhone 6.9" 세트 + iPad 13" 세트. 앱 미리보기 영상은 선택.
8. [ ] 버전 정보: 프로모션 텍스트, 설명, 키워드, 지원 URL, 마케팅 URL(= app-ads.txt 도메인), 저작권.
9. [ ] **수출 규정 준수**: 면제 대상만 사용 (Info.plist 키를 넣었으면 질문 생략).
10. [ ] **TestFlight**: 내부 테스터로 운영 빌드 확인 — 샌드박스 계정으로 구매·복원, 테스트 광고 표시·보상.
11. [ ] **심사 정보** — 로그인 필요 없음(데모 계정 칸 비움), 연락처, 아래 "심사 메모" 붙여 넣기.
12. [ ] 심사 제출 → 승인 후 수동 출시 권장.

### 3.1 심사 메모 (App Review Notes) — 붙여 넣기용

```text
No account or login is required. All content works offline.

Rewarded ads (Google AdMob, optional):
1. Clear stage 1 ("1단계") from the map, or clear today's mission ("오늘의 미션") on the title screen.
2. On the result screen, tap "광고 보고 +₵30 더 받기" (stage) or "광고 보고 미션 포인트 +₵85 한 번 더" (daily mission) = "Watch an ad for extra points".
3. After the ad finishes, the points are added once. Closing early gives no reward and the game continues normally.
Ads are requested as child-directed, content rating G, non-personalized. The app does not use ATT or the IDFA. There are no interstitial or banner ads.
New players get no ad button for the first 3 minutes of play (grace period); please play stage 1 first.

In-app purchase "칼퇴 패스" (Clock-Out Pass, non-consumable, product ID kaltoe.pass):
- Where: Settings (설정) > "칼퇴 패스" card, or the bottom of the staff shop (복지몰).
- Content: the same rewards as the rewarded ads without watching ads (same daily limit) + one exclusive cosmetic stamp ("칼퇴 패스 도장").
- Restore: Settings > "구매 복원" (Restore Purchases).
No random rewards or loot boxes exist in the app. The app is in Korean.

Native features: haptic feedback (stage clear, rewards), StoreKit in-app purchase, AdMob rewarded ads, full offline play, local save.
```

(버튼 문구·메뉴 이름·유예 시간은 최종 빌드와 다르면 고쳐서 넣기.)

### 3.2 가이드라인 4.2(최소 기능) 반려 위험과 대응 [S16]

- 위험: 이 앱은 Capacitor로 감싼 웹 게임이고 같은 게임이 웹(GitHub Pages)에서도 돌아요. 4.2는 "다시 포장한 웹사이트 이상의 기능·콘텐츠·UI"를 요구해요.
- 앱만의 네이티브 요소 (심사 메모와 설명에 명시):
  - **햅틱**(`@capacitor/haptics`: 클리어·보상 피드백)
  - **StoreKit 2 인앱 구매**·구매 복원(`@capgo/native-purchases`)
  - **AdMob 네이티브 SDK** 보상형 광고(`@capacitor-community/admob`)
  - **완전 오프라인 동작**: 모든 그림·소리·데이터를 앱에 포함, 네트워크 없이 첫 실행부터 플레이 (웹판과 달리 서비스 워커 없음, 로그인 없음)
  - 기기 저장 진행·주간 카드·매일 미션, 세로 고정·안전 영역 대응 전체 화면 게임 UI
- 추가로 고려(선택): 게임 센터, 홈 화면 위젯 등은 이번 범위 밖.

## 4. Google Play Console (Android, 조직 계정)

1. [ ] **결제 프로필(판매자 프로필)** 생성·인증 → 인앱 상품 판매에 필요.
2. [ ] **앱 만들기**: 앱 이름, 기본 언어 한국어, 게임, 무료, 선언(개발자 정책·미국 수출법) 동의.
3. [ ] **앱 콘텐츠**(정책 › 앱 콘텐츠) — questionnaires.md 대로:
   - [ ] 개인정보처리방침 URL
   - [ ] 앱 액세스 권한: "모든 기능을 제한 없이 사용 가능"
   - [ ] 광고: 예
   - [ ] 콘텐츠 등급(IARC) 설문
   - [ ] 타겟층 및 콘텐츠: 9~12, 13~15, 16~17, 18+ (Families 정책 동의)
   - [ ] 데이터 보안
   - [ ] 광고 ID: 사용 안 함
   - [ ] 정부 앱 아님, 금융 기능 없음, 건강 앱 아님, 뉴스 앱 아님
4. [ ] **스토어 등록정보**: 앱 이름, 간단한 설명, 자세한 설명(listing.md), 앱 아이콘 512×512, **그래픽 이미지 1024×500**, 스크린샷(5장 규격), 카테고리 아케이드 + 태그, 연락처 이메일, **웹사이트(= app-ads.txt 도메인)**.
5. [ ] **수익 창출 › 인앱 상품**: 일회성 제품 `kaltoe.pass` 생성(이름·설명·가격) → 활성화. ※ Play는 결제 라이브러리가 들어간 AAB를 먼저 한 번 업로드해야 인앱 상품을 만들 수 있어요.
6. [ ] **테스트 › 내부 테스트** 트랙: AAB 업로드, 테스터 이메일 목록, 라이선스 테스터(설정 › 라이선스 테스트)에 등록해 테스트 결제·복원 확인. 테스트 광고 표시·보상 확인.
7. [ ] 사전 출시 보고서(자동 테스트) 결과 확인: 비정상 종료·접근성 경고.
8. [ ] **프로덕션** 트랙: 국가 선택(한국 / 전체), 출시 노트(listing.md "새로운 기능"), 검토 제출. 조직 계정이라 비공개 테스트 12명·14일 요건은 해당 없음(설계 0장, 계정 유형은 콘솔에서 재확인).
9. [ ] 출시 후 AdMob에서 Play 앱 연결, app-ads.txt 확인.

## 5. 스크린샷 규격 (2026-11-18 확인)

게임은 **세로 고정**이라 모두 세로로 찍어요. 형식 PNG 또는 JPEG, 투명도(알파) 없음.

| 대상 | 규격 (세로, px) | 개수 | 출처 |
|---|---|---|---|
| iPhone 6.9" (iPhone 16/17 Pro Max·Plus, Air 등) | **1320 × 2868** (그 밖에 1290 × 2796, 1260 × 2736도 허용으로 안내됨) | 1~10장, 필수 | Apple 스크린샷 사양 [S21] |
| iPad 13" (iPad Pro M4/M5, iPad Air 13" 등) | **2064 × 2752** 또는 **2048 × 2732** | 1~10장, iPad 지원 앱은 필수 | [S21] |
| 작은 iPhone·iPad 크기 | 6.9"·13" 세트를 자동 축소해서 씀 → 따로 안 올려도 됨 | | [S21] |
| Play 휴대전화 | 각 변 **320~3,840px**, 긴 변 ≤ 짧은 변 × 2. 권장 **1080 × 1920**(9:16) 이상 | 2~8장 (추천·홍보 대상이 되려면 1080px 이상 4장 이상 권장) | Play 미리보기 저작물 도움말 [S22] |
| Play 7" 태블릿 | 각 변 **320~3,840px**, 같은 비율 규칙. 권장 1200 × 1920 | 선택(대형 화면 노출에 권장), 최대 8장 | [S22] (2차 출처에는 1,080~7,680px 9:16 규칙도 있어 콘솔에서 재확인) |
| Play 10" 태블릿 | 위와 같음. 권장 1600 × 2560 또는 2048 × 2732 | 선택, 최대 8장 | [S22] |
| Play 그래픽 이미지 | **1024 × 500**, JPEG 또는 24비트 PNG(알파 없음) | 1장, 필수 | [S22] |
| Play 앱 아이콘 | 512 × 512, 32비트 PNG | 1장, 필수 | [S22] |

- 촬영 장면 제안(같은 5장): ① 1단계 달리기 + 상사 등장 ② 상사 보스전 ③ 지도(1부/2부) ④ 오늘의 미션·주간 출근 카드 ⑤ 사원 복지몰 꾸미기. 문구 오버레이는 ko/en 각각, 다른 게임 이름·순위·보장 문구 금지, 기기 프레임·스토어 배지 넣지 않기.
- 광고·패스 화면을 스크린샷에 넣을 때는 테스트 광고 화면이 보이지 않게.

## 6. 출시 직전 최종 확인

- [ ] 운영 광고 ID가 출시 빌드에만 있고, 개발 빌드·e2e는 테스트 ID.
- [ ] `public-office/privacy.html` 배포됨(Pages), 앱 설정·두 스토어 URL에서 열림.
- [ ] `terms.html` 앱 출시 내용으로 갱신됨.
- [ ] 원격 설정 `monetization.json` 기본값(`ads_enabled true`, 상한 5) 배포, 긴급 중지(`ads_enabled false`) 테스트.
- [ ] 릴리스 리포트에 이 체크리스트 결과, 확인한 정책 링크·날짜(`policy-sources.md`), QA verdict 기록 → `node scripts/gate.mjs` 단계 이동(게이트 규칙).
