// 📑 보고서 탭 (냐냐 가계부 전용 — 욱진 보드 짝 코드 아님). 데이터(기록)는 안 바꾸고 보여 주기만.
// 2026-10-26 처음 만듦 → 같은 날 냐냐: "생각보다 쓰기 힘듦"(조건 칸이 길고 · 분류 고르기 어렵고 · 결과 보기 불편 · 저장한 것 쓰기 불편) → 카드 먼저로 다시 만듦
//   ① 첫 화면 = 저장한 보고서 카드 (이름 · 기간 · 조건 한 줄 · 쓴 돈/남은 돈 · 건수) + ＋ 새 보고서 (없으면 예시로 시작)
//   ② 카드를 누르면 결과: 기간(‹ › 로 앞뒤 달·해) · 조건 한 줄 · 합계 · 왼쪽 원형 + 분류 목록(누르면 그 분류만, 소분류까지) · 오른쪽 달마다 막대 · 달마다 표(누르면 그 달만) · 내역
//   ③ ✏️ 조건 = 작은 창: 이름 · 기간 · 구분 · ❤️ 공통 · 분류(찾기 + 체크 목록, 소분류는 펼쳐서) · 자산(펼쳐서) · 검색어 — 아래에 맞는 건수·금액이 바로 보임
//   예: 분류 🐶 돌돌이(지출) + 🏥보험금›돌돌이(수입) → 쓴 돈(지출 − 수입) = 돌돌이에 실제로 든 돈
// 저장 = settings.reports/{id} = { name, f, at(만든 때), upd(고친 때) } (모든 기기 같이)
// f = { per(빠른 기간 이름, ""면 from~to 그대로), from, to, kinds[expense|income|move], accts[], cats["kind|분류" 또는 "kind|분류|소분류"], q, common all|only|no }

const KIND = { expense: "지출", income: "수입", move: "이체" };
const ATYPE = [["bank", "통장"], ["card", "카드"], ["cash", "현금"], ["save", "저축"]];
const PERS = ["이번 달", "지난 달", "최근 3달", "올해", "작년", "최근 12달", "전체"];
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dot = (d) => d.replace(/-/g, ".");
const clone = (o) => JSON.parse(JSON.stringify(o));
const TPL = [   // 저장한 보고서가 없을 때 '예시로 시작'
  ["이번 달 지출", { per: "이번 달", kinds: ["expense"] }],
  ["올해 수입·지출", { per: "올해" }],
  ["❤️ 올해 공통비용", { per: "올해", kinds: ["expense"], common: "only" }],
  ["최근 12달 지출", { per: "최근 12달", kinds: ["expense"] }]
];

