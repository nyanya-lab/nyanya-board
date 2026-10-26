// 냐냐 보드 — 화면 로직
// 저장: 욱진 보드와 같은 방식. Firebase Realtime Database(nyanya-board)의 nyanya/{SHA-256("nyanya-board:"+비밀번호)} 아래.
// 로그인 없음, 비밀번호 = 저장 위치. 항목마다 따로 저장해서 폰·PC가 서로 덮어쓰지 않음.

import { firebaseConfig } from "./firebase-config.js?v=20261020l";
import { mountUri } from "./uri/uri.js?v=20261026a";
import { createLinks, vocabToday, vocabStreak, isWatching, finishDays, watchPeriods, dayActivity } from "./links.js?v=20261020l";
import { startVerCheck } from "./vercheck.js?v=20261022a";

const FB_VER = "10.12.2";
const ROOT = "nyanya";
const LS_PW = "nyanya-board-pw";
const OLD_LOCAL = "nyanya-board-v1";   // 뼈대 때 이 브라우저에만 저장하던 할 일 → 보드를 열면 서버로 한 번 옮김
const COLS = ["tasks"];
const PAGES = ["home", "spanish", "watch", "money", "uri", "settings"];
const DAY_ITEMS = 3; // PC 달력 칸에 보이는 할 일 수 (넘치면 +N)
const MAX_LANES = 3; // 🎬 한 주에 겹쳐 그리는 작품 막대 줄 수 (넘치면 안 그림, 왓치로그 탭에서 보기)

const $ = (s) => document.querySelector(s);
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

// ── 상태 ──
const S = { tasks: {}, settings: {}, loaded: false, gcal: null, gsync: null };   // gcal·gsync = 냐냐 구글 Apps Script가 5분마다 씀 (apps-script/sync-core.js)
const ui = { month: today().slice(0, 7), sel: today() };
let backend = null;
// 📖🎬 스페인어·왓치로그 (읽기만). 비밀번호는 보드 설정 settings.links 또는 그 앱이 이 브라우저에 기억한 값
const links = createLinks({ onChange: () => { renderTiles(); renderCalendar(); renderDay(); renderLinkPages(); renderLinkSettings(); } });

const tasksOn = (date) => Object.entries(S.tasks)
  .filter(([, t]) => t && t.date === date)
  .sort(([, a], [, b]) => (!!a.done - !!b.done) || ((a.at || 0) - (b.at || 0)));

// ── 저장 상태: 서버에 아직 안 올라간 쓰기 수 + 연결 여부 → 설정 메뉴 옆 점 ──
const sync = { pending: 0, connected: true };
function setSync() {
  let state, text;
  if (!backend) { state = ""; text = "연결 전"; }
  else if (!sync.connected) { state = "off"; text = sync.pending ? `연결 끊김 · 저장 대기 ${sync.pending}개 (연결되면 자동으로 올라가요. 창을 닫지 마세요)` : "연결 끊김 · 다시 연결되면 최신 내용으로 맞춰요"; }
  else if (sync.pending) { state = "wait"; text = "저장 중…"; }
  else { state = "ok"; text = "서버에 저장됨"; }
  document.querySelectorAll("[data-sync]").forEach((d) => { d.dataset.state = state; d.title = text; });
  $("#syncText").textContent = text;
}
function tracked(fn) {
  return (...args) => {
    sync.pending++; setSync();
    return Promise.resolve().then(() => fn(...args)).finally(() => { sync.pending--; setSync(); });
  };
}
window.addEventListener("beforeunload", (e) => { if (sync.pending > 0) { e.preventDefault(); e.returnValue = ""; } });

const isDenied = (e) => e && (e.code === "PERMISSION_DENIED" || /permission/i.test(e.message || ""));
const DENIED_MSG = "Firebase 규칙에 냐냐 보드 칸(nyanya)이 아직 없어요. 규칙을 Firebase 콘솔에 넣어 주세요.";
function act(promise, okMsg) {
  return Promise.resolve(promise).then((r) => { if (okMsg) toast(okMsg); return r; }, (e) => {
    toast(isDenied(e) ? "저장 권한이 없어요. Firebase 규칙을 확인해 주세요." : "저장하지 못했어요. 잠시 뒤 다시 해 주세요.");
    throw e;
  });
}

// 비밀번호 → 방 이름(해시). 비밀번호 원문은 서버에 안 가고, 이 기기에만 기억해요.
async function roomOf(pw) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("nyanya-board:" + pw));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// RTDB update()는 중첩 객체를 통째로 바꾸므로 경로("a/b")로 펼쳐서 합친다
function flattenPaths(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? prefix + "/" + k : k;
    if (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length) flattenPaths(v, key, out);
    else out[key] = v;
  }
  return out;
}

