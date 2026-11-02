# 칼퇴근 대작전 로그인 설정 안내 (대표님용)

비밀 키 값은 채팅에 붙여넣지 말고, 아래 대시보드에 직접 입력해 주세요.

**공통 값**
- Supabase 콜백 URL: `https://bmstuotifpmaspszrgyi.supabase.co/auth/v1/callback`
- 게임 주소: `https://breton5797.github.io/tap-rope/office/`

## 1. Supabase URL 설정 (2분)
1. https://supabase.com/dashboard/project/bmstuotifpmaspszrgyi/auth/url-configuration 열기
2. **Site URL**: `https://breton5797.github.io/tap-rope/office/`
3. **Redirect URLs**에 추가:
   - `https://breton5797.github.io/tap-rope/office/**`
   - (로컬 개발 중에만) `http://localhost:5173/**` — 개발할 때만 잠깐 추가하고 끝나면 **삭제**하세요. 운영 설정에 남겨 두지 않습니다.
4. Save

## 2. 구글 로그인 (10분)
1. https://console.cloud.google.com/ → 상단에서 프로젝트 선택(없으면 "새 프로젝트" → 이름 `kaltoe-office`)
2. **API 및 서비스 → OAuth 동의 화면**
   - User Type: **외부** → 만들기
   - 앱 이름 `칼퇴근 대작전`, 사용자 지원 이메일·개발자 연락처: breton5797@gmail.com
   - 범위: 기본값(email, profile, openid) 그대로 → 저장
   - **게시 상태**: "앱 게시"를 눌러 프로덕션으로(테스트 상태면 등록한 테스트 사용자만 로그인 가능)
3. **API 및 서비스 → 사용자 인증 정보 → 사용자 인증 정보 만들기 → OAuth 클라이언트 ID**
   - 애플리케이션 유형: **웹 애플리케이션**
   - 승인된 JavaScript 원본: `https://breton5797.github.io`
   - 승인된 리디렉션 URI: `https://bmstuotifpmaspszrgyi.supabase.co/auth/v1/callback`
   - 만들기 → **클라이언트 ID**와 **클라이언트 보안 비밀번호**가 나옴
4. https://supabase.com/dashboard/project/bmstuotifpmaspszrgyi/auth/providers → **Google** 켜기 → Client ID, Client Secret 붙여넣기 → Save

## 3. 애플 로그인 (15분, Apple Developer 계정 필요 — 팀 ID 6SGPPQF3VQ)
1. https://developer.apple.com/account/resources/identifiers/list
2. **App ID 확인/생성**: `+` → App IDs → App → Bundle ID `com.heesookyang.taprope`(기존 것 사용 가능) → Capabilities에서 **Sign in with Apple** 체크 → 저장
3. **Services ID 생성**: `+` → **Services IDs** → Description `칼퇴근 대작전 웹 로그인`, Identifier `com.heesookyang.taprope.web` → 등록
   - 만든 Services ID 클릭 → **Sign in with Apple** 체크 → Configure:
     - Primary App ID: 2번의 App ID
     - Domains: `bmstuotifpmaspszrgyi.supabase.co`
     - Return URLs: `https://bmstuotifpmaspszrgyi.supabase.co/auth/v1/callback`
   - Save → Continue → Save
4. **키 생성**: Keys → `+` → 이름 `kaltoe-signin` → **Sign in with Apple** 체크 → Configure(Primary App ID 선택) → Register → **.p8 파일 다운로드**(한 번만 받을 수 있음) → **Key ID** 메모
5. Supabase → Auth → Providers → **Apple** 켜기:
   - Client IDs: `com.heesookyang.taprope.web`
   - Secret Key: Supabase 화면의 안내에 따라 Team ID `6SGPPQF3VQ`, Key ID, .p8 내용으로 생성한 값 입력
   - Save
   - 참고: 애플 비밀 키는 6개월마다 만료되어 다시 만들어야 합니다.

## 4. 무적 테스트 계정 활성화
- 서버 설정(마이그레이션 `supabase/migrations/20261102000000_office_testers.sql`)이 적용되어 있어야 합니다. 적용 후 breton5797@gmail.com으로 구글(또는 같은 이메일의 애플) 로그인 → 화면에 `TEST` 배지가 보이면 성공.
- 테스터 추가/삭제는 `game.office_testers` 테이블에 이메일을 넣거나 뺀 뒤, 그 사용자의 표시를 갱신하는 아래 SQL을 실행합니다(트리거는 사용자 정보가 바뀔 때만 돌기 때문에, 다시 로그인하는 것만으로는 반영되지 않습니다 — 이메일·인증 상태가 바뀌는 경우는 예외):
  ```sql
  update auth.users set email = email where lower(email) = '<주소>';
  ```
  반영 후 해당 사용자는 로그아웃 → 다시 로그인하면(새 토큰) `TEST` 배지가 보이거나 사라집니다.

설정이 끝나면 "설정 완료"라고 알려 주세요. 라이브에서 실제 로그인을 확인하겠습니다.
