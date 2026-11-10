// ★ 두 가계부(냐냐·욱진)가 같이 쓰는 파일 — 원본은 냐냐 보드 docs/money/, 욱진 보드 docs/는 글자 하나까지 같은 복사본. 한쪽만 고치지 말고, 보드마다 달라야 하는 건 env로 가르기.
// 📅 날짜 칸 달력 (2026-11-02 냐냐 요청) — 브라우저 기본 달력은 모양을 못 바꿔서 그 자리에 둥근 창을 띄움 (고르는 칸 picker.js와 같은 방식).
// <input type="date">는 그대로 두고 값만 대신 넣어 input·change를 보냄 → 저장 코드는 전과 같음. 칸에 숫자를 직접 적는 것도 그대로.
// 제목(2026년 11월)을 누르면 달 고르기, 오늘·어제 버튼. 폰은 폰 자체 고르는 화면이 더 편해서 그대로 둠 (마우스 쓰는 기기에서만).
export function mountDatePick() {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const pad = (n) => String(n).padStart(2, "0");
  const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const WD = ["일", "월", "화", "수", "목", "금", "토"];
  let pop = null, owner = null, y = 0, m = 0, months = false;

  function close() { if (pop) pop.remove(); pop = null; owner = null; months = false; }
  const dayBtn = (d, out, today, sel) => {
    const s = ymd(d), w = d.getDay(), off = (owner.min && s < owner.min) || (owner.max && s > owner.max);
    return `<button type="button" data-d="${s}" class="dp-d${out ? " out" : ""}${s === today ? " today" : ""}${s === sel ? " on" : ""}${w === 0 ? " sun" : w === 6 ? " sat" : ""}"${off ? " disabled" : ""}${s === sel ? ' aria-current="date"' : ""}>${d.getDate()}</button>`;
  };
  function draw() {
    const now = new Date(), today = ymd(now), yd = new Date(now); yd.setDate(now.getDate() - 1);
    if (months) {
      pop.innerHTML = `<div class="dp-head"><button type="button" class="dp-nav" data-go="-12" aria-label="이전 해">‹</button><button type="button" class="dp-title" data-back>${y}년</button><button type="button" class="dp-nav" data-go="12" aria-label="다음 해">›</button></div>
        <div class="dp-months">${Array.from({ length: 12 }, (_, i) => `<button type="button" data-m="${i}" class="${i === m ? "on" : ""}">${i + 1}월</button>`).join("")}</div>`;
      return;
    }
    const first = new Date(y, m, 1), start = new Date(y, m, 1 - first.getDay()), cells = [];
    const weeks = Math.ceil((first.getDay() + new Date(y, m + 1, 0).getDate()) / 7);
    for (let i = 0; i < weeks * 7; i++) { const d = new Date(start); d.setDate(start.getDate() + i); cells.push(dayBtn(d, d.getMonth() !== m, today, owner.value)); }
    const canClear = !owner.required && !["mDate", "cpDate"].includes(owner.id) && owner.dataset.c !== "date" && owner.dataset.rv !== "date";
    pop.innerHTML = `<div class="dp-head"><button type="button" class="dp-nav" data-go="-1" aria-label="이전 달">‹</button><button type="button" class="dp-title" data-pick aria-label="달 고르기">${y}년 ${m + 1}월</button><button type="button" class="dp-nav" data-go="1" aria-label="다음 달">›</button></div>
      <div class="dp-wd">${WD.map((w, i) => `<span class="${i === 0 ? "sun" : i === 6 ? "sat" : ""}">${w}</span>`).join("")}</div>
      <div class="dp-days">${cells.join("")}</div>
      <div class="dp-foot"><button type="button" data-d="${today}">오늘</button><button type="button" data-d="${ymd(yd)}">어제</button>${canClear ? `<button type="button" data-d="" class="dp-clear">지우기</button>` : ""}</div>`;
  }
  function place() {
    const r = owner.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = innerHeight, gap = 6, edge = 8, h = pop.offsetHeight;
    pop.style.left = `${Math.max(edge, Math.min(r.left, vw - pop.offsetWidth - edge))}px`;
    const up = h > vh - r.bottom - gap - edge && r.top > vh - r.bottom;
    pop.style.top = `${up ? Math.max(edge, r.top - gap - h) : Math.min(r.bottom + gap, vh - h - edge)}px`;
  }
  function setView(v) { const d = /^\d{4}-\d{2}-\d{2}$/.test(v) ? new Date(`${v}T00:00`) : new Date(); y = d.getFullYear(); m = d.getMonth(); }
  function open(el) {
    close();
    owner = el; setView(el.value);
    pop = document.createElement("div");
    pop.className = "dp-pop"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "날짜 고르기");
    pop.popover = "manual";   // 창(dialog) 위에도 뜨고 창 밖으로 나가도 안 잘리게
    draw();
    (el.closest("dialog") || document.body).append(pop);
    if (pop.showPopover) pop.showPopover();
    place();
    pop.addEventListener("click", (e) => {
      e.stopPropagation();
      const b = e.target.closest("button"); if (!b || b.disabled) return;
      if (b.dataset.go) { const d = new Date(y, m + Number(b.dataset.go), 1); y = d.getFullYear(); m = d.getMonth(); draw(); place(); return; }
      if ("pick" in b.dataset) { months = true; draw(); place(); return; }
      if ("back" in b.dataset) { months = false; draw(); place(); return; }
      if (b.dataset.m) { m = Number(b.dataset.m); months = false; draw(); place(); return; }
      if (b.dataset.d == null) return;
      const s = owner, changed = s.value !== b.dataset.d;
      close();
      if (!s.isConnected) return;
      s.focus({ preventScroll: true });
      if (!changed) return;
      s.value = b.dataset.d;
      s.dispatchEvent(new Event("input", { bubbles: true }));
      s.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  document.addEventListener("click", (e) => {
    const el = e.target.closest && e.target.closest('input[type="date"]'); if (!el || el.disabled || el.readOnly) return;
    e.preventDefault();   // 브라우저 기본 달력 대신
    if (el !== owner) open(el);
  }, true);
  document.addEventListener("mousedown", (e) => {
    if (!pop) return;
    if (pop.contains(e.target)) { e.preventDefault(); return; }   // 포커스는 칸에 그대로
    if (e.target !== owner) close();
  }, true);
  document.addEventListener("keydown", (e) => { if (pop && e.key === "Escape") { e.preventDefault(); e.stopPropagation(); close(); } }, true);
  document.addEventListener("input", (e) => { if (pop && e.target === owner && owner.value) { setView(owner.value); months = false; draw(); } }, true);   // 칸에 직접 적으면 달력도 따라감
  document.addEventListener("scroll", (e) => { if (pop && !pop.contains(e.target)) close(); }, true);
  addEventListener("resize", close);
  addEventListener("blur", close);
}