async function firebaseStart() {
  const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
  const [{ initializeApp }, rt] = await Promise.all([import(base + "firebase-app.js"), import(base + "firebase-database.js")]);
  const db = rt.getDatabase(initializeApp(firebaseConfig));
  const path = (room, ...p) => rt.ref(db, [ROOT, room, ...p].join("/"));
  let unsubs = [], pendingPw = null, bakTimer = null;
  rt.onValue(rt.ref(db, ".info/connected"), (snap) => { sync.connected = snap.val() === true; setSync(); });

  const lockScreen = (msg) => {
    unsubs.forEach((u) => u()); unsubs = []; clearInterval(bakTimer);
    backend = null; S.loaded = false; S.tasks = {}; S.gcal = null; S.gsync = null;
    document.body.classList.add("locked");
    $("#loadingView").hidden = true;
    $("#loginView").hidden = false;
    $("#newBoard").hidden = true;
    $("#loginMsg").textContent = msg || "";
    $("#loginPw").focus();
  };

  // 서버 백업 (욱진 보드 방식): 1시간짜리 prev, 하루짜리 daily. 되돌리기 직전 상태는 undo
  const BAK_KINDS = { prev: 60 * 60 * 1000, daily: 24 * 60 * 60 * 1000 };
  const BAK_KEYS = [...COLS, "settings"];
  async function roomSnap(room) {
    const out = {};
    await Promise.all(BAK_KEYS.map(async (k) => { const v = (await rt.get(path(room, k))).val(); if (v != null) out[k] = v; }));
    return out;
  }
  async function rotateBackups(room) {
    try {
      const all = await roomSnap(room);
      if (!COLS.some((c) => all[c] && Object.keys(all[c]).length)) return; // 빈 보드는 백업으로 덮지 않음
      const now = Date.now();
      for (const [kind, ms] of Object.entries(BAK_KINDS)) {
        const savedAt = (await rt.get(path(room, "_backup", kind, "savedAt"))).val() || 0;
        if (now - savedAt < ms) continue;    // 아직 주기가 안 됨
        await rt.set(path(room, "_backup", kind), { ...all, savedAt: now });
      }
    } catch (e) { /* 백업 실패가 사용을 막지는 않음 */ }
  }

  function open(room) {
    backend = {
      add: tracked(async (c, obj) => { const r = rt.push(path(room, c)); await rt.set(r, obj); return r.key; }),
      update: tracked((c, id, patch) => rt.update(path(room, c, id), flattenPaths(patch))),
      remove: tracked((c, id) => rt.remove(path(room, c, id))),
      saveLinks: tracked((patch) => rt.update(path(room, "settings", "links"), patch)),
      saveView: tracked((patch) => rt.update(path(room, "settings", "view"), patch)),
      saveUriPw: tracked((pw) => rt.update(path(room, "settings"), { uriPw: pw })),
      async backups() { return (await rt.get(path(room, "_backup"))).val() || {}; },
      restore: tracked(async (kind) => {
        const bak = (await rt.get(path(room, "_backup", kind))).val(); if (!bak) throw new Error("no backup");
        await rt.set(path(room, "_backup", "undo"), { ...(await roomSnap(room)), savedAt: Date.now() });
        const patch = {};
        BAK_KEYS.forEach((k) => { patch[k] = bak[k] || null; });
        await rt.update(path(room), patch);
      })
    };
    rotateBackups(room);
    clearInterval(bakTimer); bakTimer = setInterval(() => rotateBackups(room), 10 * 60 * 1000);
    lockAction = () => { try { localStorage.removeItem(LS_PW); } catch (e) { /* 무시 */ } location.hash = "#home"; lockScreen("잠갔어요. 다시 열려면 비밀번호를 넣어 주세요."); };

    document.body.classList.remove("locked");
    $("#loginView").hidden = true;
    setSync();
    const onErr = (e) => toast(isDenied(e) ? DENIED_MSG : "데이터를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.");
    const got = {};
    COLS.forEach((c) => {
      unsubs.push(rt.onValue(path(room, c), (snap) => {
        S[c] = snap.val() || {}; got[c] = true;
        S.loaded = COLS.every((k) => got[k]);
        render();
        if (S.loaded) moveOldLocal();
      }, onErr));
    });
    unsubs.push(rt.onValue(path(room, "gcal"), (snap) => { S.gcal = snap.val(); renderCalendar(); renderDay(); renderGoogleSettings(); }, onErr));
    unsubs.push(rt.onValue(path(room, "gsync"), (snap) => { S.gsync = snap.val(); renderGoogleSettings(); }, onErr));
    unsubs.push(rt.onValue(path(room, "settings"), (snap) => {
      S.settings = snap.val() || {};
      links.setPasswords(S.settings.links);
      if (S.settings.uriPw) uri.usePassword(S.settings.uriPw);   // 🤝 보드에 기억한 공통 비밀번호로 우리 탭 열기
      renderLinkSettings();
      renderToggles();
      renderCalendar();
      renderGoogleSettings();
    }, onErr));
    render();
    if (location.hash === "#settings") renderBackups();
  }

  async function tryPassword(pw, remember) {
    const room = await roomOf(pw);
    const snap = await rt.get(path(room, "settings"));
    if (!snap.exists()) return false;
    if (remember) { try { localStorage.setItem(LS_PW, pw); } catch (e) { /* 무시 */ } }
    open(room);
    return true;
  }

  $("#loginForm").onsubmit = async (ev) => {
    ev.preventDefault();
    const pw = $("#loginPw").value;
    $("#loginMsg").textContent = ""; $("#newBoard").hidden = true;
    if (pw.length < 6) { $("#loginMsg").textContent = "비밀번호는 6자 이상으로 해 주세요."; return; }
    try {
      if (await tryPassword(pw, true)) { $("#loginPw").value = ""; return; }
      pendingPw = pw; $("#newBoard").hidden = false;   // 오타로 빈 보드가 생기지 않게 한 번 더 확인
    } catch (e) {
      $("#loginMsg").textContent = isDenied(e) ? DENIED_MSG : "열지 못했어요. 인터넷 연결을 확인해 주세요.";
    }
  };
  $("#newBoardYes").onclick = async () => {
    if (!pendingPw) return;
    try {
      const room = await roomOf(pendingPw);
      await rt.set(path(room, "settings"), { createdAt: Date.now() });
      try { localStorage.setItem(LS_PW, pendingPw); } catch (e) { /* 무시 */ }
      pendingPw = null; $("#loginPw").value = "";
      open(room);
      toast("새 보드를 만들었어요. 다른 기기에서도 같은 비밀번호로 열면 돼요.");
    } catch (e) {
      $("#loginMsg").textContent = isDenied(e) ? DENIED_MSG : "만들지 못했어요. 인터넷 연결을 확인해 주세요.";
    }
  };
  $("#newBoardNo").onclick = () => { pendingPw = null; lockScreen(""); };

  let saved = null;
  try { saved = localStorage.getItem(LS_PW); } catch (e) { /* 무시 */ }
  if (!saved) { lockScreen(""); return; }
  try {
    if (!(await tryPassword(saved, false))) lockScreen("저장된 비밀번호로 보드를 찾지 못했어요. 다시 넣어 주세요.");
  } catch (e) {
    lockScreen(isDenied(e) ? DENIED_MSG : "연결하지 못했어요. 인터넷 연결을 확인해 주세요.");
  }
}
let lockAction = null;

