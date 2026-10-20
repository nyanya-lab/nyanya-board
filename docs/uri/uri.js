// 🤝 우리 탭 — 냐냐 보드·욱진 보드가 같이 쓰는 코드. 이 파일 하나만 고치면 두 보드 다 적용돼요.
// 냐냐 보드: ./uri/uri.js / 욱진 보드: https://nyanya-lab.github.io/nyanya-board/uri/uri.js 에서 불러옴
// 저장: Firebase uri-board 의 uri/{SHA-256("uri-board:"+공통 비밀번호)} 아래 (각 보드 저장소와 따로)
// 지금 들어 있는 것: 공통비용 (costs). 나중에 공통 목표·같이 할 일·공통 상을 같은 방에 더함.
//
// 쓰는 법: mountUri(넣을 요소, { who: "nyanya" | "ukjin", toast, onSummary })
//   who        = 이 보드 주인 (적은 사람·기본 '낸 사람')
//   toast(msg) = 보드의 알림 함수 (없으면 alert 안 하고 조용히)
//   onSummary({ month, total, connected }) = 이번 달 공통비용 합계가 바뀔 때 (보드 요약 칸용, 선택)
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
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

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

  const st = {
    phase: "start",            // start → locked | open | error
    msg: "", askNew: false, pendingPw: null,
    costs: {}, loaded: false,
    month: today().slice(0, 7),
    edit: null,                // 고치는 중인 기록 id
    form: null                 // 다시 그릴 때 입력 중이던 값 유지
  };
  let rt = null, db = null, room = null, unsubs = [], bakTimer = null, readyDone;
  const ready = new Promise((r) => { readyDone = r; });   // 저장소 연결 준비 끝 (usePassword가 기다림)
  const hostSaves = typeof opts.savePassword === "function";
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
    unsubs.push(rt.onValue(path(room, "costs"), (snap) => {
      st.costs = snap.val() || {}; st.loaded = true; summary(); render();
    }, (e) => { toast(isDenied(e) ? "공통 저장소 규칙을 확인해 주세요." : "공통비용을 불러오지 못했어요."); }));
    rotateBackups(); clearInterval(bakTimer); bakTimer = setInterval(rotateBackups, 10 * 60 * 1000);
    render();
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
  const monthList = () => Object.entries(st.costs)
    .map(([id, c]) => ({ id, ...c }))
    .filter((c) => c && typeof c.date === "string" && c.date.slice(0, 7) === st.month)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.at || 0) - (a.at || 0));

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
    root.innerHTML = openHtml();
    restoreForm();
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
    const [y, m] = st.month.split("-").map(Number);
    const settleText = !s.diff ? "딱 반반이에요" : s.diff > 0 ? `욱진 → 냐냐 ${won(s.diff)}` : `냐냐 → 욱진 ${won(-s.diff)}`;
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
      rows += `<li class="uri-item${st.edit === c.id ? " on" : ""}">
        <span class="uri-cat">${esc(c.cat || "기타")}</span>
        <span class="uri-title">${esc(c.title || "")}${c.memo ? `<small>${esc(c.memo)}</small>` : ""}</span>
        <span class="uri-payer p-${esc(c.payer)}">${esc(PAYER[c.payer] || "?")}</span>
        <b class="uri-amt">${won(c.amount)}</b>
        <span class="uri-acts">
          <button type="button" class="uri-icon" data-uri="edit" data-id="${esc(c.id)}" aria-label="고치기" title="고치기 (적은 사람: ${esc(NAME[c.by] || "?")})">✎</button>
          <button type="button" class="uri-icon" data-uri="del" data-id="${esc(c.id)}" aria-label="지우기" title="지우기">×</button>
        </span></li>`;
    }

    const f = editing || { date: st.month === today().slice(0, 7) ? today() : st.month + "-01", payer: who, cat: URI_CATS[0] };
    return `
      <div class="uri-head">
        <button type="button" class="uri-round" data-uri="prev" aria-label="지난달">‹</button>
        <h3>${y}년 ${m}월 공통비용</h3>
        <button type="button" class="uri-round" data-uri="next" aria-label="다음 달">›</button>
        ${st.month !== today().slice(0, 7) ? `<button type="button" class="uri-chip" data-uri="thisMonth">이번 달</button>` : ""}
      </div>

      <div class="uri-tiles">
        <div class="uri-tile t-me"><span>이번 달 합계</span><b>${won(s.total)}</b></div>
        <div class="uri-tile"><span>냐냐가 낸 돈</span><b>${won(s.paid.nyanya)}</b></div>
        <div class="uri-tile"><span>욱진이 낸 돈</span><b>${won(s.paid.ukjin)}</b></div>
        <div class="uri-tile t-settle"><span>반반 정산</span><b>${settleText}</b></div>
      </div>
      ${s.paid.joint ? `<p class="uri-muted uri-small">공동 통장으로 낸 ${won(s.paid.joint)}은 합계에만 넣고 정산에서는 빼요.</p>` : ""}

      <div class="uri-grid">
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
        </form>

        <div class="uri-side">
          <div class="uri-card">
            <h4>내역 <span class="uri-muted uri-small">${list.length}건</span></h4>
            ${!st.loaded ? `<p class="uri-muted">불러오는 중…</p>` : list.length ? `<ul class="uri-list">${rows}</ul>` : `<p class="uri-muted">이 달 공통비용이 아직 없어요.</p>`}
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
        if (doc.date.slice(0, 7) !== st.month) st.month = doc.date.slice(0, 7);
        render(true);
        const t = root.querySelector('input[name="title"]'); if (t) t.focus();
      } catch (err) { /* 알림은 save가 띄움 */ }
    }
  });

  root.addEventListener("input", (e) => {
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
      if (a === "thisMonth") st.month = today().slice(0, 7);
      else {
        const [y, m] = st.month.split("-").map(Number);
        const d = new Date(y, m - 1 + (a === "next" ? 1 : -1), 1);
        st.month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      }
      st.edit = null; render(true);
    } else if (a === "edit" && st.costs[id]) { st.edit = id; render(true); root.querySelector('form[data-uri="cost"]').scrollIntoView({ block: "nearest", behavior: "smooth" }); }
    else if (a === "cancel") { st.edit = null; render(true); }
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

  render();
  start();
  return { render, usePassword };
}

let styled = false;
function injectStyle() {
  if (styled) return;
  styled = true;
  const css = `
.uri { display: flex; flex-direction: column; gap: 14px; }
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
.uri-acts { display: flex; gap: 2px; }
.uri-icon { font: inherit; border: 0; background: none; color: var(--muted); cursor: pointer; font-size: 15px; padding: 2px 5px; border-radius: 6px; }
.uri-icon:hover { color: var(--fg); background: var(--surface); }
.uri-bars { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
.uri-bars li { display: grid; grid-template-columns: 84px minmax(0, 1fr) auto; align-items: center; gap: 10px; font-size: 13px; }
.uri-bars i { display: block; height: 10px; width: var(--w); border-radius: 5px; background: var(--me); }
.uri-bars b { font-family: var(--f-mono); font-weight: 500; white-space: nowrap; }
.uri-foot { margin: 0; }
.uri-link { font: inherit; font-size: 13px; color: var(--muted); background: none; border: 0; padding: 0; cursor: pointer; text-decoration: underline; }
@media (max-width: 1000px) { .uri-grid { grid-template-columns: 1fr; } }
@media (max-width: 720px) {
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
