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

## 💰 가계부 (`docs/money/`) — 욱진 보드 가계부와 짝 (2026-10-20 만듦)

- 따로 페이지: https://nyanya-lab.github.io/nyanya-board/money/ (보드 메뉴 💰 → 여기). 냐냐 보드 비밀번호로 열리고 **같은 저장 자리** `nyanya/{해시}`의 `money`·`accounts`·`pics`·`settings`(budgets·moneyCats·catColors·moneySubs·currencies·budget)에 저장.
- `docs/money/money.js` = 욱진 보드 `docs/money.js` **복사본**(짝 코드). 냐냐 쪽에서 바꾼 곳은 파일 맨 위에 적어 둠: localStorage 키 `ukjin-`→`nyanya-`, 💝 줄 돈은 `env.give === false`면 안 보임, ❤️ `common` 체크(`#mCommonWrap`이 있을 때만), 탭에 `common` 허용.
- `docs/money/style.css` = 욱진 보드 `style.css` **그대로**, 냐냐 고침은 `nyanya.css`. `docs/money/index.html` = 욱진 보드 가계부 화면 조각(#moneyPage·dialog들·#mBottom)을 가져와서 만든 것. `docs/money/app.js` = 얇은 연결 코드(로그인·Firebase·도우미·bindMoney).
- 욱진 보드 가계부를 고치면(또는 여기를 고치면) 짝도 같이 고칠지 생각하기. 복사본이라 저절로 안 따라감.
- 📥 편한가계부 가져오기 (`docs/money/import.js`, 가계부 설정 탭): 편한가계부 엑셀(시트 '내역') → 지출·수입·이체(이체지출, 분류=받는 자산)·자산(이름으로 종류 짐작, 미리보기에서 바꿈)·분류·소분류. 잔액수정 줄(분류 '잔액수정', 수입/지출 빈칸, 금액은 늘 +)은 기록 대신 그 자산 `accounts.initial`에 더함 — 엑셀엔 +/−가 없어서 다 +로 넣음. 2026-10-21 냐냐 가계부에 넣고 편한가계부 자산 화면과 비교: 대부분 맞고 신한(잔액수정 −, → 100,428 + 10/21 보험 5,417 기록)·키움증권(손익)(→5,000,000)·업비트(손익)(→0)은 줄인 줄이 섞여 있어 🧮 맞추기로 고침. '카드' 자산(갚을 돈 6,715,781)은 편한가계부엔 없음. 넣은 합은 `accounts.pkAdj`(다시 눌러도 안 겹침), [🧮 잔액수정만 넣기] 버튼은 기록은 안 건드림. 기록 id = 줄 내용 해시(같은 파일 다시 가져와도 안 겹침). 브라우저에서 SheetJS(cdn.sheetjs.com 0.20.3)로 읽음.
  (선택) '공통비용 미정산' 엑셀(시트 'YY년 M월', 정산여부='완료') → 💙 공통비용 줄의 정산 여부: 날짜·자산·금액 → 날짜·자산 → 그 달 상태(다 완료면 정산, 아니면 미정산, 파일 마지막 달 뒤는 미정산). 2026-10-20 냐냐 실제 파일로 미리 계산: 26년 7월까지 미정산 합계가 파일 합계 시트와 정확히 같음.
  ⚠️ 실제 엑셀은 저장소에 절대 넣지 않기 (.gitignore에 *.xlsx).
  2026-10-20 냐냐 실제 가계부에 가져오기 완료 (6,535건, 자산 34개 — 단기임대·신한○○○○=저축, 카카오페이=현금). 잔액은 2023-06 전 돈·잔액수정이 빠져서 아래 '잔액 맞추기'로 맞춤.
- 📅 내역 기간 고르기 (`docs/money/range.js`, 2026-10-21, 욱진 보드도 같이 쓰려고 따로 둔 파일 — CSS도 안에 있음): 내역 탭 달 이름·[이번 달] → 빠른 선택(오늘~전체) + 시작~끝 달력 → `ui.txRange`({from,to}, 딱 한 달이면 ui.month로). money.js `monthTotals(m, range)`, 액션 txPick·txShift. 탭 위 '💰 가계부' 제목·설명은 nyanya.css로 숨김.
- 🔁 매월 반복 (`docs/money/repeat.js`, 가계부 설정 탭, 냐냐 전용, 2026-10-21): 규칙 `settings.moneyRepeat/{id}` = {kind expense|income|move(이체, toAccount), amount(마이너스 가능), account, cat, sub, memo, day, from "YYYY-MM", made{YYYY-MM:true}}. 가계부를 열 때(render) 그 달 day일(짧은 달은 말일)이 지났고 made에 없으면 `money/rp-{id}-{YYYYMM}` 기록을 만들고 made 표시 → 지운 기록은 다시 안 생김, 기기 여러 대여도 같은 id. 규칙을 지워도 생긴 기록은 남음.
- ✅ 2026-10-21 냐냐 가계부로 갈아탐 (편한가계부는 백업, 새로 안 적음): 반복 13개 넣음(편한가계부 반복관리 그대로, 16일 이하는 11월부터 — 10월분은 엑셀에 있어서), '카드' 자산(2023-10-10 BC 카드정산 결제 2줄의 빈 자리)은 '잔액조정'으로 이름 바꾸고 🙈 숨김 → 합계 66,814,849원 = 편한가계부 자산 화면과 같음.
- 💑 공통비용 정리 (2026-10-21 냐냐와 정함): 각자 자기 돈 관리(공통비용은 낸 사람 지출로 그대로, 욱진이가 보낸 돈은 💚 욱진입금 수입), 못 받은 돈은 엑셀 대신 ❤️ 공통 탭 '💸 아직 정산 안 된 돈'.
  + '💑 내 몫으로 보기' 켜고 끄기 (기본 꺼짐, `settings.moneyMine`, money.js `mineOn`·`cntAmt`): 켜면 합계·통계·달력·예산에서 💙 공통비용(❤️ 또는 분류에 '공통비용') 절반, 💚 욱진입금(분류에 '욱진입금')은 수입에서 빼고 '정산 받은 돈'으로. 기록·잔액은 그대로.
  ❤️ 공통 탭 첫 화면 = 엑셀 첫 시트처럼 '한눈에 보기' 표(달·✈️여행 묶음마다 합계·정산·미정산·1인당 미정산, 줄 누르면 그 내역) + 💸 정산하기(공통 통장에서 뺀 총액 → 선입선출로 오래된 기록부터 정산, 기록 중간에서 멈추면 남는 돈 안내) — uri.js summaryHtml·fifo.
  ✈️ 여행 묶음 = 소분류 '여행…' + 내용이 숫자로 시작('2026 상해', '2608 강릉') → 같은 내용 기록 다 묶임. 가계부 내용 칸에 예전 여행 이름 자동완성(app.js tripList). 욱진이가 낸 공통비용이 생기면 선입선출 계산(지금은 낸 사람 구분 없이 총액) 다시 보기.
  🏷 공통 분류 (2026-10-21 큰 작업 ①): 공통 저장소 `settings/cats` = [{n 대분류, s [소분류]}] (기본 식비{외식,배달,장보기}·문화생활{영화,인형뽑기,노래방,야구,콘서트}·여행{식비,숙소,체험 및 기타,교통 및 비행기}·쇼핑{기타}·기타), 공통 탭 '🏷 공통 분류'에서 둘이 고침.
    가계부 기록 창 ❤️ 체크 → 분류 칸이 공통 분류 → 기록 cat='💙 공통비용', ccat·csub (money.js ccOn·ccOf). 예전 기록(소분류 '식비(외식)')은 ccOf가 읽어서 보여 줌. 공통 저장소 costs에 cat=대분류, sub=소분류.
    ② 2026-10-21 예전 공통비용 1,070건 ccat·csub로 옮김 (냐냐 OK, 설정 '분류'의 ccmigrate.js — 다 옮겨서 이제 안 보임. 내용·날짜·금액·정산 그대로 확인).
    ③ 공통 탭 '📊 통계'(uri.js statsHtml: 달·해·전체, 대분류별 → 누르면 소분류별 + 내역, 냐냐·욱진 낸 돈, 원형은 보드가 opts.pie로 줌).
    ④ 냐냐 통계에서 💙 공통비용을 누르면 공통 분류별로 펼침(#stCcSub, 누르면 그 대분류 기록만).
  결혼 후 방향: 자산에 '🤝 공동' 체크 → 그 자산 기록만 둘이 같이 봄 (아직 안 만듦). 냐냐 가계부엔 냐냐 돈만, 둘의 돈은 우리(공통) 저장소에.
- ⚠️ 냐냐 실제 가계부 숫자(잔액·기록)를 바꾸는 건 **꼭 먼저 물어보고**, 근거 없는 숫자로 맞추지 않기 (2026-10-21 신한 5,417원을 시작 잔액에 끼워 맞췄다가 냐냐 요청으로 되돌림 → 신한 100,428원, 그 5,417원은 10/21 보험·한화 매월 반복 지출).
- 🧮 실제 잔액 맞추기 · 🙈 숨기기 (`docs/money/balance.js`, 자산 탭 아래, 냐냐 전용): 실제 잔액(카드는 갚을 카드값) → `accounts.initial`을 (실제 − 계산된 잔액)만큼 고침. 숨기기 = `accounts.hidden` → money.js `sortedAccts`에서 빠짐(목록·합계·고르는 칸), 기록은 그대로.
- ❤️ 공통비용: 지출 기록 칸의 **❤️ 공통비용** 체크 → `money.common = true` → `app.js mirrorCommon` → `uri.setMirror` → 공통 저장소 `costs/nyanya-{가계부 id}`(src "money", by·payer "nyanya")에 저절로 복사(고치면 고쳐지고, ❤️ 빼거나 지우면 지워짐, 원화만). '❤️ 공통' 탭(가계부 안)에서 둘 다 보기 + 반반 정산. ✅ 정산: 공통비용마다 `settled`(정산한 날, 가져오기면 "가져오기") — 맨 위 '💸 아직 정산 안 된 돈(전체)', 달마다 [✅ M월 정산 완료로]/[↩ 정산 취소]. 가계부 → 공통 복사는 처음 만들 때만 settled를 가져가고 그 뒤엔 공통 쪽 정산 표시를 안 건드림. 분류가 '공통비용'이면 공통 쪽엔 소분류로. 우리 탭(`mirror: true`)은 보기만, 직접 적는 칸 없음.
- (원래 계획) 냐냐 보드 가계부는 욱진 보드 `docs/money.js`를 가져와서 쓸 예정. 두 프로젝트 모두 이 컴퓨터에 있음.
- ⏸ **욱진 보드 가계부엔 당분간 안 넣음** (2026-10-21 냐냐: "냐냐 가계부 다 개발하면 한번에 넣자"). 그때 욱진 방에 한꺼번에 넘길 목록 (PR #158까지는 이미 넣음):
  - 위 제목 = 지금 탭 이름(예산·내역·달력·자산·통계·공통·설정, money.js `E.tabTitles`) + 제목 줄 높이 고정 → 탭마다 내용 시작 높이 같게 (nyanya.css `#moneyPage .page-head`)
  - 기록 창: 날짜를 위 한 줄, 금액은 아래 한 줄 통째로 (글자 크기는 그대로, index.html `.m-amt-full`, nyanya.css)
  - ✏️ 분류·소분류 이름 바꾸기 (money.js `renameCat`·`renameSub`: 목록·색·소분류·기록·예산·반복 한 번에 rootUpdate, 있는 이름이면 합침) + '목록에 없는 분류 (기록엔 있음)' 줄 — 욱진 보드는 rootUpdate가 없어서 맞게 바꿔야 함
  - ▦ 다건입력: 창 옆으로 넓게(화면 너비 − 24px) + 채우기 손잡이(money.js `bulkFillInit`, 칸 오른쪽 아래 네모를 끌면 같은 칸 복사 — 구분은 줄 다시 만들고, 분류는 소분류 칸도, 소분류는 같은 분류 줄에만)
  - 자산 고르는 칸(기록·다건입력·이체 받는 곳·카드 결제·빠지는 통장·반복) = 자산 탭 순서로 현금·통장·카드·저축 묶음(optgroup) + '이름_계좌번호' (money.js `acctOptsHtml`)
  - 금액 +/- 기호 없애기 (색으로만): app.js `won` = 부호 없음, `wonS` = 부호 있음(잔액 맞추기), money.js `amtText` = 직접 -로 적은 금액만 -, `wonN` = 지출·수입·분류 합계가 마이너스면 - (통계·요약 칸·달력) (환불·할인은 지출에 -로 적는 게 냐냐 방식)
  - 🧮 실제 잔액 맞추기 칸: 자산 탭 맨 아래 → 설정 '자산' 작은 탭 (🙈는 자산 관리에만)
  - 🎨 분류 색: 그래프 색 가이드 검증 팔레트 8색(nyanya.css --c0~c7) + 회색, 원형마다 금액 큰 8개가 서로 다른 색(늘 쓰는 색 = 지금까지 쓴 돈 순위 먼저), 9번째부터 '그 밖' (money.js `E.catRank`·`setCatView`) · 내역 아래 '지출' 칸 원형 숨김(#catBars)
  - 📅 가계부 달력 칸의 합계(수입−지출) 줄 = 검은 글씨 + 바탕색(플러스 옅은 빨강·마이너스 옅은 파랑, nyanya.css `.mc-v i.net`), 수입·지출 하나만 있어도 보임 (money.js)
  - 통계 분류 목록·설정 분류 편집의 색 동그라미 숨김 (nyanya.css, 설정에서 색 바꾸기 버튼도 같이 숨음)
  - ⚙ 설정 탭 안 작은 탭 (분류·자산·반복·가져오기·화폐, index.html `#setTabs`·`data-st`, app.js `setSubTab`)
  - 🏦 자산 계좌번호(`accounts.number`)·메모(`accounts.memo`): 자산 목록 이름 옆 작은 글씨, 자산별 보기 위 한 줄 (money.js) + 가계부 설정 '🏦 자산 관리'(`docs/money/acctset.js`: 이름·계좌번호·메모·🙈 숨기기 한곳에서)
  - 💳 카드 결제예정 = 이용기간이 끝난 가장 최근 결제(저번 달 사용분), 결제일 안 정해도 지난달 1일~말일 (money.js `cardDue`) · [결제] 기록 내용 '카드정산 결제' + 메모 '기간 사용분' (`doCardPay`). 2026-10-21 냐냐 카드 3개 편한가계부와 같음 (BC 2,731,592/2,231,282 · 현대 173,661/19,800 · 롯데 0/54,870)
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
docs/google-sync.html     구글 캘린더 연결 안내 (Apps Script에 Code.gs 붙여넣기)
docs/apps-script/Code.gs        냐냐 Apps Script에 넣는 짧은 로더 (한 번만 붙여넣음)
docs/apps-script/sync-core.js   실제 구글 동기화 코드. 로더가 5분마다 받아서 실행 → 여기만 고치면 자동 적용 (CORE_VERSION 올리기)
docs/manifest.webmanifest, *.png  홈 화면 앱 아이콘 = 냐냐 캐릭터(다운로드 '케릭터사진.png' 왼쪽 분홍 원, 2026-10-20). avatar.png = 둥근 로고(.logo-img). 바꾸면 ?v= 올리기
```

## 데이터 (Firebase Realtime Database `nyanya-board`, 싱가포르)

- 로그인 없음. **비밀번호 = 저장 위치**: `nyanya/{SHA-256("nyanya-board:"+비밀번호)}` 아래 (`docs/firebase-config.js`).
  비밀번호는 이 기기 `localStorage["nyanya-board-pw"]`에만 기억, ⚙️ 설정 → 잠그기로 지움. 처음 넣는 비밀번호면 "새 보드 만들기" 한 번 더 확인.
- 규칙: 저장소 맨 위 `database.rules.json` (`nyanya/$room` = 64자 해시만 읽기/쓰기). 고치면 Firebase 콘솔(nyanya-board) → Realtime Database → 규칙에 다시 게시해야 적용.
- 욱진 보드(`ukjin-207a3`)와는 **저장소가 따로**.

## 🤝 우리(공통) 저장소 — Firebase `uri-board` (싱가포르)

- 공통비용·공통 목표·같이 할 일·공통 상 등 둘이 같이 쓰는 것. 사이트는 따로 없고 냐냐 보드·욱진 보드 안의 🤝 우리 탭에서 봄. 지금은 공통비용만.
- 공통비용 `costs/{id}` = {date, title, amount, cat(`URI_CATS`), payer nyanya|ukjin|joint(공동 통장), memo, by(적은 사람), at, updBy, updAt}. 정산 = (냐냐 낸 돈 − 욱진 낸 돈) / 2, 공동 통장은 합계에만 (`settleOf`). `_backup/{prev,daily}` 자동 백업(되돌리기 화면은 아직 없음).
- 공통 비밀번호는 이 기기 `localStorage["uri-board-pw"]` + 냐냐 보드 `settings.uriPw`(한 번 넣으면 보드가 기억 → 다른 기기에선 보드 비밀번호만 넣으면 우리 탭도 열림, `mountUri`의 `savePassword` / 돌려받은 `usePassword`). 욱진 보드는 아직 savePassword를 안 넘겨서 기기마다 넣어야 함 (원하면 욱진 보드 app.js에 같은 연결 추가). 두 보드가 같은 주소(nyanya-lab.github.io)라서 같은 브라우저면 한쪽에서 열면 다른 보드도 열림.
- ⏸ **욱진 보드엔 아직 비공개** (냐냐 요청: 다 만든 뒤 한꺼번에): `uri.js` `HOLD_UKJIN = true` → 욱진 보드 우리 탭은 '준비 중'만, `uri/changes.js`도 비워 둠.
  욱진 보드의 '우리' 메뉴·설명서 주제도 숨김: `uri/changes.js`의 `URI_HOLD` 코드(욱진 보드가 열 때 이 파일을 불러와서 숨김, 2026-10-20 실제 사이트에서 확인).
  공개할 때 할 일: ⓪ `uri/changes.js` URI_HOLD 코드 지우기 ① 욱진 보드 money.js에 ❤️ 체크 + 기록 칸 `#mCommonWrap` + `mirrorCommon`(who "ukjin") + '❤️ 공통' 탭(여기 money/app.js 참고) — 욱진 보드 PR ② `HOLD_UKJIN = false` ③ `uri/changes.js`에 그날 소개 줄 ④ 욱진 보드도 `savePassword` 연결(공통 비밀번호 기억).
- **uri.js를 고치면 욱진 보드에도 바로 적용됨** → 욱진 보드 화면에서도 확인하기. 욱진이가 보는 게 바뀌면 `docs/uri/changes.js`(`URI_CHANGES`) 맨 위에 쉬운 말로 한 줄 추가 → 욱진 보드 업데이트 내역·새 버전 알림에 자동으로 섞여 나옴 (욱진 보드 changes.js는 안 건드림). 욱진 보드는 10분 단위 `?v=`로 불러와서 고친 뒤 최대 10분+GitHub Pages 반영 시간 뒤에 바뀜.
- 저장 위치 `uri/{SHA-256("uri-board:"+공통 비밀번호)}` (공통 비밀번호는 둘이 정함, 아직 안 정함). 규칙: 저장소 맨 위 `uri.rules.json` (게시 완료, 2026-10-20 읽기·쓰기·목록 막힘 확인).
- 연결 설정 `docs/uri/uri-config.js` (`uriConfig`). 우리 탭 코드도 `docs/uri/` 아래에 두고, 욱진 보드는 `https://nyanya-lab.github.io/nyanya-board/uri/…`에서 불러와 쓸 계획 → 한 곳만 고치면 두 보드 다 적용.
  한 페이지에서 Firebase 앱 두 개를 쓰므로 `initializeApp(uriConfig, "uri")`처럼 **이름을 붙여** 초기화함.
- 모음(`COLS`): `tasks` = {title, date, done, at}. 그 외 `settings`(createdAt, `links`{vocab, watch} = 연동 비밀번호 — 보드 비밀번호로 지켜지고 모든 기기 공유), `_backup/{prev,daily,undo}`(1시간·하루 자동 백업, 설정에서 되돌리기).
- 항목·칸 단위로 따로 저장 (`flattenPaths`로 경로별 update) → 폰·PC가 서로 덮어쓰지 않음. 저장 상태 점: 초록 저장됨 · 노랑 저장 중 · 코랄 연결 끊김.
- 뼈대 때 브라우저에만 저장하던 `localStorage["nyanya-board-v1"]` 할 일은 보드를 열면 서버로 한 번 옮기고 지움 (`moveOldLocal`).

## 📅 구글 캘린더 연동 (2026-10-20 만듦 — 욱진 보드와 같은 Apps Script 방식)

- 방식: 냐냐 구글 계정 Apps Script(`Code.gs` 로더 → `sync-core.js`)가 5분마다. 사이트에서 구글 로그인 없음. 양쪽 방향.
- 보드 → 구글: 보드가 넣은 일정엔 private 표시 `nyanyaApp=1` · `nyanyaKind`(task|vocab) · `nyanyaRef` → 그것만 고치고 지움. 냐냐가 직접 넣은 일정은 안 건드림. 할 일 `noGoogle: true`면 안 보냄(화면 버튼은 아직 없음). 캘린더는 **이름**으로 찾음(`CAL_NAME`), 못 찾으면 `gsync.missing`에 적고 할 일은 기본 캘린더로.
- 구글 → 보드: 캘린더 전부, 지난달~석 달 뒤 → `nyanya/{방}/gcal` = {at, cals{키:{name,color,sel(구글에서 체크됨),o}}, ev{e0:{t,c,d,e(종일 끝 다음 날),tm,link}}}. 키 = 캘린더 id에서 . # $ [ ] / → _. 동기화 상태 `gsync` = {at, email, version, added, updated, deleted, missing[], vocab}.
- 보드 화면: 하루짜리·시간 일정은 칸 안 글자(캘린더 색 `--gc`), 여러 날 종일 일정은 🎬처럼 막대(`weekBars`). 날짜 창 아래 '📅 구글 일정'. 오늘 옆 [📅 구글] 전체 켜고 끄기(`view.google`), ⚙️ 설정에서 캘린더마다(`view.gcal[키]`, 안 정했으면 구글에서 체크된 캘린더만 = 기본으로 '욱진'은 꺼짐).
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
- 비밀번호: **지금 열린 보드의 `settings.links`만** 씀 (냐냐 요청: 냐냐 보드에서만 보이게). 이 브라우저 앱 비밀번호로 저절로 대신 쓰지 않음 — ⚙️ 설정 [이 브라우저 앱에서 가져오기] 버튼으로만 그 보드에 옮김.
- ⚠️ 보드 비밀번호·연동 비밀번호·그 해시는 공개 저장소에 **절대** 넣지 않기 (해시 = 데이터 자리).
- 보여 주는 것: 첫 화면 요약 칸(스페인어 오늘 복습·🔥 연속 / 이번 달 다 본 작품 수) · 달력: 스페인어는 공부한 날 칸 위 📖 **표시만**, 왓치로그는 **본 기간 막대**(시작~끝, 보는 중이면 오늘까지, 다시 본 기간도. 한 주 최대 3줄 `MAX_LANES`) · 첫 화면 달력 아래 '보는 중' 포스터 · 📖/🎬 탭.
- 달력의 📖·🎬는 '오늘' 옆 버튼으로 켜고 끔 (`settings.view` {vocab, watch} = false면 숨김, 모든 기기 같이). 💰 돈 표시도 나중에 여기 같은 버튼으로.
- 첫 화면 오른쪽 '오늘' 칸은 냐냐 요청으로 뺌 (2026-10-20). 할 일은 날짜를 눌러 뜨는 창에서.
- 계산 규칙은 각 앱과 같게: 스페인어 연속 = core.js `calcStreak`(10/9부터 복습 다 한 날만) · 학습 개수 = `dayActivity` · 오늘 복습 = 그날 일지 `reviewDone`/`reviewLeft`(앱이 마지막으로 저장한 때 기준). 왓치로그 보는 중 = 시작했는데 끝난 날 없음(다시 보기 포함), 다 본 날 = endDate·lastWatchEnd. **앱 쪽 규칙이 바뀌면 여기도 같이.**
- 정확한 '오늘 복습할 단어 수'는 단어장 전체(약 1MB)를 받아야 해서 안 함 (냐냐와 정함).