// 뼈대 때 이 브라우저에만 적어 둔 할 일을 서버 보드로 옮기고 지움 (한 번만)
let moving = false;
async function moveOldLocal() {
  if (moving) return;
  let old = null;
  try { old = JSON.parse(localStorage.getItem(OLD_LOCAL)); } catch (e) { /* 깨진 값은 무시 */ }
  const list = old && old.tasks ? Object.values(old.tasks).filter((t) => t && t.title && t.date) : [];
  if (!list.length) return;
  moving = true;
  try {
    for (const t of list) await backend.add("tasks", { title: t.title, date: t.date, done: !!t.done, at: t.at || Date.now() });
    localStorage.removeItem(OLD_LOCAL);
    toast(`이 브라우저에 있던 할 일 ${list.length}개를 보드로 옮겼어요.`);
  } catch (e) { /* 다음에 다시 시도 */ }
  moving = false;
}

// ── 그리기 ──
function render() {
  renderTiles();
  renderCalendar();
  renderDay();
}

function renderTiles() {
  const list = tasksOn(today());
  $("#tileTodo").textContent = `${list.filter(([, t]) => t.done).length} / ${list.length}`;
  const v = links.st.vocab, w = links.st.watch;
  let vt = "연결 전", vs = "";
  if (v.state === "loading") vt = "…";
  else if (v.state === "ok" || v.state === "empty") {
    const t = vocabToday(v.diary, today()), n = vocabStreak(v.diary);
    vt = t.kind === "done" ? "복습 끝 ✅" : t.kind === "left" ? `남은 복습 ${t.left}` : "아직 안 함";
    vs = n ? `🔥 ${n}일` : "";
  } else if (v.state === "error") vt = "연결 안 됨";
  $("#tileVocab").textContent = vt;
  $("#tileVocabSub").textContent = vs;
  let wt = "연결 전";
  if (w.state === "loading") wt = "…";
  else if (w.state === "ok" || w.state === "empty") wt = `${watchedIn(today().slice(0, 7)).length}편`;
  else if (w.state === "error") wt = "연결 안 됨";
  $("#tileWatch").textContent = wt;
}

