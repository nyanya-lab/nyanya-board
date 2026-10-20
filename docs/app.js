// 냐냐 보드 — 화면 로직
// 지금은 뼈대: 달력 + 그날 할 일. 저장은 이 브라우저(localStorage)에만.
// 다음 단계에서 욱진 보드처럼 Firebase(비밀번호 = 저장 위치)로 옮기고, 스페인어·왓치로그·가계부를 붙인다.

const STORE_KEY = "nyanya-board-v1";
const PAGES = ["home", "spanish", "watch", "money"];
const DAY_ITEMS = 3; // PC 달력 칸에 보이는 할 일 수 (넘치면 +N)

const $ = (s) => document.querySelector(s);
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = () => ymd(new Date());
const rid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const DOW = ["일", "월", "화", "수", "목", "금", "토"];

// ── 상태 ──
const S = load();
const ui = { month: today().slice(0, 7), sel: today() };

function load() {
  try {
    const v = JSON.parse(localStorage.getItem(STORE_KEY));
    if (v && typeof v === "object") return { tasks: v.tasks || {} };
  } catch (e) { /* 저장된 게 없거나 깨짐 → 빈 보드 */ }
  return { tasks: {} };
}
function save() {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(S)); }
  catch (e) { toast("저장하지 못했어요 (브라우저 저장 공간)"); }
}

const tasksOn = (date) => Object.entries(S.tasks)
  .filter(([, t]) => t.date === date)
  .sort(([, a], [, b]) => (a.done - b.done) || (a.at - b.at));

// ── 그리기 ──
function render() {
  renderTiles();
  renderCalendar();
  renderDay();
}

function renderTiles() {
  const list = tasksOn(today());
  $("#tileTodo").textContent = `${list.filter(([, t]) => t.done).length} / ${list.length}`;
}

function renderCalendar() {
  const [y, m] = ui.month.split("-").map(Number);
  $("#calTitle").textContent = `${y}년 ${m}월`;
  const first = new Date(y, m - 1, 1);
  const start = new Date(y, m - 1, 1 - first.getDay());
  const weeks = Math.ceil((first.getDay() + new Date(y, m, 0).getDate()) / 7);
  const t = today();
  let html = "";
  for (let i = 0; i < weeks * 7; i++) {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    const key = ymd(d);
    const list = tasksOn(key);
    const cls = ["day",
      key.slice(0, 7) !== ui.month && "out",
      key === t && "today",
      key === ui.sel && "sel",
      d.getDay() === 0 && "sun",
      d.getDay() === 6 && "sat"].filter(Boolean).join(" ");
    const items = list.slice(0, DAY_ITEMS)
      .map(([, x]) => `<span class="day-item${x.done ? " done" : ""}">${esc(x.title)}</span>`).join("");
    const more = list.length > DAY_ITEMS ? `<span class="day-more">+${list.length - DAY_ITEMS}</span>` : "";
    const dots = list.length ? `<span class="dots">${list.slice(0, 3).map(([, x]) => `<i${x.done ? ' class="done"' : ""}></i>`).join("")}</span>` : "";
    html += `<button type="button" class="${cls}" data-date="${key}" aria-label="${d.getMonth() + 1}월 ${d.getDate()}일, 할 일 ${list.length}개"><span class="num">${d.getDate()}</span>${items}${more}${dots}</button>`;
  }
  $("#calGrid").innerHTML = html;
}

function renderDay() {
  const d = new Date(ui.sel + "T00:00:00");
  const label = `${d.getMonth() + 1}월 ${d.getDate()}일 (${DOW[d.getDay()]})`;
  $("#dayTitle").textContent = ui.sel === today() ? `오늘 · ${label}` : label;
  const list = tasksOn(ui.sel);
  $("#todoList").innerHTML = list.length
    ? list.map(([id, t]) => `<li class="${t.done ? "done" : ""}">
        <input type="checkbox" data-check="${id}" ${t.done ? "checked" : ""} aria-label="끝냄">
        <span class="t">${esc(t.title)}</span>
        <button type="button" class="del" data-del="${id}" aria-label="지우기">×</button></li>`).join("")
    : `<li class="empty">할 일이 없어요.</li>`;
}

function renderPage() {
  const page = PAGES.includes(location.hash.slice(1)) ? location.hash.slice(1) : "home";
  for (const p of PAGES) $(`#page-${p}`).hidden = p !== page;
  document.querySelectorAll("[data-page]").forEach((a) => a.classList.toggle("on", a.dataset.page === page));
  window.scrollTo(0, 0);
}

let toastTimer = 0;
function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

// ── 할 일 ──
function shiftMonth(n) {
  const [y, m] = ui.month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  ui.month = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  renderCalendar();
}

document.addEventListener("click", (e) => {
  const act = e.target.closest("[data-act]");
  if (act) {
    const a = act.dataset.act;
    if (a === "prevMonth") shiftMonth(-1);
    else if (a === "nextMonth") shiftMonth(1);
    else if (a === "goToday") { ui.sel = today(); ui.month = ui.sel.slice(0, 7); render(); }
    return;
  }
  const day = e.target.closest("[data-date]");
  if (day) {
    ui.sel = day.dataset.date;
    if (ui.sel.slice(0, 7) !== ui.month) ui.month = ui.sel.slice(0, 7);
    renderCalendar();
    renderDay();
    return;
  }
  const del = e.target.closest("[data-del]");
  if (del) {
    delete S.tasks[del.dataset.del];
    save();
    render();
  }
});

document.addEventListener("change", (e) => {
  const id = e.target.dataset && e.target.dataset.check;
  if (!id || !S.tasks[id]) return;
  S.tasks[id].done = e.target.checked;
  save();
  render();
});

$("#todoForm").addEventListener("submit", (e) => {
  e.preventDefault();
  const input = $("#todoInput");
  const title = input.value.trim();
  if (!title) return;
  S.tasks[rid()] = { title, date: ui.sel, done: false, at: Date.now() };
  input.value = "";
  save();
  render();
});

// ── 시작 ──
function renderToday() {
  const d = new Date();
  $("#todayLabel").textContent = `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 ${DOW[d.getDay()]}요일`;
  $("#todayMono").textContent = today();
}
window.addEventListener("hashchange", renderPage);
renderToday();
renderPage();
render();
