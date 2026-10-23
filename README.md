# 탭탭 줄넘기 · TAP ROPE

모바일 캐주얼 아케이드: **화면 탭 = 점프, 공중에서 한 번 더 탭 = 2단, 세 번 = 3단.**
두 친구가 돌리는 긴 줄과 허들·새가 1단/2단/3단/복합 패턴으로 다가오고, 리듬에 맞춰 넘어 스테이지를 클리어합니다.
설계 문서: [docs/GDD.md](docs/GDD.md)

## Run
```bash
npm install
npm run dev        # http://localhost:5173 (폰에서는 같은 Wi-Fi로 --host 주소 접속)
npm test           # 438 unit/property tests (모든 스테이지를 봇이 무피격 클리어하는지 포함)
npm run build      # dist/ — 정적 호스팅에 그대로 배포 (PWA, 오프라인 지원)
```
- `?autoplay=1` — 봇이 플레이 (QA/데모 녹화용)
- `render-preview.html?world=0..3&skin=cat&scene=jump3` — 렌더러 단독 미리보기
- `ui-preview.html?screen=title|stages|hud|result|shop|...` — UI 화면 단독 미리보기
- 데스크톱: Space/↑ = 탭, Esc/P = 일시정지

## Structure
| Path | Role |
|---|---|
| `src/types.ts` | 모듈 간 공유 계약 |
| `src/core/` | 순수 로직: 물리, 판정, 점수/피버, 스테이지 생성기, 타임라인, 저장 |
| `src/game/` | 세션 상태머신, 오토플레이 봇, 앱 컨트롤러(화면 흐름) |
| `src/render/` | Canvas2D 절차적 아트: 4개 월드, 6개 스킨, 리듬 레인, 이펙트 |
| `src/ui/`, `src/styles/` | DOM 화면: 타이틀, 스테이지 선택, HUD, 결과, 상점, 설정 |
| `src/audio/` | WebAudio 절차적 효과음 + BPM 동기 음악 |
| `sw/sw.template.js` | 빌드 시 해시 버전으로 생성되는 서비스워커 |