// 🎬 그 기간(YYYY-MM 또는 YYYY)에 다 본 작품 [{x, day}] (다시 본 것도 끝낸 날로)
function watchedIn(prefix) {
  const out = [];
  for (const x of Object.values(links.st.watch.items || {})) {
    for (const d of finishDays(x)) if (d.startsWith(prefix)) out.push({ x, day: d });
  }
  return out.sort((a, b) => b.day.localeCompare(a.day));
}
// 달력에 📖·🎬 보이기 (오늘 옆 버튼, 보드 설정 settings.view — 기본 켜짐, 모든 기기 같이)
const viewOn = (k) => !(S.settings.view && S.settings.view[k] === false);
function renderToggles() {
  document.querySelectorAll('[data-act="toggleView"]').forEach((b) => b.setAttribute("aria-pressed", String(viewOn(b.dataset.k))));
}
// 📅 구글 캘린더: 전체 버튼(view.google) + 캘린더마다(view.gcal[키], 정하지 않았으면 구글에서 체크된 캘린더만)
function gcalOn(k) {
  if (!viewOn("google") || !S.gcal || !S.gcal.cals || !S.gcal.cals[k]) return false;
  const v = S.settings.view && S.settings.view.gcal && S.settings.view.gcal[k];
  return v === undefined ? !!S.gcal.cals[k].sel : v === true;
}
const gcolor = (k) => (S.gcal && S.gcal.cals && S.gcal.cals[k] && S.gcal.cals[k].color) || "#8A94A6";
// 구글 일정: 하루짜리(시간 있는 일정 포함)는 칸 안 글자, 여러 날 종일 일정은 막대
const gMulti = (e) => !!(e.e && e.e > addDay(e.d, 1));
function gEventsOn(day) {
  if (!S.gcal || !S.gcal.ev) return [];
  return Object.values(S.gcal.ev).filter((e) => e && e.d && gcalOn(e.c) && (e.d === day || (e.e && e.d <= day && day < e.e)))
    .sort((a, b) => (a.tm ? 1 : 0) - (b.tm ? 1 : 0) || String(a.tm || "").localeCompare(String(b.tm || "")));
}
function addDay(s, n) { const d = new Date(s + "T00:00:00"); d.setDate(d.getDate() + n); return ymd(d); }

// 🎬 이번 주(일~토)에 걸친 작품 막대: 주 밖은 잘라서, 겹치면 아래 줄로 [{a, b, lane, x, s, e, open}] (a·b = 0~6 칸)
function weekBars(weekStart, weekEnd) {
  const segs = [];
  const add = (p, extra) => {
    if (p.e < weekStart || p.s > weekEnd) return;
    const s = p.s < weekStart ? weekStart : p.s, e = p.e > weekEnd ? weekEnd : p.e;
    const a = Math.round((new Date(s + "T00:00:00") - new Date(weekStart + "T00:00:00")) / 86400000);
    const b = Math.round((new Date(e + "T00:00:00") - new Date(weekStart + "T00:00:00")) / 86400000);
    segs.push({ a, b, head: p.s >= weekStart, tail: p.e <= weekEnd && !p.open, open: p.open && p.e <= weekEnd, from: p.s, to: p.open ? "" : p.e, ...extra });
  };
  if (viewOn("watch")) {
    for (const x of Object.values(links.st.watch.items || {})) {
      for (const p of watchPeriods(x, today())) add(p, { label: `🎬 ${x.title || ""}${x.season ? ` ${x.season}` : ""}`, tip: `${x.title || ""} ${md(p.s)}~${p.open ? " 보는 중" : md(p.e)}` });
    }
  }
  if (S.gcal && S.gcal.ev) {
    for (const ev of Object.values(S.gcal.ev)) {
      if (!ev || !ev.d || !gMulti(ev) || !gcalOn(ev.c)) continue;
      add({ s: ev.d, e: addDay(ev.e, -1), open: false }, { label: ev.t, tip: `${ev.t} ${md(ev.d)}~${md(addDay(ev.e, -1))}`, color: gcolor(ev.c) });
    }
  }
  segs.sort((p, q) => p.a - q.a || (q.b - q.a) - (p.b - p.a));
  const ends = [];
  for (const g of segs) {
    let lane = ends.findIndex((end) => end < g.a);
    if (lane < 0) { lane = ends.length; ends.push(g.b); } else ends[lane] = g.b;
    g.lane = lane;
  }
  return segs.filter((g) => g.lane < MAX_LANES);
}

