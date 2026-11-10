// ★ 두 가계부(냐냐·욱진)가 같이 쓰는 파일 — 원본은 냐냐 보드 docs/money/, 욱진 보드 docs/는 글자 하나까지 같은 복사본. 한쪽만 고치지 말고, 보드마다 달라야 하는 건 env로 가르기.
// 🔎 내역 표 정렬·거르기 (2026-11-02 냐냐 요청): 표 머리줄 칸을 누르면 바로 정렬(오름차순 → 내림차순 → 원래 순서), 오른쪽 클릭하면 엑셀 필터처럼 작은 창 → 값 체크(금액은 최소~최대).
// 폰은 머리줄이 없고 오른쪽 클릭도 없어서 표 위 칸 이름 버튼을 누름 → 같은 창에 정렬 버튼까지. 표 위 #txBar에 지금 걸린 조건·건수·합계·[모두 풀기].
// 화면에서만 거름 (기록은 안 바꿈). 달을 옮겨도 그대로, 새로고침하면 풀림. 위 요약 칸(전체·수입·지출)은 그 기간 전체 그대로.
const COLS = [["date", "날짜"], ["acct", "자산"], ["cat", "분류"], ["sub", "소분류"], ["amt", "금액"], ["memo", "내용"], ["note", "메모"]];
const BLANK = "(비어 있음)";

