// 💰 냐냐 가계부 — 가계부 화면(money.js, 욱진 보드에서 가져온 짝 코드)을 움직이는 얇은 연결 코드.
// 저장: 냐냐 보드와 같은 자리 Firebase nyanya-board의 nyanya/{SHA-256("nyanya-board:"+비밀번호)} 아래 money · accounts · settings · pics.
//   (settings는 보드와 같이 씀 — 가계부는 budgets·moneyCats·catColors·moneySubs·currencies·budget 칸만 고침)
// 비밀번호는 보드와 같은 칸(localStorage nyanya-board-pw)을 써서, 보드를 연 기기면 바로 열림.
// ❤️ 공통: 지출에 common: true → ../uri/uri.js setMirror로 공통 저장소(uri-board)에 저절로 복사, '❤️ 공통' 탭에서 둘 다 보기 + 반반 정산.

import { firebaseConfig } from "../firebase-config.js?v=20261020a";
import { mountUri } from "../uri/uri.js?v=20261020o";
import { bindMoney, initMoney, moneyAction, renderMoney, renderMoneyForm, editMoney, isWon, MONEY_CATS, catKey } from "./money.js?v=20261020c";
import { mountImport } from "./import.js?v=20261020a";

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
function won(n) { return Math.round(Number(n) || 0).toLocaleString("ko-KR") + "원"; }
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
function render() {
  if (!backend) return;
  $("todayMono").textContent = today().replace(/-/g, ".");
  renderMoney();
  mirrorCommon();
}
// ❤️ 공통으로 표시한 지출(원화)만 공통 저장소로
function mirrorCommon() {
  if (!S.loaded) return;
  const docs = {};
  S.money.forEach((x, id) => { if (x && x.common && (x.kind === "expense" || !x.kind) && isWon(x)) docs[id] = { date: x.date, amount: x.amount, cat: /공통/.test(x.cat || "") && x.sub ? x.sub : x.cat, memo: x.memo, settled: !!x.settled }; });   // 분류가 '공통비용'이면 소분류(식비(외식) 등)로
  uri.setMirror(docs);
}

// ---------- 연결 ----------
async function firebaseStart() {
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
const uri = mountUri($("uriRoot"), {
  who: "nyanya", toast, mirror: true,
  savePassword: (pw) => { if (backend) act(backend.saveUriPw(pw || null)).catch(() => {}); }
});
bindMoney({ $, DEFAULTS, DEMO: false, S, act, amtVal, clone, closeDlg, commaNum, deepMerge, esc, isAdminDevice, moneyShort, monthLabel, openDlg, pad, partner, quietly, ready, render, rid, rows, shiftMonth, shortDate, shrinkPic, statTile, toast, today, ui, viewPic, won,
  give: false,   // 💝 줄 돈(욱진 보드 전용)은 안 씀
  get backend() { return backend; }, get testMode() { return false; } });
initMoney();
// 📥 편한가계부 가져오기 (가계부 설정 탭)
mountImport($("importPanel"), { S, backend: () => backend, toast, act, esc, won, render, catKey, defaultCats: (k) => (MONEY_CATS[k] || []).slice() });
// 보드 첫 화면 '공통비용' 칸에서 바로 오면 (#common)
if (location.hash === "#common") { try { localStorage.setItem("nyanya-mtab", "common"); } catch (e) { /* 무시 */ } }
setSync();
firebaseStart().catch(() => { $("loginView").hidden = false; $("loginMsg").textContent = "저장소에 연결하지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요."; });
