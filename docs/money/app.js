// 💰 냐냐 가계부 — 가계부 화면(money.js, 욱진 보드에서 가져온 짝 코드)을 움직이는 얇은 연결 코드.
// 저장: 냐냐 보드와 같은 자리 Firebase nyanya-board의 nyanya/{SHA-256("nyanya-board:"+비밀번호)} 아래 money · accounts · settings · pics.
//   (settings는 보드와 같이 씀 — 가계부는 budgets·moneyCats·catColors·moneySubs·currencies·budget 칸만 고침)
// 비밀번호는 보드와 같은 칸(localStorage nyanya-board-pw)을 써서, 보드를 연 기기면 바로 열림.
// ❤️ 공통: 지출에 common: true → ../uri/uri.js setMirror로 공통 저장소(uri-board)에 저절로 복사, '❤️ 공통' 탭에서 둘 다 보기 + 반반 정산.

import { firebaseConfig } from "../firebase-config.js?v=20261020a";
import { mountUri } from "../uri/uri.js?v=20261026e";
import { bindMoney, initMoney, moneyAction, renderMoney, renderMoneyForm, renderCatEditor, editMoney, isWon, MONEY_CATS, catKey, balances, subsOf, acctOptsHtml, ccOf, commonCatName, pieHtml, stRange, setChart, acctName, acctFlow, sortedAccts, txRow, mineOn, cntAmt, isSettleIn } from "./money.js?v=20261027a";
import { mountRepeat } from "./repeat.js?v=20261021d";
import { mountAcctSet } from "./acctset.js?v=20261026a";
import { mountCcMigrate } from "./ccmigrate.js?v=20261021b";
import { startVerCheck } from "../vercheck.js?v=20261022a";
import { mountBalance } from "./balance.js?v=20261021a";
import { mountImport } from "./import.js?v=20261021b";
import { mountCardImport } from "./cardimport.js?v=20261022d";
import { mountReport } from "./report.js?v=20261027b";

const FB_VER = "10.12.2";
const ROOT = "nyanya";
const LS_PW = "nyanya-board-pw";
const COLS = ["money", "accounts"];
const DEFAULTS = { name: "냐냐", partner: "욱진", budget: 0 };
const WD = ["일", "월", "화", "수", "목", "금", "토"];

// ---------- 상태 ----------
const S = { money: new Map(), accounts: new Map(), tasks: new Map(), logs: new Map(), settings: { ...DEFAULTS }, loaded: false };
const ui = { month: today().slice(0, 7), kind: "expense", mEdit: null };
let backend = null;

