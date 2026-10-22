// 🤝 우리 탭 — 냐냐 보드·욱진 보드가 같이 쓰는 코드. 이 파일 하나만 고치면 두 보드 다 적용돼요.
// 냐냐 보드: ./uri/uri.js / 욱진 보드: https://nyanya-lab.github.io/nyanya-board/uri/uri.js 에서 불러옴
// 저장: Firebase uri-board 의 uri/{SHA-256("uri-board:"+공통 비밀번호)} 아래 (각 보드 저장소와 따로)
// 지금 들어 있는 것: 공통비용 (costs). 나중에 공통 목표·같이 할 일·공통 상을 같은 방에 더함.
//
// 쓰는 법: mountUri(넣을 요소, { who: "nyanya" | "ukjin", toast, onSummary })
//   who        = 이 보드 주인 (적은 사람·기본 '낸 사람')
//   toast(msg) = 보드의 알림 함수 (없으면 alert 안 하고 조용히)
//   onSummary({ month, total, connected }) = 이번 달 공통비용 합계가 바뀔 때 (보드 요약 칸용, 선택)
//   mirror: true = ❤️ 가계부 방식: 여기선 적지 않고 보기만. 각자 가계부에서 ❤️ 공통으로 표시한 지출이 저절로 들어옴
//            (돌려받은 .setMirror({가계부 기록 id: {date, amount, cat, memo}})로 내 것을 넘기면 공통 저장소를 거기에 맞춤)
//   savePassword(pw | null) = 공통 비밀번호를 보드에 저장/지우기 (선택). 있으면 한 번 넣은 공통 비밀번호를 그 보드가 기억해서
//                             다른 기기에선 다시 안 넣어도 됨 → 보드가 불러온 값을 돌려받은 함수 .usePassword(pw)로 넘겨 줌
// 화면 색은 보드의 색 토큰(--me, --surface, --line …)을 그대로 써요. 클래스는 모두 uri- 로 시작.

import { uriConfig } from "./uri-config.js?v=20261020a";

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
const ROOT = "uri";
const LS_PW = "uri-board-pw";
const NAME = { nyanya: "냐냐", ukjin: "욱진" };
const PAYER = { nyanya: "냐냐", ukjin: "욱진", joint: "공동 통장" };
export const URI_CATS = ["식비", "카페·간식", "장보기", "생활용품", "주거·공과금", "데이트", "여행", "선물", "기타"];
// 🏷 공통 분류 (공통 저장소 settings/cats, 둘이 같이 씀): [{ n: 대분류, s: [소분류…] }] — 처음 열 때 없으면 이걸로 만듦 (냐냐가 정함 2026-10-21)
export const COMMON_CATS = [   // 2026-10-22 대분류 앞에 그림 (냐냐 요청)
  { n: "🍽️ 식비", s: ["외식", "배달", "장보기"] },
  { n: "🖼 문화생활", s: ["영화", "오락실", "노래방", "공연 및 스포츠", "게임", "방탈출", "사진", "나들이", "힐링"] },
  { n: "✈️ 여행", s: ["식비", "숙소", "체험 및 기타", "교통 및 비행기"] },
  { n: "🛍️ 쇼핑", s: ["기타", "복권"] },
  { n: "🎞️ 구독", s: ["쇼츠드라마"] },
  { n: "📦 기타", s: [] }
];
const catsOf = (v) => (Array.isArray(v) ? v : v && typeof v === "object" ? Object.values(v) : []).filter((c) => c && c.n).map((c) => ({ n: c.n, s: Array.isArray(c.s) ? c.s.filter(Boolean) : c.s && typeof c.s === "object" ? Object.values(c.s).filter(Boolean) : [] }));
const DOW = ["일", "월", "화", "수", "목", "금", "토"];
// ⏸ 욱진 보드에선 잠깐 '준비 중'만 (냐냐 요청 2026-10-20: 가계부 ❤️ 공통까지 다 만든 뒤 한꺼번에 공개). 공개할 때 false로
const HOLD_UKJIN = true;

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const won = (n) => `${Math.round(Number(n) || 0).toLocaleString("ko-KR")}원`;
const digits = (s) => Number(String(s).replace(/[^\d]/g, "")) || 0;
const isDenied = (e) => e && (e.code === "PERMISSION_DENIED" || /permission/i.test(e.message || ""));

async function roomOf(pw) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode("uri-board:" + pw));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
const lsGet = (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } };
const lsSet = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* 무시 */ } };

// 정산: 냐냐·욱진이 각자 낸 돈을 반반으로. 공동 통장은 빼고 계산. 양수 = 욱진 → 냐냐
export function settleOf(list) {
  const paid = { nyanya: 0, ukjin: 0, joint: 0 };
  for (const c of list) paid[c.payer in paid ? c.payer : "joint"] += Number(c.amount) || 0;
  return { paid, total: paid.nyanya + paid.ukjin + paid.joint, diff: Math.round((paid.nyanya - paid.ukjin) / 2) };
}

