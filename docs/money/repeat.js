// 🔁 매월 반복 (냐냐 가계부 전용 — 욱진 보드 짝 코드 아님. 편한가계부 '반복'처럼)
// 규칙: settings.moneyRepeat/{id} = { kind: expense|income, amount, account, cat, sub, memo, day(1~31), from: "YYYY-MM", at, made: {YYYY-MM: true} }
// 가계부를 열 때마다: 규칙마다 from 달부터 이번 달까지, 그 달 day일(달이 짧으면 말일)이 오늘이거나 지났고 made에 없으면
//   기록 money/rp-{id}-{YYYYMM} 을 만들고 made[YYYY-MM] = true (지운 기록은 다시 안 생김, 폰·PC가 같이 열어도 같은 id라 안 겹침)
// 규칙을 지워도 이미 생긴 기록은 그대로.

const lastDay = (m) => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo, 0).getDate(); };
const nextMonth = (m) => { let [y, mo] = m.split("-").map(Number); mo++; if (mo > 12) { mo = 1; y++; } return `${y}-${String(mo).padStart(2, "0")}`; };
export const repeatDate = (m, day) => `${m}-${String(Math.min(Math.max(1, day | 0), lastDay(m))).padStart(2, "0")}`;

// 지금 만들어야 할 기록 (규칙들, 오늘) → { "money/rp-…": doc, "settings/moneyRepeat/{id}/made/{m}": true }
export function duePatch(rules, today) {
  const patch = {}, thisMonth = today.slice(0, 7);
  for (const [id, r] of Object.entries(rules || {})) {
    if (!r || !r.from || !r.amount || !r.account) continue;
    for (let m = r.from, n = 0; m <= thisMonth && n < 240; m = nextMonth(m), n++) {
      if (r.made && r.made[m]) continue;
      const date = repeatDate(m, r.day);
      if (date > today) continue;
      patch[`money/rp-${id}-${m.replace("-", "")}`] = { kind: r.kind === "income" ? "income" : "expense", amount: Number(r.amount), date, account: r.account,
        cat: r.cat || "기타", sub: r.sub || null, memo: r.memo || "", note: null, repeat: id, createdAt: Date.now(), src: "반복" };
      patch[`settings/moneyRepeat/${id}/made/${m}`] = true;
    }
  }
  return patch;
}