// ---------- 도우미 (욱진 보드 app.js와 같은 것들) ----------
const $ = (id) => document.getElementById(id);
function esc(s) { return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])); }
function pad(n) { return (n < 10 ? "0" : "") + n; }
function ymd(d) { return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate()); }
function today() { return ymd(new Date()); }
function shortDate(s) { const p = s.split("-"), d = new Date(+p[0], +p[1] - 1, +p[2]); return `${d.getMonth() + 1}/${d.getDate()}(${WD[d.getDay()]})`; }
function rows(map) { return [...map].map(([id, v]) => ({ id, ...v })); }
function rid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
function clone(o) { return JSON.parse(JSON.stringify(o)); }
function commaNum(v, neg) {
  const s = String(v ?? "").replace(/[^\d-]/g, ""), minus = !!neg && s.startsWith("-"), d = s.replace(/-/g, "").replace(/^0+(?=\d)/, "");
  return d ? (minus ? "-" : "") + Number(d).toLocaleString("ko-KR") : minus ? "-" : "";
}
function amtVal(el) { return parseInt(String((el && el.value) || "").replace(/[^\d-]/g, ""), 10) || 0; }
// 💰 금액 칸: 쓰는 동안 쉼표
document.addEventListener("input", (ev) => {
  const el = ev.target; if (!el.classList || !el.classList.contains("amt-in")) return;
  const pos = el.selectionStart ?? el.value.length, before = el.value.slice(0, pos).replace(/[^\d-]/g, "").length;
  const v = commaNum(el.value, "neg" in el.dataset); if (v === el.value) return;
  el.value = v;
  let i = 0, n = 0; while (i < v.length && n < before) { if (/[\d-]/.test(v[i])) n++; i++; }
  try { el.setSelectionRange(i, i); } catch (e) { /* 무시 */ }
});
function won(n) { return Math.abs(Math.round(Number(n) || 0)).toLocaleString("ko-KR") + "원"; }   // 냐냐: +/- 기호 없이 (색으로 구분). 직접 -로 적은 금액은 money.js amtText가 - 붙임
const wonS = (n) => (Math.round(Number(n) || 0) < 0 ? "-" : "") + won(n);   // 부호가 꼭 필요한 곳 (잔액 맞추기)
function monthLabel(m) { return m.replace("-", "."); }
function shiftMonth(m, d) { const p = m.split("-"); const dt = new Date(+p[0], +p[1] - 1 + d, 1); return dt.getFullYear() + "-" + pad(dt.getMonth() + 1); }
function partner() { return DEFAULTS.partner; }
function deepMerge(base, patch) {
  for (const k of Object.keys(patch)) {
    const v = patch[k];
    if (v && typeof v === "object" && !Array.isArray(v) && base[k] && typeof base[k] === "object") deepMerge(base[k], v);
    else base[k] = v;
  }
  return base;
}
function moneyShort(n) { const v = Math.round(Number(n) || 0); return v >= 10000 ? (Math.round(v / 1000) / 10).toLocaleString("ko-KR") + "만" : v.toLocaleString("ko-KR"); }
function statTile(label, value, sub, cls, act) {
  const tag = act ? "button" : "div", attrs = act ? ` type="button" data-act="${act}"` : "";
  return `<${tag} class="stat ${cls || ""}"${attrs}><span>${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ""}</${tag}>`;
}
function openDlg(d) { if (d.open) return; if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", ""); }
function closeDlg(d) { if (d.open) { if (typeof d.close === "function") d.close(); else d.removeAttribute("open"); } }
let toastTimer;
function toast(msg) { const t = $("toast"); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2600); }
const isDenied = (e) => e && (e.code === "PERMISSION_DENIED" || /permission/i.test(e.message || ""));
function act(promise, okMsg) {
  return Promise.resolve(promise).then((r) => { if (okMsg) toast(okMsg); return r; }, (e) => {
    toast(isDenied(e) ? "저장 권한이 없어요. Firebase 규칙을 확인해 주세요." : "저장하지 못했어요. 잠시 뒤 다시 해 주세요.");
    throw e;
  });
}
function quietly(fn) { return Promise.resolve().then(fn).catch(() => {}); }
function ready() { if (!backend) { toast("아직 불러오는 중이에요."); return false; } return true; }
function shrinkPic(file, max = 1280, cap = 400000) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height)), cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      const g = cv.getContext("2d"); g.fillStyle = "#FFFFFF"; g.fillRect(0, 0, cv.width, cv.height); g.drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url);
      let q = 0.8, out = cv.toDataURL("image/jpeg", q);
      while (out.length > cap && q > 0.4) { q -= 0.15; out = cv.toDataURL("image/jpeg", q); }
      res(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("그림을 못 읽었어요")); };
    img.src = url;
  });
}
const okPic = (v) => typeof v === "string" && v.startsWith("data:image/");
async function viewPic(pid) {
  if (!backend) return;
  try { const v = await backend.getPic(pid, "full"); if (okPic(v)) { $("picImg").src = v; openDlg($("picDlg")); } else toast("사진을 찾지 못했어요."); }
  catch (e) { toast("사진을 불러오지 못했어요. 인터넷 연결을 확인해 주세요."); }
}
function isAdminDevice() { return false; }   // 냐냐 가계부엔 관리자 보기 없음

// ---------- 저장 상태 점 ----------
const sync = { pending: 0, connected: true };
function setSync() {
  let state, text;
  if (!backend) { state = ""; text = "연결 전"; }
  else if (!sync.connected) { state = "off"; text = sync.pending ? `연결 끊김 · 저장 대기 ${sync.pending}개` : "연결 끊김"; }
  else if (sync.pending) { state = "wait"; text = "저장 중…"; }
  else { state = "ok"; text = "서버에 저장됨"; }
  document.querySelectorAll("[data-sync]").forEach((d) => { d.dataset.state = state; d.title = text; });
  $("syncText").textContent = text;
}
function tracked(fn) {
  return (...args) => { sync.pending++; setSync(); return Promise.resolve().then(() => fn(...args)).finally(() => { sync.pending--; setSync(); }); };
}
window.addEventListener("beforeunload", (e) => { if (sync.pending > 0) { e.preventDefault(); e.returnValue = ""; } });

