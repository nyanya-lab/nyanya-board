# 냐냐 보드 — 작업 안내 (Claude용)

냐냐(저장소 주인, nyanya-lab)의 개인 보드. 달력·할 일 + 스페인어 공부방·Watch LOG 연동 + 가계부(공통비용은 욱진이와 공유).
욱진 보드(`../ukjin-board`)를 본떠 만들지만 복권·쿠폰·자격증 찾기·관리자 모드는 없음.
사이트: https://nyanya-lab.github.io/nyanya-board/ (GitHub Pages, `main` 브랜치의 `docs/` 폴더)

## 작업 규칙

- 한국어로 쉽게 설명하기 (개발 용어는 풀어서).
- 고칠 때마다 브라우저로 PC·폰 너비 둘 다 확인하고, 확인한 것과 못 한 것을 솔직히 말하기.
- 정적 파일을 바꾸면 `docs/index.html` 안의 `?v=날짜문자` 값을 같이 올리기 (브라우저 캐시 때문).
- 빌드 도구 없음. 순수 HTML/CSS/JS (ES 모듈). 로컬 확인은 `.claude/launch.json`의 `docs` (http://localhost:8010)
  (모듈이라 파일을 더블클릭해서 열면 안 됨)
- 비밀번호·API 키 같은 비밀값은 저장소(공개)에 절대 넣지 않기.
- `gh`(GitHub CLI)는 `C:\Program Files\GitHub CLI\gh.exe`, nyanya-lab 계정으로 로그인돼 있음.

## 가계부 코드는 욱진 보드와 짝

- 냐냐 보드 가계부는 욱진 보드 `docs/money.js`를 가져와서 쓸 예정. 두 프로젝트 모두 이 컴퓨터에 있음.
- 가계부를 고칠 때 **욱진 보드에도 필요한 고침인지** 먼저 생각하고, 그렇다면 "욱진 보드도 같이 고칠까?" 물어보기.
  냐냐 보드에만 필요한 것은 여기서만, 욱진이 것에만 필요한 것은 욱진 보드 방에서.
- 🤝 공통비용은 두 보드가 공통 저장소를 같이 읽고 써서 공유 (아직 안 만듦). 지금 냐냐는 '편한가계부' 앱을 쓰는 중 — 계속 쓸지 보드로 옮길지는 공통비용 단계에서 정하기로 함.

## 파일

```
docs/index.html          화면 마크업 (왼쪽 메뉴·아래 메뉴, 페이지 #home #spanish #watch #money)
docs/style.css           색 토큰(욱진 보드와 같음, 대표 색 --me = 코랄), 폰 ≤720px
docs/app.js              화면 로직 (상태 S, 달력 renderCalendar, 그날 할 일 renderDay, 페이지 전환 renderPage)
docs/manifest.webmanifest, *.png  홈 화면 앱 아이콘
```

## 데이터 (Firebase Realtime Database `nyanya-board`, 싱가포르)

- 로그인 없음. **비밀번호 = 저장 위치**: `nyanya/{SHA-256("nyanya-board:"+비밀번호)}` 아래 (`docs/firebase-config.js`).
  비밀번호는 이 기기 `localStorage["nyanya-board-pw"]`에만 기억, ⚙️ 설정 → 잠그기로 지움. 처음 넣는 비밀번호면 "새 보드 만들기" 한 번 더 확인.
- 규칙: 저장소 맨 위 `database.rules.json` (`nyanya/$room` = 64자 해시만 읽기/쓰기). 고치면 Firebase 콘솔(nyanya-board) → Realtime Database → 규칙에 다시 게시해야 적용.
- 욱진 보드(`ukjin-207a3`)와는 **저장소가 따로**.

## 🤝 우리(공통) 저장소 — Firebase `uri-board` (싱가포르)

- 공통비용·공통 목표·같이 할 일·공통 상 등 둘이 같이 쓰는 것. 사이트는 따로 없고 냐냐 보드·욱진 보드 안의 🤝 우리 탭(아직 안 만듦)에서 봄.
- 저장 위치 `uri/{SHA-256("uri-board:"+공통 비밀번호)}` (공통 비밀번호는 둘이 정함, 아직 안 정함). 규칙: 저장소 맨 위 `uri.rules.json` (게시 완료, 2026-10-20 읽기·쓰기·목록 막힘 확인).
- 연결 설정 `docs/uri/uri-config.js` (`uriConfig`). 우리 탭 코드도 `docs/uri/` 아래에 두고, 욱진 보드는 `https://nyanya-lab.github.io/nyanya-board/uri/…`에서 불러와 쓸 계획 → 한 곳만 고치면 두 보드 다 적용.
  한 페이지에서 Firebase 앱 두 개를 쓰므로 `initializeApp(uriConfig, "uri")`처럼 **이름을 붙여** 초기화하기.
- 모음(`COLS`): `tasks` = {title, date, done, at}. 그 외 `settings`(createdAt), `_backup/{prev,daily,undo}`(1시간·하루 자동 백업, 설정에서 되돌리기).
- 항목·칸 단위로 따로 저장 (`flattenPaths`로 경로별 update) → 폰·PC가 서로 덮어쓰지 않음. 저장 상태 점: 초록 저장됨 · 노랑 저장 중 · 코랄 연결 끊김.
- 뼈대 때 브라우저에만 저장하던 `localStorage["nyanya-board-v1"]` 할 일은 보드를 열면 서버로 한 번 옮기고 지움 (`moveOldLocal`).

## 연동 예정

- 🇪🇸 스페인어 공부방 `../nyanya-spanish` — Firebase `nyanya-vocab` (https://nyanya-lab.github.io/nyanya-spanish/)
- 🎬 Watch LOG `../watch-log` — Firebase `nyanya-watchlog` (https://nyanya-lab.github.io/watch-log/)
