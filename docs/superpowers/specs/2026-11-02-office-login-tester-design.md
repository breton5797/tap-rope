# 칼퇴근 대작전 — 구글·애플 로그인 + 무적 테스트 계정 설계서

> 2026-11-02 · 기반 main fe6ff0e · 대표님 결정: 선택 로그인 / 무적 + 전 단계 개방 / 콘솔 설정은 단계별 안내.

## 1. 범위
- 칼퇴근판(`/tap-rope/office/`)에 **선택형** 구글·애플 로그인. 로그인하지 않아도 지금처럼 바로 플레이.
- `breton5797@gmail.com`으로 로그인한 회원 = **테스터**: 무적(피격해도 체력 감소 없음, 실패 없음) + 1~5단계 전부 선택 가능. 화면에 `TEST` 배지. 테스터 판은 기록·업적·도장·보상에 반영하지 않음(일반 기록 오염 방지, P3).
- v8(`/tap-rope/`)은 변경 없음.

## 2. 인증 구조
- 기존 Supabase 프로젝트 `laser-escape`(bmstuotifpmaspszrgyi)의 **Supabase Auth**(OAuth: Google, Apple). 클라이언트는 `@supabase/supabase-js`의 auth만 사용(게임 데이터는 계속 기기에만 저장 — 오프라인 원칙 유지, 리더보드 없음).
- 칼퇴근 빌드 가드 변경: "Supabase URL/키 금지" → "URL + **publishable key만** 허용, 게임 데이터 API(online.ts 리더보드 등)는 계속 비활성". 테스트로 고정.
- 리다이렉트: `https://breton5797.github.io/tap-rope/office/` (개발용 `http://localhost:*/office/`).

## 3. 테스터 판정 (서버 측)
- 이메일을 클라이언트 번들에 **넣지 않는다**(공개 코드 노출·조작 방지).
- DB: 비공개 테이블 `game.office_testers(email text primary key)` + `auth.users` insert/update 트리거 → 이메일이 목록에 있고 **이메일 인증됨**이면 `raw_app_meta_data.office_tester = true`, 아니면 제거.
- 클라이언트: 세션의 `user.app_metadata.office_tester === true`일 때만 테스터 모드. app_metadata는 사용자가 수정할 수 없고 JWT에 서명되어 들어옴.
- 한계(정직): 오프라인 게임이라 클라이언트 측 무적은 원리적으로 조작 가능 — 하지만 칼퇴근판엔 서버 기록·보상이 없어 영향 없음.

## 4. UI
- 타이틀: `로그인` 버튼 → 시트(구글로 계속하기 / Apple로 계속하기 / 닫기, 개인정보 안내: 이메일은 로그인 확인용으로만 사용). 로그인 후 버튼이 프로필 칩(이메일 앞부분 마스킹)과 `로그아웃`으로 바뀜.
- 테스터: HUD에 `TEST` 배지, 층별 안내도 전 단계 열림, 결과 화면 "테스트 판 · 기록 안 함".

## 5. 대표님이 해야 할 일 (단계별 안내 문서 별도)
1. Google Cloud: OAuth 동의 화면 + 웹 클라이언트 ID 생성(승인된 리다이렉트 URI = Supabase 콜백) → Supabase 대시보드 Auth > Providers > Google에 Client ID/Secret 입력.
2. Apple Developer: Services ID(Sign in with Apple, 도메인·리턴 URL = Supabase 콜백) + 키(.p8) → Supabase Apple Provider에 Services ID, Team ID 6SGPPQF3VQ, Key ID, 키 입력.
3. Supabase Auth > URL Configuration: Site URL과 Redirect URLs 등록.

## 6. 검증
- 단위 테스트: 테스터 판정(app_metadata), 무적(피격 시 하트 불변·실패 없음), 전 단계 개방, 테스터 판 기록 제외, v8 동일, 빌드 가드.
- e2e: 비로그인 플레이 그대로, 가짜 세션 주입으로 테스터/일반 회원 분기 확인, 로그인 시트 UI. 실제 OAuth는 대표님 콘솔 설정 후 라이브에서 직접 로그인으로 확인.