let weekHtml = "";
function renderCalendar() {
  const [y, m] = ui.month.split("-").map(Number);
  $("#calTitle").textContent = `${y}년 ${m}월`;
  const first = new Date(y, m - 1, 1);
  const start = new Date(y, m - 1, 1 - first.getDay());
  const weeks = Math.ceil((first.getDay() + new Date(y, m, 0).getDate()) / 7);
  const t = today();
  const diary = viewOn("vocab") ? (links.st.vocab.diary || {}) : {};
  let html = "";
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = ymd(d);
    let bars = [];
    if (i % 7 === 0) {   // 주 시작: 작품 막대 줄 수만큼 칸 안에 자리 비우기
      const end = new Date(d); end.setDate(end.getDate() + 6);
      bars = weekBars(key, ymd(end));
      const lanes = bars.length ? Math.max(...bars.map((g) => g.lane)) + 1 : 0;
      html += `<div class="cal-week" style="--lanes:${lanes}">`;
    }
    const list = tasksOn(key);
    const cls = ["day",
      key.slice(0, 7) !== ui.month && "out",
      key === t && "today",
      key === ui.sel && "sel",
      d.getDay() === 0 && "sun",
      d.getDay() === 6 && "sat"].filter(Boolean).join(" ");
    const gs = gEventsOn(key).filter((e) => !gMulti(e));   // 여러 날 일정은 막대로
    const all = list.map(([, x]) => `<span class="day-item${x.done ? " done" : ""}">${esc(x.title)}</span>`)
      .concat(gs.map((e) => `<span class="day-item g" style="--gc:${esc(gcolor(e.c))}">${e.tm ? `<b>${esc(e.tm)}</b> ` : ""}${esc(e.t)}</span>`));
    const items = all.slice(0, DAY_ITEMS + 1).join("");
    const more = all.length > DAY_ITEMS + 1 ? `<span class="day-more">+${all.length - DAY_ITEMS - 1}</span>` : "";
    const gdots = gs.slice(0, 3).map((e) => `<i class="g" style="--gc:${esc(gcolor(e.c))}"></i>`).join("");
    const dots = list.length || gdots ? `<span class="dots">${list.slice(0, 3).map(([, x]) => `<i${x.done ? ' class="done"' : ""}></i>`).join("")}${gdots}</span>` : "";
    const studied = dayActivity(diary[key]);
    const marks = studied ? `<span class="day-ext"><i title="스페인어 ${studied}개 학습">📖</i></span>` : "";
    html += `<button type="button" class="${cls}" data-date="${key}" aria-label="${d.getMonth() + 1}월 ${d.getDate()}일, 할 일 ${list.length}개"><span class="day-top"><span class="num">${d.getDate()}</span>${marks}</span><span class="day-gap"></span>${items}${more}${dots}</button>`;
    if (i % 7 === 0) weekHtml = bars.map((g) => `<span class="wbar${g.head ? " s" : ""}${g.tail ? " e" : ""}${g.open ? " open" : ""}${g.color ? " g" : ""}" style="grid-column:${g.a + 1} / ${g.b + 2};grid-row:${g.lane + 1}${g.color ? `;--gc:${esc(g.color)}` : ""}" title="${esc(g.tip)}">${g.head || g.a === 0 ? esc(g.label) : ""}</span>`).join("");
    if (i % 7 === 6) html += `<div class="wk-bars" aria-hidden="true">${weekHtml}</div></div>`;
  }
  $("#calGrid").innerHTML = html;
}

