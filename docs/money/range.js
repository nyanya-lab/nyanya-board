// 📅 기간 고르기 창 (편한가계부처럼): 왼쪽 빠른 선택(오늘·어제·이번 주·지난 주·이번 달·지난 달·올해·작년·전체),
// 오른쪽 시작일 ~ 끝날 + 달력(위아래로 넘김, 연·월 골라 바로 가기), [취소] [적용].
// 냐냐 가계부 · 욱진 보드 가계부가 같이 쓰려고 따로 둔 파일 (CSS도 이 안에서 넣음, rg- 클래스). 그대로 복사해서 써도 됨.
// openRangePicker(anchor, { from, to, first(전체의 시작일), today }, onApply({ from, to, preset })) — 날짜는 "YYYY-MM-DD"

const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
const monthEnd = (y, m) => ymd(new Date(y, m + 1, 0));   // m: 0~11
const WD = ["일", "월", "화", "수", "목", "금", "토"];

export function presets(today, first) {
  const t = parse(today), y = t.getFullYear(), m = t.getMonth(), wk = addDays(today, -t.getDay());   // 주는 일요일부터 (달력과 같게)
  return [
    ["today", "오늘", today, today],
    ["yday", "어제", addDays(today, -1), addDays(today, -1)],
    ["week", "이번 주", wk, addDays(wk, 6)],
    ["lweek", "지난 주", addDays(wk, -7), addDays(wk, -1)],
    ["month", "이번 달", ymd(new Date(y, m, 1)), monthEnd(y, m)],
    ["lmonth", "지난 달", ymd(new Date(y, m - 1, 1)), monthEnd(y, m - 1)],
    ["year", "올해", `${y}-01-01`, `${y}-12-31`],
    ["lyear", "작년", `${y - 1}-01-01`, `${y - 1}-12-31`],
    ["all", "전체", first || `${y}-01-01`, today]
  ];
}
// 그 기간이 딱 한 달이면 "YYYY-MM", 아니면 null
export function wholeMonth(from, to) {
  if (!from || !to || from.slice(0, 7) !== to.slice(0, 7) || from.slice(8) !== "01") return null;
  const [y, m] = from.split("-").map(Number); return to === monthEnd(y, m - 1) ? from.slice(0, 7) : null;
}
// 화면에 보일 이름: 한 달이면 2026.10, 하루면 26.10.21, 아니면 26.10.5 ~ 26.10.21
export function rangeLabel(from, to) {
  const wm = wholeMonth(from, to); if (wm) return wm.replace("-", ".");
  const s = (d) => `${d.slice(2, 4)}.${+d.slice(5, 7)}.${+d.slice(8)}`;
  return from === to ? s(from) : `${s(from)} ~ ${s(to)}`;
}
// ‹ › 로 옮기기: 한 달이면 한 달씩, 아니면 같은 날 수만큼
export function shiftRange(from, to, dir) {
  const wm = wholeMonth(from, to);
  if (wm) { const [y, m] = wm.split("-").map(Number), d = new Date(y, m - 1 + dir, 1); return { from: ymd(d), to: monthEnd(d.getFullYear(), d.getMonth()) }; }
  const n = Math.round((parse(to) - parse(from)) / 86400000) + 1;
  return { from: addDays(from, dir * n), to: addDays(to, dir * n) };
}