function flattenPaths(obj, prefix = "", out = {}) {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? prefix + "/" + k : k;
    if (v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length) flattenPaths(v, key, out);
    else out[key] = v;
  }
  return out;
}
async function roomOf(pw) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("nyanya-board:" + pw));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ---------- 그리기 ----------
// 📌 PC: 내역 · 통계 · 자산 칸 높이를 화면 아래 끝까지 → 위(요약·그래프·표 머리줄)는 그대로, 목록만 스크롤 (nyanya.css)
function fitPanels() {
  const els = document.querySelectorAll("#moneyPage .tx-panel, #moneyPage .st-grid, #asGrid");
  els.forEach((el) => {
    if (innerWidth <= 720 || !el.offsetParent) { el.style.height = ""; return; }
    const top = el.getBoundingClientRect().top + scrollY;
    el.style.height = Math.max(360, Math.round(innerHeight - top - 16)) + "px";
  });
}
window.addEventListener("resize", fitPanels);
document.addEventListener("click", (ev) => setTimeout(() => { fitPanels(); if (ev.target.closest && ev.target.closest('[data-act="mTab"]')) rpt.render(); }, 0));   // 탭을 바꾸면 (📑 보고서는 그 탭으로 올 때 그림)
function render() {
  if (!backend) return;
  $("todayMono").textContent = today().replace(/-/g, ".");
  renderMoney();
  bal.render();
  rp.render(); rp.run(); ak.render(); ccm.render(); ci.render(); rpt.render();
  tripList();
  mirrorCommon();
  mirrorJoint();
  fitPanels();
}
// ✈️ 내용 칸 자동완성: 예전에 쓴 여행 이름 (소분류가 '여행…'이고 숫자로 시작하는 내용 — '2026 상해'처럼, 최근 것 먼저) — 공통 탭 여행 묶음이 같은 이름으로 묶여서
let tripKey = "";
function tripList() {
  const seen = new Map(); S.money.forEach((x) => { if (x && x.memo && (/^여행/.test(x.sub || "") || /^(\S+\s)?여행$/.test(x.ccat || "")) && /^\d/.test(x.memo)) { const d = seen.get(x.memo); if (!d || x.date > d) seen.set(x.memo, x.date); } });
  const names = [...seen].sort((a, b) => b[1].localeCompare(a[1])).map(([n]) => n), key = names.join("|");
  if (key === tripKey) return; tripKey = key;
  $("tripNames").innerHTML = names.map((n) => `<option value="${esc(n)}">`).join("");
}
// 🤝 공동 자산(accounts.joint) → 공통 저장소 joint/ 에 복사 (공통 탭 🏦 공동 자산에서 둘이 같이 봄, 기록은 냐냐만 — 2026-10-26 냐냐와 정함)
//   자산 = {name, type, initial, number, memo}, 기록 = 그 자산에 들고 난 돈 {acct, date, d(+들어옴/−나감), kind, cat, sub, memo, note, other(상대 자산), at}
function mirrorJoint() {
  if (!S.loaded) return;
  const accts = {}, tx = {};
  S.accounts.forEach((a, id) => {
    if (!a || !a.joint) return;
    accts[id] = { name: a.name || "", type: a.type || "bank", initial: Number(a.initial) || 0, number: a.number || null, memo: a.memo || null };
    acctFlow(id).forEach((x) => {
      const other = x.kind === "move" ? acctName(x.account === id ? x.toAccount : x.account) : null;
      tx[x.id] = { acct: id, date: x.date, d: x.d, kind: x.kind || "expense", cat: x.common && x.ccat ? x.ccat : x.cat || null, sub: x.common && x.ccat ? x.csub || null : x.sub || null,
        common: x.common ? true : null, memo: x.memo || null, note: x.note || null, other, at: Number(x.createdAt) || 0 };
    });
  });
  uri.setJoint({ accts, tx });
}
// ❤️ 공통으로 표시한 지출(원화)만 공통 저장소로
// 🤝 공동 자산(accounts.joint, 데이트통장 등)으로 낸 건 payer "joint" = 둘이 같이 냄 → 합계엔 들어가고 정산할 돈엔 안 들어감.
//   예전 기록(데이트통장 78건, 2025.3~7, 이미 정산 끝)은 숫자가 흔들리지 않게 그대로 → 2026-10-26부터 적은 것만 (냐냐와 정함)
const JOINT_FROM = Date.UTC(2026, 9, 25, 15);   // 2026-10-26 00:00 (한국)
function mirrorCommon() {
  if (!S.loaded) return;
  const docs = {};
  const jointOf = (x) => { const a = S.accounts.get(x.account); return a && a.joint && (Number(x.createdAt) || 0) >= JOINT_FROM ? "joint" : null; };
  S.money.forEach((x, id) => { if (x && x.common && (x.kind === "expense" || !x.kind) && isWon(x)) docs[id] = x.ccat ? { date: x.date, amount: x.amount, cat: x.ccat, sub: x.csub || null, memo: x.memo, settled: !!x.settled, payer: jointOf(x) }   // 🏷 공통 분류로 적은 것
    : { date: x.date, amount: x.amount, cat: /공통/.test(x.cat || "") && x.sub ? x.sub : x.cat, sub: null, memo: x.memo, settled: !!x.settled, payer: jointOf(x) }; });   // 예전 방식: 분류가 '공통비용'이면 소분류(식비(외식) 등)로
  uri.setMirror(docs);
}

