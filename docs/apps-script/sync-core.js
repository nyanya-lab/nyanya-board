/**
 * 냐냐 보드 ↔ 구글 캘린더 동기화 본체
 * 냐냐 Apps Script의 짧은 코드(Code.gs)가 5분마다 이 파일을 받아서 실행해요.
 * 여기를 고쳐서 main에 올리면, 다시 붙여넣지 않아도 늦어도 15분 안에 적용돼요.
 *   · 보드 할 일(날짜 있는 것) → '김윤아' 캘린더: 📌 할 일 / ✅ 끝낸 일 (공유 캘린더라 ❌ 같은 표시는 안 넣음)
 *   · 스페인어 공부한 날(최근 60일) → '루틴관리' 캘린더: 📖 스페인어 12개 · 복습 끝 (보드 ⚙️ 연동에 스페인어 비밀번호가 있을 때)
 *   · 💰 돈은 안 보냄 (냐냐와 정함)
 *   · 구글 캘린더 전부(지난달~석 달 뒤) → 보드 달력 (nyanya/{방}/gcal, 캘린더마다 보드에서 켜고 끄기)
 * 보드가 넣은 일정엔 nyanyaApp=1 · nyanyaKind(task|vocab) · nyanyaRef 표시 → 그것만 고치고 지움. 냐냐가 직접 넣은 일정은 안 건드림.
 */
const CORE_VERSION = "2026-10-20b";
const DB_URL = "https://nyanya-board-default-rtdb.asia-southeast1.firebasedatabase.app";
const VOCAB_URL = "https://nyanya-vocab-default-rtdb.firebaseio.com";
const TZ = "Asia/Seoul";
const DESC = "냐냐 보드에서 넣은 일정";
const CAL_NAME = { task: "김윤아", vocab: "루틴관리" };   // 보낼 캘린더 이름 (구글 캘린더 왼쪽 목록 이름 그대로)
const MARK = { plan: "📌 ", done: "✅ ", vocab: "📖 " };
const VOCAB_DAYS = 60;

function nyanyaSync(BOARD_PASSWORD) {
  const base = DB_URL + "/nyanya/" + roomOf_(BOARD_PASSWORD);
  const settings = getJson_(base + "/settings.json");
  if (!settings) throw new Error("이 비밀번호로 만든 냐냐 보드가 없어요. BOARD_PASSWORD를 확인해 주세요.");
  const tasks = getJson_(base + "/tasks.json") || {};
  const cals = calendars_();
  const byName = function (n) { return cals.filter(function (c) { return c.name === n; })[0]; };
  const res = { added: 0, updated: 0, deleted: 0 }, missing = [];

  // 📌 할 일 → 김윤아. 김윤아는 냐냐 기본(primary) 캘린더라 API에선 이름이 이메일로 나옴 → 이름으로 못 찾으면 기본 캘린더 (calendars_에서 이름도 김윤아로 붙임)
  const taskCal = byName(CAL_NAME.task) || cals.filter(function (c) { return c.primary; })[0];
  const taskItems = {};
  Object.keys(tasks).forEach(function (id) {
    const t = tasks[id];
    if (!t || !t.title || !t.date || t.noGoogle) return;
    taskItems["task:" + id] = { summary: (t.done ? MARK.done : MARK.plan) + t.title, date: t.date };
  });
  syncCal_(taskCal.id, "task", taskItems, res);

  // 📖 스페인어 공부한 날 → 루틴관리
  const vocabCal = byName(CAL_NAME.vocab);
  let vocabNote = "";
  if (!vocabCal) missing.push(CAL_NAME.vocab);
  else {
    const vpw = settings.links && settings.links.vocab;
    if (!vpw) vocabNote = "스페인어 비밀번호 없음 (보드 ⚙️ 설정 → 연동)";
    else {
      const diary = vocabDiary_(vpw);
      if (diary === null) vocabNote = "스페인어 기록을 못 읽음";   // 못 읽었을 땐 있던 일정을 지우지 않게 건너뜀
      else {
        const since = addDays_(today_(), -VOCAB_DAYS), items = {};
        Object.keys(diary).forEach(function (d) {
          if (d < since) return;
          const n = dayActivity_(diary[d]);
          if (n > 0) items["vocab:" + d] = { summary: MARK.vocab + "스페인어 " + n + "개" + (diary[d].reviewDone === true ? " · 복습 끝" : ""), date: d };
        });
        syncCal_(vocabCal.id, "vocab", items, res);
      }
    }
  }

  putJson_(base + "/gcal.json", pullFromGoogle_(cals));
  putJson_(base + "/gsync.json", {
    at: Date.now(), email: Session.getEffectiveUser().getEmail(), version: CORE_VERSION,
    added: res.added, updated: res.updated, deleted: res.deleted, missing: missing, vocab: vocabNote
  });
  Logger.log("동기화 코드 " + CORE_VERSION + " · 추가 " + res.added + " · 수정 " + res.updated + " · 삭제 " + res.deleted +
    (missing.length ? " · 못 찾은 캘린더: " + missing.join(", ") : "") + (vocabNote ? " · " + vocabNote : ""));
}