// env = { S, backend(), toast, act, esc, won, rows, today, cats(kind), subs(kind, cat), rid }
export function mountRepeat(root, env) {
  const { esc, won } = env;
  const f = { kind: "expense", amount: "", day: "", account: "", cat: "", sub: "", memo: "", from: "" };
  let running = false;
  // 가계부를 열었을 때 · 데이터가 바뀌었을 때: 날짜가 된 반복 기록 만들기
  function run() {
    const be = env.backend(); if (!be || !env.S.loaded || running) return;
    const patch = duePatch(env.S.settings.moneyRepeat, env.today());
    const n = Object.keys(patch).filter((k) => k.startsWith("money/")).length; if (!n) return;
    running = true;
    be.rootUpdate(patch).then(() => env.toast(`🔁 매월 반복 기록 ${n}건을 넣었어요.`)).catch(() => {}).finally(() => { running = false; });
  }
  const acctName = (id) => env.S.accounts.has(id) ? env.S.accounts.get(id).name : "지운 자산";
  function render() {
    if (root.contains(document.activeElement) && /INPUT|SELECT/.test(document.activeElement.tagName)) return;   // 고르는 중엔 다시 안 그림
    const S = env.S, rules = Object.entries(S.settings.moneyRepeat || {}).filter(([, r]) => r && r.amount);
    const accts = env.rows(S.accounts).filter((a) => !a.hidden && !(f.kind === "income" && a.type === "card")).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const cats = env.cats(f.kind), subs = f.cat ? env.subs(f.kind, f.cat) : [];
    if (!f.from) f.from = env.today().slice(0, 7);
    root.innerHTML = `<div class="panel-head"><div><h3>🔁 매월 반복</h3><span class="muted small">보험료·월세·구독료처럼 매달 같은 날 나가는 돈. 그날이 되면 가계부를 열 때 기록이 저절로 생겨요 (생긴 기록은 내역에서 고치거나 지울 수 있어요).</span></div></div>
      <div class="rp-list">${rules.length ? rules.sort((a, b) => (a[1].day || 0) - (b[1].day || 0)).map(([id, r]) => `<div class="rp-row">
          <span><b>매월 ${r.day}일</b> · ${esc(acctName(r.account))} · ${esc(r.cat || "기타")}${r.sub ? " / " + esc(r.sub) : ""}${r.memo ? ` <span class="muted">${esc(r.memo)}</span>` : ""}</span>
          <b class="${r.kind === "income" ? "rp-in" : ""}">${r.kind === "income" ? "+" : ""}${esc(won(r.amount))}</b>
          <span class="small muted">${esc(r.from.replace("-", "."))}부터</span>
          <button class="btn ghost sm" type="button" data-rp-del="${esc(id)}">그만하기</button></div>`).join("") : '<p class="muted small" style="margin:0">아직 반복이 없어요.</p>'}</div>
      <div class="rp-form">
        <select data-rp="kind" aria-label="수입/지출"><option value="expense"${f.kind === "expense" ? " selected" : ""}>지출</option><option value="income"${f.kind === "income" ? " selected" : ""}>수입</option></select>
        <input type="text" class="amt-in" inputmode="numeric" data-rp="amount" placeholder="금액" aria-label="금액" value="${esc(f.amount)}">
        <label class="rp-day">매월 <input type="number" min="1" max="31" data-rp="day" value="${esc(f.day)}" aria-label="며칠"> 일</label>
        <select data-rp="account" aria-label="자산"><option value="">자산 고르기</option>${accts.map((a) => `<option value="${esc(a.id)}"${a.id === f.account ? " selected" : ""}>${esc(a.name)}</option>`).join("")}</select>
        <select data-rp="cat" aria-label="분류"><option value="">분류 고르기</option>${cats.map((c) => `<option${c === f.cat ? " selected" : ""}>${esc(c)}</option>`).join("")}</select>
        <select data-rp="sub" aria-label="소분류"${subs.length ? "" : " disabled"}><option value="">소분류 없음</option>${subs.map((s) => `<option${s === f.sub ? " selected" : ""}>${esc(s)}</option>`).join("")}</select>
        <input type="text" data-rp="memo" placeholder="내용 (선택)" aria-label="내용" maxlength="40" value="${esc(f.memo)}">
        <label class="rp-day">시작 <input type="month" data-rp="from" value="${esc(f.from)}" aria-label="시작 달"></label>
        <button class="btn" type="button" data-rp-add>＋ 반복 추가</button>
      </div>`;
  }
  root.addEventListener("input", (e) => {
    const k = e.target.dataset.rp; if (!k) return;
    if (k === "amount") { const v = e.target.value.replace(/[^\d]/g, ""); f.amount = v ? Number(v).toLocaleString("ko-KR") : ""; e.target.value = f.amount; }
    else if (k === "day" || k === "memo" || k === "from") f[k] = e.target.value;
  });
  root.addEventListener("change", (e) => {
    const k = e.target.dataset.rp; if (!k || !/kind|account|cat|sub/.test(k)) return;
    f[k] = e.target.value;
    if (k === "kind") { f.cat = ""; f.sub = ""; } if (k === "cat") f.sub = "";
    e.target.blur(); render();
  });
  root.addEventListener("click", (e) => {
    const be = env.backend(); if (!be) return;
    const del = e.target.closest("[data-rp-del]");
    if (del) {
      if (!confirm("이 반복을 그만할까요? 이미 생긴 기록은 그대로 남아요.")) return;
      env.act(be.rootUpdate({ [`settings/moneyRepeat/${del.dataset.rpDel}`]: null }), "🔁 반복을 그만했어요.").then(render).catch(() => {});
      return;
    }
    if (!e.target.closest("[data-rp-add]")) return;
    const amount = parseInt(String(f.amount).replace(/[^\d]/g, ""), 10) || 0, day = parseInt(f.day, 10) || 0;
    if (!amount) return env.toast("금액을 넣어 주세요.");
    if (day < 1 || day > 31) return env.toast("매월 며칠인지 넣어 주세요 (1~31).");
    if (!f.account) return env.toast("자산을 골라 주세요.");
    if (!f.cat) return env.toast("분류를 골라 주세요.");
    if (!/^\d{4}-\d{2}$/.test(f.from)) return env.toast("시작 달을 골라 주세요.");
    const rule = { kind: f.kind, amount, day, account: f.account, cat: f.cat, sub: f.sub || null, memo: f.memo.trim(), from: f.from, at: Date.now() };
    const first = repeatDate(f.from, day) <= env.today() ? ` ${f.from.replace("-", "년 ")}월부터 오늘까지 기록도 바로 생겨요.` : "";
    if (!confirm(`매월 ${day}일 ${won(amount)} ${f.kind === "income" ? "수입" : "지출"}을 반복할까요?${first}`)) return;
    env.act(be.rootUpdate({ [`settings/moneyRepeat/${env.rid()}`]: rule }), "🔁 반복을 추가했어요.").then(() => {
      Object.assign(f, { amount: "", day: "", memo: "", sub: "" }); render();
    }).catch(() => {});
  });
  return { render, run };
}