// ---------- 🔒 로컬 확인 모드 (이 컴퓨터에서만: http://localhost:8010/money/?local) ----------
// 로그인 없이 _local/snapshot.json(= python tools/snapshot.py 로 받은 진짜 데이터 사본, 깃에 안 올라감)을 띄움. 보기 전용 — 뭘 눌러도 서버에 안 씀.
// Claude가 화면을 진짜 숫자로 확인할 때 씀 (비밀번호를 브라우저에 넣지 않으려고). 실제 사이트에선 절대 안 켜짐.
const LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && new URLSearchParams(location.search).has("local");
let localSnap = null;
if (LOCAL) { try { localSnap = await (await fetch("_local/snapshot.json", { cache: "no-store" })).json(); } catch (e) { localSnap = null; } }
function localStart() {
  const d = localSnap;
  if (!d) { $("loginView").hidden = false; $("mainView").hidden = true; $("loginMsg").textContent = "로컬 사본이 없어요. python tools/snapshot.py 로 먼저 받아 주세요."; return; }
  let said = 0; const no = () => { if (Date.now() - said > 4000) { said = Date.now(); toast("🔒 로컬 확인 모드라 저장 안 돼요 (보기 전용)"); } return Promise.resolve(null); };
  backend = { add: no, update: no, remove: no, set: no, saveSettings: no, saveSettingsDeep: no, putPic: no, saveUriPw: no, rootUpdate: no, async getPic() { return null; } };
  $("loginView").hidden = true; $("mainView").hidden = false;
  S.money = new Map(Object.entries(d.money || {})); S.accounts = new Map(Object.entries(d.accounts || {})); S.tasks = new Map(Object.entries(d.tasks || {}));
  S.settings = { ...DEFAULTS, ...(d.settings || {}) }; S.loaded = true;
  document.body.insertAdjacentHTML("afterbegin", `<div style="position:sticky;top:0;z-index:100;background:#1f2937;color:#fff;font-size:12px;padding:4px 12px;text-align:center">🔒 로컬 확인 모드 · 보기 전용 · 사본 ${esc(d.at || "")}</div>`);
  sync.connected = true; setSync(); $("syncText").textContent = "로컬 사본";
  render();
}

