/**
 * 냐냐 보드 ↔ 구글 캘린더 자동 동기화 (자동 업데이트 버전)
 * 냐냐 구글 계정의 Apps Script(script.google.com)에 이 짧은 코드만 넣어 두면,
 * 5분마다 사이트에서 최신 동기화 코드(sync-core.js)를 받아와 실행해요.
 * → 동기화 기능이 바뀌어도 여기를 다시 붙여넣을 필요가 없어요.
 *
 * 처음 한 번만:
 *   1) 아래 BOARD_PASSWORD 에 냐냐 보드 비밀번호 넣고 저장
 *   2) 왼쪽 '서비스' + → Google Calendar API 추가
 *   3) 위쪽 함수 고르는 칸에서 setup 고르고 ▶ 실행 → 권한 허락
 */

const BOARD_PASSWORD = "";   // ← 여기에 냐냐 보드 비밀번호 (따옴표 안에)

const CORE_URL = "https://nyanya-lab.github.io/nyanya-board/apps-script/sync-core.js";

// 처음 한 번 실행: 5분마다 sync가 돌게 예약하고 바로 한 번 맞춰요
function setup() {
  checkPassword_();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === "sync") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("sync").timeBased().everyMinutes(5).create();
  sync();
  Logger.log("설정 끝! 이제 5분마다 자동으로 맞춰요.");
}

// 자동 동기화를 멈추고 싶을 때 실행
function stop() {
  ScriptApp.getProjectTriggers().forEach(function (t) { ScriptApp.deleteTrigger(t); });
  Logger.log("자동 동기화를 멈췄어요.");
}

function sync() {
  checkPassword_();
  loadCore_().sync(BOARD_PASSWORD);
}

// 최신 동기화 코드 받아오기: 10분 동안은 받아 둔 걸 쓰고, 사이트가 잠깐 안 열리면 6시간 안의 마지막 코드로 돌아요
function loadCore_() {
  const cache = CacheService.getScriptCache();
  let code = cache.get("core");
  if (!code) {
    try {
      const r = UrlFetchApp.fetch(CORE_URL + "?t=" + Date.now(), { muteHttpExceptions: true });
      if (r.getResponseCode() === 200) code = r.getContentText();
    } catch (e) { /* 아래에서 예비 코드 사용 */ }
    if (code) {
      cache.put("core", code, 600);
      cache.put("core_last", code, 21600);
    } else {
      code = cache.get("core_last");
      if (!code) throw new Error("동기화 코드를 받아오지 못했어요. 잠시 뒤 다시 실행해 주세요.");
    }
  }
  return new Function(code + "\nreturn { sync: nyanyaSync };")();
}

// 바로 새 코드로 돌리고 싶을 때 (받아 둔 코드 지우고 sync)
function refresh() {
  CacheService.getScriptCache().removeAll(["core", "core_last"]);
  sync();
}

function checkPassword_() {
  if (!BOARD_PASSWORD) throw new Error("맨 위 BOARD_PASSWORD에 냐냐 보드 비밀번호를 넣고 저장해 주세요.");
}

// 실행되지 않아요. 동기화 코드가 쓰는 권한(캘린더·인터넷·시간 예약)을 구글이 미리 알 수 있게 적어 둔 거예요.
function permissions_() {
  Calendar.Events.list("primary");
  Calendar.CalendarList.list();
  UrlFetchApp.fetch("https://example.com");
  ScriptApp.getProjectTriggers();
  Session.getEffectiveUser().getEmail();
  Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, "");
}
