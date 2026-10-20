// 냐냐 보드 — 화면 로직
// 저장: 욱진 보드와 같은 방식. Firebase Realtime Database(ukjin-207a3)의 nyanya/{SHA-256("nyanya-board:"+비밀번호)} 아래.
// 로그인 없음, 비밀번호 = 저장 위치. 항목마다 따로 저장해서 폰·PC가 서로 덮어쓰지 않음.

import { firebaseConfig } from "./firebase-config.js?v=20261020d";
import { mountUri } from "./uri/uri.js?v=20261020d";

const FB_VER = "10.12.2";
const ROOT = "nyanya";
const LS_PW = "nyanya-board-pw";
const OLD_LOCAL = "nyanya-board-v1";   // 뼈대 때 이 브라우저에만 저장하던 할 일 → 보드를 열면 서버로 한 번 옮김
const COLS = ["tasks"];
const PAGES = ["home", "spanish", "watch", "money", "uri", "settings"];
const DAY_ITEMS = 3; // PC 달력 칸에 보이는 할 일 수 (넘치면 +N)

const $ = (s) => document.querySelector(s);
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

// ── 상태 ──
const S = { tasks: {}, settings: {}, loaded: false };
const ui = { month: today().slice(0, 7), sel: today() };
let backend = null;

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
    backend = null; S.loaded = false; S.tasks = {};
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
    unsubs.push(rt.onValue(path(room, "settings"), (snap) => { S.settings = snap.val() || {}; }, onErr));
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
}

function renderCalendar() {
  const [y, m] = ui.month.split("-").map(Number);
  $("#calTitle").textContent = `${y}년 ${m}월`;
  const first = new Date(y, m - 1, 1);
  const start = new Date(y, m - 1, 1 - first.getDay());
  const weeks = Math.ceil((first.getDay() + new Date(y, m, 0).getDate()) / 7);
  const t = today();
  let html = "";
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = ymd(d);
    const list = tasksOn(key);
    const cls = ["day",
      key.slice(0, 7) !== ui.month && "out",
      key === t && "today",
      key === ui.sel && "sel",
      d.getDay() === 0 && "sun",
      d.getDay() === 6 && "sat"].filter(Boolean).join(" ");
    const items = list.slice(0, DAY_ITEMS)
      .map(([, x]) => `<span class="day-item${x.done ? " done" : ""}">${esc(x.title)}</span>`).join("");
    const more = list.length > DAY_ITEMS ? `<span class="day-more">+${list.length - DAY_ITEMS}</span>` : "";
    const dots = list.length ? `<span class="dots">${list.slice(0, 3).map(([, x]) => `<i${x.done ? ' class="done"' : ""}></i>`).join("")}</span>` : "";
    html += `<button type="button" class="${cls}" data-date="${key}" aria-label="${d.getMonth() + 1}월 ${d.getDate()}일, 할 일 ${list.length}개"><span class="num">${d.getDate()}</span>${items}${more}${dots}</button>`;
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
    else if (a === "lock" && lockAction && confirm("이 기기를 잠글까요? 다시 열려면 비밀번호가 필요해요.")) lockAction();
    return;
  }
  const day = e.target.closest("[data-date]");
  if (day) {
    ui.sel = day.dataset.date;
    if (ui.sel.slice(0, 7) !== ui.month) ui.month = ui.sel.slice(0, 7);
    renderCalendar();
    renderDay();
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
mountUri($("#uriRoot"), {
  who: "nyanya",
  toast,
  onSummary: ({ total, connected }) => { $("#tileUri").textContent = connected ? total.toLocaleString("ko-KR") + "원" : "열기 전"; }
});
renderPage();
render();
setSync();
firebaseStart().catch(() => {
  document.body.classList.add("locked");
  $("#loadingView").hidden = true;
  $("#loginView").hidden = false;
  $("#loginMsg").textContent = "저장소에 연결하지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.";
});
