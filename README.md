# 레이저 탈출작전 · LASER ESCAPE

횡스크롤 스파이 액션: 특수요원이 적 기지에 잠입해 포로를 **구출**하고(1부, 1~50단계) 함께 **탈출**한다(2부, 51~100단계).
상하좌우에서 박자에 맞춰 날아오는 전기 레이저를 **탭 = 점프(공중 탭 = 2·3단)**, **아래로 스와이프 = 슬라이딩**으로 피한다.

- 플레이: https://breton5797.github.io/tap-rope/ (휴대폰 브라우저 → 홈 화면에 추가하면 앱처럼 전체화면·오프라인)
- 설계 문서: [docs/GDD-v4.md](docs/GDD-v4.md) (이전 버전 기록: GDD.md ~ GDD-v3.md)

## Run
```bash
npm install
npm run dev        # http://localhost:5173 (같은 Wi-Fi 휴대폰은 표시되는 Network 주소)
npm test           # 1000+ 단위·속성 테스트 (봇이 100단계를 스와이프 지연 0.1s로 무피격 클리어하는지 포함)
npm run build      # dist/ — main에 push하면 GitHub Actions가 테스트 후 Pages에 자동 배포
npm run ios        # 빌드 + iOS 동기화 → Xcode(ios/App/App.xcodeproj)에서 기기에 실행
```
- `?autoplay=1` — 봇이 플레이 (QA/데모)
- `render-preview.html?world=0..3&variant=base|alarm|dark|steam|night|dawn&scene=…` — 렌더러 단독 미리보기
- `ui-preview.html?screen=…` — UI 화면 단독 미리보기
- 데스크톱: Space/↑ = 점프, ↓/S = 슬라이딩, Esc/P = 일시정지

## Structure
| Path | Role |
|---|---|
| `src/types.ts` | 모듈 간 공유 계약 |
| `src/core/` | 순수 로직: 점프·슬라이딩 물리, 레이저 판정, 점수·피버, 생성기, 100단계 캠페인·난이도 곡선, 저장 |
| `src/game/` | 세션 상태머신, 오토플레이 봇, 제스처 입력, 앱 컨트롤러(브리핑·카운트다운·결과) |
| `src/render/` | Canvas2D 절차적 아트: 복도 테마·변형, 요원·포로, 레이저·발사기·드론, 리듬 레인, 이펙트 |
| `src/ui/`, `src/styles/` | DOM 화면: 타이틀, 작전 지도, HUD, 브리핑, 결과, 장비실, 기술 도감, 설정 |
| `src/audio/` | WebAudio 절차적 스파이 음악·효과음 |
| `sw/sw.template.js` | 빌드 시 해시 버전으로 생성되는 서비스워커 (오프라인) |
| `ios/` | Capacitor iOS 앱 |