export function mountTxFilter(env) {
  const { $, esc, won } = env;
  const st = { sort: null, f: {} };   // sort = { col, dir }, f[칸] = { out, set } (out이면 set을 뺀 것만) · 금액은 { min, max }
  let base = [], pop = null;
  const label = (c) => COLS.find((x) => x[0] === c)[1];
  const isRecv = (x) => x.recvTo || x.recvOf;
  // 칸에 보이는 글자 그대로 (money.js txRow와 같게)
  function val(x, c) {
    const move = x.kind === "move";
    if (c === "date") return x.date || "";
    if (c === "acct") return move ? `${env.acctName(x.account)} → ${env.acctName(x.toAccount)}` : env.acctName(x.account);
    if (c === "cat") return move ? "이체" : isRecv(x) ? "🤲 받을 돈" : x.cat || "";
    if (c === "sub") { if (isRecv(x)) return env.recvName(x.recvTo || x.account); if (x.common) { const o = env.ccOf(x); return o.c + (o.s ? " · " + o.s : ""); } return x.sub || ""; }
    return (c === "memo" ? x.memo : x.note) || "";
  }
  function keep(x, c) {
    const f = st.f[c]; if (!f) return true;
    if (c === "amt") { const a = Number(x.amount) || 0; return (f.min == null || a >= f.min) && (f.max == null || a <= f.max); }
    return f.out !== f.set.has(val(x, c));
  }
  const textOf = (c, v) => !v ? BLANK : c === "date" ? env.shortDate(v) : v;
  function compare(a, b) {
    const { col, dir } = st.sort, s = dir === "asc" ? 1 : -1;
    if (col === "amt") return s * ((Number(a.amount) || 0) - (Number(b.amount) || 0));
    const x = val(a, col), y = val(b, col);
    if (col === "date") return s * (x.localeCompare(y) || (a.createdAt || 0) - (b.createdAt || 0));
    if (!x !== !y) return x ? -1 : 1;   // 빈칸은 늘 맨 아래
    return s * x.localeCompare(y, "ko");
  }
  function apply(items) {
    base = items;
    const out = items.filter((x) => COLS.every(([c]) => keep(x, c)));
    return st.sort ? out.slice().sort(compare) : out;
  }
  const active = () => Object.keys(st.f).length > 0;
  const mark = (c) => (st.sort && st.sort.col === c ? (st.sort.dir === "asc" ? " ▲" : " ▼") : "") + (st.f[c] ? " ⏷" : "");
  const head = () => COLS.map(([c, l]) => `<span class="tf-th${c === "amt" ? " tx-amt" : ""}${mark(c) ? " on" : ""}" data-col="${c}" title="클릭: 정렬 · 오른쪽 클릭: 거르기">${l}${mark(c)}</span>`).join("");
  const sortText = (c, dir) => c === "date" ? (dir === "desc" ? "최근순" : "옛날순") : c === "amt" ? (dir === "desc" ? "큰 순" : "작은 순") : dir === "asc" ? "가나다순" : "역순";
  function filterText(c) {
    const f = st.f[c];
    if (c === "amt") return `${label(c)} ${f.min != null ? won(f.min) : ""}~${f.max != null ? won(f.max) : ""}`;
    const list = [...f.set];
    return `${label(c)} ${f.out ? "빼기 " : ""}${esc(textOf(c, list[0]))}${list.length > 1 ? ` 외 ${list.length - 1}` : ""}`;
  }
  function bar(items) {
    const on = [];
    if (st.sort && active()) on.push(`<button type="button" class="tf-chip" data-tf-off="sort">${label(st.sort.col)} ${sortText(st.sort.col, st.sort.dir)} ×</button>`);
    Object.keys(st.f).forEach((c) => on.push(`<button type="button" class="tf-chip" data-tf-off="${c}">${c === "amt" ? esc(filterText(c)) : filterText(c)} ×</button>`));
    const sum = (k) => items.filter((x) => !x.recvTo && !x.recvOf && (k === "income" ? x.kind === "income" : x.kind === "expense" || !x.kind)).reduce((t, x) => t + env.cntAmt(x), 0);
    $("txBar").innerHTML = `<div class="tf-cols">${COLS.map(([c, l]) => `<button type="button" class="tf-col${mark(c) ? " on" : ""}" data-tf-col="${c}">${l}${mark(c)}</button>`).join("")}</div>` +
      (on.length ? `<div class="tf-on">${on.join("")}<button type="button" class="link-btn" data-tf-off="all">모두 풀기</button>${active() ? `<span class="small muted">${items.length.toLocaleString()}건 · 지출 ${won(sum("expense"))} · 수입 ${won(sum("income"))}</span>` : ""}</div>` : "");
  }

  function close() { if (pop) pop.remove(); pop = null; }
  function open(c, anchor, withSort) {
    close();
    const rest = base.filter((x) => COLS.every(([k]) => k === c || keep(x, k))), f = st.f[c], amt = c === "amt";
    const count = new Map(); if (!amt) rest.forEach((x) => { const v = val(x, c); count.set(v, (count.get(v) || 0) + 1); });
    if (f && !amt) f.set.forEach((v) => { if (!f.out && !count.has(v)) count.set(v, 0); });
    const vals = [...count.keys()].sort((a, b) => (c === "date" ? b.localeCompare(a) : !a !== !b ? (a ? -1 : 1) : a.localeCompare(b, "ko")));
    const on = new Set(vals.filter((v) => !f || f.out !== f.set.has(v)));
    pop = document.createElement("div");
    pop.className = "tf-pop"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", `${label(c)} 정렬·거르기`);
    const sortBtn = (d) => `<button type="button" class="tf-s${st.sort && st.sort.col === c && st.sort.dir === d ? " on" : ""}" data-tf="sort" data-d="${d}">${sortText(c, d)}</button>`;
    pop.innerHTML = `<b class="tf-title">${label(c)}</b>${withSort ? `<div class="tf-sort">${c === "date" || amt ? sortBtn("desc") + sortBtn("asc") : sortBtn("asc") + sortBtn("desc")}</div>` : ""}` +
      (amt ? `<div class="tf-range"><input type="text" inputmode="numeric" data-tf="min" value="${f && f.min != null ? f.min.toLocaleString() : ""}" placeholder="최소" aria-label="최소 금액"><span>~</span><input type="text" inputmode="numeric" data-tf="max" value="${f && f.max != null ? f.max.toLocaleString() : ""}" placeholder="최대" aria-label="최대 금액"></div>`
        : `<input type="search" class="tf-q" data-tf="q" placeholder="🔍 찾기" aria-label="값 찾기"><label class="tf-row tf-all"><input type="checkbox" data-tf="all"><span>전체 (${vals.length})</span></label>
          <div class="tf-list">${vals.map((v, i) => `<label class="tf-row" data-i="${i}"><input type="checkbox" data-tf="ck"${on.has(v) ? " checked" : ""}><span>${esc(textOf(c, v))}</span><small>${count.get(v)}</small></label>`).join("")}</div>`) +
      `<div class="tf-btns"><button type="button" class="btn ghost small" data-tf="clear">이 칸 풀기</button><button type="button" class="btn small" data-tf="ok">확인</button></div>`;
    document.body.append(pop);
    const r = anchor.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = innerHeight, edge = 8, w = pop.offsetWidth;
    pop.style.left = `${Math.max(edge, Math.min(r.left, vw - w - edge))}px`;
    const below = vh - r.bottom - edge * 2, up = pop.offsetHeight > below && r.top > below;
    pop.style.maxHeight = `${Math.max(up ? r.top - edge * 2 : below, 180)}px`;
    pop.style.top = `${up ? Math.max(edge, r.top - edge - pop.offsetHeight) : Math.min(r.bottom + 4, vh - pop.offsetHeight - edge)}px`;

    const rows = [...pop.querySelectorAll(".tf-list .tf-row")], allCk = pop.querySelector('[data-tf="all"]');
    const syncAll = () => { if (!allCk) return; const vis = rows.filter((x) => !x.hidden); allCk.checked = vis.length > 0 && vis.every((x) => x.querySelector("input").checked); };
    syncAll();
    const qEl = pop.querySelector('[data-tf="q"]');
    if (qEl) qEl.focus(); else pop.querySelector('[data-tf="min"]').focus();
    const done = () => { close(); env.render(); };
    const parse = (el) => { const t = el.value.replace(/[^\d-]/g, ""); return t === "" || t === "-" ? null : Number(t); };
    function ok() {
      if (amt) {
        const min = parse(pop.querySelector('[data-tf="min"]')), max = parse(pop.querySelector('[data-tf="max"]'));
        if (min == null && max == null) delete st.f.amt; else st.f.amt = { min, max };
        done(); return;
      }
      const yes = vals.filter((v, i) => !rows[i].hidden && rows[i].querySelector("input").checked), no = vals.filter((v) => !yes.includes(v));
      if (!yes.length) { env.toast("하나 이상 골라 주세요."); return; }
      if (!no.length) delete st.f[c]; else st.f[c] = no.length <= yes.length ? { out: true, set: new Set(no) } : { out: false, set: new Set(yes) };   // 적은 쪽으로 기억 (달을 옮겨도 자연스럽게)
      done();
    }
    pop.addEventListener("input", (e) => {
      const k = e.target.dataset.tf;
      if (k === "q") { const q = e.target.value.trim().toLowerCase(); rows.forEach((x) => { x.hidden = !!q && !x.textContent.toLowerCase().includes(q); }); syncAll(); }
      else if (k === "all") { rows.filter((x) => !x.hidden).forEach((x) => { x.querySelector("input").checked = e.target.checked; }); }
      else if (k === "ck") syncAll();
    });
    pop.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); ok(); } });
    pop.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-tf]"); if (!b) return;
      if (b.dataset.tf === "sort") { const d = b.dataset.d; st.sort = st.sort && st.sort.col === c && st.sort.dir === d ? null : { col: c, dir: d }; done(); }
      else if (b.dataset.tf === "clear") { delete st.f[c]; done(); }
      else ok();
    });
  }

  // capture: money.js가 머리줄 클릭을 capture에서 막아서 같은 단계에서 받음
  $("txList").addEventListener("click", (e) => {
    const th = e.target.closest(".tx-th [data-col]"); if (!th) return;
    const c = th.dataset.col;
    const now = st.sort && st.sort.col === c ? st.sort.dir : "";
    st.sort = now === "asc" ? { col: c, dir: "desc" } : now === "desc" ? null : { col: c, dir: "asc" };   // 오름차순 → 내림차순 → 원래 순서
    close(); env.render();
  }, true);
  $("txList").addEventListener("contextmenu", (e) => {
    const th = e.target.closest(".tx-th [data-col]"); if (!th) return;
    e.preventDefault();
    open(th.dataset.col, th, false);
  });
  $("txBar").addEventListener("click", (e) => {
    const col = e.target.closest("[data-tf-col]"); if (col) { open(col.dataset.tfCol, col, true); return; }
    const off = e.target.closest("[data-tf-off]"); if (!off) return;
    const k = off.dataset.tfOff;
    if (k === "all") { st.sort = null; st.f = {}; } else if (k === "sort") st.sort = null; else delete st.f[k];
    env.render();
  });
  document.addEventListener("mousedown", (e) => { if (pop && !pop.contains(e.target) && !e.target.closest("[data-tf-col]")) close(); }, true);
  document.addEventListener("keydown", (e) => { if (pop && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } }, true);
  addEventListener("resize", close);
  return { apply, head, bar, active };
}