const CSS = `
.rg-pop { position: fixed; z-index: 80; display: grid; grid-template-columns: 116px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr) auto; width: min(440px, calc(100vw - 16px)); height: min(560px, calc(100vh - 16px));
  background: var(--surface, #fff); color: var(--fg, #222); border: 1px solid var(--line, #ddd); border-radius: 14px; box-shadow: 0 12px 40px rgba(10, 16, 28, .18); overflow: hidden; font-size: 14px; }
.rg-pre { grid-row: 1; border-right: 1px solid var(--line, #ddd); overflow-y: auto; }
.rg-pre button { display: block; width: 100%; text-align: left; padding: 12px 14px; border: 0; border-bottom: 1px solid var(--line, #ddd); background: none; color: inherit; cursor: pointer; font: inherit; }
.rg-pre button.on { color: var(--coral, #f0604d); font-weight: 600; }
.rg-main { grid-row: 1; display: flex; flex-direction: column; min-height: 0; }
.rg-fields { display: flex; align-items: center; gap: 6px; padding: 10px; }
.rg-fields button { flex: 1; min-width: 0; padding: 8px 4px; border: 1px solid var(--line, #ddd); border-radius: 8px; background: none; color: inherit; font: inherit; font-size: 13px; cursor: pointer; white-space: nowrap; }
.rg-fields button.on { border-color: var(--coral, #f0604d); }
.rg-jump { display: flex; align-items: center; justify-content: center; gap: 6px; padding: 0 10px 6px; }
.rg-jump select { font: inherit; border: 0; background: none; color: inherit; font-weight: 600; }
.rg-jump button { border: 1px solid var(--line, #ddd); background: none; color: inherit; border-radius: 8px; width: 30px; height: 28px; cursor: pointer; }
.rg-wd, .rg-days { display: grid; grid-template-columns: repeat(7, 1fr); text-align: center; }
.rg-wd { padding: 0 8px 4px; color: var(--muted, #888); font-size: 12px; }
.rg-cal { flex: 1; min-height: 0; overflow-y: auto; padding: 0 8px 8px; }
.rg-mh { padding: 10px 6px 6px; color: var(--muted, #888); font-size: 13px; }
.rg-days span { padding: 2px 0; }
.rg-days button { width: 100%; aspect-ratio: 1.15; max-height: 36px; border: 0; background: none; color: inherit; font: inherit; cursor: pointer; border-radius: 0; }
.rg-days .in { background: color-mix(in srgb, var(--coral, #f0604d) 14%, transparent); }
.rg-days .s, .rg-days .e { background: var(--coral, #f0604d); color: #fff; border-radius: 999px; font-weight: 600; }
.rg-days .s.in-r { border-radius: 999px 0 0 999px; } .rg-days .e.in-l { border-radius: 0 999px 999px 0; } .rg-days .s.e { border-radius: 999px; }
.rg-days .t { outline: 1.5px solid var(--ink, #334); outline-offset: -3px; border-radius: 999px; }
.rg-foot { grid-column: 1 / 3; display: flex; justify-content: flex-end; gap: 8px; padding: 10px 12px; border-top: 1px solid var(--line, #ddd); }
.rg-foot button { padding: 8px 16px; border-radius: 8px; border: 1px solid var(--line, #ddd); background: none; color: inherit; font: inherit; cursor: pointer; }
.rg-foot .go { background: var(--coral, #f0604d); border-color: var(--coral, #f0604d); color: #fff; font-weight: 600; }
.rg-scrim { position: fixed; inset: 0; z-index: 79; }
@media (max-width: 520px) { .rg-pop { grid-template-columns: 1fr; grid-template-rows: auto minmax(0, 1fr) auto; } .rg-pre { grid-row: 1; display: flex; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--line, #ddd); }
  .rg-pre button { width: auto; flex: 0 0 auto; border-bottom: 0; padding: 10px 12px; } .rg-main { grid-row: 2; } .rg-foot { grid-column: 1; } }
`;