// 한 캘린더 안에서 보드가 넣은 같은 종류(kind) 일정만 맞추기: 없으면 넣고, 바뀌면 고치고, 보드에 없으면 지움
function syncCal_(calId, kind, items, res) {
  const ids = {};
  listAll_(calId, { privateExtendedProperty: "nyanyaApp=1", singleEvents: false }).forEach(function (ev) {
    if (ev.status === "cancelled") return;
    const p = (ev.extendedProperties && ev.extendedProperties.private) || {};
    if (p.nyanyaKind !== kind) return;
    const ref = p.nyanyaRef, it = ref && items[ref];
    if (!it || ids[ref]) { remove_(calId, ev.id); res.deleted++; return; }   // 보드에서 지웠거나 중복
    ids[ref] = ev.id;
    if (ev.summary !== it.summary || !ev.start || ev.start.date !== it.date) {
      Calendar.Events.patch({ summary: it.summary, start: { date: it.date }, end: { date: nextDay_(it.date) } }, calId, ev.id);
      res.updated++;
    }
  });
  Object.keys(items).forEach(function (ref) {
    if (ids[ref]) return;
    const it = items[ref];
    Calendar.Events.insert({
      summary: it.summary, description: DESC, start: { date: it.date }, end: { date: nextDay_(it.date) },
      extendedProperties: { private: { nyanyaApp: "1", nyanyaKind: kind, nyanyaRef: ref } }
    }, calId);
    res.added++;
  });
}

// ---------- 스페인어 일지 (읽기만) ----------
function vocabDiary_(pw) {
  try {
    const root = VOCAB_URL + "/vocab/" + encodeURIComponent(pw);
    const v3 = getJson_(root + "__v3/diary.json");
    if (v3) return v3;
    return getJson_(root + "/nyanyaDiary.json") || {};
  } catch (e) { return null; }
}
// 스페인어 앱 core.js dayActivity와 같은 계산
function dayActivity_(d) {
  if (!d) return 0;
  return (d.quizTotal || 0) + (d.aiSessions || 0) + (d.newWordsCount || 0) + (d.reviewCount || 0) + (d.gameCount || 0)
    + (d.newGrammarCount || 0) + (d.practiceCount || 0) + (d.numTotal || 0);
}

