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
docs/index.html          화면 마크업 (왼쪽 메뉴·아래 메뉴, 페이지 #home #spanish #watch #money #uri #settings)
docs/style.css           색 토큰(욱진 보드와 같음, 대표 색 --me = 코랄), 폰 ≤720px
docs/app.js              화면 로직 (상태 S, 달력 renderCalendar = 주(.cal-week)마다 7칸 + 🎬 막대 줄(weekBars), 날짜 누르면 그날 할 일 창 #dayDlg(renderDay), 페이지 전환 renderPage)
docs/firebase-config.js   냐냐 보드 Firebase 설정
docs/links.js             📖🎬 스페인어·왓치로그 읽기 (createLinks, 스페인어 연속·오늘 복습 계산, 왓치로그 보는 중·다 본 날)
docs/uri/uri.js           🤝 우리 탭 (욱진 보드와 같이 쓰는 코드, mountUri). CSS도 이 안에서 넣음(uri- 클래스)
docs/uri/uri-config.js    우리(공통) 저장소 Firebase 설정
docs/uri/changes.js       우리 탭 업데이트 내역 (욱진 보드가 읽어서 자기 업데이트 내역에 섞음)
docs/manifest.webmanifest, *.png  홈 화면 앱 아이콘
```

## 데이터 (Firebase Realtime Database `nyanya-board`, 싱가포르)

- 로그인 없음. **비밀번호 = 저장 위치**: `nyanya/{SHA-256("nyanya-board:"+비밀번호)}` 아래 (`docs/firebase-config.js`).
  비밀번호는 이 기기 `localStorage["nyanya-board-pw"]`에만 기억, ⚙️ 설정 → 잠그기로 지움. 처음 넣는 비밀번호면 "새 보드 만들기" 한 번 더 확인.
- 규칙: 저장소 맨 위 `database.rules.json` (`nyanya/$room` = 64자 해시만 읽기/쓰기). 고치면 Firebase 콘솔(nyanya-board) → Realtime Database → 규칙에 다시 게시해야 적용.
- 욱진 보드(`ukjin-207a3`)와는 **저장소가 따로**.

## 🤝 우리(공통) 저장소 — Firebase `uri-board` (싱가포르)

- 공통비용·공통 목표·같이 할 일·공통 상 등 둘이 같이 쓰는 것. 사이트는 따로 없고 냐냐 보드·욱진 보드 안의 🤝 우리 탭에서 봄. 지금은 공통비용만.
- 공통비용 `costs/{id}` = {date, title, amount, cat(`URI_CATS`), payer nyanya|ukjin|joint(공동 통장), memo, by(적은 사람), at, updBy, updAt}. 정산 = (냐냐 낸 돈 − 욱진 낸 돈) / 2, 공동 통장은 합계에만 (`settleOf`). `_backup/{prev,daily}` 자동 백업(되돌리기 화면은 아직 없음).
- 공통 비밀번호는 이 기기 `localStorage["uri-board-pw"]`. 두 보드가 같은 주소(nyanya-lab.github.io)라서 같은 브라우저면 한쪽에서 열면 다른 보드도 열림.
- **uri.js를 고치면 욱진 보드에도 바로 적용됨** → 욱진 보드 화면에서도 확인하기. 욱진이가 보는 게 바뀌면 `docs/uri/changes.js`(`URI_CHANGES`) 맨 위에 쉬운 말로 한 줄 추가 → 욱진 보드 업데이트 내역·새 버전 알림에 자동으로 섞여 나옴 (욱진 보드 changes.js는 안 건드림). 욱진 보드는 10분 단위 `?v=`로 불러와서 고친 뒤 최대 10분+GitHub Pages 반영 시간 뒤에 바뀜.
- 저장 위치 `uri/{SHA-256("uri-board:"+공통 비밀번호)}` (공통 비밀번호는 둘이 정함, 아직 안 정함). 규칙: 저장소 맨 위 `uri.rules.json` (게시 완료, 2026-10-20 읽기·쓰기·목록 막힘 확인).
- 연결 설정 `docs/uri/uri-config.js` (`uriConfig`). 우리 탭 코드도 `docs/uri/` 아래에 두고, 욱진 보드는 `https://nyanya-lab.github.io/nyanya-board/uri/…`에서 불러와 쓸 계획 → 한 곳만 고치면 두 보드 다 적용.
  한 페이지에서 Firebase 앱 두 개를 쓰므로 `initializeApp(uriConfig, "uri")`처럼 **이름을 붙여** 초기화함.
- 모음(`COLS`): `tasks` = {title, date, done, at}. 그 외 `settings`(createdAt, `links`{vocab, watch} = 연동 비밀번호 — 보드 비밀번호로 지켜지고 모든 기기 공유), `_backup/{prev,daily,undo}`(1시간·하루 자동 백업, 설정에서 되돌리기).
- 항목·칸 단위로 따로 저장 (`flattenPaths`로 경로별 update) → 폰·PC가 서로 덮어쓰지 않음. 저장 상태 점: 초록 저장됨 · 노랑 저장 중 · 코랄 연결 끊김.
- 뼈대 때 브라우저에만 저장하던 `localStorage["nyanya-board-v1"]` 할 일은 보드를 열면 서버로 한 번 옮기고 지움 (`moveOldLocal`).

## 구글 캘린더 연동 (정하는 중, 2026-10-20)

- 방식: 욱진 보드처럼 냐냐 구글 계정 Apps Script가 5분마다 동기화 (사이트에서 구글 로그인 없음). 양쪽 방향.
- 냐냐 구글 캘린더 목록: 김윤아(다른 사람과 **공유됨**) · Tasks · 루틴관리(지금 안 씀) · 생일 · 욱진 · 점심 · 캘린더 · 트레이딩실.
- 정한 것:
  - 스페인어 같은 루틴 → **루틴관리** 캘린더.
  - 💰 돈(월급·예산 등)은 구글에 **안 보냄** (김윤아가 공유 캘린더라). 냐냐 보드 달력에선 돈 표시를 **보이기/숨기기** 토글로만 (욱진 보드처럼 늘 보이게 하지 않기).
  - 📌 날짜 있는 할 일 · 🎯 큰 목표 D-day → **김윤아** 캘린더 (공유돼도 괜찮다고 함). 날짜 없는 할 일은 안 보냄.
  - 🤝 우리 일정 → 새 **'우리'** 캘린더 (냐냐 계정에 만들어 욱진이 구글 계정과 공유). 보드에선 우리 탭에 '우리 일정' 추가 예정.
  - 구글 → 보드: 냐냐의 캘린더 **전부** 가져오고, 보드에서 캘린더마다 켜고 끄기.
- **나중에 정하기:** 🎬 왓치로그 다 본 작품을 구글에 보낼지 (지금은 안 보냄, 보드 달력에만).

## 📖🎬 스페인어·왓치로그 연동 (읽기만, `docs/links.js`)

- 그쪽 데이터는 **절대 쓰지 않기** (읽기만). 각 앱 동기화 비밀번호 = 서버 자리.
  - 📖 스페인어 공부방 `../nyanya-spanish` — Firebase `nyanya-vocab`, `vocab/{비번}__v3/diary/{날짜}` (없으면 옛 `vocab/{비번}/nyanyaDiary`). 이 브라우저 키 `nyanya_sync_password`.
  - 🎬 Watch LOG `../watch-log` — Firebase `nyanya-watchlog`, `watchlog/{비번}__v3/items/{id}`. 이 브라우저 키 `watchlog_sync_password`.
- 비밀번호: 보드 `settings.links` 먼저, 없으면 같은 주소(nyanya-lab.github.io)의 그 앱이 이 브라우저에 기억한 값. (아이폰 홈 화면 앱은 저장 공간이 따로라 설정에 넣어야 함)
- 보여 주는 것: 첫 화면 요약 칸(스페인어 오늘 복습·🔥 연속 / 이번 달 다 본 작품 수) · 달력: 스페인어는 공부한 날 칸 위 📖 **표시만**, 왓치로그는 **본 기간 막대**(시작~끝, 보는 중이면 오늘까지, 다시 본 기간도. 한 주 최대 3줄 `MAX_LANES`) · 첫 화면 달력 아래 '보는 중' 포스터 · 📖/🎬 탭.
- 달력의 📖·🎬는 '오늘' 옆 버튼으로 켜고 끔 (`settings.view` {vocab, watch} = false면 숨김, 모든 기기 같이). 💰 돈 표시도 나중에 여기 같은 버튼으로.
- 첫 화면 오른쪽 '오늘' 칸은 냐냐 요청으로 뺌 (2026-10-20). 할 일은 날짜를 눌러 뜨는 창에서.
- 계산 규칙은 각 앱과 같게: 스페인어 연속 = core.js `calcStreak`(10/9부터 복습 다 한 날만) · 학습 개수 = `dayActivity` · 오늘 복습 = 그날 일지 `reviewDone`/`reviewLeft`(앱이 마지막으로 저장한 때 기준). 왓치로그 보는 중 = 시작했는데 끝난 날 없음(다시 보기 포함), 다 본 날 = endDate·lastWatchEnd. **앱 쪽 규칙이 바뀌면 여기도 같이.**
- 정확한 '오늘 복습할 단어 수'는 단어장 전체(약 1MB)를 받아야 해서 안 함 (냐냐와 정함).