let open = null;
export function openRangePicker(anchor, o, onApply) {
  if (open) open.close();
  if (!document.getElementById("rg-css")) { const st = document.createElement("style"); st.id = "rg-css"; st.textContent = CSS; document.head.appendChild(st); }
  const today = o.today, pre = presets(today, o.first);
  const st = { from: o.from || today, to: o.to || o.from || today, pick: "from", preset: null };
  const scrim = document.createElement("div"), pop = document.createElement("div");
  scrim.className = "rg-scrim"; pop.className = "rg-pop"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "기간 고르기");
  const mark = () => { const p = pre.find(([, , f, t]) => f === st.from && t === st.to); st.preset = p ? p[0] : null; };
  // 달력: 시작 달 앞뒤로 몇 달씩 (위아래로 넘기면서 보기), 연·월 고르면 그 달로
  let base = st.from.slice(0, 7);
  function months() { const [y, m] = base.split("-").map(Number), out = []; for (let i = -3; i <= 9; i++) { const d = new Date(y, m - 1 + i, 1); out.push([d.getFullYear(), d.getMonth()]); } return out; }
  function cal() {
    return months().map(([y, m]) => {
      const first = new Date(y, m, 1).getDay(), n = new Date(y, m + 1, 0).getDate(), cells = [];
      for (let i = 0; i < first; i++) cells.push("<span></span>");
      for (let d = 1; d <= n; d++) {
        const s = `${y}-${pad(m + 1)}-${pad(d)}`, inR = s >= st.from && s <= st.to, cls = [];
        if (inR) cls.push("in"); if (s === st.from) cls.push("s"); if (s === st.to) cls.push("e"); if (s === today) cls.push("t");
        if (s === st.from && st.to > st.from) cls.push("in-r"); if (s === st.to && st.to > st.from) cls.push("in-l");
        cells.push(`<span><button type="button" data-d="${s}" class="${cls.join(" ")}">${d}</button></span>`);
      }
      return `<div class="rg-mh" data-m="${y}-${pad(m + 1)}">${y}년 ${m + 1}월</div><div class="rg-days">${cells.join("")}</div>`;
    }).join("");
  }
  const fmt = (s) => `${s.slice(0, 4)}년 ${+s.slice(5, 7)}월 ${+s.slice(8)}일`;
  function render(scrollTo) {
    mark();
    const [by, bm] = base.split("-").map(Number), ty = +today.slice(0, 4);
    const years = []; for (let y = Math.min(by, +(o.first || today).slice(0, 4)) - 1; y <= ty + 1; y++) years.push(y);
    pop.innerHTML = `<div class="rg-pre">${pre.map(([k, l]) => `<button type="button" data-p="${k}" class="${st.preset === k ? "on" : ""}">${l}</button>`).join("")}</div>
      <div class="rg-main">
        <div class="rg-fields"><button type="button" data-f="from" class="${st.pick === "from" ? "on" : ""}">${fmt(st.from)}</button>~<button type="button" data-f="to" class="${st.pick === "to" ? "on" : ""}">${fmt(st.to)}</button></div>
        <div class="rg-jump"><button type="button" data-j="-1" aria-label="이전 달">‹</button>
          <select data-y aria-label="연도">${years.map((y) => `<option${y === by ? " selected" : ""}>${y}</option>`).join("")}</select>
          <select data-mo aria-label="월">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}"${i + 1 === bm ? " selected" : ""}>${i + 1}월</option>`).join("")}</select>
          <button type="button" data-j="1" aria-label="다음 달">›</button></div>
        <div class="rg-wd">${WD.map((w) => `<span>${w}</span>`).join("")}</div>
        <div class="rg-cal">${cal()}</div>
      </div>
      <div class="rg-foot"><button type="button" data-x>취소</button><button type="button" class="go" data-go>적용</button></div>`;
    const c = pop.querySelector(".rg-cal"), h = c.querySelector(`[data-m="${scrollTo || base}"]`);
    if (h) c.scrollTop = h.offsetTop - c.offsetTop;
  }
  function place() {
    const r = anchor.getBoundingClientRect(), w = pop.offsetWidth, hh = pop.offsetHeight;
    pop.style.left = Math.max(8, Math.min(r.left, innerWidth - w - 8)) + "px";
    pop.style.top = Math.max(8, Math.min(r.bottom + 6, innerHeight - hh - 8)) + "px";
  }
  function close() { scrim.remove(); pop.remove(); document.removeEventListener("keydown", onKey); open = null; }
  const onKey = (e) => { if (e.key === "Escape") close(); };
  pop.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.p) { const p = pre.find(([k]) => k === b.dataset.p); st.from = p[2]; st.to = p[3]; st.pick = "from"; base = st.from.slice(0, 7); render(); return; }
    if (b.dataset.f) { st.pick = b.dataset.f; base = st[b.dataset.f].slice(0, 7); render(); return; }
    if (b.dataset.j) { const [y, m] = base.split("-").map(Number), d = new Date(y, m - 1 + +b.dataset.j, 1); base = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; render(); return; }
    if (b.dataset.d) {   // 시작일 → 끝날 차례로. 끝날이 시작일보다 앞이면 바꿔서
      const d = b.dataset.d, keep = pop.querySelector(".rg-cal").scrollTop;
      if (st.pick === "from") { st.from = d; if (st.to < d) st.to = d; st.pick = "to"; }
      else { if (d < st.from) { st.to = st.from; st.from = d; } else st.to = d; st.pick = "from"; }
      render(); pop.querySelector(".rg-cal").scrollTop = keep; return;
    }
    if ("x" in b.dataset) { close(); return; }
    if ("go" in b.dataset) { close(); onApply({ from: st.from, to: st.to, preset: st.preset }); }
  });
  pop.addEventListener("change", (e) => {
    if (e.target.matches("[data-y], [data-mo]")) { base = `${pop.querySelector("[data-y]").value}-${pad(pop.querySelector("[data-mo]").value)}`; render(); }
  });
  scrim.addEventListener("click", close);
  document.addEventListener("keydown", onKey);
  document.body.append(scrim, pop);
  render(); place();
  open = { close };
  return open;
}