function renderDay() {
  const d = new Date(ui.sel + "T00:00:00");
  const label = `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
  $("#dayTitle").textContent = ui.sel === today() ? `오늘 · ${label}` : label;
  const list = tasksOn(ui.sel);
  $("#todoList").innerHTML = !S.loaded
    ? `<li class="empty">불러오는 중…</li>`
    : list.length
      ? list.map(([id, t]) => `<li class="${t.done ? "done" : ""}">
        <input type="checkbox" data-check="${id}" ${t.done ? "checked" : ""} aria-label="끝냄">
        <span class="t">${esc(t.title)}</span>
        <button type="button" class="del" data-del="${id}" aria-label="지우기">×</button></li>`).join("")
      : `<li class="empty">할 일이 없어요.</li>`;
  const gs = gEventsOn(ui.sel);
  $("#dayG").hidden = !gs.length;
  $("#dayGList").innerHTML = gs.map((e) => `<li><i style="--gc:${esc(gcolor(e.c))}"></i><span class="t">${e.tm ? `<b>${esc(e.tm)}</b> ` : ""}${esc(e.t)}<small class="muted"> · ${esc((S.gcal.cals[e.c] || {}).name || "")}</small></span>${/^https:\/\/www\.google\.com\//.test(e.link || "") ? `<a href="${esc(e.link)}" target="_blank" rel="noopener" aria-label="구글 캘린더에서 열기">↗</a>` : ""}</li>`).join("");
}

// ⚙️ 설정 → 구글 캘린더: 동기화 상태 + 캘린더마다 보드에 보이기
function renderGoogleSettings() {
  const g = S.gsync, box = $("#gStatus");
  if (!g || !g.at) box.innerHTML = `<span class="sync-dot"></span><span>아직 연결 안 됨 · <a href="google-sync.html" target="_blank" rel="noopener">설정 방법 보기 ↗</a></span>`;
  else {
    const min = Math.round((Date.now() - g.at) / 60000), late = min > 20;
    const when = min < 1 ? "방금" : min < 60 ? `${min}분 전` : `${Math.round(min / 60)}시간 전`;
    box.innerHTML = `<span class="sync-dot" data-state="${late ? "off" : "ok"}"></span><span>${late ? "구글 동기화 멈춤" : "자동 동기화 중"} · 마지막 ${when}${g.email ? ` · ${esc(g.email)}` : ""}</span>`;
  }
  const notes = [];
  if (g && g.missing && g.missing.length) notes.push(`구글에서 '${g.missing.join("', '")}' 캘린더를 못 찾았어요${g.missing.includes("김윤아") ? " (할 일은 기본 캘린더로 보냈어요)" : ""}.`);
  if (g && g.vocab) notes.push(`📖 ${g.vocab}`);
  $("#gNote").textContent = notes.join(" ");
  $("#gNote").hidden = !notes.length;
  const cals = (S.gcal && S.gcal.cals) || {};
  const keys = Object.keys(cals).sort((a, b) => (cals[a].o || 0) - (cals[b].o || 0));
  $("#gCals").innerHTML = keys.length ? keys.map((k) => `<li><label><input type="checkbox" data-gcal="${esc(k)}" ${gcalOn(k) || (!viewOn("google") && (S.settings.view?.gcal?.[k] ?? cals[k].sel)) ? "checked" : ""}><i style="--gc:${esc(cals[k].color)}"></i>${esc(cals[k].name)}</label></li>`).join("") : `<li class="muted">동기화가 한 번 돌면 캘린더 목록이 여기 나와요.</li>`;
}

// 📖 스페인어 · 🎬 왓치로그 탭 + 첫 화면 '보는 중'
function linkMsg(s, name) {
  if (s.state === "nopw") return `<p class="muted">${name} 비밀번호가 아직 없어요. <a href="#settings">⚙️ 설정 → 연동</a>에서 넣어 주세요.</p>`;
  if (s.state === "loading" || s.state === "off") return `<p class="muted">불러오는 중…</p>`;
  if (s.state === "error") return `<p class="muted">${name}에 ${s.err || "연결하지 못했어요"}. 비밀번호와 인터넷 연결을 확인해 주세요.</p>`;
  if (s.state === "empty") return `<p class="muted">이 비밀번호 자리에 기록이 없어요. 비밀번호가 맞는지 확인해 주세요.</p>`;
  return "";
}
function poster(x, cls) {
  return x.poster ? `<img class="${cls}" src="${esc(String(x.poster).replace("/w500/", "/w185/"))}" alt="" loading="lazy">` : `<span class="${cls} no-poster">🎬</span>`;
}
const md = (s) => String(s || "").slice(5, 10).replace("-", "/");
function renderLinkPages() {
  const v = links.st.vocab, w = links.st.watch, t = today();
  // 📖 스페인어
  let vh = linkMsg(v, "스페인어");
  if (!vh) {
    const td = vocabToday(v.diary, t), n = vocabStreak(v.diary), m = t.slice(0, 7);
    const days = Object.entries(v.diary).filter(([d, e]) => d.startsWith(m) && dayActivity(e) > 0);
    const by = td.kind === "left" && td.by ? `단어 ${td.by[0]} · 관용구 ${td.by[1]} · 문법 ${td.by[2]}` : td.act ? `오늘 ${td.act}개 학습` : "";
    const status = td.kind === "done" ? "복습 다 했어요 ✅" : td.kind === "left" ? `남은 복습 ${td.left}개` : td.kind === "open" ? "열어 봤어요" : "아직 안 했어요";
    const recent = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const k = ymd(d), e = v.diary[k], a = dayActivity(e);
      recent.push(`<li class="${a ? (e.reviewDone === true ? "on" : "part") : ""}" title="${k} · ${a}개"><b>${d.getDate()}</b><span>${a || "·"}</span></li>`);
    }
    vh = `<div class="link-tiles">
        <div class="tile t-sun"><span class="tile-k">오늘</span><b class="tile-v small">${esc(status)}</b>${by ? `<span class="tile-note">${esc(by)}</span>` : ""}</div>
        <div class="tile t-coral"><span class="tile-k">🔥 연속 공부</span><b class="tile-v">${n}일</b></div>
        <div class="tile t-mint"><span class="tile-k">이번 달 공부한 날</span><b class="tile-v">${days.length}일</b></div>
      </div>
      <div class="card"><h3>최근 2주</h3><ul class="recent">${recent.join("")}</ul>
      <p class="muted small">숫자 = 그날 학습한 개수. 초록 = 복습까지 다 한 날 (🔥 연속에 들어가요). 스페인어 앱에서 마지막으로 저장한 때 기준이에요.</p></div>`;
  }
  $("#vocabView").innerHTML = vh;
  // 🎬 왓치로그
  let wh = linkMsg(w, "왓치로그");
  let watching = [];
  if (!wh) {
    watching = Object.values(w.items).filter(isWatching)
      .sort((a, b) => String(b.lastWatchStart || b.startDate).localeCompare(String(a.lastWatchStart || a.startDate)));
    const month = watchedIn(t.slice(0, 7)), year = new Set(watchedIn(t.slice(0, 4)).map((r) => r.x.id || r.x.title)).size;
    const watchingHtml = watching.map((x) => `<li>${poster(x, "pst")}<span>${esc(x.title || "")}${x.season ? ` ${esc(x.season)}` : ""}</span><small class="muted">${md(x.lastWatchStart || x.startDate)}~</small></li>`).join("");
    const monthHtml = month.map(({ x, day }) => `<li>${poster(x, "pst-s")}<span class="grow"><b>${esc(x.title || "")}${x.season ? ` ${esc(x.season)}` : ""}</b><small class="muted">${md(day)} · ${esc(x.type || "")}${x.ott ? ` · ${esc(x.ott)}` : ""}</small></span>${x.rating != null ? `<b class="rate">⭐ ${esc(x.rating)}</b>` : ""}</li>`).join("");
    wh = `<div class="link-tiles">
        <div class="tile t-grape"><span class="tile-k">지금 보는 중</span><b class="tile-v">${watching.length}편</b></div>
        <div class="tile t-coral"><span class="tile-k">이번 달 다 본 작품</span><b class="tile-v">${month.length}편</b></div>
        <div class="tile t-mint"><span class="tile-k">올해 다 본 작품</span><b class="tile-v">${year}편</b></div>
      </div>
      ${watching.length ? `<div class="card"><h3>보는 중</h3><ul class="posters">${watchingHtml}</ul></div>` : ""}
      <div class="card"><h3>이번 달 다 본 작품</h3>${month.length ? `<ul class="watched">${monthHtml}</ul>` : `<p class="muted">이번 달은 아직 다 본 작품이 없어요.</p>`}</div>`;
  }
  $("#watchView").innerHTML = wh;
  // 첫 화면 '보는 중'
  $("#homeWatching").hidden = !watching.length;
  $("#homeWatchingList").innerHTML = watching.slice(0, 6).map((x) => `<li>${poster(x, "pst")}<span>${esc(x.title || "")}</span></li>`).join("");
}