export function mountReport(root, env) {
  const { esc, won, S } = env;
  const now = new Date(), Y = now.getFullYear(), M = now.getMonth(), today0 = ymd(now);
  const norm = (f = {}) => ({ per: f.per != null ? f.per : f.from ? "" : "이번 달", from: f.from || ymd(new Date(Y, M, 1)), to: f.to || today0,
    kinds: f.kinds && f.kinds.length ? f.kinds.slice() : ["expense", "income"], accts: (f.accts || []).slice(), cats: (f.cats || []).slice(), q: f.q || "", common: f.common || "all" });
  // 보는 중: id(저장한 보고서, 새 것이면 null) · name · f · sh(기간 ‹ › 몇 칸) · pk(원형 수입/지출) · pick(분류) · psub(소분류) · mon(그 달만) · more(내역 더 보기)
  const st = { yr: null, yopen: {}, f: null, id: null, name: "", sh: 0, pk: null, pick: null, psub: null, mon: null, more: 0 };
  let ed = null;   // ✏️ 조건 창에서 고치는 중: { id, name, f, q(분류 찾기), aq(자산 찾기), open{}, acOpen }

  // ---------- 기간 ----------
  function period(f, sh = 0) {
    const mon = (k) => { const a = new Date(Y, M + k, 1); return { from: ymd(a), to: k >= 0 ? today0 : ymd(new Date(Y, M + k + 1, 0)), name: `${a.getFullYear()}년 ${a.getMonth() + 1}월`, unit: "달" }; };
    const yr = (k) => ({ from: `${Y + k}-01-01`, to: k >= 0 ? today0 : `${Y + k}-12-31`, name: `${Y + k}년`, unit: "해" });
    switch (f.per) {
      case "이번 달": return mon(sh);
      case "지난 달": return mon(sh - 1);
      case "올해": return yr(sh);
      case "작년": return yr(sh - 1);
      case "최근 3달": return { from: ymd(new Date(Y, M - 2, 1)), to: today0, name: "최근 3달" };
      case "최근 12달": return { from: ymd(new Date(Y, M - 11, 1)), to: today0, name: "최근 12달" };
      case "전체": return { from: "2000-01-01", to: today0, name: "전체 기간" };
    }
    const a = f.from <= f.to ? f.from : f.to, b = f.from <= f.to ? f.to : f.from;
    return { from: a, to: b, name: "직접 고른 기간" };
  }
  const perText = (r) => r.from === "2000-01-01" ? "처음부터 오늘까지" : `${dot(r.from)} ~ ${r.to.slice(0, 4) === r.from.slice(0, 4) ? dot(r.to).slice(5) : dot(r.to)}`;

  // ---------- 고르기 · 합계 ----------
  const keyOf = (x) => { const k = x.kind || "expense"; return [`${k}|${x.cat || ""}`, `${k}|${x.cat || ""}|${x.sub || ""}`]; };
  function match(x, f, r) {
    const k = x.kind || "expense";
    if (!x || !env.isWon(x) || !x.date || x.date < r.from || x.date > r.to) return false;
    if (!f.kinds.includes(k === "transfer" ? "expense" : k)) return false;
    if (f.accts.length && !f.accts.includes(x.account) && !(k === "move" && f.accts.includes(x.toAccount))) return false;
    if (f.cats.length) {   // 분류만 고르면 그 분류 전체, 그 분류의 소분류를 하나라도 고르면 고른 소분류만
      const [c1, c2] = keyOf(x), narrow = f.cats.some((c) => c.startsWith(c1 + "|"));
      if (narrow ? !f.cats.includes(c2) : !f.cats.includes(c1)) return false;
    }
    if (f.common === "only" && !x.common) return false;
    if (f.common === "no" && x.common) return false;
    if (f.q) { const q = f.q.toLowerCase(); if (![x.memo, x.note, x.cat, x.sub, x.ccat, x.csub].some((v) => String(v || "").toLowerCase().includes(q))) return false; }
    return true;
  }
  const subOf = (x) => (x.common && x.ccat ? x.ccat : x.sub) || "(소분류 없음)";   // ❤️ 공통비용은 소분류 대신 공통 분류(식비·문화생활…)로 묶음
  const kOf = (x) => (x.kind === "income" ? "income" : x.kind === "move" ? "move" : "expense");
  function compute(f, r) {
    const list = [];
    S.money.forEach((x, id) => { if (match(x, f, r)) list.push({ id, ...x }); });
    list.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
    let inc = 0, exp = 0, mv = 0;
    list.forEach((x) => { const a = Number(x.amount) || 0, k = kOf(x); if (k === "income") inc += a; else if (k === "move") mv += a; else exp += a; });
    return { list, inc, exp, mv };
  }
  // 대표 금액: 수입·지출 둘 다면 쓴 돈(지출 − 수입) 또는 남은 돈(수입 − 지출), 하나면 그것
  function headOf(f, r) {
    const hasI = f.kinds.includes("income"), hasE = f.kinds.includes("expense");
    if (hasI && hasE) { const net = r.inc - r.exp; return net < 0 ? { l: "쓴 돈 (지출 − 수입)", v: -net, c: "minus" } : { l: "남은 돈 (수입 − 지출)", v: net, c: "plus" }; }
    if (hasE) return { l: "지출", v: r.exp, c: "minus" };
    if (hasI) return { l: "수입", v: r.inc, c: "plus" };
    return { l: "이체", v: r.mv, c: "" };
  }
  const wonS = (v) => (v < 0 ? "-" : "") + won(Math.abs(v));
  // 조건 한 줄 (카드 · 결과 위)
  function condList(f) {
    const out = [];
    const ks = f.kinds; if (!(ks.length === 2 && ks.includes("expense") && ks.includes("income"))) out.push(ks.map((k) => KIND[k]).join("·") + (ks.length === 1 ? "만" : ""));
    if (f.cats.length) { const subd = new Set(f.cats.filter((c) => c.split("|").length === 3).map((c) => c.split("|").slice(0, 2).join("|")));
      const ns = f.cats.filter((c) => !subd.has(c)).map((c) => { const [, a, b] = c.split("|"); return b != null ? `${a} › ${b}` : a; });
      out.push(ns.slice(0, 3).join(", ") + (ns.length > 3 ? ` 외 ${ns.length - 3}개` : "")); }
    if (f.accts.length) { const ns = f.accts.map((id) => env.acctName(id)); out.push("💳 " + ns.slice(0, 2).join(", ") + (ns.length > 2 ? ` 외 ${ns.length - 2}개` : "")); }
    if (f.common === "only") out.push("❤️ 공통만"); else if (f.common === "no") out.push("❤️ 공통 빼고");
    if (f.q) out.push(`🔍 '${f.q}'`);
    return out.length ? out : ["모든 기록"];
  }
  const saved = () => Object.entries((S.settings && S.settings.reports) || {}).filter(([, r]) => r && r.f).sort((a, b) => (a[1].at || 0) - (b[1].at || 0));
  const savedOf = (id) => id && ((S.settings || {}).reports || {})[id];
  const dirty = () => { const s = savedOf(st.id); return !s || s.name !== st.name || JSON.stringify(norm(s.f)) !== JSON.stringify(st.f); };

  // ---------- 그리기 ----------
  function render() {
    if (!root.offsetParent && root.innerHTML) return;   // 다른 탭일 땐 안 그림 (보고서 탭으로 오면 다시)
    if (st.f && st.id) { if (savedOf(st.id)) st.seen = true; else if (st.seen) { st.f = null; st.id = null; } }   // 다른 기기에서 지움 (막 저장해서 아직 안 들어온 건 그대로)
    root.innerHTML = st.yr ? annualHtml() : st.f ? detailHtml() : listHtml();
    if (st.yr) afterAnnual(); else if (st.f) afterDetail();
  }
  function listHtml() {
    const sv = saved(), yd = yearData(Y), yi = sum(yd.income.tot), ye = sum(yd.expense.tot);
    const annual = `<button type="button" class="rpt-card rpt-annual" data-rf="annual"><span class="rpt-cn">📅 연간 보고서 <small class="rpt-badge">기본</small></span>` +
      `<span class="rpt-cp">${Y}년 · 달마다 수입 · 지출 · 분류별 표</span>` +
      `<span class="rpt-cv"><small>합계 (수입 − 지출)</small><b class="won ${yi - ye < 0 ? "minus" : "plus"}">${wonS(yi - ye)}</b></span>` +
      `<span class="rpt-cc">수입 ${won(yi)} · 지출 ${won(ye)}</span></button>`;
    const cards = annual + sv.map(([id, s]) => {
      const f = norm(s.f), r = period(f), c = compute(f, r), h = headOf(f, c);
      return `<button type="button" class="rpt-card" data-rf="open" data-k="${esc(id)}"><span class="rpt-cn">${esc(s.name)}</span>` +
        `<span class="rpt-cp">📅 ${esc(f.per || "직접")} <span>· ${esc(perText(r))}</span></span>` +
        `<span class="rpt-cv"><small>${esc(h.l)}</small><b class="won ${h.c}">${won(h.v)}</b></span>` +
        `<span class="rpt-cc">${esc(condList(f).join(" · "))} · ${c.list.length.toLocaleString()}건</span></button>`;
    }).join("");
    return `<div class="rpt-lhead"><h2>📑 보고서</h2><span class="muted small">자주 보는 조건을 저장해 두고 눌러서 봐요</span></div>
      <div class="rpt-cards">${cards}<button type="button" class="rpt-card rpt-new" data-rf="new"><b>＋ 새 보고서</b><span class="muted small">기간 · 분류 · 자산을 골라서 만들어요</span></button></div>
      ${sv.length ? "" : `<div class="rpt-tpl"><span class="muted small">예시로 시작</span>${TPL.map(([n], i) => `<button type="button" class="chip" data-rf="tpl" data-k="${i}">${esc(n)}</button>`).join("")}</div>`}`;
  }
  function detailHtml() {
    const f = st.f, r = period(f, st.sh), c = compute(f, r), h = headOf(f, c), isNew = !st.id, dt = dirty();
    // 원형·분류 목록은 지출 또는 수입 하나씩 (둘 다 있으면 위 작은 탭)
    const kinds = ["expense", "income"].filter((k) => f.kinds.includes(k) && c.list.some((x) => kOf(x) === k));
    if (!kinds.includes(st.pk)) { st.pk = kinds[0] || null; st.pick = st.psub = null; }
    const pk = st.pk, kl = pk ? c.list.filter((x) => kOf(x) === pk) : [];
    const byCat = {}; kl.forEach((x) => { const cn = x.cat || "(분류 없음)", o = (byCat[cn] ||= { amt: 0, n: 0, subs: {} }), a = Number(x.amount) || 0, sn = subOf(x); o.amt += a; o.n++; (o.subs[sn] ||= { amt: 0, n: 0 }); o.subs[sn].amt += a; o.subs[sn].n++; });
    const cats = Object.entries(byCat).sort((a, b) => b[1].amt - a[1].amt), ktot = kl.reduce((t, x) => t + (Number(x.amount) || 0), 0);
    if (st.pick && !byCat[st.pick]) st.pick = st.psub = null;
    if (st.psub && !(byCat[st.pick].subs[st.psub])) st.psub = null;
    // 분류가 하나뿐이면 원형은 소분류로
    const subView = st.pick || (cats.length === 1 ? cats[0][0] : null);
    const pieSrc = subView ? Object.entries(byCat[subView].subs).sort((a, b) => b[1].amt - a[1].amt) : cats;
    const colIdx = (i) => (i < 8 ? i : 8), pctOf = (v, t) => (t ? Math.round(v / t * 100) : 0);
    const top = pieSrc.slice(0, 8).map(([n, v]) => ({ cat: n, amt: v.amt })), rest = pieSrc.slice(8);
    const pieList = rest.length ? top.concat([{ cat: "그 밖", amt: rest.reduce((t, [, v]) => t + v.amt, 0), other: true }]) : top;
    const pie = pk && env.pie ? env.pie(null, pieList, KIND[pk], { color: (x) => `var(--c${x.other ? 8 : colIdx(top.indexOf(x))})`, legend: false, full: true }) : "";
    const subRows = (cn) => Object.entries(byCat[cn].subs).sort((a, b) => b[1].amt - a[1].amt).map(([sn, v], i) => `<button type="button" class="st-cat st-sub${st.psub === sn ? " on" : ""}" data-rf="psub" data-k="${esc(sn)}"><i class="st-pct" style="--c:var(--c${colIdx(i)})">${pctOf(v.amt, byCat[cn].amt)}%</i><span>${esc(sn)} <small class="muted">${v.n}</small></span><b class="won">${wonS(v.amt)}</b></button>`).join("");
    const catRows = `<button type="button" class="st-cat all${st.pick ? "" : " on"}" data-rf="pick" data-k=""><span>${KIND[pk] || ""} 전체 <small>${kl.length}</small></span><b class="won">${wonS(ktot)}</b></button>` +
      cats.map(([cn, v], i) => `<button type="button" class="st-cat${st.pick === cn ? " on" : ""}" data-rf="pick" data-k="${esc(cn)}"><i class="st-pct" style="--c:${subView && subView !== cn ? "var(--c8)" : subView ? "var(--muted)" : `var(--c${colIdx(i)})`}">${pctOf(v.amt, ktot)}%</i><span>${esc(cn)} <small class="muted">${v.n}</small></span><b class="won">${wonS(v.amt)}</b></button>` + (subView === cn && !(Object.keys(v.subs).length === 1 && v.subs["(소분류 없음)"]) ? subRows(cn) : "")).join("");
    // 오른쪽: 고른 분류 · 그 달
    const pl = st.pick ? kl.filter((x) => (x.cat || "(분류 없음)") === st.pick && (!st.psub || subOf(x) === st.psub)) : c.list;
    const shown = st.mon ? pl.filter((x) => x.date.slice(0, 7) === st.mon) : pl;
    const both = !st.pick && f.kinds.includes("income") && f.kinds.includes("expense");
    const byMon = {}; pl.forEach((x) => { const m = x.date.slice(0, 7), o = (byMon[m] ||= { inc: 0, exp: 0, n: 0 }), a = Number(x.amount) || 0, k = kOf(x); if (k === "income") o.inc += a; else if (k === "expense") o.exp += a; o.n++; });
    const mVal = (o) => both ? o.exp - o.inc : pk === "income" && st.pick ? o.inc : st.pick ? o.exp : f.kinds.includes("expense") ? o.exp : o.inc;
    const months = Object.keys(byMon).sort();
    if (st.mon && !byMon[st.mon]) st.mon = null;
    const sm = { inc: 0, exp: 0, n: 0 }; shown.forEach((x) => { const a = Number(x.amount) || 0, k = kOf(x); if (k === "income") sm.inc += a; else if (k === "expense") sm.exp += a; });
    const headName = (st.pick ? `${st.pick}${st.psub ? " › " + st.psub : ""}` : both ? h.l : `${KIND[pk] || "이체"} 전체`) + (st.mon ? ` · ${+st.mon.slice(5)}월` : "");
    const headV = mVal(sm);
    const unit = period(f).unit, canNext = r.to < today0;
    // 달마다 막대 (최근 24달)
    st._chart = months.length > 1 ? { bars: true, label: both ? "달마다 쓴 돈 (지출 − 수입)" : "달마다 금액",
      pts: months.slice(-24).map((m) => { const v = mVal(byMon[m]); return { lab: `${+m.slice(5)}월`, v, on: st.mon === m, tip: `${dot(m)} ${wonS(v)}` }; }) } : null;
    return `<div class="rpt-top">
        <button type="button" class="btn ghost small" data-rf="back">‹ 보고서</button>
        <h2 class="rpt-title">${esc(st.name || "새 보고서")}${isNew ? ' <span class="rpt-badge">저장 안 함</span>' : dt ? ' <span class="rpt-badge">바뀜</span>' : ""}</h2>
        <span class="rpt-acts">${dt ? '<button type="button" class="btn small" data-rf="save">💾 저장</button>' : ""}
          <button type="button" class="btn ghost small" data-rf="edit">✏️ 조건</button>
          ${isNew ? "" : '<button type="button" class="btn ghost small" data-rf="copy" title="이 조건으로 새 보고서">📋 복사</button><button type="button" class="btn ghost small danger-txt" data-rf="del" title="이 보고서 지우기" aria-label="지우기">🗑</button>'}</span>
      </div>
      <div class="panel rpt-cond">
        <span class="rpt-per">${unit ? `<button type="button" class="chip" data-rf="sh" data-k="-1" aria-label="앞 ${unit}">‹</button>` : ""}<b>${esc(r.name)}</b>${unit ? `<button type="button" class="chip" data-rf="sh" data-k="1" aria-label="다음 ${unit}"${canNext ? "" : " disabled"}>›</button>` : ""}<span class="muted small">${esc(perText(r))}</span></span>
        <select data-rf="per" aria-label="기간">${PERS.map((p) => `<option${f.per === p ? " selected" : ""}>${p}</option>`).join("")}<option value=""${f.per ? "" : " selected"}>직접 고르기…</option></select>
        <span class="rpt-cl">${condList(f).map((t) => `<button type="button" class="rpt-tag" data-rf="edit">${esc(t)}</button>`).join("")}</span>
      </div>
      <div class="stats rpt-sum">
        <div class="stat rpt-main-v"><span>${esc(h.l)}</span><b class="won ${h.c}">${won(h.v)}</b></div>
        ${f.kinds.includes("income") ? `<div class="stat"><span>수입</span><b class="won plus">${wonS(c.inc)}</b></div>` : ""}
        ${f.kinds.includes("expense") ? `<div class="stat"><span>지출</span><b class="won minus">${wonS(c.exp)}</b></div>` : ""}
        <div class="stat"><span>건수</span><b>${c.list.length.toLocaleString()}건</b>${c.mv && f.kinds.length > 1 ? `<small>이체 ${won(c.mv)}</small>` : ""}</div>
      </div>
      ${c.list.length ? `<div class="rpt-grid">
        <div class="panel rpt-side">
          ${kinds.length > 1 ? `<div class="seg rpt-pk">${kinds.map((k) => `<button type="button" data-rf="pk" data-k="${k}" aria-selected="${pk === k}">${KIND[k]}</button>`).join("")}</div>` : ""}
          ${pk ? `<div class="st-pie">${pie}</div>${subView && !st.pick ? `<p class="muted small rpt-note">분류가 하나라 원형은 소분류로 보여 줘요</p>` : ""}<div class="st-cats">${catRows}</div>` : '<p class="muted small" style="margin:0">이체만 있어요.</p>'}
        </div>
        <div class="panel rpt-main">
          <div class="st-head"><h3>${esc(headName)}</h3><b class="won">${wonS(headV)}</b></div>
          ${months.length > 1 ? `<div class="as-chart" data-rf-chart></div>` : ""}
          ${months.length ? `<details class="rpt-mt"${st.mon ? " open" : ""}><summary>달마다 표 <span class="muted small">${months.length}달 · 줄을 누르면 그 달 내역만</span></summary><div class="rpt-tbl">
            <div class="rpt-tr th"><span>달</span>${both ? "<span>수입</span><span>지출</span><span>쓴 돈</span>" : "<span>건수</span><span></span><span>금액</span>"}</div>
            ${months.slice().reverse().map((m) => { const o = byMon[m]; return `<button type="button" class="rpt-tr${st.mon === m ? " on" : ""}" data-rf="mon" data-k="${m}"><span class="mono">${dot(m)}</span>${both ? `<span class="won plus">${o.inc ? wonS(o.inc) : "-"}</span><span class="won minus">${o.exp ? wonS(o.exp) : "-"}</span><b class="won">${wonS(o.exp - o.inc)}</b>` : `<span class="muted">${o.n}건</span><span></span><b class="won">${wonS(mVal(o))}</b>`}</button>`; }).join("")}
          </div></details>` : ""}
          ${st.mon ? `<div class="rpt-monbar"><span>📅 ${dot(st.mon)} 내역만 보는 중</span><button type="button" class="link-btn small" data-rf="mon" data-k="${st.mon}">전체 보기</button></div>` : ""}
          <div class="tx-list rpt-tx">${shown.length ? `<div class="tx-row tx-th no-ck"><span>날짜</span><span>자산</span><span>분류</span><span>소분류</span><span class="tx-amt">금액</span><span>내용</span><span>메모</span></div>` + shown.slice(0, 200 + st.more).map((x) => env.txRow(x)).join("") : '<p class="muted small" style="margin:8px 0">기록이 없어요.</p>'}</div>
          ${shown.length > 200 + st.more ? `<button type="button" class="btn ghost small" data-rf="more">더 보기 (${(shown.length - 200 - st.more).toLocaleString()}건 남음)</button>` : ""}
        </div>
      </div>` : `<div class="panel rpt-empty"><p>고른 조건에 맞는 기록이 없어요.</p><button type="button" class="btn ghost small" data-rf="edit">✏️ 조건 고치기</button></div>`}`;
  }
  function afterDetail() {
    const el = root.querySelector("[data-rf-chart]");
    if (el && st._chart && env.chart) env.chart(el, st._chart);
  }

  // ---------- 📅 연간 보고서 (기본, 지울 수 없음) — 편한가계부 '연간 보고서'처럼 (2026-10-26 냐냐 요청) ----------
  // 해 ‹ › · 수입/지출/합계 · [전체] 달마다 수입·지출 막대 + 표(수입·지출·합계) · [수입]·[지출] 막대(☑ 전년도 비교 = 작년 회색 막대) + 분류별 표(▾ 소분류)
  // 평균 = 합계 ÷ 12 (편한가계부와 같게), 이체는 빼고, 💝 보낸 돈은 지출에, 원화만
  const sum = (a) => a.reduce((t, v) => t + v, 0);
  function yearData(y) {
    const z = () => Array(12).fill(0), D = { income: { tot: z(), cats: {} }, expense: { tot: z(), cats: {} } }, ys = String(y);
    S.money.forEach((x) => {
      if (!x || !env.isWon(x) || !x.date || x.date.slice(0, 4) !== ys) return;
      const k = kOf(x); if (k === "move") return;
      const i = +x.date.slice(5, 7) - 1, a = Number(x.amount) || 0, g = D[k], cn = x.cat || "(분류 없음)", c = (g.cats[cn] ||= { v: z(), subs: {} });
      g.tot[i] += a; c.v[i] += a; (c.subs[subOf(x)] ||= z())[i] += a;
    });
    return D;
  }
  let cmpMemo = null;
  const cmpOf = () => { if (cmpMemo) return cmpMemo; try { cmpMemo = JSON.parse(localStorage.getItem("nyanya-rpt-cmp") || "{}") || {}; } catch (e) { cmpMemo = {}; } return cmpMemo; };
  const num = (v) => { v = Math.round(v); return v ? v.toLocaleString("ko-KR") : ""; };
  function yTable(head, rows, foot) {   // rows = [{name, vals, cls, key, sub, open, can}]
    const cells = (vals) => vals.map((v) => `<td>${num(v)}</td>`).join("") + `<td class="yr-avg">${num(sum(vals) / 12)}</td><td class="yr-sum">${num(sum(vals))}</td>`;
    return `<div class="yr-tw"><table class="yr-t"><thead><tr><th>${esc(head)}</th>${Array.from({ length: 12 }, (_, i) => `<th>${i + 1}월</th>`).join("")}<th>평균</th><th>합계</th></tr></thead><tbody>` +
      rows.map((r) => `<tr class="${r.cls || ""}"${r.key ? ` data-rf="yopen" data-k="${esc(r.key)}"` : ""}><th title="${esc(r.name)}"><span>${esc(r.name)}</span>${r.can ? `<i aria-hidden="true">${r.open ? "▴" : "▾"}</i>` : ""}</th>${cells(r.vals)}</tr>`).join("") +
      `</tbody>${foot ? `<tfoot><tr><th>합계</th>${cells(foot)}</tr></tfoot>` : ""}</table></div>`;
  }
  function annualHtml() {
    const y = st.yr, D = yearData(y), P = yearData(y - 1), inc = D.income.tot, exp = D.expense.tot, ti = sum(inc), te = sum(exp), cmp = cmpOf();
    let first = Y; S.money.forEach((x) => { if (x && x.date) { const yy = +x.date.slice(0, 4); if (yy && yy < first) first = yy; } });
    st._bars = {};
    const sec = (k, label) => {
      const g = D[k], cats = Object.entries(g.cats).sort((a, b) => sum(b[1].v) - sum(a[1].v));
      st._bars[k] = { series: (cmp[k] ? [{ name: `${y - 1}년`, cls: "prev", vals: P[k].tot }] : []).concat([{ name: cmp[k] ? `${y}년` : label, cls: k, vals: g.tot }]) };
      const rows = [];
      cats.forEach(([cn, c]) => {
        const subs = Object.entries(c.subs).sort((a, b) => sum(b[1]) - sum(a[1])), can = !(subs.length === 1 && subs[0][0] === "(소분류 없음)"), key = `${k}|${cn}`, open = can && !!st.yopen[key];
        rows.push({ name: cn, vals: c.v, key: can ? key : "", can, open, cls: "yr-cat" });
        if (open) subs.forEach(([sn, v]) => rows.push({ name: sn, vals: v, cls: "yr-sub" }));
      });
      return `<div class="panel yr-sec"><div class="yr-sh"><h3>${label}</h3><label class="yr-cmp"><input type="checkbox" data-rf="ycmp" data-k="${k}"${cmp[k] ? " checked" : ""}> 전년도 비교</label></div>
        <div class="yr-chart" data-yb="${k}"></div>${cats.length ? yTable(label, rows, g.tot) : `<p class="muted small" style="margin:0">${y}년 ${label} 기록이 없어요.</p>`}</div>`;
    };
    st._bars.all = { series: [{ name: "수입", cls: "income", vals: inc }, { name: "지출", cls: "expense", vals: exp }] };
    return `<div class="rpt-top">
        <button type="button" class="btn ghost small" data-rf="back">‹ 보고서</button>
        <h2 class="rpt-title">📅 연간 보고서</h2>
        <span class="rpt-acts"><button type="button" class="btn ghost small" data-rf="print" title="인쇄">🖨 인쇄</button></span>
      </div>
      <div class="yr-nav"><button type="button" class="chip" data-rf="ysh" data-k="-1" aria-label="앞 해"${y <= first ? " disabled" : ""}>‹</button><b>${y}년</b><button type="button" class="chip" data-rf="ysh" data-k="1" aria-label="다음 해"${y >= Y ? " disabled" : ""}>›</button></div>
      <div class="stats yr-sum">
        <div class="stat"><span>수입</span><b class="won plus">${wonS(ti)}</b></div>
        <div class="stat"><span>지출</span><b class="won minus">${wonS(te)}</b></div>
        <div class="stat"><span>합계 (수입 − 지출)</span><b class="won">${wonS(ti - te)}</b></div>
      </div>
      <div class="panel yr-sec"><div class="yr-sh"><h3>전체</h3><span class="yr-leg"><i class="income"></i>수입 <i class="expense"></i>지출</span></div>
        <div class="yr-chart" data-yb="all"></div>
        ${yTable("전체", [{ name: "수입", vals: inc }, { name: "지출", vals: exp }, { name: "합계", vals: inc.map((v, i) => v - exp[i]), cls: "yr-net" }])}</div>
      ${sec("income", "수입")}
      ${sec("expense", "지출")}`;
  }
  // 막대: 달마다 묶음(수입·지출 또는 작년·올해), 칸에 마우스를 올리거나 누르면 그 달 상자
  const axisW = (v) => { const a = Math.abs(v), s = v < 0 ? "-" : ""; return a >= 1e8 ? s + +(a / 1e8).toFixed(1) + "억" : a >= 1e4 ? s + +(a / 1e4).toFixed(0) + "만" : s + a; };
  const nice = (raw) => { const p = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; };
  function drawBars(el) {
    const d = el._bars; if (!d) return;
    const W = Math.max(280, el.clientWidth || 600), H = 220, L = 48, R = 6, T = 10, B = 24, pw = W - L - R, ph = H - T - B, f = (v) => v.toFixed(1);
    el._w = Math.round(el.clientWidth);
    const all = d.series.flatMap((s) => s.vals); let lo = Math.min(0, ...all), hi = Math.max(0, ...all); if (hi === lo) hi = lo + 10000;
    const stp = nice((hi - lo) / 4); lo = Math.floor(lo / stp) * stp; hi = Math.ceil(hi / stp) * stp;
    const yv = (v) => T + ph - (v - lo) / (hi - lo) * ph, cw = pw / 12, ns = d.series.length, bw = Math.min(28, cw * 0.72 / ns);
    let s = "";
    for (let v = lo; v <= hi + 1e-6; v += stp) s += `<line x1="${L}" x2="${W - R}" y1="${f(yv(v))}" y2="${f(yv(v))}"${v === 0 ? ' class="z"' : ""}/><text class="yl" x="${L - 6}" y="${f(yv(v) + 3.5)}">${axisW(v)}</text>`;
    for (let i = 0; i < 12; i++) {
      const x0 = L + cw * i + cw / 2 - bw * ns / 2;
      d.series.forEach((se, j) => { const v = se.vals[i]; if (!v) return; s += `<rect class="b ${se.cls}" x="${f(x0 + bw * j)}" y="${f(Math.min(yv(v), yv(0)))}" width="${f(bw - 2)}" height="${f(Math.max(1.5, Math.abs(yv(0) - yv(v))))}" rx="2"/>`; });
      s += `<text class="xl" x="${f(L + cw * i + cw / 2)}" y="${H - 6}">${i + 1}${cw < 38 ? "" : "월"}</text><rect class="hit" data-i="${i}" x="${f(L + cw * i)}" y="${T}" width="${f(cw)}" height="${ph}"/>`;
    }
    el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="달마다 막대">${s}</svg><div class="yr-tip" hidden></div>`;
    if (el._bound) return; el._bound = true;
    const show = (ev) => {
      const r = ev.target.closest && ev.target.closest("rect.hit"), tip = el.querySelector(".yr-tip"), dd = el._bars; if (!tip || !dd) return;
      el.querySelectorAll("rect.hit.on").forEach((x) => x.classList.remove("on"));
      if (!r) { tip.hidden = true; return; }
      const i = +r.dataset.i; r.classList.add("on");
      tip.innerHTML = `<b>${i + 1}월</b>` + dd.series.map((se) => `<div><i class="${se.cls}"></i>${esc(se.name)}: <b>${won(se.vals[i])}</b></div>`).join("");
      tip.hidden = false;
      const cx = +r.getAttribute("x") + +r.getAttribute("width") / 2, w = tip.offsetWidth || 150;
      tip.style.left = Math.max(4, Math.min(el.clientWidth - w - 4, cx + 10)) + "px";
    };
    el.addEventListener("mousemove", show); el.addEventListener("click", show);
    el.addEventListener("mouseleave", () => { const t = el.querySelector(".yr-tip"); if (t) t.hidden = true; el.querySelectorAll("rect.hit.on").forEach((x) => x.classList.remove("on")); });
  }
  let barRO = null;
  function afterAnnual() {
    root.querySelectorAll("[data-yb]").forEach((el) => {
      el._bars = st._bars[el.dataset.yb]; drawBars(el);
      if (window.ResizeObserver) { barRO = barRO || new ResizeObserver((es) => es.forEach((e) => { const w = Math.round(e.contentRect.width); if (w && w !== e.target._w) drawBars(e.target); })); barRO.observe(el); }
    });
  }

  // ---------- ✏️ 조건 창 ----------
  const dlg = document.createElement("dialog");
  dlg.className = "dlg rpt-dlg"; dlg.setAttribute("aria-label", "보고서 조건");
  document.body.appendChild(dlg);
  function openEd(id, name, f, focusName) {
    ed = { id, name, f: clone(f), q: "", aq: "", open: {}, acOpen: false };
    renderEd(); if (!dlg.open) dlg.showModal();
    const n = dlg.querySelector('[data-re="name"]'); if (n && (focusName || !name)) n.focus();
  }
  const chip = (on, attrs, label) => `<button type="button" class="rpt-chip${on ? " on" : ""}" ${attrs} aria-pressed="${on}">${label}</button>`;
  function catTree() {
    const f = ed.f, q = ed.q.trim().toLowerCase();
    return ["expense", "income"].filter((k) => f.kinds.includes(k)).map((k) => {
      const rows = env.cats(k).map((cn) => {
        const key = `${k}|${cn}`, subs = env.subs(k, cn), picked = subs.filter((s) => f.cats.includes(`${key}|${s}`));
        const hitCat = !q || cn.toLowerCase().includes(q), hitSubs = q ? subs.filter((s) => s.toLowerCase().includes(q)) : subs;
        if (!hitCat && !hitSubs.length) return "";
        const whole = f.cats.includes(key) && !picked.length, open = ed.open[key] || picked.length > 0 || (q && !hitCat);
        const showSubs = open ? (q && !hitCat ? hitSubs : subs) : [];
        return `<div class="rpt-tc${whole || picked.length ? " on" : ""}"><label class="rpt-ck"><input type="checkbox" data-re="cat" data-k="${esc(key)}"${whole ? " checked" : ""}${picked.length ? " data-ind" : ""}><span>${esc(cn)}</span>${picked.length ? `<small class="muted">소분류 ${picked.length}개만</small>` : ""}</label>` +
          (subs.length ? `<button type="button" class="rpt-exp" data-re="exp" data-k="${esc(key)}" aria-expanded="${!!open}">소분류 ${subs.length} ${open ? "▴" : "▾"}</button>` : "") + `</div>` +
          (showSubs.length ? `<div class="rpt-ts">${showSubs.map((s) => `<label class="rpt-ck"><input type="checkbox" data-re="sub" data-k="${esc(`${key}|${s}`)}"${f.cats.includes(`${key}|${s}`) ? " checked" : ""}><span>${esc(s)}</span></label>`).join("")}</div>` : "");
      }).join("");
      return rows ? `<div class="rpt-tg"><b class="small muted">${KIND[k]} 분류</b>${rows}</div>` : "";
    }).join("") || '<p class="muted small" style="margin:4px 0">찾는 분류가 없어요.</p>';
  }
  function acctTree() {
    const f = ed.f, q = ed.aq.trim().toLowerCase(), list = env.accts();
    return ATYPE.map(([t, tl]) => { const xs = list.filter((a) => (a.type || "bank") === t && (!q || String(a.name).toLowerCase().includes(q)));
      return xs.length ? `<div class="rpt-tg"><b class="small muted">${tl}</b><div class="rpt-ag">${xs.map((a) => `<label class="rpt-ck"><input type="checkbox" data-re="acct" data-k="${esc(a.id)}"${f.accts.includes(a.id) ? " checked" : ""}><span>${esc(a.name)}</span></label>`).join("")}</div></div>` : ""; }).join("") || '<p class="muted small" style="margin:4px 0">찾는 자산이 없어요.</p>';
  }
  function renderEd() {
    if (!ed) return;
    const body = dlg.querySelector(".rpt-ed-body"), scr = body ? body.scrollTop : 0;
    const fa = document.activeElement && dlg.contains(document.activeElement) ? document.activeElement : null;
    const keep = fa ? { re: fa.dataset.re, k: fa.dataset.k, s: fa.selectionStart } : null;
    const f = ed.f, r = period(f), c = compute(f, r), h = headOf(f, c);
    const pickedChips = (() => { const subd = new Set(f.cats.filter((x) => x.split("|").length === 3).map((x) => x.split("|").slice(0, 2).join("|")));
      return f.cats.filter((x) => !subd.has(x)).map((x) => { const [k, a, b] = x.split("|"); return `<span class="rpt-pc">${f.kinds.length > 1 && f.kinds.includes("income") ? `<i>${KIND[k]}</i>` : ""}${esc(b != null ? `${a} › ${b}` : a)}<button type="button" data-re="unpick" data-k="${esc(x)}" aria-label="빼기">×</button></span>`; }).join(""); })();
    dlg.innerHTML = `<div class="dlg-head"><h3>${ed.id ? "✏️ 보고서 조건" : "＋ 새 보고서"}</h3><button class="icon-round" type="button" data-re="close" aria-label="닫기"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
      <div class="rpt-ed-body">
        <div class="rpt-es"><label class="rpt-name">이름<input type="text" data-re="name" value="${esc(ed.name)}" placeholder="예: 돌돌이 실제 비용" maxlength="40"></label></div>
        <div class="rpt-es"><h4>기간</h4><div class="rpt-chips">${PERS.map((p) => chip(f.per === p, `data-re="per" data-k="${p}"`, p)).join("")}${chip(!f.per, 'data-re="per" data-k=""', "직접 고르기")}</div>
          ${f.per ? `<p class="muted small" style="margin:0">${esc(perText(r))}${["이번 달", "지난 달", "올해", "작년"].includes(f.per) ? " · 날이 지나면 저절로 따라가요" : ""}</p>` : `<div class="rpt-dates"><input type="date" data-re="from" value="${esc(f.from)}" aria-label="부터"> ~ <input type="date" data-re="to" value="${esc(f.to)}" aria-label="까지"></div>`}</div>
        <div class="rpt-es"><h4>구분</h4><div class="rpt-chips">${Object.entries(KIND).map(([k, l]) => chip(f.kinds.includes(k), `data-re="kind" data-k="${k}"`, l)).join("")}
          <span class="rpt-sep"></span>${[["all", "❤️ 공통 포함"], ["only", "❤️ 공통만"], ["no", "❤️ 공통 빼고"]].map(([k, l]) => chip(f.common === k, `data-re="common" data-k="${k}"`, l)).join("")}</div></div>
        <div class="rpt-es"><h4>분류 <span class="muted small">${f.cats.length ? "" : "안 고르면 전체"}</span>${f.cats.length ? '<button type="button" class="link-btn small" data-re="catClear">다 빼기</button>' : ""}</h4>
          ${pickedChips ? `<div class="rpt-picked">${pickedChips}</div>` : ""}
          <input type="search" class="rpt-find" data-re="q" value="${esc(ed.q)}" placeholder="🔍 분류·소분류 찾기 (예: 돌돌이, 병원)">
          <div class="rpt-tree">${catTree()}</div>
          <p class="muted small" style="margin:0">분류에 체크 = 그 분류 전체 · 소분류를 펼쳐 체크 = 고른 소분류만</p></div>
        <div class="rpt-es"><h4>자산 <span class="muted small">${f.accts.length ? `${f.accts.length}개 고름` : "전체"}</span>${f.accts.length ? '<button type="button" class="link-btn small" data-re="acctClear">전체로</button>' : ""}
          <button type="button" class="rpt-exp" data-re="acOpen" aria-expanded="${ed.acOpen}">${ed.acOpen ? "접기 ▴" : "고르기 ▾"}</button></h4>
          ${f.accts.length ? `<div class="rpt-picked">${f.accts.map((id) => `<span class="rpt-pc">${esc(env.acctName(id))}<button type="button" data-re="acct" data-k="${esc(id)}" aria-label="빼기">×</button></span>`).join("")}</div>` : ""}
          ${ed.acOpen ? `<input type="search" class="rpt-find" data-re="aq" value="${esc(ed.aq)}" placeholder="🔍 자산 찾기"><div class="rpt-tree">${acctTree()}</div>` : ""}</div>
        <div class="rpt-es"><h4>검색어</h4><input type="search" class="rpt-find" data-re="fq" value="${esc(f.q)}" placeholder="내용·메모·분류에 들어간 글자 (예: 병원)"></div>
      </div>
      <div class="dlg-foot rpt-ed-foot"><span class="rpt-live"><b>${c.list.length.toLocaleString()}건</b> · ${esc(h.l)} <b class="won ${h.c}">${won(h.v)}</b></span>
        <span class="rpt-ed-btns"><button type="button" class="btn ghost" data-re="view">저장 안 하고 보기</button><button type="button" class="btn" data-re="save">💾 저장</button></span></div>`;
    dlg.querySelectorAll("input[data-ind]").forEach((i) => { i.indeterminate = true; });
    const nb = dlg.querySelector(".rpt-ed-body"); if (nb) nb.scrollTop = scr;
    if (keep && keep.re) { const i = dlg.querySelector(`[data-re="${keep.re}"]${keep.k ? `[data-k="${CSS.escape(keep.k)}"]` : ""}`); if (i) { i.focus({ preventScroll: true }); if (keep.s != null && i.setSelectionRange) try { i.setSelectionRange(keep.s, keep.s); } catch (e) { /* 무시 */ } } }
  }
  const toggle = (arr, v) => arr.includes(v) ? arr.filter((x) => x !== v) : arr.concat(v);
  async function saveReport(id, name, f) {
    const be = env.backend(); if (!be) return null;
    const old = savedOf(id), nid = id || "r" + Date.now().toString(36);
    try { await be.rootUpdate({ [`settings/reports/${nid}`]: { name, f: clone(f), at: (old && old.at) || Date.now(), upd: Date.now() } }); env.toast(`💾 '${name}' 저장했어요.`); return nid; }
    catch (err) { env.toast("저장하지 못했어요."); return null; }
  }
  dlg.addEventListener("click", async (e) => {
    if (e.target === dlg) { dlg.close(); return; }   // 바깥 누르면 닫기
    const b = e.target.closest("[data-re]"); if (!b || !ed) return;
    const k = b.dataset.re, v = b.dataset.k, f = ed.f;
    if (b.tagName === "INPUT" && b.type !== "checkbox") return;
    if (k === "close") { dlg.close(); return; }
    if (k === "per") { f.per = v; if (!v) { const r = period({ ...f, per: "이번 달" }); f.from = f.from || r.from; f.to = f.to || r.to; } }
    else if (k === "kind") { f.kinds = toggle(f.kinds, v); if (!f.kinds.length) f.kinds = [v]; }
    else if (k === "common") f.common = v;
    else if (k === "cat") { e.preventDefault(); const subs = f.cats.filter((c) => c.startsWith(v + "|")), whole = f.cats.includes(v) && !subs.length;
      f.cats = f.cats.filter((c) => c !== v && !c.startsWith(v + "|")); if (!whole) f.cats.push(v); }
    else if (k === "sub") { e.preventDefault(); const ck = v.split("|").slice(0, 2).join("|"); f.cats = toggle(f.cats.filter((c) => c !== ck), v); ed.open[ck] = true; }
    else if (k === "unpick") f.cats = f.cats.filter((c) => c !== v && !c.startsWith(v + "|"));
    else if (k === "exp") ed.open[v] = !ed.open[v];
    else if (k === "catClear") f.cats = [];
    else if (k === "acct") { e.preventDefault(); f.accts = toggle(f.accts, v); }
    else if (k === "acctClear") f.accts = [];
    else if (k === "acOpen") ed.acOpen = !ed.acOpen;
    else if (k === "view" || k === "save") {
      const name = ed.name.trim();
      if (k === "save" && !name) { env.toast("보고서 이름을 적어 주세요."); const n = dlg.querySelector('[data-re="name"]'); if (n) n.focus(); return; }
      let id = ed.id;
      if (k === "save") { id = await saveReport(ed.id, name, f); if (!id) return; }
      Object.assign(st, { f: clone(f), id, name, seen: false, sh: 0, pk: null, pick: null, psub: null, mon: null, more: 0 });
      ed = null; dlg.close(); render(); return;
    }
    else return;
    renderEd();
  });
  dlg.addEventListener("change", (e) => {
    const k = e.target.dataset.re; if (!ed) return;
    if (k === "from" || k === "to") { ed.f[k] = e.target.value || (k === "to" ? today0 : ed.f.from); renderEd(); }
  });
  let qt = null;
  dlg.addEventListener("input", (e) => {
    const k = e.target.dataset.re; if (!ed) return;
    if (k === "name") { ed.name = e.target.value; return; }
    if (k === "q" || k === "aq" || k === "fq") { const val = e.target.value; clearTimeout(qt); qt = setTimeout(() => { if (!ed) return; if (k === "fq") ed.f.q = val.trim(); else ed[k] = val; renderEd(); }, 200); }
  });
  dlg.addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.dataset.re === "name") { e.preventDefault(); dlg.querySelector('[data-re="save"]').click(); } });
  dlg.addEventListener("close", () => { ed = null; });

  // ---------- 결과 화면 버튼 ----------
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-rf]"); if (!b || b.tagName === "SELECT") return;
    const k = b.dataset.rf, v = b.dataset.k;
    if (k === "open") { const s = savedOf(v); if (!s) return; Object.assign(st, { f: norm(s.f), id: v, name: s.name, seen: true, sh: 0, pk: null, pick: null, psub: null, mon: null, more: 0 }); scrollTo(0, 0); }
    else if (k === "new") { openEd(null, "", norm({})); return; }
    else if (k === "tpl") { const t = TPL[+v]; if (t) openEd(null, t[0], norm(t[1])); return; }
    else if (k === "back") { st.f = null; st.id = null; st.yr = null; }
    else if (k === "annual") { st.yr = Y; scrollTo(0, 0); }
    else if (k === "ysh") st.yr += +v;
    else if (k === "ycmp") { const c = cmpOf(); c[v] = !c[v]; try { localStorage.setItem("nyanya-rpt-cmp", JSON.stringify(c)); } catch (err) { /* 무시 */ } }
    else if (k === "yopen") st.yopen[v] = !st.yopen[v];
    else if (k === "print") { window.print(); return; }
    else if (k === "edit") { openEd(st.id, st.name, st.f); return; }
    else if (k === "copy") { openEd(null, `${st.name} 복사본`, st.f, true); return; }
    else if (k === "save") { if (!st.id) { openEd(null, st.name, st.f, true); return; } await saveReport(st.id, st.name, st.f); }
    else if (k === "del") {
      const s = savedOf(st.id); if (!s || !confirm(`'${s.name}' 보고서를 지울까요? (기록은 그대로예요)`)) return;
      const be = env.backend(); if (!be) return;
      try { await be.rootUpdate({ [`settings/reports/${st.id}`]: null }); env.toast("지웠어요."); st.f = null; st.id = null; } catch (err) { env.toast("지우지 못했어요."); return; }
    }
    else if (k === "sh") { st.sh += +v; st.mon = null; }
    else if (k === "pk") { st.pk = v; st.pick = st.psub = null; }
    else if (k === "pick") { st.pick = v && st.pick !== v ? v : null; st.psub = null; }
    else if (k === "psub") st.psub = st.psub === v ? null : v;
    else if (k === "mon") st.mon = st.mon === v ? null : v;
    else if (k === "more") { st.more += 300; render(); return; }
    else return;
    st.more = 0; render();
  });
  root.addEventListener("change", (e) => {
    if (e.target.dataset.rf !== "per" || !st.f) return;
    const v = e.target.value;
    if (!v) { const r = period(st.f, st.sh); st.f.from = r.from; st.f.to = r.to; st.f.per = ""; st.sh = 0; openEd(st.id, st.name, st.f); render(); return; }
    st.f.per = v; st.sh = 0; st.mon = null; st.more = 0; render();
  });
  return { render };
}