export function mountUri(root, opts = {}) {
  const who = opts.who === "ukjin" ? "ukjin" : "nyanya";
  const partner = who === "nyanya" ? "욱진이" : "냐냐";   // 상대 이름 (문구용)
  const toast = typeof opts.toast === "function" ? opts.toast : () => {};
  injectStyle();
  root.classList.add("uri");
  if (who === "ukjin" && HOLD_UKJIN) {
    root.innerHTML = `<div class="uri-card"><h3>🤝 준비 중이에요</h3><p class="uri-muted">냐냐와 같이 쓰는 공간을 만들고 있어요. 곧 열려요!</p></div>`;
    return { render() {}, usePassword() {}, setMirror() {}, cats: () => null, setCats: () => Promise.reject(new Error("준비 중")), settlePreview: () => null, settleBy: () => Promise.reject(new Error("준비 중")), unsettle: () => Promise.resolve(), ready: () => false };
  }

  const st = {
    phase: "start",            // start → locked | open | error
    msg: "", askNew: false, pendingPw: null,
    costs: {}, loaded: false, cats: null,   // cats = 공통 분류 (settings/cats)
    settles: {}, settlesLoaded: false,       // 💸 정산 장부 settles/{id} = { date, amount, memo, by, at } — 금액으로 정산 (냐냐 방식 2026-10-21)
    month: today().slice(0, 7),
    view: null,                // null = 한눈에 표(첫 화면), "YYYY-MM" = 그 달, "trip:이름" = 그 여행 묶음
    showDone: false,           // 표에서 정산 끝난 줄도 보기
    pay: null,                 // 💸 정산하기 창: { amount: "123,000" } (null = 닫힘)
    tab: "spend",              // 공통 탭 안 작은 탭: "spend" = 📊 지출 (처음), "settle" = 💸 정산
    stats: { p: "month", anchor: today(), from: "", to: "", trip: null, sel: null, sub: null },   // 📊 지출: 주간·월간·연간·기간·여행(trip) + 고른 대분류·소분류
    edit: null,                // 고치는 중인 기록 id
    form: null                 // 다시 그릴 때 입력 중이던 값 유지
  };
  let rt = null, db = null, room = null, unsubs = [], bakTimer = null, readyDone;
  const ready = new Promise((r) => { readyDone = r; });   // 저장소 연결 준비 끝 (usePassword가 기다림)
  const hostSaves = typeof opts.savePassword === "function";
  const mirrorMode = !!opts.mirror;
  let mirror = null, mirroring = false;   // 이 사람 가계부의 ❤️ 공통 지출 (setMirror로 받음)
  const path = (...p) => rt.ref(db, [ROOT, ...p].join("/"));

  // ── 연결 ──
  async function start() {
    try {
      const [{ initializeApp, getApps }, rtMod] = await Promise.all([import(FB + "firebase-app.js"), import(FB + "firebase-database.js")]);
      rt = rtMod;
      // 보드 자기 저장소(기본 앱)와 섞이지 않게 이름 붙인 앱으로
      const app = getApps().find((a) => a.name === "uri") || initializeApp(uriConfig, "uri");
      db = rt.getDatabase(app);
      readyDone();
    } catch (e) {
      st.phase = "error"; st.msg = "공통 저장소에 연결하지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요."; render(); return;
    }
    const saved = lsGet(LS_PW);
    if (!saved) { lock(""); return; }
    try {
      if (!(await tryPassword(saved))) lock("저장된 공통 비밀번호로 공간을 찾지 못했어요. 다시 넣어 주세요.");
    } catch (e) { lock(isDenied(e) ? "공통 저장소 규칙을 확인해 주세요." : "연결하지 못했어요. 인터넷 연결을 확인해 주세요."); }
  }

  function lock(msg) {
    unsubs.forEach((u) => u()); unsubs = []; clearInterval(bakTimer);
    room = null; st.phase = "locked"; st.msg = msg || ""; st.askNew = false; st.costs = {}; st.loaded = false;
    summary(); render();
  }

  async function tryPassword(pw) {
    const r = await roomOf(pw);
    const snap = await rt.get(path(r, "settings"));
    if (!snap.exists()) return false;
    lsSet(LS_PW, pw);
    open(r);
    return true;
  }
  // 보드에 저장된 공통 비밀번호로 열기 (보드 설정을 불러온 뒤 보드가 부름). 이미 그 공간이 열려 있으면 그대로
  async function usePassword(pw) {
    await ready;
    if (!pw) return;
    if (room && room === await roomOf(pw)) return;
    try { if (!(await tryPassword(pw)) && st.phase !== "open") lock(""); } catch (e) { /* 직접 넣으면 됨 */ }
  }

  function open(r) {
    unsubs.forEach((u) => u()); unsubs = [];
    room = r; st.phase = "open"; st.msg = ""; st.askNew = false; st.pendingPw = null;
    unsubs.push(rt.onValue(path(room, "settings", "cats"), (snap) => {
      const v = snap.val();
      if (!v) { rt.set(path(room, "settings", "cats"), COMMON_CATS).catch(() => {}); st.cats = COMMON_CATS.map((c) => ({ n: c.n, s: c.s.slice() })); }
      else st.cats = catsOf(v);
      if (typeof opts.onCats === "function") opts.onCats(st.cats);
      render();
    }));
    unsubs.push(rt.onValue(path(room, "settles"), (snap) => { st.settles = snap.val() || {}; st.settlesLoaded = true; seedSettles(); render(); }));
    unsubs.push(rt.onValue(path(room, "costs"), (snap) => {
      st.costs = snap.val() || {}; st.loaded = true; seedSettles(); summary(); render(); reconcile();
    }, (e) => { toast(isDenied(e) ? "공통 저장소 규칙을 확인해 주세요." : "공통비용을 불러오지 못했어요."); }));
    rotateBackups(); clearInterval(bakTimer); bakTimer = setInterval(rotateBackups, 10 * 60 * 1000);
    render();
  }

  // ❤️ 내 가계부의 공통 지출 → 공통 저장소 costs/{who}-{가계부 id} (src "money"). 바뀐 것만 한 번에 고치고, 가계부에서 지웠거나 ❤️를 뺀 건 지움
  function setMirror(docs) { mirror = docs || {}; reconcile(); }
  async function reconcile() {
    if (!mirror || !room || !st.loaded || mirroring || opts.local) return;
    const want = {};
    for (const [id, d] of Object.entries(mirror)) {
      if (!d || !d.date || !Number(d.amount)) continue;   // 마이너스(환불·취소)도 같이 — 합계·정산에서 빠지게
      want[`${who}-${id}`] = { date: d.date, title: d.memo || d.cat || "공통비용", amount: Number(d.amount), cat: d.cat || "기타", sub: d.sub || null, payer: who, by: who, src: "money", memo: null, _settled: !!d.settled };
    }
    const patch = {};
    for (const [k, v] of Object.entries(want)) {
      const cur = st.costs[k];
      const { _settled, ...base } = v;
      if (!cur) patch[k] = { ...base, at: Date.now(), settled: _settled ? "가져오기" : null };
      else for (const f of ["date", "title", "amount", "cat", "sub", "payer"]) if ((cur[f] ?? null) !== (v[f] ?? null)) patch[`${k}/${f}`] = v[f];
    }
    for (const [k, c] of Object.entries(st.costs)) if (c && c.src === "money" && c.by === who && !want[k]) patch[k] = null;
    if (!Object.keys(patch).length) return;
    mirroring = true;
    try { await rt.update(path(room, "costs"), patch); } catch (e) { toast("공통비용을 맞추지 못했어요. 잠시 뒤 다시 해요."); }
    mirroring = false;
  }

  // 서버 백업: 1시간짜리 prev, 하루짜리 daily (보드와 같은 방식). 되돌리기는 아직 화면 없음
  async function rotateBackups() {
    if (!room) return;
    try {
      const costs = (await rt.get(path(room, "costs"))).val();
      if (!costs) return;
      const now = Date.now();
      for (const [kind, ms] of [["prev", 3600e3], ["daily", 86400e3]]) {
        const at = (await rt.get(path(room, "_backup", kind, "savedAt"))).val() || 0;
        if (now - at >= ms) await rt.set(path(room, "_backup", kind), { costs, savedAt: now });
      }
    } catch (e) { /* 백업 실패가 사용을 막지는 않음 */ }
  }

  const save = (p, okMsg) => Promise.resolve(p).then(() => { if (okMsg) toast(okMsg); }, (e) => {
    toast(isDenied(e) ? "저장 권한이 없어요. 공통 저장소 규칙을 확인해 주세요." : "저장하지 못했어요. 잠시 뒤 다시 해 주세요.");
    throw e;
  });

  // ── 계산 ──
  // ✈️ 여행 묶음 (냐냐 엑셀처럼): 분류(가계부 소분류)가 '여행…'이고 내용이 숫자로 시작하는 기록 ('2026 상해', '2608 강릉', '25/6/13-23 발리')
  //   → 그 내용 이름이 여행 이름. 같은 내용이 적힌 다른 기록도 그 여행에 같이 묶음. 나머지('양갈비' 같은 여행 분류 한 건)는 날짜의 달로
  const all = () => Object.entries(st.costs).map(([id, c]) => ({ id, ...c })).filter((c) => c && typeof c.date === "string");
  function tripNames(list) { const t = new Set(); list.forEach((c) => { if (/^(\S+\s)?여행/.test(c.cat || "") && /^\d/.test(c.title || "")) t.add(c.title); }); return t; }   // '✈️ 여행'처럼 앞에 그림이 붙어도
  function groupOf(c, trips) { return c.title && trips.has(c.title) ? "trip:" + c.title : c.date.slice(0, 7); }
  // 묶음마다 합계·정산·미정산 (정렬: 달 = 그 달, 여행 = 그 여행의 마지막 날짜 달 — 엑셀처럼 그 달 바로 뒤)
  function groups(extra = 0) {
    const list = all(), trips = tripNames(list), g = {}, al = alloc(extra);
    for (const c of list) {
      const k = groupOf(c, trips), x = (g[k] ||= { key: k, trip: k.startsWith("trip:"), name: k.startsWith("trip:") ? k.slice(5) : k, total: 0, done: 0, open: 0, n: 0, nOpen: 0, last: "" });
      const a = Number(c.amount) || 0, d = al.m[c.id] ?? 0; x.total += a; x.n++; x.done += d; x.open += a - d; if (a - d > 0) x.nOpen++;
      if (c.date > x.last) x.last = c.date;
    }
    return Object.values(g).sort((a, b) => (a.trip ? a.last.slice(0, 7) + "~" : a.key).localeCompare(b.trip ? b.last.slice(0, 7) + "~" : b.key));
  }
  const viewKey = () => st.view || st.month;
  const monthList = () => { const list = all(), trips = tripNames(list), k = viewKey();
    return list.filter((c) => groupOf(c, trips) === k).sort((a, b) => b.date.localeCompare(a.date) || (b.at || 0) - (a.at || 0)); };
  // 💸 금액으로 정산 (냐냐 방식): 정산 장부(settles) 합계만큼, 공통비용을 날짜 순서대로 앞에서부터 채움. 채워진 만큼 정산, 나머지 미정산.
  //   기록마다 정산 표시를 붙이지 않음 → 장부에 한 줄 더하거나 지우면 저절로 다시 계산. m[기록 id] = 그 기록에서 정산된 금액
  const settledSum = () => Object.values(st.settles || {}).reduce((t, x) => t + (Number(x && x.amount) || 0), 0);
  function alloc(extra = 0) {
    const list = all().sort((a, b) => a.date.localeCompare(b.date) || (a.at || 0) - (b.at || 0) || a.id.localeCompare(b.id));
    let rem = settledSum() + extra; const m = {};
    for (const c of list) { const a = Number(c.amount) || 0; let d; if (a <= 0 || rem >= a) { d = a; rem -= a; } else { d = rem; rem = 0; } m[c.id] = d; }
    return { m, left: rem };
  }
  const openOf = (c, al) => (Number(c.amount) || 0) - (al.m[c.id] ?? 0);
  // 그 금액을 더 정산하면: 묶음마다 얼마씩 · 몇 건이 새로 다 정산되는지 · 다 채우고 남는 돈
  function fifo(amount) {
    const g0 = groups(0), g1 = groups(amount), by = {};
    g1.forEach((x) => { const o = g0.find((y) => y.key === x.key); const d = o.open - x.open; if (d) by[x.key] = d; });
    const a0 = alloc(0), a1 = alloc(amount), take = all().filter((c) => openOf(c, a0) > 0 && openOf(c, a1) <= 0);
    return { take, by, left: a1.left };
  }
  // 처음 한 번: 장부가 비어 있으면 예전 방식(기록마다 '정산됨')의 합계를 '가져오기' 한 줄로 → 지금 숫자 그대로 이어짐
  function seedSettles() {
    if (!room || !st.loaded || !st.settlesLoaded || Object.keys(st.settles || {}).length) return;
    const sum = all().filter((c) => c.settled).reduce((t, c) => t + (Number(c.amount) || 0), 0);
    if (!sum) return;
    st.settles = { import: { date: "가져오기", amount: sum, memo: "편한가계부·엑셀에서 정산한 합계", by: who, at: Date.now() } };
    rt.set(path(room, "settles", "import"), st.settles.import).catch(() => {});
  }

  function summary() {
    if (typeof opts.onSummary !== "function") return;
    const m = today().slice(0, 7);
    const list = Object.values(st.costs).filter((c) => c && typeof c.date === "string" && c.date.slice(0, 7) === m);
    opts.onSummary({ month: m, total: settleOf(list).total, count: list.length, connected: st.phase === "open" && st.loaded });
  }

  // ── 그리기 ──
  // fresh = 입력 칸을 비우고 새로 (적기·고치기·달 바꾸기 뒤). 아니면 입력 중이던 값 유지 (다른 기기에서 바뀌어 다시 그릴 때)
  function render(fresh) {
    if (fresh) st.form = null; else keepForm();
    if (st.phase === "start") { root.innerHTML = `<p class="uri-muted">공통 공간을 여는 중…</p>`; return; }
    if (st.phase === "error") { root.innerHTML = `<div class="uri-card"><p class="uri-err">${esc(st.msg)}</p></div>`; return; }
    if (st.phase === "locked") { root.innerHTML = lockHtml(); return; }
    const keepAmt = st.pay && root.querySelector('[data-uri-pay]');
    root.innerHTML = st.view && !mirrorMode ? openHtml()   // (가계부 연결 없는 보드: 예전 달 화면에서 적기)
      : `<div class="uri-tabs" role="tablist" aria-label="공통 보기"><button type="button" data-uri="tab" data-k="spend" aria-pressed="${st.tab !== "settle"}">📊 공통지출</button><button type="button" data-uri="tab" data-k="settle" aria-pressed="${st.tab === "settle"}">💸 정산</button></div>`
        + (st.tab === "settle" ? summaryHtml() : statsHtml());
    // 작은 탭 [공통지출 | 정산]과 기간 줄(‹ 2026-10 › 월간)을 한 줄로 → 위 공백 줄이기 (냐냐 요청 2026-10-22)
    const tabs = root.querySelector(":scope > .uri-tabs"), top = root.querySelector(":scope > .st-top");
    if (tabs) { const bar = document.createElement("div"); bar.className = "uri-bar"; tabs.before(bar); bar.append(tabs); if (top) bar.append(top); }
    if (st.tab !== "settle" && !(st.view && !mirrorMode)) drawStatsChart();
    restoreForm();
    if (keepAmt && document.activeElement === document.body) { const i = root.querySelector('[data-uri-pay]'); if (i) i.focus(); }
  }
  const groupLabel = (x) => x.trip ? `✈️ ${x.name}` : `${x.key.slice(2, 4)}년 ${+x.key.slice(5)}월`;
  const dirText = (diff) => !diff ? "딱 반반이에요" : diff > 0 ? `욱진 → 냐냐 ${won(diff)}` : `냐냐 → 욱진 ${won(-diff)}`;
  // 💸 정산하기 미리보기 (넣은 총액 → 선입선출로 어디까지 정산되는지)
  function payPreview() {
    const amt = digits(st.pay && st.pay.amount);
    if (!amt) return `<p class="uri-muted uri-small">공통 통장에서 내 통장으로 뺀 <b>총액</b>(둘이 넣은 돈 합)을 넣으면, 가장 오래된 미정산부터 차례로 정산돼요.</p>`;
    const r = fifo(amt), gs = groups().filter((x) => r.by[x.key]);
    return `<ul class="uri-pay-list">${gs.map((x) => { const after = x.open - r.by[x.key];
        return `<li><span>${esc(groupLabel(x))}</span><span class="uri-muted">${won(x.open)} →</span><b>${after ? `잔액 ${won(after)}` : "✅ 다 정산"}</b></li>`; }).join("")}</ul>
      ${r.left ? `<p class="uri-muted uri-small">남는 돈 <b>${won(r.left)}</b> — 미정산을 다 채우고도 남아요.</p>` : ""}
      <div class="uri-row"><button type="button" class="uri-btn" data-uri="payDo">✅ ${won(amt)} 정산 장부에 적기</button><button type="button" class="uri-btn ghost" data-uri="payClose">취소</button><span class="uri-muted uri-small">보통은 가계부에서 이체를 적을 때 '💸 공통비용 정산'을 체크하면 돼요.</span></div>`;
  }
  // 📊 공통 지출: 가계부 '통계' 탭과 똑같이 (보드의 st- · tx- 클래스, 기간·그래프는 보드가 opts.stats로 줌) — 표 맨 오른쪽에 '낸 사람'
  //   기간: 주간·월간·연간·기간 (+ 💸 정산 표에서 누른 ✈️ 여행). 자산·메모는 내가 낸 것만 (보드 가계부에서 찾아서)
  function stCur() {
    const sp = st.stats, R = opts.stats && opts.stats.range, t = today();
    if (sp.p === "trip") return { from: "0000", to: "9999", name: `✈️ ${sp.trip}` };
    if (sp.p === "range") { let f = sp.from || `${t.slice(0, 7)}-01`, e = sp.to || t; if (f > e) [f, e] = [e, f]; return { from: f, to: e, name: `${f.slice(2).replace(/-/g, ".")} ~ ${e.slice(2).replace(/-/g, ".")}` }; }
    if (R) return R(sp.p, sp.anchor || t, 0);
    const m = (sp.anchor || t).slice(0, 7); return { from: m + "-01", to: m + "-31", name: m };
  }
  function statsHtml() {
    const sp = st.stats, every = all(), trips = tripNames(every), cur = stCur(), DOWS = DOW;
    const inPer = (c) => sp.p === "trip" ? groupOf(c, trips) === "trip:" + sp.trip : c.date >= cur.from && c.date <= cur.to;
    const list = every.filter(inPer);
    const sum = (arr) => arr.reduce((t, c) => t + (Number(c.amount) || 0), 0);
    const by = (arr, key) => { const g = {}; arr.forEach((c) => { const k = key(c); (g[k] ||= []).push(c); }); return Object.entries(g).map(([k, v]) => ({ k, v, amt: sum(v) })).sort((a, b) => b.amt - a.amt); };
    const cats = by(list, (c) => c.cat || "기타"), total = sum(list), pct = (v, base) => base ? Math.round(v / base * 100) : 0;
    const colorOf = (k) => { const i = cats.filter((x) => x.amt > 0).slice(0, 8).findIndex((x) => x.k === k); return `var(--c${i < 0 ? 8 : i})`; };
    const sel = sp.sel && cats.find((x) => x.k === sp.sel) ? sp.sel : null, selCat = sel ? cats.find((x) => x.k === sel) : null;
    const subs = selCat ? by(selCat.v, (c) => c.sub || "기타") : [];
    const subSel = sp.sub && subs.find((x) => x.k === sp.sub) ? sp.sub : null;
    const shown = (subSel ? subs.find((x) => x.k === subSel).v : selCat ? selCat.v : list).slice().sort((a, b) => b.date.localeCompare(a.date) || (b.at || 0) - (a.at || 0));
    const stot = sum(shown);
    const pieList = cats.filter((x) => x.amt > 0).map((x) => ({ cat: x.k, amt: x.amt }));
    const pie = typeof opts.pie === "function" && pieList.length ? opts.pie(pieList, "공통비용") : "";
    const sd = (d) => { const t = new Date(d + "T00:00:00"); return `${t.getMonth() + 1}/${t.getDate()}(${DOWS[t.getDay()]})`; };
    const rec = (c) => (opts.stats && opts.stats.rec && opts.stats.rec(c.id)) || {};
    const nameOf = sel ? sel + (subSel ? " › " + subSel : "") : "공통비용 전체";
    return `
      <div class="st-top">
        <div class="st-nav">${sp.p === "trip" ? `<button class="chip" type="button" data-uri="stMonth">‹ 달로</button><b>${esc(cur.name)}</b>`
          : `<button class="chip" type="button" data-uri="stPrev" aria-label="이전"${sp.p === "range" ? " hidden" : ""}>‹</button><b>${esc(cur.name)}</b><button class="chip" type="button" data-uri="stNext" aria-label="다음"${sp.p === "range" ? " hidden" : ""}>›</button>
          <select data-uri-per aria-label="기간 단위">${[["week", "주간"], ["month", "월간"], ["year", "연간"], ["range", "기간"]].map(([k, l]) => `<option value="${k}"${sp.p === k ? " selected" : ""}>${l}</option>`).join("")}</select>`}</div>
        ${sp.p === "range" ? `<div class="row st-range"><label class="f">부터<input type="date" data-uri-from value="${esc(cur.from)}"></label><label class="f">까지<input type="date" data-uri-to value="${esc(cur.to)}"></label></div>` : ""}
      </div>
      <div class="st-grid">
        <div class="panel st-side"><div class="st-pie">${pie || `<p class="muted small" style="margin:0">${esc(cur.name)} 공통비용 기록이 없어요.</p>`}</div>
          <div class="st-cats"><button type="button" class="st-cat all${sel ? "" : " on"}" data-uri="stSel" data-k=""><span>공통비용 전체 <small>${list.length}</small></span><b class="won">${won(total)}</b></button>${cats.map((x) => `<button type="button" class="st-cat${sel === x.k && !subSel ? " on" : ""}" data-uri="stSel" data-k="${esc(x.k)}"><i class="st-pct" style="--c:${colorOf(x.k)}">${pct(x.amt, total)}%</i><span>${esc(x.k)}</span><b class="won">${won(x.amt)}</b></button>`
            + (sel === x.k ? `<div class="st-cc">${subs.map((y) => `<button type="button" class="st-cat st-sub${subSel === y.k ? " on" : ""}" data-uri="stSub" data-k="${esc(y.k)}"><i class="st-pct">${pct(y.amt, x.amt)}%</i><span>${esc(y.k)}</span><b class="won">${won(y.amt)}</b></button>`).join("")}</div>` : "")).join("")}</div>
        </div>
        <div class="panel st-main">
          <div class="st-head"><h3>${esc(nameOf)}</h3><b class="won">${won(stot)}</b></div>
          <div class="st-chip"><i class="st-pct" style="--c:${sel ? colorOf(sel) : "var(--coral)"}">${sel ? pct(stot, total) : 100}%</i> ${esc(sel ? nameOf : "전체")} <b class="won">${won(stot)}</b></div>
          ${sp.p === "trip" ? "" : `<div class="as-chart" data-uri-chart></div>`}
          <div class="tx-list">${shown.length ? `<div class="tx-row tx-th no-ck uri-tx"><span>날짜</span><span>자산</span><span>분류</span><span>소분류</span><span class="tx-amt">금액</span><span>내용</span><span>메모</span><span>낸 사람</span></div>` + shown.map((c) => { const r = rec(c);
            return `<div class="tx-row no-ck uri-tx"><span class="tx-d mono">${esc(sd(c.date))}</span><span class="tx-a">${esc(r.acct || "")}</span><span class="tx-c">${esc(c.cat || "기타")}</span><span class="tx-s">${esc(c.sub || "")}</span><span class="tx-amt won minus">${Number(c.amount) < 0 ? "-" : ""}${won(Math.abs(Number(c.amount) || 0))}</span><span class="tx-m">${esc(c.title || "")}</span><span class="tx-n">${esc(r.note || "")}</span><span class="tx-p p-${esc(c.payer)}">${esc(PAYER[c.payer] || "?")}</span></div>`; }).join("") : `<p class="muted small" style="margin:8px 0">${esc(cur.name)} ${esc(nameOf)} 기록이 없어요.</p>`}</div>
        </div>
      </div>`;
  }
  // 흐름 그래프 (통계 탭처럼 그 칸 포함 앞 12칸 · 연간 5칸 · 기간이면 그 안의 달) — 보드의 그래프 함수로 그림
  function drawStatsChart() {
    const el = root.querySelector("[data-uri-chart]"), S0 = opts.stats; if (!el || !S0 || !S0.chart || !S0.range) return;
    const sp = st.stats, every = all(), t = today();
    const want = (c) => (!sp.sel || (c.cat || "기타") === sp.sel) && (!sp.sub || (c.sub || "기타") === sp.sub);
    const sumR = (from, to) => every.reduce((s, c) => s + (c.date >= from && c.date <= to && want(c) ? Number(c.amount) || 0 : 0), 0);
    let pts;
    if (sp.p === "range") { const cur = stCur(), ms = []; for (let mm = cur.from.slice(0, 7); mm <= cur.to.slice(0, 7) && ms.length < 24;) { ms.push(mm); const [y, m] = mm.split("-").map(Number), d = new Date(y, m, 1); mm = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }
      pts = ms.map((mm) => { const v = sumR(mm + "-01" < cur.from ? cur.from : mm + "-01", mm + "-31" > cur.to ? cur.to : mm + "-31"); return { lab: `${+mm.slice(5)}월`, v, on: false, tip: `${mm} ${won(v)}` }; }); }
    else pts = Array.from({ length: sp.p === "year" ? 5 : 12 }, (_, i) => i - (sp.p === "year" ? 4 : 11)).map((k) => { const r = S0.range(sp.p, sp.anchor || t, k), v = sumR(r.from, r.to); return { lab: r.lab, v, on: k === 0, tip: `${r.name} ${won(v)}` }; });
    S0.chart(el, { pts, label: "공통비용 흐름" });
  }
  // 📜 정산한 내역: 같은 이체(settledBy)나 같은 날 정산한 것끼리 → 날짜 · 정산한 금액 · 건수 · 어느 달들. 편한가계부 엑셀에서 가져온 정산은 '가져오기'
  function historyHtml() {
    const rows = Object.entries(st.settles || {}).map(([id, x]) => ({ id, ...x })).filter((x) => x && Number(x.amount))
      .sort((a, b) => (b.date === "가져오기" ? -1 : 0) - (a.date === "가져오기" ? -1 : 0) || String(b.date).localeCompare(String(a.date)) || (b.at || 0) - (a.at || 0));
    if (!rows.length) return "";
    const d = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v.slice(2, 4)}.${+v.slice(5, 7)}.${+v.slice(8)}` : v;
    return `<div class="uri-card"><h4>📜 정산 장부 <span class="uri-muted uri-small">언제 얼마 정산했는지 · 합계 ${won(settledSum())}</span></h4><ul class="uri-hist">${rows.map((x) => `<li><span>${esc(d(String(x.date)))}</span><span class="uri-muted uri-small">${esc(x.memo || "")}${x.money ? " · 💸 가계부 이체" : ""}</span><b>${won(x.amount)}</b>${/^tab-/.test(x.id) ? `<button type="button" class="uri-x" data-uri="setDel" data-id="${esc(x.id)}" aria-label="이 정산 지우기" title="지우기">×</button>` : "<span></span>"}</li>`).join("")}</ul>
      <p class="uri-muted uri-small">가계부 이체로 적은 줄은 그 이체에서 '💸 공통비용 정산' 체크를 빼거나 이체를 지우면 같이 빠져요.</p></div>`;
  }
  function historyHtmlOld() {
    const g = {};
    all().filter((c) => c.settled).forEach((c) => { const k = c.settledBy ? "by:" + c.settledBy : "d:" + c.settled; const x = (g[k] ||= { k, date: c.settled, by: !!c.settledBy, amt: 0, n: 0, from: c.date, to: c.date }); x.amt += Number(c.amount) || 0; x.n++; if (c.date < x.from) x.from = c.date; if (c.date > x.to) x.to = c.date; });
    const list = Object.values(g).sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 12);
    if (!list.length) return "";
    const d = (v) => /^\d{4}-\d{2}-\d{2}$/.test(v) ? `${v.slice(2, 4)}.${+v.slice(5, 7)}.${+v.slice(8)}` : v;
    return `<div class="uri-card"><h4>📜 정산한 내역 <span class="uri-muted uri-small">최근 ${list.length}번</span></h4><ul class="uri-hist">${list.map((x) => `<li><span>${esc(d(x.date))}${x.by ? ' <span class="uri-muted uri-small">💸 이체</span>' : ""}</span><span class="uri-muted uri-small">${esc(x.from.slice(2, 7).replace("-", "."))}${x.to.slice(0, 7) !== x.from.slice(0, 7) ? `~${esc(x.to.slice(2, 7).replace("-", "."))}` : ""} · ${x.n}건</span><b>${won(x.amt)}</b></li>`).join("")}</ul></div>`;
  }
  // 🏷 공통 분류 고치기 (둘이 같이 씀): 대분류마다 소분류 칩(× 빼기) + 소분류 더하기, 대분류 더하기·빼기. 빼도 이미 적은 기록은 그대로
  function catsHtml() {
    if (!st.cats) return "";
    return `<details class="uri-card uri-cats"${st.catsOpen ? " open" : ""}><summary><h4>🏷 공통 분류 <span class="uri-muted uri-small">${partner}와 같이 써요 · 가계부에서 ❤️ 체크하면 이 분류로 골라요</span></h4></summary>
      ${st.cats.map((c, i) => `<div class="uri-cat-row"><b>${esc(c.n)}</b>
        <span class="uri-chips">${c.s.map((v, j) => `<span class="uri-chip-s">${esc(v)}<button type="button" class="uri-x" data-uri="subDel" data-i="${i}" data-j="${j}" aria-label="${esc(v)} 빼기">×</button></span>`).join("")}
        <form class="uri-sub-add" data-uri="subAdd" data-i="${i}"><input class="uri-input" name="v" maxlength="20" placeholder="＋ 소분류" aria-label="${esc(c.n)} 소분류 더하기"></form></span>
        <button type="button" class="uri-x" data-uri="catDel" data-i="${i}" aria-label="${esc(c.n)} 대분류 빼기" title="대분류 빼기">🗑</button></div>`).join("")}
      <form class="uri-row" data-uri="catAdd"><input class="uri-input" name="v" maxlength="20" placeholder="새 대분류 (예: 생활용품)"><button class="uri-btn ghost" type="submit">대분류 더하기</button></form>
      <p class="uri-muted uri-small">빼도 이미 적은 기록의 분류는 그대로예요.</p></details>`;
  }
  const saveCats = (list, msg) => save(rt.set(path(room, "settings", "cats"), list), msg).catch(() => {});
  // 📊 첫 화면: 냐냐 엑셀 첫 시트처럼 묶음(달·여행)마다 합계 · 정산 · 미정산 · 1인당 미정산
  function summaryHtml() {
    const gs = groups(), al = alloc(), open = all().map((c) => ({ ...c, amount: openOf(c, al) })).filter((c) => c.amount > 0), os = settleOf(open), now = today().slice(0, 7);
    const shown = gs.filter((x) => st.showDone || x.open || x.key === now), hid = gs.length - shown.length;
    const sum = gs.reduce((t, x) => ({ total: t.total + x.total, done: t.done + x.done, open: t.open + x.open }), { total: 0, done: 0, open: 0 });
    const w = (n) => n ? Math.round(n).toLocaleString("ko-KR") : "-", W = (n) => Math.round(n).toLocaleString("ko-KR");   // 표 안 숫자는 '원' 없이 (엑셀처럼)
    return `
      <div class="uri-owe${os.diff ? "" : " zero"}">
        <span>💸 아직 정산 안 된 돈 (전체)</span>
        <b>${dirText(os.diff)}</b>
        <small>${open.length ? `미정산 ${won(os.total)} · 정산한 돈 합계 ${won(settledSum())}` : "다 정산했어요 🎉"}</small>
        ${open.length && !st.pay ? `<div class="uri-row"><button type="button" class="uri-btn" data-uri="payOpen">💸 정산하기</button></div>` : ""}
      </div>
      ${st.pay ? `<div class="uri-card uri-pay"><h4>💸 정산하기 <span class="uri-muted uri-small">선입선출</span></h4>
        <label class="uri-f"><span>공통 통장에서 뺀 총액</span><input class="uri-input" type="text" inputmode="numeric" data-uri-pay value="${esc(st.pay.amount || "")}" placeholder="예: 2,412,560" autocomplete="off"></label>
        <div id="uri-pay-prev">${payPreview()}</div></div>` : ""}
      <div class="uri-card">
        <h4>한눈에 보기 <span class="uri-muted uri-small">줄을 누르면 📊 공통지출에서 그 달(여행)</span></h4>
        ${!st.loaded ? `<p class="uri-muted">불러오는 중…</p>` : `<div class="uri-tbl-wrap"><table class="uri-tbl">
          <thead><tr><th>달 <span class="uri-muted">(원)</span></th><th>합계</th><th class="c-done">정산</th><th>미정산</th><th>1인당 미정산</th></tr></thead>
          <tbody>${shown.map((x) => `<tr class="${x.open ? "" : "done"}${x.trip ? " trip" : ""}" data-uri="view" data-k="${esc(x.key)}" tabindex="0"><td>${esc(groupLabel(x))}</td><td>${w(x.total)}</td><td class="c-done">${w(x.done)}</td><td class="op">${w(x.open)}</td><td class="op">${w(Math.round(x.open / 2))}</td></tr>`).join("")}</tbody>
          <tfoot><tr><td>합계</td><td>${W(sum.total)}</td><td class="c-done">${W(sum.done)}</td><td class="op">${W(sum.open)}</td><td class="op">${W(sum.open / 2)}</td></tr>
            <tr class="per"><td>1인당</td><td>${W(sum.total / 2)}</td><td class="c-done">${W(sum.done / 2)}</td><td>${W(sum.open / 2)}</td><td></td></tr></tfoot>
        </table></div>
        ${hid || st.showDone ? `<button type="button" class="uri-link" data-uri="showDone">${st.showDone ? "정산 끝난 달 숨기기" : `정산 끝난 달 ${hid}개 더 보기`}</button>` : ""}`}
      </div>
      ${historyHtml()}
      <p class="uri-foot"><button type="button" class="uri-link" data-uri="lock">🔒 ${hostSaves ? "이 보드에 기억한" : "이 기기에서"} 공통 비밀번호 지우기</button></p>`;
  }

  function lockHtml() {
    return `<div class="uri-card uri-lock">
      <h3>🤝 우리 공간 열기</h3>
      <p class="uri-muted">${partner}와 같이 정한 <b>공통 비밀번호</b>를 넣어 주세요. 둘이 같은 비밀번호를 써야 같은 공통비용이 보여요.
        이 보드 비밀번호와는 따로예요.${hostSaves ? " 한 번 넣으면 이 보드에 기억돼서 다른 기기에선 다시 안 넣어도 돼요." : ""}</p>
      <form class="uri-row" data-uri="login" autocomplete="on">
        <input type="text" name="username" value="uri-board" autocomplete="username" hidden>
        <input class="uri-input" type="password" name="pw" placeholder="공통 비밀번호" aria-label="공통 비밀번호" autocomplete="current-password" required>
        <button class="uri-btn" type="submit">열기</button>
      </form>
      ${st.askNew ? `<div class="uri-note"><span>이 비밀번호로 만든 공통 공간이 아직 없어요. 오타가 아니라면 새로 만들까요? 만든 뒤 ${partner}에게도 같은 비밀번호를 알려 주세요.</span>
        <span class="uri-row"><button class="uri-btn" type="button" data-uri="newYes">새로 만들기</button><button class="uri-btn ghost" type="button" data-uri="newNo">다시 입력</button></span></div>` : ""}
      ${st.msg ? `<p class="uri-err">${esc(st.msg)}</p>` : ""}
    </div>`;
  }

  function openHtml() {
    const list = monthList();
    const s = settleOf(list);
    const isTrip = st.view.startsWith("trip:"), [y, m] = isTrip ? [0, 0] : st.view.split("-").map(Number);
    const vLabel = isTrip ? `✈️ ${st.view.slice(5)}` : `${m}월`;
    // ✅ 정산: 공통비용마다 settled(정산한 날, 가져오기면 "가져오기"). 아직 정산 안 된 것 전체로 '받을 돈·줄 돈'
    const open = Object.entries(st.costs).map(([id, c]) => ({ id, ...c })).filter((c) => c && c.date && !c.settled);
    const os = settleOf(open), openMonths = [...new Set(open.map((c) => c.date.slice(0, 7)))].sort();
    const mOpen = list.filter((c) => !c.settled), mSettled = list.length - mOpen.length;
    const cats = {};
    list.forEach((c) => { cats[c.cat || "기타"] = (cats[c.cat || "기타"] || 0) + (Number(c.amount) || 0); });
    const catRows = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const max = catRows.length ? catRows[0][1] : 0;
    const editing = st.edit && st.costs[st.edit] ? st.costs[st.edit] : null;

    // 날짜별로 묶기
    let lastDate = "", rows = "";
    for (const c of list) {
      if (c.date !== lastDate) {
        const d = new Date(c.date + "T00:00:00");
        rows += `<li class="uri-day">${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})</li>`;
        lastDate = c.date;
      }
      rows += `<li class="uri-item${st.edit === c.id ? " on" : ""}${c.settled ? " settled" : ""}">
        <span class="uri-cat">${esc(c.cat || "기타")}${c.sub ? ` · ${esc(c.sub)}` : ""}</span>
        <span class="uri-title">${esc(c.title || "")}${c.memo ? `<small>${esc(c.memo)}</small>` : ""}</span>
        <span class="uri-payer p-${esc(c.payer)}">${esc(PAYER[c.payer] || "?")}</span>
        <b class="uri-amt">${c.settled ? '<span class="uri-ok" title="정산 완료">✅</span> ' : ""}${won(c.amount)}</b>
        <span class="uri-acts">
          ${c.src === "money" ? `<span class="uri-src" title="${esc(NAME[c.by] || "")} 가계부에서 ❤️로 표시한 지출 — 고치기·지우기는 가계부에서">${c.by === who ? "내 가계부" : `${esc(NAME[c.by] || "")} 가계부`}</span>` : mirrorMode ? "" : `
          <button type="button" class="uri-icon" data-uri="edit" data-id="${esc(c.id)}" aria-label="고치기" title="고치기 (적은 사람: ${esc(NAME[c.by] || "?")})">✎</button>
          <button type="button" class="uri-icon" data-uri="del" data-id="${esc(c.id)}" aria-label="지우기" title="지우기">×</button>`}
        </span></li>`;
    }

    const f = editing || { date: isTrip || st.view === today().slice(0, 7) ? today() : st.view + "-01", payer: who, cat: URI_CATS[0] };
    return `
      <div class="uri-head">
        <button type="button" class="uri-chip" data-uri="back">‹ 한눈에 보기</button>
        ${isTrip ? `<h3>${esc(vLabel)} 공통비용</h3>` : `<button type="button" class="uri-round" data-uri="prev" aria-label="지난달">‹</button>
        <h3>${y}년 ${m}월 공통비용</h3>
        <button type="button" class="uri-round" data-uri="next" aria-label="다음 달">›</button>
        ${st.view !== today().slice(0, 7) ? `<button type="button" class="uri-chip" data-uri="thisMonth">이번 달</button>` : ""}`}
      </div>

      <div class="uri-owe${os.diff ? "" : " zero"}">
        <span>💸 아직 정산 안 된 돈 (전체)</span>
        <b>${dirText(os.diff)}</b>
        <small>${open.length ? `미정산 ${open.length}건 · ${won(os.total)}${openMonths.length ? ` · ${openMonths[0].replace("-", ".")}${openMonths.length > 1 ? `~${openMonths[openMonths.length - 1].replace("-", ".")}` : ""}` : ""}` : "다 정산했어요 🎉"}</small>
      </div>
      <div class="uri-tiles">
        <div class="uri-tile t-me"><span>${isTrip ? "여행 합계" : "이 달 합계"}</span><b>${won(s.total)}</b></div>
        <div class="uri-tile"><span>냐냐가 낸 돈</span><b>${won(s.paid.nyanya)}</b></div>
        <div class="uri-tile"><span>욱진이 낸 돈</span><b>${won(s.paid.ukjin)}</b></div>
        <div class="uri-tile t-settle"><span>${isTrip ? "여행 반반" : "이 달 반반"}</span><b>${dirText(s.diff)}</b><small>${list.length ? (mOpen.length ? `미정산 ${mOpen.length}건${mSettled ? ` · 정산 ${mSettled}건` : ""}` : "✅ 다 정산했어요") : ""}</small></div>
      </div>
      ${list.length ? `<div class="uri-row uri-settle-row">${mOpen.length
        ? `<button type="button" class="uri-btn" data-uri="settleMonth">✅ ${esc(vLabel)} 정산 완료로 (${mOpen.length}건)</button><span class="uri-muted uri-small">돈을 주고받았으면 눌러요. ${isTrip ? "이 여행" : "이 달"} 공통비용이 전부 정산됨으로 바뀌어요.</span>`
        : `<button type="button" class="uri-btn ghost" data-uri="unsettleMonth">↩ ${esc(vLabel)} 정산 취소</button>`}</div>` : ""}
      ${s.paid.joint ? `<p class="uri-muted uri-small">공동 통장으로 낸 ${won(s.paid.joint)}은 합계에만 넣고 정산에서는 빼요.</p>` : ""}

      <div class="uri-grid${mirrorMode ? " uri-mirror" : ""}">
        ${mirrorMode ? `<div class="uri-card uri-how"><h4>❤️ 이렇게 들어와요</h4><p class="uri-muted uri-small">가계부에서 지출을 적을 때 <b>❤️ 공통비용</b>을 체크하면 여기에 저절로 들어와요. ${partner}가 자기 가계부에서 ❤️로 적은 것도 같이 보여요. 고치기·지우기는 각자 가계부에서 하면 여기도 같이 바뀌어요.</p></div>` : `
        <form class="uri-card uri-form" data-uri="cost" autocomplete="off">
          <h4>${editing ? "✎ 기록 고치기" : "＋ 공통비용 적기"}</h4>
          <label class="uri-f"><span>날짜</span><input class="uri-input" type="date" name="date" value="${esc(f.date)}" required></label>
          <label class="uri-f"><span>내용</span><input class="uri-input" type="text" name="title" value="${esc(f.title || "")}" placeholder="예: 마트 장보기" maxlength="60" required></label>
          <label class="uri-f"><span>금액</span><input class="uri-input" type="text" inputmode="numeric" name="amount" value="${f.amount ? Number(f.amount).toLocaleString("ko-KR") : ""}" placeholder="0" required></label>
          <label class="uri-f"><span>분류</span><select class="uri-input" name="cat">${URI_CATS.map((c) => `<option${c === f.cat ? " selected" : ""}>${esc(c)}</option>`).join("")}${f.cat && !URI_CATS.includes(f.cat) ? `<option selected>${esc(f.cat)}</option>` : ""}</select></label>
          <div class="uri-f"><span>낸 사람</span><div class="uri-seg" role="radiogroup" aria-label="낸 사람">
            ${Object.entries(PAYER).map(([k, v]) => `<label><input type="radio" name="payer" value="${k}"${k === f.payer ? " checked" : ""}><span>${v}</span></label>`).join("")}
          </div></div>
          <label class="uri-f"><span>메모</span><input class="uri-input" type="text" name="memo" value="${esc(f.memo || "")}" placeholder="(선택)" maxlength="80"></label>
          <div class="uri-row">
            <button class="uri-btn" type="submit">${editing ? "저장" : "추가"}</button>
            ${editing ? `<button class="uri-btn ghost" type="button" data-uri="cancel">취소</button>` : ""}
          </div>
        </form>`}

        <div class="uri-side">
          <div class="uri-card">
            <h4>내역 <span class="uri-muted uri-small">${list.length}건</span></h4>
            ${!st.loaded ? `<p class="uri-muted">불러오는 중…</p>` : list.length ? `<ul class="uri-list">${rows}</ul>` : `<p class="uri-muted">${isTrip ? "이 여행" : "이 달"} 공통비용이 아직 없어요.</p>`}
          </div>
          ${catRows.length ? `<div class="uri-card">
            <h4>분류별</h4>
            <ul class="uri-bars">${catRows.map(([c, v]) => `<li><span>${esc(c)}</span><i style="--w:${max ? Math.max(3, Math.round(v / max * 100)) : 0}%"></i><b>${won(v)}</b></li>`).join("")}</ul>
          </div>` : ""}
        </div>
      </div>

      <p class="uri-foot"><button type="button" class="uri-link" data-uri="lock">🔒 ${hostSaves ? "이 보드에 기억한" : "이 기기에서"} 공통 비밀번호 지우기</button></p>`;
  }

  // 다시 그려도 입력 중이던 값이 날아가지 않게
  function keepForm() {
    const f = root.querySelector('form[data-uri="cost"]');
    if (!f) return;
    const a = document.activeElement;
    st.form = { edit: st.edit, values: Object.fromEntries(new FormData(f)), focus: a && f.contains(a) ? a.name : null };
  }
  function restoreForm() {
    const f = root.querySelector('form[data-uri="cost"]');
    const k = st.form; st.form = null;
    if (!f || !k || k.edit !== st.edit) return;
    for (const [n, v] of Object.entries(k.values)) {
      const el = f.elements[n];
      if (!el) continue;
      if (el instanceof RadioNodeList) [...el].forEach((r) => { r.checked = r.value === v; });
      else el.value = v;
    }
    if (k.focus && f.elements[k.focus] && !(f.elements[k.focus] instanceof RadioNodeList)) f.elements[k.focus].focus();
  }

  // ── 동작 ──
  root.addEventListener("submit", async (e) => {
    const form = e.target.closest("form[data-uri]");
    if (!form) return;
    e.preventDefault();
    if (form.dataset.uri === "login") {
      const pw = form.elements.pw.value;
      st.msg = ""; st.askNew = false;
      if (pw.length < 6) { st.msg = "공통 비밀번호는 6자 이상으로 해 주세요."; render(); return; }
      try {
        if (await tryPassword(pw)) { if (hostSaves) opts.savePassword(pw); return; }
        st.pendingPw = pw; st.askNew = true; render();
        const again = root.querySelector('input[name="pw"]'); if (again) again.value = pw;
      } catch (err) { st.msg = isDenied(err) ? "공통 저장소 규칙을 확인해 주세요." : "열지 못했어요. 인터넷 연결을 확인해 주세요."; render(); }
      return;
    }
    if ((form.dataset.uri === "catAdd" || form.dataset.uri === "subAdd") && st.cats) {
      const v = String(form.elements.v.value || "").trim().slice(0, 20); if (!v) return;
      const list = st.cats.map((c) => ({ n: c.n, s: c.s.slice() }));
      if (form.dataset.uri === "catAdd") { if (list.some((c) => c.n === v)) { toast("이미 있는 대분류예요."); return; } list.push({ n: v, s: [] }); }
      else { const c = list[+form.dataset.i]; if (!c) return; if (c.s.includes(v)) { toast("이미 있는 소분류예요."); return; } c.s.push(v); }
      st.catsOpen = true; saveCats(list, `🏷 '${v}'을 더했어요.`);
      return;
    }
    if (form.dataset.uri === "cost") {
      const v = Object.fromEntries(new FormData(form));
      const amount = digits(v.amount), title = String(v.title || "").trim();
      if (!title) { toast("내용을 적어 주세요."); return; }
      if (!amount) { toast("금액을 적어 주세요."); return; }
      const doc = { date: v.date, title, amount, cat: v.cat || "기타", payer: PAYER[v.payer] ? v.payer : who, memo: String(v.memo || "").trim() || null };
      try {
        if (st.edit && st.costs[st.edit]) {
          const id = st.edit;
          await save(rt.update(path(room, "costs", id), { ...doc, updBy: who, updAt: Date.now() }), "고쳤어요.");
          st.edit = null;
        } else {
          const r = rt.push(path(room, "costs"));
          await save(rt.set(r, { ...doc, by: who, at: Date.now() }), "공통비용을 적었어요.");
        }
        if (st.view && !st.view.startsWith("trip:") && doc.date.slice(0, 7) !== st.view) st.view = doc.date.slice(0, 7);
        render(true);
        const t = root.querySelector('input[name="title"]'); if (t) t.focus();
      } catch (err) { /* 알림은 save가 띄움 */ }
    }
  });

  root.addEventListener("input", (e) => {
    if ("uriPay" in e.target.dataset) {   // 💸 정산하기 금액: 쉼표 + 미리보기만 다시 (입력 칸은 그대로)
      const n = digits(e.target.value); e.target.value = n ? n.toLocaleString("ko-KR") : "";
      st.pay = { amount: e.target.value }; const pv = root.querySelector("#uri-pay-prev"); if (pv) pv.innerHTML = payPreview(); return;
    }
    if (e.target.name !== "amount") return;
    const n = digits(e.target.value);
    e.target.value = n ? n.toLocaleString("ko-KR") : "";
  });

  root.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-uri]");
    if (!b || b.tagName === "FORM") return;
    const a = b.dataset.uri, id = b.dataset.id;
    if (a === "newYes" && st.pendingPw) {
      try {
        const r = await roomOf(st.pendingPw);
        await rt.set(path(r, "settings"), { createdAt: Date.now(), by: who });
        lsSet(LS_PW, st.pendingPw);
        if (hostSaves) opts.savePassword(st.pendingPw);
        open(r); toast("🤝 우리 공간을 만들었어요. 같은 비밀번호로 열면 둘 다 같은 걸 봐요.");
      } catch (err) { st.msg = isDenied(err) ? "공통 저장소 규칙을 확인해 주세요." : "만들지 못했어요. 인터넷 연결을 확인해 주세요."; render(); }
    } else if (a === "newNo") { st.pendingPw = null; st.askNew = false; render(); }
    else if (a === "prev" || a === "next" || a === "thisMonth") {
      if (a === "thisMonth") st.view = today().slice(0, 7);
      else {
        const [y, m] = (st.view && !st.view.startsWith("trip:") ? st.view : today().slice(0, 7)).split("-").map(Number);
        const d = new Date(y, m - 1 + (a === "next" ? 1 : -1), 1);
        st.view = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      }
      st.edit = null; render(true);
    }
    else if (a === "view" && b.dataset.k) {
      const k = b.dataset.k;
      if (mirrorMode) { st.tab = "spend"; st.stats = k.startsWith("trip:") ? { ...st.stats, p: "trip", trip: k.slice(5), sel: null, sub: null } : { ...st.stats, p: "month", anchor: k + "-01", sel: null, sub: null }; render(); }
      else { st.view = k; st.edit = null; render(true); }
      root.scrollIntoView({ block: "start" });
    }
    else if (a === "tab") { st.tab = b.dataset.k === "settle" ? "settle" : "spend"; st.pay = null; render(); }
    else if (a === "stMonth") { st.stats = { ...st.stats, p: "month", trip: null, sel: null, sub: null }; render(); }
    else if (a === "setDel" && st.settles[id]) {
      const x = st.settles[id];
      if (!confirm(`정산 장부에서 ${won(x.amount)} 줄을 지울까요? 그만큼 다시 미정산으로 돌아가요.`)) return;
      save(rt.remove(path(room, "settles", id)), "정산 한 줄을 지웠어요.").catch(() => {});
    }
    else if (a === "back") { st.view = null; st.edit = null; render(true); }
    else if (a === "stSel" && st.stats) { st.stats.sel = st.stats.sel === b.dataset.k && !st.stats.sub ? null : b.dataset.k || null; st.stats.sub = null; render(); }
    else if (a === "stSub" && st.stats) { st.stats.sub = st.stats.sub === b.dataset.k ? null : b.dataset.k; render(); }
    else if ((a === "stPrev" || a === "stNext") && st.stats) {
      const d = a === "stNext" ? 1 : -1, sp = st.stats, an = sp.anchor || today(), [y, m, dd] = an.split("-").map(Number);
      const dt = sp.p === "year" ? new Date(y + d, m - 1, 1) : sp.p === "week" ? new Date(y, m - 1, dd + 7 * d) : new Date(y, m - 1 + d, 1);
      sp.anchor = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`; sp.sel = null; sp.sub = null; render();
    }
    else if ((a === "subDel" || a === "catDel") && st.cats) {
      const list = st.cats.map((c) => ({ n: c.n, s: c.s.slice() })), c = list[+b.dataset.i]; if (!c) return;
      if (a === "subDel") { const v = c.s[+b.dataset.j]; c.s.splice(+b.dataset.j, 1); st.catsOpen = true; saveCats(list, `'${v}' 소분류를 뺐어요.`); }
      else { if (!confirm(`'${c.n}' 대분류를 뺄까요? 이미 적은 기록은 그대로예요.`)) return; list.splice(+b.dataset.i, 1); st.catsOpen = true; saveCats(list, `'${c.n}' 대분류를 뺐어요.`); }
    }
    else if (a === "showDone") { st.showDone = !st.showDone; render(); }
    else if (a === "payOpen") { st.pay = { amount: "" }; render(); const i = root.querySelector("[data-uri-pay]"); if (i) i.focus(); }
    else if (a === "payClose") { st.pay = null; render(); }
    else if (a === "payDo" && st.pay) {
      const amt = digits(st.pay.amount); if (!amt) return;
      if (!confirm(`정산 장부에 ${won(amt)}을 적을까요? 오래된 미정산부터 금액만큼 정산돼요. ${partner} 보드에서도 같이 보여요.`)) return;
      save(settleBy(amt, "tab-" + Date.now(), { memo: "공통 탭에서 적음" }), `✅ ${won(amt)} 정산했어요.`).then(() => { st.pay = null; render(); }).catch(() => {});
    } else if (a === "edit" && st.costs[id]) { st.edit = id; render(true); root.querySelector('form[data-uri="cost"]').scrollIntoView({ block: "nearest", behavior: "smooth" }); }
    else if (a === "cancel") { st.edit = null; render(true); }
    else if (a === "settleMonth" || a === "unsettleMonth") {
      const on = a === "settleMonth", items = monthList().filter((c) => !!c.settled !== on);
      if (!items.length) return;
      const lb = st.view.startsWith("trip:") ? st.view.slice(5) : `${+st.view.slice(5)}월`;
      if (!confirm(on ? `${lb} 공통비용 ${items.length}건을 정산 완료로 바꿀까요? ${partner} 보드에서도 같이 바뀌어요.` : `${lb} 정산 표시를 지울까요? 다시 미정산으로 돌아가요.`)) return;
      const patch = {}; items.forEach((c) => { patch[`${c.id}/settled`] = on ? today() : null; });
      save(rt.update(path(room, "costs"), patch), on ? `✅ ${lb} 정산 완료!` : "정산 표시를 지웠어요.").catch(() => {});
    }
    else if (a === "del" && st.costs[id]) {
      const c = st.costs[id];
      if (!confirm(`'${c.title}' ${won(c.amount)} 기록을 지울까요? ${partner} 보드에서도 지워져요.`)) return;
      if (st.edit === id) st.edit = null;
      save(rt.remove(path(room, "costs", id)), "지웠어요.").catch(() => {});
    } else if (a === "lock") {
      if (!confirm(hostSaves ? "이 보드에 기억한 공통 비밀번호를 지울까요? 이 보드를 쓰는 모든 기기에서 우리 탭이 잠기고, 다시 보려면 공통 비밀번호를 넣어야 해요." : "이 기기에서 공통 비밀번호를 지울까요? 다시 보려면 공통 비밀번호를 넣어야 해요.")) return;
      lsSet(LS_PW, null); if (hostSaves) opts.savePassword(null); lock("잠갔어요.");
    }
  });

  root.addEventListener("change", (e) => {
    if (!e.target.matches || !st.stats) return;
    if (e.target.matches("[data-uri-per]")) { st.stats.p = e.target.value; st.stats.sel = null; st.stats.sub = null; render(); }
    else if (e.target.matches("[data-uri-from]")) { st.stats.from = e.target.value; render(); }
    else if (e.target.matches("[data-uri-to]")) { st.stats.to = e.target.value; render(); }
  });
  root.addEventListener("toggle", (e) => { if (e.target.classList && e.target.classList.contains("uri-cats")) st.catsOpen = e.target.open; }, true);
  root.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.matches && e.target.matches('tr[data-uri="view"]')) e.target.click(); });
  render();
  // 🔒 로컬 확인 모드 (냐냐 가계부가 localhost?local 일 때 opts.local = 사본 {costs, cats, settles}): 서버에 안 붙고 사본만 보여 줌, 저장 안 함
  if (opts.local) setTimeout(() => {   // 보드가 연결 코드를 다 붙인 뒤에 (바로 그리면 통계 도우미가 아직 없음)
    room = "local"; st.phase = "open"; st.costs = opts.local.costs || {}; st.loaded = true; st.settles = opts.local.settles || {}; st.settlesLoaded = true;
    st.cats = opts.local.cats ? catsOf(opts.local.cats) : COMMON_CATS.map((c) => ({ n: c.n, s: c.s.slice() }));
    if (typeof opts.onCats === "function") opts.onCats(st.cats);
    summary(); render();
  }, 0); else start();
  // 🏷 공통 분류 저장 (냐냐 가계부 설정 '분류'에서만 부름 — 고치는 건 냐냐만, 욱진 보드는 보기만)
  const setCats = (list) => room ? rt.set(path(room, "settings", "cats"), list) : Promise.reject(new Error("공통 공간이 안 열렸어요"));
  // 💸 이체로 정산 (가계부 이체 기록의 '공통비용 정산' 체크): 장부 settles/{이체 id}에 금액 한 줄. preview = 확인 창 글
  function settlePreview(amount) {
    const r = fifo(Number(amount) || 0), gs = groups().filter((x) => r.by[x.key]);
    const restG = groups(amount).find((x) => x.open > 0);   // 정산 뒤 가장 오래된 남은 묶음 → 메모 '2511 잔액 601,900원'처럼
    const short = (x) => x.trip ? x.name : x.key.slice(2, 4) + x.key.slice(5, 7);
    return { n: Object.keys(r.by).length, left: r.left, text: gs.map((x) => `· ${groupLabel(x)}: ${won(x.open)} → ${x.open - r.by[x.key] ? `남은 ${won(x.open - r.by[x.key])}` : "다 정산"}`).join("\n"),
      rest: restG ? `${short(restG)} 잔액 ${won(restG.open)}` : "미정산 없음" };
  }
  async function settleBy(amount, tag, meta = {}) {
    if (!room) throw new Error("공통 공간이 안 열렸어요");
    const id = String(tag || "tab-" + Date.now()).replace(/[.#$[\]/]/g, "_");
    await rt.set(path(room, "settles", id), { date: meta.date || today(), amount: Math.round(Number(amount) || 0), memo: meta.memo || null, money: meta.money || null, by: who, at: Date.now() });
    return { ok: true };
  }
  const unsettle = (tag) => room ? rt.remove(path(room, "settles", String(tag).replace(/[.#$[\]/]/g, "_"))) : Promise.resolve();
  return { render, usePassword, setMirror, cats: () => st.cats, setCats, settlePreview, settleBy, unsettle, ready: () => !!room && st.loaded && st.settlesLoaded };
}

let styled = false;
function injectStyle() {
  if (styled) return;
  styled = true;
  const css = `
.uri { display: flex; flex-direction: column; gap: 14px; min-width: 0; max-width: 100%; }
.uri h3, .uri h4 { font-family: var(--f-display); font-weight: 400; margin: 0; }
.uri h3 { font-size: 20px; } .uri h4 { font-size: 17px; }
.uri-muted { color: var(--muted); margin: 0; }
.uri-small { font-size: 13px; }
.uri-err { color: var(--danger, #D9412A); font-size: 14px; margin: 0; }
.uri-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--r, 14px); box-shadow: var(--shadow); padding: 16px 18px; display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.uri-lock { max-width: 480px; }
.uri-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.uri-row .uri-input { flex: 1; min-width: 0; }
.uri-input { font: inherit; color: inherit; padding: 8px 11px; border: 1px solid var(--line); border-radius: 10px; background: var(--surface); width: 100%; min-width: 0; }
.uri-input:focus { outline: 2px solid var(--me-soft); border-color: var(--me); }
.uri-btn { font: inherit; display: inline-flex; align-items: center; justify-content: center; padding: 8px 16px; border-radius: 10px; border: 0; background: var(--me); color: #fff; font-weight: 600; cursor: pointer; }
.uri-btn:hover { filter: brightness(0.95); }
.uri-btn.ghost { background: var(--surface); color: var(--fg); border: 1px solid var(--line); }
.uri-note { display: grid; gap: 10px; padding: 12px 14px; border-radius: 10px; background: var(--sun-soft); font-size: 14px; }
.uri-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.uri-round { font: inherit; width: 32px; height: 32px; border-radius: 50%; border: 1px solid var(--line); background: var(--surface); color: var(--fg); cursor: pointer; font-size: 18px; line-height: 1; }
.uri-chip { font: inherit; border: 1px solid var(--line); background: var(--surface); color: var(--fg); border-radius: 999px; padding: 4px 12px; cursor: pointer; font-size: 13px; font-weight: 500; }
.uri-tiles { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; }
.uri-tile { display: flex; flex-direction: column; gap: 2px; padding: 12px 14px; border-radius: var(--r, 14px); background: var(--sunk); min-width: 0; }
.uri-tile span { font-size: 13px; font-weight: 500; color: var(--muted); }
.uri-tile b { font-family: var(--f-display); font-weight: 400; font-size: 21px; overflow-wrap: anywhere; }
.uri-tile.t-me { background: var(--me-soft); } .uri-tile.t-me b { color: var(--me); }
.uri-tile.t-settle { background: var(--mint-soft); } .uri-tile.t-settle b { color: var(--mint); font-size: 18px; }
.uri-tile small { font-size: 12px; color: var(--muted); }
.uri-owe { display: flex; flex-direction: column; gap: 2px; padding: 14px 16px; border-radius: var(--r, 14px); background: var(--coral-soft); border: 1px solid color-mix(in srgb, var(--coral) 30%, transparent); }
.uri-owe span { font-size: 13px; font-weight: 600; color: var(--coral); }
.uri-owe b { font-family: var(--f-display); font-weight: 400; font-size: 26px; color: var(--fg); }
.uri-owe small { font-size: 13px; color: var(--muted); }
.uri-owe.zero { background: var(--mint-soft); border-color: transparent; } .uri-owe.zero span { color: var(--mint); }
.uri-settle-row { gap: 10px; }
.uri-item.settled { opacity: 0.6; }
.uri-ok { font-size: 12px; }
.uri-grid { display: grid; grid-template-columns: 320px minmax(0, 1fr); gap: 14px; align-items: start; }
.uri-side { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
.uri-f { display: flex; flex-direction: column; gap: 4px; font-size: 13px; font-weight: 500; color: var(--muted); }
.uri-f .uri-input { font-size: 15px; font-weight: 400; color: var(--fg); }
.uri-seg { display: flex; gap: 6px; flex-wrap: wrap; }
.uri-seg label { cursor: pointer; }
.uri-seg input { position: absolute; opacity: 0; pointer-events: none; }
.uri-seg span { display: inline-block; padding: 6px 12px; border-radius: 999px; border: 1px solid var(--line); background: var(--surface); color: var(--fg); font-size: 14px; }
.uri-seg input:checked + span { background: var(--me); border-color: var(--me); color: #fff; }
.uri-seg input:focus-visible + span { outline: 2px solid var(--me-soft); }
.uri-list { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 4px; }
.uri-day { font-size: 12px; font-weight: 600; color: var(--muted); padding: 8px 2px 2px; }
.uri-day:first-child { padding-top: 0; }
.uri-item { display: grid; grid-template-columns: auto minmax(0, 1fr) auto auto auto; align-items: center; gap: 10px; padding: 8px 10px; border-radius: 10px; background: var(--sunk); font-size: 14px; }
.uri-item.on { outline: 2px solid var(--me); }
.uri-cat { font-size: 12px; padding: 1px 8px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); white-space: nowrap; }
.uri-title { min-width: 0; overflow-wrap: anywhere; }
.uri-title small { display: block; color: var(--muted); font-size: 12px; }
.uri-payer { font-size: 12px; font-weight: 600; white-space: nowrap; }
.uri-payer.p-nyanya { color: var(--coral); } .uri-payer.p-ukjin { color: var(--blue); } .uri-payer.p-joint { color: var(--mint); }
.uri-amt { font-family: var(--f-mono); font-size: 14px; white-space: nowrap; }
.uri-acts { display: flex; gap: 2px; align-items: center; }
.uri-src { font-size: 11px; color: var(--muted); white-space: nowrap; }
.uri-grid.uri-mirror { grid-template-columns: 260px minmax(0, 1fr); }
.uri-icon { font: inherit; border: 0; background: none; color: var(--muted); cursor: pointer; font-size: 15px; padding: 2px 5px; border-radius: 6px; }
.uri-icon:hover { color: var(--fg); background: var(--surface); }
.uri-bars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.uri-bars li { display: grid; grid-template-columns: 84px minmax(0, 1fr) auto; align-items: center; gap: 10px; font-size: 13px; }
.uri-bars i { display: block; height: 10px; width: var(--w); border-radius: 5px; background: var(--me); }
.uri-bars b { font-family: var(--f-mono); font-weight: 500; white-space: nowrap; }
.uri-foot { margin: 0; }
.uri-owe .uri-row { margin-top: 8px; }
.uri-tbl-wrap { overflow-x: auto; }
.uri-tbl { width: 100%; border-collapse: collapse; font-size: 14px; font-variant-numeric: tabular-nums; }
.uri-tbl th { font-size: 12px; font-weight: 500; color: var(--muted); text-align: right; padding: 6px 10px; border-bottom: 1px solid var(--line); white-space: nowrap; }
.uri-tbl td { text-align: right; padding: 8px 10px; border-bottom: 1px solid var(--line); white-space: nowrap; }
.uri-tbl th:first-child, .uri-tbl td:first-child { text-align: left; }
.uri-tbl tbody tr { cursor: pointer; } .uri-tbl tbody tr:hover { background: var(--sunk); }
.uri-tbl tbody tr.done { color: var(--muted); }
.uri-tbl tbody tr:not(.done) td.op:nth-child(4) { color: var(--coral); }
.uri-tbl tfoot td { font-weight: 600; border-bottom: 0; border-top: 2px solid var(--line); }
.uri-tbl tfoot tr.per td { font-weight: 400; color: var(--muted); border-top: 0; }
.uri-pay-list { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.uri-pay-list li { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; gap: 10px; align-items: center; padding: 6px 10px; border-radius: 8px; background: var(--sunk); font-size: 14px; white-space: nowrap; }
.uri-pay-list b { font-weight: 600; }
.uri-hist { list-style: none; margin: 0; padding: 0; display: grid; gap: 4px; }
.uri-hist li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto 18px; gap: 10px; align-items: center; padding: 6px 10px; border-radius: 8px; background: var(--sunk); font-size: 14px; }
.uri-hist b { font-weight: 500; font-variant-numeric: tabular-nums; }
.uri-tabs { display: grid; grid-template-columns: 1fr 1fr; gap: 4px; background: var(--sunk); border: 1px solid var(--line); border-radius: 10px; padding: 4px; max-width: 360px; }
.uri-tabs button { font: inherit; border: 0; background: transparent; border-radius: 7px; padding: 8px 4px; font-size: 14px; color: var(--muted); cursor: pointer; }
.uri-tabs button[aria-pressed="true"] { background: var(--surface); color: var(--fg); font-weight: 600; box-shadow: 0 1px 2px rgba(0,0,0,.12); }
.uri-st-per { gap: 8px; }
.uri .st-top { justify-content: flex-end; }
.uri-bar { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.uri-bar .uri-tabs { flex: 0 1 360px; }
.uri-bar .st-top { margin-left: auto; }   /* 통계 탭처럼 기간 줄은 오른쪽 */
.uri-st-pay { display: flex; flex-wrap: wrap; gap: 6px 16px; color: var(--muted); padding: 2px 0 6px; } .uri-st-pay b { color: var(--fg); font-weight: 500; margin-left: 4px; }
.uri .st-main { display: flex; flex-direction: column; gap: 10px; min-width: 0; }
.uri .tx-row.no-ck.uri-tx { grid-template-columns: 82px minmax(0, .75fr) minmax(0, 1fr) minmax(0, .8fr) 118px minmax(0, 1.4fr) minmax(0, 1fr) 56px; cursor: default; }
.uri .tx-p { font-size: 12px; font-weight: 600; white-space: nowrap; } .uri .tx-p.p-nyanya { color: var(--coral); } .uri .tx-p.p-ukjin { color: var(--blue); } .uri .tx-p.p-joint { color: var(--mint); }
@media (max-width: 720px) { .uri .tx-row.no-ck.uri-tx { grid-template-columns: 66px minmax(0, 1fr) auto; grid-template-areas: "d c amt" "d m p"; } .uri .uri-tx .tx-a, .uri .uri-tx .tx-n, .uri .uri-tx .tx-s { display: none; } .uri .uri-tx .tx-d { grid-area: d; } .uri .uri-tx .tx-c { grid-area: c; } .uri .uri-tx .tx-amt { grid-area: amt; } .uri .uri-tx .tx-m { grid-area: m; } .uri .uri-tx .tx-p { grid-area: p; justify-self: end; } .uri .tx-th.uri-tx { display: none; } } .uri-st-per b { font-family: var(--f-mono); min-width: 96px; text-align: center; }
.uri-st-grid { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
.uri-st-list { display: grid; gap: 4px; }
.uri-st-row { font: inherit; display: grid; grid-template-columns: 52px minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 8px 10px; border: 0; border-radius: 10px; background: var(--sunk); color: var(--fg); text-align: left; cursor: pointer; }
.uri-st-row.flat { cursor: default; }
.uri-st-row:not(.flat):hover { outline: 1px solid var(--line); }
.uri-st-p { font-size: 12px; color: var(--muted); font-variant-numeric: tabular-nums; }
.uri-st-n small { color: var(--muted); font-size: 12px; margin-left: 4px; }
.uri-st-row b { font-weight: 500; font-variant-numeric: tabular-nums; white-space: nowrap; }
.uri-cats summary { cursor: pointer; list-style: none; } .uri-cats summary::-webkit-details-marker { display: none; }
.uri-cat-row { display: grid; grid-template-columns: 88px minmax(0, 1fr) auto; gap: 8px; align-items: center; padding: 6px 0; border-top: 1px solid var(--line); font-size: 14px; }
.uri-chips { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.uri-chip-s { display: inline-flex; align-items: center; gap: 2px; padding: 2px 4px 2px 10px; border-radius: 999px; background: var(--sunk); font-size: 13px; }
.uri-x { font: inherit; border: 0; background: none; color: var(--muted); cursor: pointer; padding: 0 4px; }
.uri-sub-add .uri-input { width: 110px; padding: 4px 8px; font-size: 13px; }
.uri-link { font: inherit; font-size: 13px; color: var(--muted); background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; }
@media (max-width: 1000px) { .uri-grid, .uri-grid.uri-mirror, .uri-st-grid { grid-template-columns: 1fr; } }
@media (max-width: 720px) {
  .uri-tbl { font-size: 12.5px; } .uri-tbl th, .uri-tbl td { padding: 7px 3px; } .uri-tbl td:first-child { white-space: normal; } .uri-tbl th { font-size: 11px; white-space: normal; }
  .uri-tbl .c-done { display: none; }   /* 폰: '정산' 칸은 숨김 (합계 − 미정산) */
  .uri-pay-list li { font-size: 13px; gap: 6px; }
  .uri-tiles { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
  .uri-tile b { font-size: 18px; }
  .uri-item { grid-template-columns: minmax(0, 1fr) auto auto; gap: 4px 8px; }
  .uri-item .uri-cat { grid-column: 1; justify-self: start; }
  .uri-item .uri-title { grid-column: 1; grid-row: 2; }
  .uri-item .uri-payer { grid-column: 2; grid-row: 1; justify-self: end; }
  .uri-item .uri-amt { grid-column: 2; grid-row: 2; justify-self: end; }
  .uri-item .uri-acts { grid-column: 3; grid-row: 1 / 3; }
}`;
  const el = document.createElement("style");
  el.dataset.uri = "";
  el.textContent = css;
  document.head.appendChild(el);
}