// ---------- 연결 ----------
async function firebaseStart() {
  if (LOCAL) { localStart(); return; }
  const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
  const [{ initializeApp }, rt] = await Promise.all([import(base + "firebase-app.js"), import(base + "firebase-database.js")]);
  const db = rt.getDatabase(initializeApp(firebaseConfig));
  const path = (room, ...p) => rt.ref(db, [ROOT, room, ...p].join("/"));
  rt.onValue(rt.ref(db, ".info/connected"), (snap) => { sync.connected = snap.val() === true; setSync(); });

  const showLogin = (msg) => { $("loginView").hidden = false; $("mainView").hidden = true; $("loginMsg").textContent = msg || ""; $("loginPw").focus(); };

  function open(room) {
    backend = {
      add: tracked(async (c, obj) => { const r = rt.push(path(room, c)); await rt.set(r, obj); return r.key; }),
      update: tracked((c, id, patch) => rt.update(path(room, c, id), flattenPaths(patch))),
      remove: tracked((c, id) => rt.remove(path(room, c, id))),
      set: tracked((c, id, obj) => rt.set(path(room, c, id), obj)),
      saveSettings: tracked((patch) => rt.update(path(room, "settings"), patch)),
      saveSettingsDeep: tracked((patch) => rt.update(path(room, "settings"), flattenPaths(patch))),
      putPic: tracked((id, obj) => rt.set(path(room, "pics", id), obj)),
      async getPic(id, part) { return (await rt.get(path(room, "pics", id, part))).val(); },
      saveUriPw: tracked((pw) => rt.update(path(room, "settings"), { uriPw: pw })),
      rootUpdate: tracked((patch) => rt.update(path(room), patch))   // 📥 가져오기: 여러 칸을 한 번에
    };
    $("loginView").hidden = true; $("mainView").hidden = false;
    setSync();
    const onErr = (e) => toast(isDenied(e) ? "Firebase 규칙을 확인해 주세요." : "데이터를 불러오지 못했어요. 인터넷 연결을 확인해 주세요.");
    const got = {};
    COLS.forEach((c) => {
      rt.onValue(path(room, c), (snap) => {
        S[c] = new Map(Object.entries(snap.val() || {})); got[c] = true;
        S.loaded = COLS.every((k) => got[k]) && !!got.settings; render();
      }, onErr);
    });
    rt.onValue(path(room, "settings"), (snap) => {
      S.settings = { ...DEFAULTS, ...(snap.val() || {}) }; got.settings = true;
      S.loaded = COLS.every((k) => got[k]); render();
      if (S.settings.uriPw) uri.usePassword(S.settings.uriPw);
    }, onErr);
  }

  async function tryPassword(pw) {
    const room = await roomOf(pw);
    if (!(await rt.get(path(room, "settings"))).exists()) return false;
    open(room);
    return true;
  }
  $("loginForm").onsubmit = async (ev) => {
    ev.preventDefault();
    const pw = $("loginPw").value;
    $("loginMsg").textContent = "";
    try {
      if (await tryPassword(pw)) { try { localStorage.setItem(LS_PW, pw); } catch (e) { /* 무시 */ } $("loginPw").value = ""; }
      else $("loginMsg").textContent = "이 비밀번호로 만든 냐냐 보드가 없어요. 냐냐 보드에서 쓰는 비밀번호를 넣어 주세요.";
    } catch (e) { $("loginMsg").textContent = isDenied(e) ? "Firebase 규칙을 확인해 주세요." : "열지 못했어요. 인터넷 연결을 확인해 주세요."; }
  };

  let saved = null;
  try { saved = localStorage.getItem(LS_PW); } catch (e) { /* 무시 */ }
  if (!saved) { showLogin(""); return; }
  try { if (!(await tryPassword(saved))) showLogin("저장된 비밀번호로 보드를 찾지 못했어요. 다시 넣어 주세요."); }
  catch (e) { showLogin(isDenied(e) ? "Firebase 규칙을 확인해 주세요." : "연결하지 못했어요. 인터넷 연결을 확인해 주세요."); }
}

// ---------- 버튼 ----------
function openMenu() { $("side").classList.add("open"); document.querySelector(".scrim").hidden = false; }
function closeMenu() { $("side").classList.remove("open"); document.querySelector(".scrim").hidden = true; }
document.addEventListener("click", (ev) => {
  const el = ev.target.closest("[data-act]");
  if (!el) return;
  const a = el.dataset.act, id = el.dataset.id, t = today();
  if (a === "mTab") closeMenu();
  if (moneyAction(a, el, id, t)) return;
  if (a === "menu") { openMenu(); return; }
  if (a === "menuClose") { closeMenu(); return; }
  if (a === "mvClose") { closeDlg($("moveDlg")); return; }
  if (a === "picClose") { closeDlg($("picDlg")); return; }
  if (a === "pfClose") { closeDlg($("proofDlg")); return; }
});
["acctDlg", "moveDlg", "picDlg", "proofDlg"].forEach((k) => $(k).addEventListener("click", (ev) => { if (ev.target === ev.currentTarget) closeDlg(ev.currentTarget); }));