// ⚙️ 설정 → 연동: 비밀번호는 보드 설정에 저장 (보드 비밀번호로 지켜지고 모든 기기에서 같이 씀)
function renderLinkSettings() {
  const L = S.settings.links || {};
  for (const [kind, name] of [["vocab", "스페인어"], ["watch", "왓치로그"]]) {
    const s = links.st[kind];
    const txt = s.state === "ok" ? "✅ 연결됨" : s.state === "loading" ? "불러오는 중…" : s.state === "empty" ? "⚠️ 이 비밀번호 자리에 기록이 없어요" : s.state === "error" ? "⚠️ 연결 안 됨" : "아직 비밀번호 없음";
    $(`#link-${kind}-st`).textContent = txt;
    $(`#link-${kind}`).placeholder = L[kind] ? "•••••• (보드에 저장됨)" : `${name} 동기화 비밀번호`;
    $(`#link-${kind}-clear`).hidden = !L[kind];
  }
  // 이 브라우저의 스페인어·왓치로그 앱에 비밀번호가 있고 보드엔 아직 없으면 [가져오기]
  $("#linkImport").hidden = !backend || !["vocab", "watch"].some((k) => !L[k] && links.appPassword(k));
}

const BAK_LABEL = { prev: "1시간 백업", daily: "하루 백업", undo: "되돌리기 직전" };
async function renderBackups() {
  const box = $("#bakList");
  if (!backend) { box.innerHTML = ""; return; }
  box.innerHTML = `<li class="muted">불러오는 중…</li>`;
  try {
    const b = await backend.backups();
    const rows = Object.keys(BAK_LABEL).filter((k) => b[k] && b[k].savedAt).map((k) => {
      const n = Object.keys(b[k].tasks || {}).length;
      const at = new Date(b[k].savedAt);
      return `<li><span class="grow"><b>${BAK_LABEL[k]}</b> · ${at.getMonth() + 1}/${at.getDate()} ${pad(at.getHours())}:${pad(at.getMinutes())} · 할 일 ${n}개</span>
        <button class="btn ghost small" type="button" data-restore="${k}">되돌리기</button></li>`;
    });
    box.innerHTML = rows.join("") || `<li class="muted">아직 백업이 없어요. 할 일이 생기면 자동으로 만들어요.</li>`;
  } catch (e) {
    box.innerHTML = `<li class="muted">백업을 불러오지 못했어요.</li>`;
  }
}

function renderPage() {
  const page = PAGES.includes(location.hash.slice(1)) ? location.hash.slice(1) : "home";
  for (const p of PAGES) $(`#page-${p}`).hidden = p !== page;
  document.querySelectorAll("[data-page]").forEach((a) => a.classList.toggle("on", a.dataset.page === page));
  if (page === "settings") renderBackups();
  window.scrollTo(0, 0);
}

let toastTimer = 0;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

// ── 할 일 ──
function shiftMonth(n) {
  const [y, m] = ui.month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  ui.month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  renderCalendar();
}

