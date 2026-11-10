// ★ 두 가계부(냐냐·욱진)가 같이 쓰는 파일 — 원본은 냐냐 보드 docs/money/, 욱진 보드 docs/는 글자 하나까지 같은 복사본. 한쪽만 고치지 말고, 보드마다 달라야 하는 건 env로 가르기.
// 🎀 고르는 칸(콤보박스) 목록 (2026-11-02 냐냐: "콤보박스 너무 딱딱해") — 브라우저 기본 목록은 모양을 못 바꿔서 그 자리에 둥근 창을 띄움.
// <select>는 그대로 두고 값만 대신 골라 change를 보냄 → 분류·소분류·자산 코드, Ctrl+C/V, 키보드(화살표·글자)는 전과 같음.
// '식비 · 외식'처럼 앞말이 같은 것과 optgroup은 제목 + 알약 버튼으로 묶음.
// 폰은 폰 자체 고르는 화면이 더 편해서 그대로 둠 (마우스 쓰는 기기에서만).
export function mountPicker() {
  if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  let pop = null, owner = null, opts = [];

  function close() { if (pop) pop.remove(); pop = null; owner = null; opts = []; }

  // 옵션들 → [{ head, list: [{ i, text, opt }] }] (같은 제목이 이어지면 한 묶음)
  function groups(sel) {
    const out = [];
    [...sel.options].forEach((opt) => {
      if (opt.hidden) return;
      const i = opts.push(opt) - 1, gl = opt.parentElement.tagName === "OPTGROUP" ? opt.parentElement.label : "", at = opt.text.indexOf(" · ");
      const head = gl || (at > 0 ? opt.text.slice(0, at) : "");
      const text = opt.value === "" && /(^|\s)-$/.test(opt.text.trim()) ? "선택 안 함" : !gl && at > 0 ? opt.text.slice(at + 3) : opt.text;
      const last = out[out.length - 1];
      if (last && last.head === head) last.list.push({ i, text, opt }); else out.push({ head, list: [{ i, text, opt }] });
    });
    return out;
  }

  function open(sel) {
    owner = sel; opts = [];
    const gs = groups(sel);
    pop = document.createElement("div");
    pop.className = "pk-pop"; pop.setAttribute("role", "listbox");
    if (sel.getAttribute("aria-label")) pop.setAttribute("aria-label", sel.getAttribute("aria-label"));
    pop.innerHTML = gs.map((g) => `<div class="pk-g">${g.head ? `<div class="pk-h">${esc(g.head)}</div>` : ""}<div class="pk-l">${g.list.map((x) => `<button type="button" role="option" tabindex="-1" data-i="${x.i}" aria-selected="${x.opt.selected}"${x.opt.disabled ? " disabled" : ""}>${esc(x.text)}</button>`).join("")}</div></div>`).join("");
    pop.popover = "manual";   // 창(dialog) 위에도 뜨고 창 밖으로 나가도 안 잘리게
    (sel.closest("dialog") || document.body).append(pop);
    if (pop.showPopover) pop.showPopover();
    const r = sel.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = innerHeight, gap = 6, edge = 8;
    pop.style.width = `${Math.min(vw - edge * 2, Math.max(r.width, opts.length > 6 ? 320 : 180))}px`;
    const h = pop.offsetHeight, below = vh - r.bottom - gap - edge, above = r.top - gap - edge, up = h > below && above > below, room = up ? above : below;
    pop.style.maxHeight = `${Math.max(room, 120)}px`;
    pop.style.left = `${Math.max(edge, Math.min(r.left, vw - pop.offsetWidth - edge))}px`;
    pop.style.top = `${up ? Math.max(edge, r.top - gap - pop.offsetHeight) : Math.min(r.bottom + gap, vh - pop.offsetHeight - edge)}px`;
    const on = pop.querySelector('[aria-selected="true"]');
    if (on) pop.scrollTop = Math.max(0, on.offsetTop - pop.clientHeight / 2);
    pop.addEventListener("click", (e) => {
      e.stopPropagation();
      const b = e.target.closest("button[data-i]"); if (!b || b.disabled) return;
      const s = owner, o = opts[+b.dataset.i];
      close();
      if (!s.isConnected || o.selected) return;   // 그사이 화면을 다시 그렸거나 같은 걸 고름
      o.selected = true;
      s.dispatchEvent(new Event("input", { bubbles: true }));
      s.dispatchEvent(new Event("change", { bubbles: true }));
    });
  }

  document.addEventListener("mousedown", (e) => {
    if (pop && pop.contains(e.target)) { e.preventDefault(); return; }   // 포커스는 칸에 그대로 (Ctrl+C/V)
    const sel = e.target.closest && e.target.closest("select"), again = sel && sel === owner;
    close();
    if (!sel || sel.disabled || sel.multiple || e.button !== 0) return;
    e.preventDefault();   // 브라우저 기본 목록 대신
    sel.focus({ preventScroll: true });
    if (!again) open(sel);
  }, true);
  document.addEventListener("keydown", (e) => {
    if (!pop || ["Shift", "Control", "Alt", "Meta"].includes(e.key)) return;
    if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); }   // 뒤의 창까지 닫히지 않게
    close();
  }, true);
  document.addEventListener("scroll", (e) => { if (pop && !pop.contains(e.target)) close(); }, true);
  addEventListener("resize", close);
  addEventListener("blur", close);
}