// ---------- 시작 ----------
// ❤️ 공통 탭: 둘이 ❤️로 표시한 지출 + 반반 정산. 공통 비밀번호는 보드 설정 uriPw에 기억 (보드와 같이)
let moneyBound = false;
const uri = mountUri($("uriRoot"), {
  who: "nyanya", toast, mirror: true, local: LOCAL && localSnap ? localSnap.uri || {} : null,
  onCats: () => { if (moneyBound && backend) { renderMoneyForm(); if (!$("catEditor").contains(document.activeElement)) renderCatEditor(); } },   // 🏷 공통 분류가 바뀌면 기록 창 분류 칸도
  // 📊 공통 통계 원형: 가계부와 같은 원형 (큰 순서 8개 색 + '그 밖' 회색, 가운데 구멍 없이)
  // 📊 공통 지출을 통계 탭과 똑같이: 기간 계산 · 흐름 그래프는 가계부 것으로, 자산·메모는 내가 ❤️로 적은 가계부 기록에서
  stats: { range: (p, anchor, k) => stRange(p, anchor, k), chart: (el, d) => setChart(el, d),
    rec: (id) => { const m = /^nyanya-(.+)$/.exec(id || ""), x = m && S.money.get(m[1]); return x ? { acct: acctName(x.account), note: x.note || "" } : null; } },
  pie: (list, label) => { const top = list.slice(0, 8), rest = list.slice(8), xs = rest.length ? top.concat([{ cat: "그 밖", amt: rest.reduce((t, x) => t + x.amt, 0), other: true }]) : top;
    return pieHtml(null, xs, label, { color: (x) => `var(--c${top.indexOf(x) < 0 ? 8 : top.indexOf(x)})`, legend: false, full: true }); },
  savePassword: (pw) => { if (backend) act(backend.saveUriPw(pw || null)).catch(() => {}); }
});
bindMoney({ $, DEFAULTS, DEMO: false, S, act, amtVal, clone, closeDlg, commaNum, deepMerge, esc, isAdminDevice, moneyShort, monthLabel, openDlg, pad, partner, quietly, ready, render, rid, rows, shiftMonth, shortDate, shrinkPic, statTile, toast, today, ui, viewPic, won,
  give: false,   // 💝 줄 돈(욱진 보드 전용)은 안 씀
  tabTitles: { budget: "예산", spend: "내역", cal: "달력", assets: "자산", stats: "통계", report: "보고서", common: "공통", settings: "설정" },   // 위 제목 = 지금 탭 이름 (냐냐 요청)
  mineView: true,   // 💑 내 몫으로 보기 버튼 (공통비용 절반·욱진입금 빼고, 기본 꺼짐 — settings.moneyMine)
  catRank: true,   // 분류 색: 원형마다 금액 큰 8개가 서로 다른 색, 9번째부터 '그 밖' (냐냐 요청)
  pieFull: true,   // 분류 원형(통계·내역 지출·예산)은 가운데 구멍 없이 꽉 찬 원형 (냐냐 요청, 자산 구성 원형은 그대로)
  commonCats: () => uri.cats(),   // 🏷 ❤️ 공통비용 체크 시 분류 칸 = 공통 분류 (공통 저장소)
  saveCommonCats: (list) => uri.setCats(list),   // 🏷 공통 분류 고치기 (설정 '분류', 냐냐만)
  settlePreview: (amt) => uri.ready() ? uri.settlePreview(amt) : null,   // 💸 이체로 정산: 미리보기
  settleCommon: (amt, tag, meta) => uri.settleBy(amt, tag, meta),   // 💸 이체로 정산: 정산 장부 settles/{이체 id}에 금액
  unsettleCommon: (tag) => uri.unsettle(tag),   // 💸 체크 빼거나 이체 지우면 장부에서 뺌
  get backend() { return backend; }, get testMode() { return false; } });