document.addEventListener("click", (e) => {
  const act_ = e.target.closest("[data-act]");
  if (act_) {
    const a = act_.dataset.act;
    if (a === "prevMonth") shiftMonth(-1);
    else if (a === "nextMonth") shiftMonth(1);
    else if (a === "goToday") { ui.sel = today(); ui.month = ui.sel.slice(0, 7); render(); }
    else if (a === "closeDay") $("#dayDlg").close();
    else if (a === "toggleView" && act_.dataset.k === "google" && !(S.gsync && S.gsync.at)) { location.hash = "#settings"; toast("먼저 구글 캘린더를 연결해 주세요."); }
    else if (a === "toggleView") {
      if (!backend) return;
      const k = act_.dataset.k;
      act(backend.saveView({ [k]: !viewOn(k) })).catch(() => {});
    }
    else if (a === "lock" && lockAction && confirm("이 기기를 잠글까요? 다시 열려면 비밀번호가 필요해요.")) lockAction();
    return;
  }
  const day = e.target.closest("[data-date]");
  if (day) {
    ui.sel = day.dataset.date;
    if (ui.sel.slice(0, 7) !== ui.month) ui.month = ui.sel.slice(0, 7);
    renderCalendar();
    renderDay();
    const dlg = $("#dayDlg");
    if (!dlg.open) dlg.showModal();
    if (matchMedia("(min-width: 721px)").matches) $("#todoInput").focus();   // 폰에선 자판이 바로 안 올라오게
    return;
  }
  const del = e.target.closest("[data-del]");
  if (del && backend) {
    act(backend.remove("tasks", del.dataset.del)).catch(() => {});
    return;
  }
  const rs = e.target.closest("[data-restore]");
  if (rs && backend && confirm(`${BAK_LABEL[rs.dataset.restore]} 백업으로 되돌릴까요? 지금 상태는 '되돌리기 직전'으로 남아요.`)) {
    act(backend.restore(rs.dataset.restore), "백업으로 되돌렸어요.").then(renderBackups).catch(() => {});
  }
});

document.addEventListener("change", (e) => {
  const id = e.target.dataset && e.target.dataset.check;
  if (!id || !S.tasks[id] || !backend) return;
  act(backend.update("tasks", id, { done: e.target.checked })).catch(() => { e.target.checked = !e.target.checked; });
});

// 창 바깥(어두운 곳)을 누르면 닫기
$("#dayDlg").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

// 캘린더마다 보드에 보이기
document.addEventListener("change", (e) => {
  const k = e.target.dataset && e.target.dataset.gcal;
  if (!k || !backend) return;
  act(backend.saveView({ ["gcal/" + k]: e.target.checked })).catch(() => { e.target.checked = !e.target.checked; });
});

$("#linkForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!backend) return;
  const patch = {};
  for (const kind of ["vocab", "watch"]) { const v = $(`#link-${kind}`).value.trim(); if (v) patch[kind] = v; }
  if (!Object.keys(patch).length) { toast("넣은 비밀번호가 없어요."); return; }
  act(backend.saveLinks(patch), "연동 비밀번호를 저장했어요. 다른 기기에서도 같이 써요.").then(() => {
    for (const kind of Object.keys(patch)) $(`#link-${kind}`).value = "";
  }).catch(() => {});
});
$("#linkImport").addEventListener("click", () => {
  if (!backend) return;
  const L = S.settings.links || {}, patch = {};
  for (const k of ["vocab", "watch"]) { const pw = links.appPassword(k); if (pw && !L[k]) patch[k] = pw; }
  if (!Object.keys(patch).length) { toast("가져올 비밀번호가 없어요."); return; }
  act(backend.saveLinks(patch), "이 브라우저 앱의 비밀번호를 이 보드에 저장했어요.").catch(() => {});
});
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-link-clear]");
  if (!b || !backend) return;
  const kind = b.dataset.linkClear;
  if (!confirm("보드에 저장한 이 비밀번호를 지울까요? (그 앱의 데이터는 그대로예요)")) return;
  act(backend.saveLinks({ [kind]: null }), "지웠어요.").catch(() => {});
});

$("#todoForm").addEventListener("submit", (e) => {
  e.preventDefault();
  if (!backend || !S.loaded) { toast("아직 불러오는 중이에요."); return; }
  const input = $("#todoInput");
  const title = input.value.trim();
  if (!title) return;
  input.value = "";
  act(backend.add("tasks", { title, date: ui.sel, done: false, at: Date.now() })).catch(() => { input.value = title; });
});

// ── 시작 ──
function renderToday() {
  const d = new Date();
  $("#todayLabel").textContent = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${DOW[d.getDay()]}요일`;
  $("#todayMono").textContent = today();
}
window.addEventListener("hashchange", renderPage);
renderToday();
// 🤝 우리 탭: 욱진 보드와 같은 코드(uri/uri.js), 공통 저장소(uri-board)에 따로 연결
const uri = mountUri($("#uriRoot"), {
  who: "nyanya",
  toast,
  mirror: true,   // 공통비용은 가계부에서 ❤️로 적음 (여기선 보기만)
  // 한 번 넣은 공통 비밀번호를 이 보드 설정에 기억 → 다른 기기에선 보드 비밀번호만 넣으면 우리 탭도 열림
  savePassword: (pw) => { if (backend) act(backend.saveUriPw(pw || null)).catch(() => {}); },
  onSummary: ({ total, connected }) => { $("#tileUri").textContent = connected ? total.toLocaleString("ko-KR") + "원" : "열기 전"; }
});
renderPage();
render();
renderLinkPages();
renderLinkSettings();
renderToggles();
renderGoogleSettings();
setSync();
firebaseStart().catch(() => {
  document.body.classList.add("locked");
  $("#loadingView").hidden = true;
  $("#loginView").hidden = false;
  $("#loginMsg").textContent = "저장소에 연결하지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.";
});
// 🔄 새 버전 알림 (욱진 보드처럼)
startVerCheck(new URL(import.meta.url).searchParams.get("v"));