// ---------- 구글 → 보드 (지난달~석 달 뒤, 캘린더 전부) ----------
function pullFromGoogle_(cals) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
  const to = new Date(now.getFullYear(), now.getMonth() + 4, 1).toISOString();
  const out = { at: Date.now(), cals: {}, ev: {} };
  let i = 0;
  cals.forEach(function (c, order) {
    out.cals[c.key] = { name: c.name, color: c.color, sel: c.selected, o: order };
    let list = [];
    try { list = listAll_(c.id, { timeMin: from, timeMax: to, singleEvents: true, orderBy: "startTime" }); } catch (e) { return; }
    list.forEach(function (ev) {
      if (i >= 1500) return;
      const p = ev.extendedProperties && ev.extendedProperties.private;
      if (ev.status === "cancelled" || (p && p.nyanyaApp === "1")) return;   // 보드가 넣은 건 보드에 이미 있음
      const e = { t: ev.summary || "(제목 없음)", c: c.key, link: ev.htmlLink || "" };
      if (ev.start.date) { e.d = ev.start.date; e.e = ev.end.date; }        // 종일: e = 끝 다음 날 (구글 방식)
      else {
        const s = new Date(ev.start.dateTime);
        e.d = Utilities.formatDate(s, TZ, "yyyy-MM-dd");
        e.tm = Utilities.formatDate(s, TZ, "HH:mm");
      }
      out.ev["e" + (i++)] = e;
    });
  });
  return out;
}

// 내 캘린더 목록 (보드 키는 Firebase 칸 이름으로 쓸 수 있게 . # $ [ ] / 를 _ 로)
function calendars_() {
  const out = [];
  let pageToken;
  do {
    const r = Calendar.CalendarList.list({ maxResults: 250, pageToken: pageToken });
    (r.items || []).forEach(function (c) {
      out.push({ id: c.id, key: String(c.id).replace(/[.#$\[\]\/]/g, "_"), name: c.summaryOverride || c.summary || c.id,
        color: c.backgroundColor || "#8A94A6", selected: !!c.selected, primary: !!c.primary });
    });
    // 기본 캘린더는 구글 화면에선 냐냐 이름(김윤아)으로 보이지만 API 이름은 이메일 → 같은 이름이 따로 없으면 김윤아로
    if (!out.some(function (c) { return c.name === CAL_NAME.task; })) out.forEach(function (c) { if (c.primary) c.name = CAL_NAME.task; });
    pageToken = r.nextPageToken;
  } while (pageToken);
  return out;
}

// ---------- 도우미 ----------
function listAll_(calId, opts) {
  const now = new Date();
  const base = {
    timeMin: new Date(now.getFullYear() - 1, now.getMonth(), 1).toISOString(),
    timeMax: new Date(now.getFullYear() + 3, now.getMonth(), 1).toISOString(),
    maxResults: 250
  };
  Object.keys(opts).forEach(function (k) { base[k] = opts[k]; });
  const all = [];
  let pageToken;
  do {
    if (pageToken) base.pageToken = pageToken;
    const r = Calendar.Events.list(calId, base);
    (r.items || []).forEach(function (x) { all.push(x); });
    pageToken = r.nextPageToken;
  } while (pageToken && all.length < 2000);
  return all;
}
function remove_(calId, id) { try { Calendar.Events.remove(calId, id); } catch (e) { /* 이미 없음 */ } }
function today_() { return Utilities.formatDate(new Date(), TZ, "yyyy-MM-dd"); }
function addDays_(ymd, n) {
  const p = ymd.split("-");
  return Utilities.formatDate(new Date(+p[0], +p[1] - 1, +p[2] + n, 12), TZ, "yyyy-MM-dd");
}
function nextDay_(ymd) { return addDays_(ymd, 1); }
// 보드와 같은 방식: 비밀번호 → SHA-256 → 64자 방 이름
function roomOf_(pw) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, "nyanya-board:" + pw, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ("0" + (b & 0xff).toString(16)).slice(-2); }).join("");
}
function getJson_(url) {
  const r = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error("보드를 읽지 못했어요 (" + r.getResponseCode() + ")");
  return JSON.parse(r.getContentText());
}
function putJson_(url, data) {
  const r = UrlFetchApp.fetch(url, { method: "put", contentType: "application/json", payload: JSON.stringify(data), muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) throw new Error("보드에 쓰지 못했어요 (" + r.getResponseCode() + ")");
}