initMoney(); moneyBound = true;
// 🧮 실제 잔액 맞추기 · 🙈 숨기기 (자산 탭)
const bal = mountBalance($("balPanel"), { S, backend: () => backend, toast, act, esc, won: wonS, rows, balances });
// 💳 카드 승인내역 올리기 (내역 탭 💳 버튼 → 팝업) — 승인취소 빼고, 이미 있는 건 건너뛰고
$("cardOpen").addEventListener("click", () => { openDlg($("cardDlg")); ci.render(); });
$("cardClose").addEventListener("click", () => closeDlg($("cardDlg")));
const ci = mountCardImport($("cardImpPanel"), { S, backend: () => backend, toast, esc, won, render, commonCatName, commonCats: () => uri.cats(), subs: subsOf, dialog: true,
  cats: (k) => { const c = (S.settings.moneyCats || {})[k]; return (c && c.length ? c : MONEY_CATS[k] || []).slice(); } });
// 📥 편한가계부 가져오기 (가계부 설정 탭)
mountImport($("importPanel"), { S, backend: () => backend, toast, act, esc, won, render, balances, catKey, defaultCats: (k) => (MONEY_CATS[k] || []).slice() });
// 🔁 매월 반복 (가계부 설정 탭) — 그날이 되면 기록이 저절로
const rp = mountRepeat($("repeatPanel"), { S, backend: () => backend, toast, act, esc, won, rows, today, rid,
  cats: (k) => { const c = (S.settings.moneyCats || {})[k]; return (c && c.length ? c : MONEY_CATS[k] || []).slice(); }, subs: subsOf, acctOpts: acctOptsHtml });
// 🏷 예전 공통비용 기록 → 공통 분류로 옮기기 (가계부 설정 '분류', 다 옮기면 안 보임)
const ccm = mountCcMigrate($("ccmPanel"), { S, backend: () => backend, toast, esc, won, ccOf, commonCatName, commonCats: () => uri.cats() });
// 📑 보고서 탭 (기간·자산·분류·검색으로 골라 보기, 저장한 보고서는 settings.reports)
const rpt = mountReport($("reportRoot"), { S, backend: () => backend, toast, esc, won, isWon, acctName, subs: subsOf, chart: setChart, pie: pieHtml, txRow: (x) => txRow(x, false), mineOn, cntAmt, isSettleIn,
  accts: () => sortedAccts(), cats: (k) => { const c = (S.settings.moneyCats || {})[k]; return (c && c.length ? c : MONEY_CATS[k] || []).slice(); } });
// 🏦 자산 관리 (가계부 설정 탭) — 이름 · 계좌번호 · 메모 · 🙈 숨기기
const ak = mountAcctSet($("acctSetPanel"), { S, backend: () => backend, toast, act, esc, rows });
// ⚙ 설정 탭 안 작은 탭: 분류 · 자산 · 반복 · 가져오기 · 화폐 (이 기기에 기억)
function setSubTab(k) {
  const ks = ["cat", "acct", "repeat", "import", "cur"]; if (!ks.includes(k)) k = "cat";
  try { localStorage.setItem("nyanya-stab", k); } catch (e) { /* 무시 */ }
  document.querySelectorAll("#moneyPage [data-st]").forEach((el) => el.classList.toggle("st-off", el.dataset.st !== k));
  document.querySelectorAll("#setTabs [data-st-k]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.stK === k)));
}
$("setTabs").addEventListener("click", (ev) => { const b = ev.target.closest("[data-st-k]"); if (b) setSubTab(b.dataset.stK); });
try { setSubTab(localStorage.getItem("nyanya-stab") || "cat"); } catch (e) { setSubTab("cat"); }
// 보드 첫 화면 '공통비용' 칸에서 바로 오면 (#common)
if (location.hash === "#common") { try { localStorage.setItem("nyanya-mtab", "common"); } catch (e) { /* 무시 */ } }
setSync();
firebaseStart().catch(() => { $("loginView").hidden = false; $("loginMsg").textContent = "저장소에 연결하지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요."; });
// 🔄 새 버전 알림 (욱진 보드처럼)
startVerCheck(new URL(import.meta.url).searchParams.get("v"));
