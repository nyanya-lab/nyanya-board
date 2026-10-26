// 📑 보고서 탭 (냐냐 가계부 전용, 2026-10-26 냐냐와 정함 — 욱진 보드 짝 코드 아님)
// 원하는 기간 · 자산 · 구분(수입/지출/이체) · 분류·소분류 · 검색어 · ❤️ 공통으로 골라서 합계 · 분류별 · 달마다 · 내역을 봄. 데이터는 안 바꾸고 보여 주기만.
//   예: 분류 🐶 돌돌이(지출) + 🏥보험금›돌돌이(수입) → 순(수입 − 지출) = 돌돌이에 실제로 든 돈
// 자주 보는 조건은 이름 붙여 저장 → settings.reports/{id} = { name, f, at } (모든 기기 같이)
// f = { from, to, kinds[expense|income|move], accts[], cats["kind|분류" 또는 "kind|분류|소분류"], q, common all|only|no }

const KIND = { expense: "지출", income: "수입", move: "이체" };
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

export function mountReport(root, env) {
  const { esc, won, S } = env;
  const now = new Date(), month0 = ymd(new Date(now.getFullYear(), now.getMonth(), 1)), today0 = ymd(now);
  const st = { f: { from: month0, to: today0, kinds: ["expense", "income"], accts: [], cats: [], q: "", common: "all" }, more: 0, open: {} };
  const QUICK = [
    ["이번 달", () => [month0, today0]],
    ["지난 달", () => [ymd(new Date(now.getFullYear(), now.getMonth() - 1, 1)), ymd(new Date(now.getFullYear(), now.getMonth(), 0))]],
    ["최근 3달", () => [ymd(new Date(now.getFullYear(), now.getMonth() - 2, 1)), today0]],
    ["올해", () => [`${now.getFullYear()}-01-01`, today0]],
    ["작년", () => [`${now.getFullYear() - 1}-01-01`, `${now.getFullYear() - 1}-12-31`]],
    ["최근 12달", () => [ymd(new Date(now.getFullYear(), now.getMonth() - 11, 1)), today0]],
    ["전체", () => ["2000-01-01", today0]]
  ];
  const cats = (k) => env.cats(k);
  const keyOf = (x) => { const k = x.kind || "expense"; return [`${k}|${x.cat || ""}`, `${k}|${x.cat || ""}|${x.sub || ""}`]; };
  function match(x) {
    const f = st.f, k = x.kind || "expense";
    if (!x || !env.isWon(x) || !x.date || x.date < f.from || x.date > f.to) return false;
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
  function compute() {
    const list = [];
    S.money.forEach((x, id) => { if (match(x)) list.push({ id, ...x }); });
    list.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
    let inc = 0, exp = 0, mv = 0; const byCat = {}, byMonth = {};
    list.forEach((x) => {
      const a = Number(x.amount) || 0, k = x.kind || "expense", m = x.date.slice(0, 7), bm = (byMonth[m] ||= { inc: 0, exp: 0 });
      if (k === "income") { inc += a; bm.inc += a; } else if (k === "move") mv += a; else { exp += a; bm.exp += a; }
      if (k !== "move") { const ck = `${k}|${x.cat || "(분류 없음)"}`, c = (byCat[ck] ||= { kind: k, cat: x.cat || "(분류 없음)", amt: 0, n: 0, subs: {} }); c.amt += a; c.n++; const sk = x.sub || "(소분류 없음)"; (c.subs[sk] ||= { amt: 0, n: 0 }); c.subs[sk].amt += a; c.subs[sk].n++; }
    });
    return { list, inc, exp, mv, byCat: Object.values(byCat).sort((a, b) => (a.kind === b.kind ? 0 : a.kind === "income" ? 1 : -1) || b.amt - a.amt), byMonth };
  }
  const chip = (on, attrs, label) => `<button type="button" class="rpt-chip${on ? " on" : ""}" ${attrs} aria-pressed="${on}">${label}</button>`;
  const saved = () => Object.entries((S.settings && S.settings.reports) || {}).filter(([, r]) => r && r.f).sort((a, b) => (a[1].at || 0) - (b[1].at || 0));
  function render() {
    if (!root.offsetParent && root.innerHTML) return;   // 다른 탭일 땐 안 그림 (보고서 탭으로 오면 다시)
    const keepFocus = document.activeElement && root.contains(document.activeElement) ? document.activeElement.dataset.rf : null;
    const f = st.f, r = compute(), accts = env.accts(), net = r.inc - r.exp;
    const sg = (v) => v > 0 ? " plus" : v < 0 ? " minus" : "";
    const catChips = (k) => cats(k).map((c) => { const key = `${k}|${c}`, on = f.cats.includes(key);
      return chip(on, `data-rf="cat" data-k="${esc(key)}"`, esc(c)); }).join("");
    const subChips = f.cats.filter((c) => c.split("|").length === 2).map((key) => { const [k, c] = key.split("|"), subs = env.subs(k, c); if (!subs.length) return "";
      return `<div class="rpt-subs"><span class="muted small">${esc(c)} 소분류</span>${subs.map((s) => { const sk = `${key}|${s}`; return chip(f.cats.includes(sk), `data-rf="cat" data-k="${esc(sk)}"`, esc(s)); }).join("")}</div>`; }).join("");
    const months = Object.keys(r.byMonth).sort();
    const shown = r.list.slice(0, 200 + st.more);
    const sd = (d) => { const t = new Date(d + "T00:00:00"); return `${d.slice(2, 4)}.${t.getMonth() + 1}.${t.getDate()}(${DOW[t.getDay()]})`; };
    root.innerHTML = `
      <div class="panel rpt-filter">
        <div class="rpt-saved"><b class="small">⭐ 저장한 보고서</b>${saved().map(([id, s]) => `<span class="rpt-sv">${chip(false, `data-rf="load" data-k="${esc(id)}"`, esc(s.name))}<button type="button" class="rpt-x" data-rf="del" data-k="${esc(id)}" aria-label="${esc(s.name)} 지우기" title="지우기">×</button></span>`).join("") || '<span class="muted small">아직 없어요 · 아래에서 고르고 [💾 저장]</span>'}
          <button type="button" class="btn ghost small" data-rf="save" style="margin-left:auto">💾 이 조건 저장</button></div>
        <div class="rpt-row"><span class="rpt-l">기간</span>${QUICK.map(([l, fn]) => { const [a, b] = fn(); return chip(f.from === a && f.to === b, `data-rf="quick" data-k="${esc(l)}"`, l); }).join("")}
          <span class="rpt-dates"><input type="date" data-rf="from" value="${esc(f.from === "2000-01-01" ? "" : f.from)}" aria-label="부터"> ~ <input type="date" data-rf="to" value="${esc(f.to)}" aria-label="까지"></span></div>
        <div class="rpt-row"><span class="rpt-l">구분</span>${Object.entries(KIND).map(([k, l]) => chip(f.kinds.includes(k), `data-rf="kind" data-k="${k}"`, l)).join("")}
          <span class="rpt-l" style="margin-left:12px">❤️ 공통</span>${[["all", "전체"], ["only", "공통만"], ["no", "공통 빼고"]].map(([k, l]) => chip(f.common === k, `data-rf="common" data-k="${k}"`, l)).join("")}</div>
        <div class="rpt-row"><span class="rpt-l">자산</span>${chip(!f.accts.length, 'data-rf="acctAll"', "전체")}${accts.map((a) => chip(f.accts.includes(a.id), `data-rf="acct" data-k="${esc(a.id)}"`, esc(a.name))).join("")}</div>
        <details class="rpt-row rpt-cats"${f.cats.length || st.open.cats ? " open" : ""} data-rf-det="cats"><summary><span class="rpt-l">분류</span> <span class="muted small">${f.cats.length ? `${f.cats.length}개 고름 · ` : "전체 · "}눌러서 고르기</span>${f.cats.length ? ' <button type="button" class="link-btn small" data-rf="catClear">다 빼기</button>' : ""}</summary>
          ${f.kinds.includes("expense") ? `<div class="rpt-cg"><span class="muted small">지출</span>${catChips("expense")}</div>` : ""}
          ${f.kinds.includes("income") ? `<div class="rpt-cg"><span class="muted small">수입</span>${catChips("income")}</div>` : ""}
          ${subChips}</details>
        <div class="rpt-row"><span class="rpt-l">검색</span><input type="search" class="rpt-q" data-rf="q" value="${esc(f.q)}" placeholder="내용·메모·분류에 들어간 글자 (예: 병원)"></div>
      </div>
      <div class="stats rpt-sum">
        <div class="stat"><span>수입</span><b class="won plus">${won(r.inc)}</b></div>
        <div class="stat"><span>지출</span><b class="won minus">${won(r.exp)}</b></div>
        <div class="stat"><span>순 (수입 − 지출)</span><b class="won${sg(net)}">${net < 0 ? "-" : ""}${won(net)}</b></div>
        <div class="stat"><span>건수</span><b>${r.list.length.toLocaleString()}건</b>${r.mv ? `<small>이체 ${won(r.mv)} 포함</small>` : ""}</div>
      </div>
      <div class="rpt-grid">
        <div class="panel"><h3 class="rpt-h">분류별</h3>${r.byCat.length ? `<div class="rpt-tbl">${r.byCat.map((c) => { const subs = Object.entries(c.subs).sort((a, b) => b[1].amt - a[1].amt);
            return `<div class="rpt-tr"><span class="rpt-k k-${c.kind}">${KIND[c.kind] || ""}</span><span class="rpt-c">${esc(c.cat)}</span><span class="rpt-n">${c.n}건</span><b class="won${c.kind === "income" ? " plus" : " minus"}">${won(c.amt)}</b></div>` +
              (subs.length > 1 || (subs[0] && subs[0][0] !== "(소분류 없음)") ? subs.map(([s, v]) => `<div class="rpt-tr sub"><span></span><span class="rpt-c">· ${esc(s)}</span><span class="rpt-n">${v.n}건</span><span class="won">${won(v.amt)}</span></div>`).join("") : ""); }).join("")}</div>` : '<p class="muted small" style="margin:0">고른 조건에 맞는 기록이 없어요.</p>'}</div>
        <div class="panel"><h3 class="rpt-h">달마다</h3>${months.length ? `<div class="as-chart rpt-chart" data-rf-chart></div><div class="rpt-tbl">${months.slice().reverse().map((m) => { const v = r.byMonth[m], n2 = v.inc - v.exp;
            return `<div class="rpt-tr mon"><span class="rpt-c mono">${m.replace("-", ".")}</span><span class="won plus">${v.inc ? won(v.inc) : "-"}</span><span class="won minus">${v.exp ? won(v.exp) : "-"}</span><b class="won${sg(n2)}">${n2 < 0 ? "-" : ""}${won(n2)}</b></div>`; }).join("")}</div>` : '<p class="muted small" style="margin:0">-</p>'}</div>
      </div>
      <div class="panel"><h3 class="rpt-h">내역 <span class="muted small">${r.list.length.toLocaleString()}건 · 줄을 누르면 고치기</span></h3>
        <div class="tx-list rpt-tx">${shown.map((x) => { const k = x.kind || "expense", a = Number(x.amount) || 0;
          return `<button type="button" class="rpt-li" data-rf="edit" data-k="${esc(x.id)}"><span class="mono">${esc(sd(x.date))}</span><span class="rpt-a">${esc(k === "move" ? `${env.acctName(x.account)} → ${env.acctName(x.toAccount)}` : env.acctName(x.account))}</span><span class="rpt-c">${esc(k === "move" ? "이체" : x.cat || "")}${x.common ? " ❤️" : ""}</span><span class="rpt-s">${esc(x.common && x.ccat ? `${x.ccat}${x.csub ? " · " + x.csub : ""}` : x.sub || "")}</span><b class="won${k === "income" ? " plus" : k === "move" ? "" : " minus"}">${a < 0 ? "-" : ""}${won(a)}</b><span class="rpt-m">${esc(x.memo || "")}</span><span class="rpt-nt">${esc(x.note || "")}</span></button>`; }).join("") || '<p class="muted small" style="margin:0">고른 조건에 맞는 기록이 없어요.</p>'}</div>
        ${r.list.length > shown.length ? `<button type="button" class="btn ghost small" data-rf="more">더 보기 (${(r.list.length - shown.length).toLocaleString()}건 남음)</button>` : ""}
      </div>`;
    const el = root.querySelector("[data-rf-chart]");
    if (el && env.chart) env.chart(el, { bars: true, pts: months.slice(-24).map((m) => ({ lab: `${+m.slice(5)}월`, v: r.byMonth[m].exp - r.byMonth[m].inc, on: false, tip: `${m.replace("-", ".")} 지출 − 수입 ${won(r.byMonth[m].exp - r.byMonth[m].inc)}` })), label: "달마다 지출 − 수입" });
    if (keepFocus) { const i = root.querySelector(`[data-rf="${keepFocus}"]`); if (i) { i.focus(); if (i.type === "search") i.setSelectionRange(i.value.length, i.value.length); } }
  }
  const toggle = (arr, v) => arr.includes(v) ? arr.filter((x) => x !== v) : arr.concat(v);
  root.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-rf]"); if (!b || b.tagName === "INPUT") return;
    const k = b.dataset.rf, v = b.dataset.k, f = st.f;
    if (k === "quick") { const q = QUICK.find(([l]) => l === v); if (q) [f.from, f.to] = q[1](); }
    else if (k === "kind") { f.kinds = toggle(f.kinds, v); if (!f.kinds.length) f.kinds = [v]; }
    else if (k === "common") f.common = v;
    else if (k === "acctAll") f.accts = [];
    else if (k === "acct") f.accts = toggle(f.accts, v);
    else if (k === "cat") { e.preventDefault(); f.cats = toggle(f.cats, v); if (!f.cats.includes(v) && v.split("|").length === 2) f.cats = f.cats.filter((c) => !c.startsWith(v + "|")); st.open.cats = true; }
    else if (k === "catClear") { e.preventDefault(); f.cats = []; }
    else if (k === "more") st.more += 300;
    else if (k === "edit") { env.edit(v); return; }
    else if (k === "load") { const s = ((S.settings || {}).reports || {})[v]; if (s && s.f) { st.f = { ...st.f, ...JSON.parse(JSON.stringify(s.f)), cats: s.f.cats || [], accts: s.f.accts || [], kinds: s.f.kinds || ["expense", "income"] }; env.toast(`⭐ ${s.name}`); } }
    else if (k === "save") {
      const name = (prompt("이 조건을 어떤 이름으로 저장할까요? (예: 돌돌이 실제 비용)") || "").trim(); if (!name) return;
      const be = env.backend(); if (!be) return;
      const id = "r" + Date.now().toString(36);
      try { await be.rootUpdate({ [`settings/reports/${id}`]: { name, f: JSON.parse(JSON.stringify(st.f)), at: Date.now() } }); env.toast(`💾 '${name}' 저장했어요.`); } catch (err) { env.toast("저장하지 못했어요."); }
      return;
    }
    else if (k === "del") {
      const s = ((S.settings || {}).reports || {})[v]; if (!s || !confirm(`'${s.name}' 보고서를 지울까요? (기록은 그대로예요)`)) return;
      const be = env.backend(); if (!be) return;
      try { await be.rootUpdate({ [`settings/reports/${v}`]: null }); env.toast("지웠어요."); } catch (err) { env.toast("지우지 못했어요."); }
      return;
    }
    else return;
    st.more = 0; render();
  });
  root.addEventListener("toggle", (e) => { if (e.target.dataset && e.target.dataset.rfDet) st.open[e.target.dataset.rfDet] = e.target.open; }, true);
  root.addEventListener("change", (e) => {
    const k = e.target.dataset.rf, f = st.f;
    if (k === "from") f.from = e.target.value || "2000-01-01";
    else if (k === "to") f.to = e.target.value || today0;
    else return;
    if (f.from > f.to) [f.from, f.to] = [f.to, f.from];
    st.more = 0; render();
  });
  let qt = null;
  root.addEventListener("input", (e) => { if (e.target.dataset.rf !== "q") return; clearTimeout(qt); qt = setTimeout(() => { st.f.q = e.target.value.trim(); st.more = 0; render(); }, 250); });
  return { render };
}
