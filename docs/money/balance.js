// 🧮 실제 잔액 맞추기 · 🙈 자산 숨기기 (냐냐 가계부 전용 — 욱진 보드 짝 코드 아님)
// 편한가계부에서 가져온 기록은 2023-06 전 돈과 잔액수정이 빠져서 잔액이 실제와 달라요.
// → 자산마다 '지금 실제 잔액'을 넣으면 시작 잔액(accounts.initial)을 (실제 − 지금 계산된 잔액)만큼 고쳐서 맞춤. 기록은 안 건드림.
//   카드는 '갚을 카드값'(양수)으로 받아서 잔액 = −카드값.
// 숨기기: accounts.hidden = true → 자산 목록·합계·고르는 칸에서 빠짐 (기록은 그대로, 그 기록을 고칠 땐 그 자산이 보임)

const ICON = { bank: "🏦", card: "💳", cash: "💵", save: "🐷" };
const ORDER = ["cash", "bank", "card", "save"];

export function mountBalance(root, env) {
  const { esc, won, toast, act } = env;
  const draft = {};   // id → 넣은 실제 잔액 (문자열)
  function render() {
    const S = env.S, bal = env.balances(), list = env.rows(S.accounts)
      .sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type) || (a.createdAt || 0) - (b.createdAt || 0));
    if (root.contains(document.activeElement) && document.activeElement.tagName === "INPUT" && document.activeElement.type === "text") return;   // 입력 중엔 다시 안 그림
    root.innerHTML = `<div class="panel-head"><div><h3>🧮 실제 잔액 맞추기 · 🙈 숨기기</h3>
        <span class="muted small">통장 앱에 보이는 <b>지금 실제 잔액</b>을 넣고 [맞추기]를 누르면 그 금액이 되게 시작 잔액만 고쳐요 (기록은 그대로). 카드는 <b>갚을 카드값</b>을 넣어요. 안 쓰는 자산은 🙈로 숨기면 목록·합계에서 빠지고 예전 기록은 남아요.</span></div></div>
      <div class="bal-list">${list.map((a) => {
        const now = bal[a.id] || 0, card = a.type === "card";
        const shown = card ? `갚을 돈 ${won(Math.max(0, -now))}${now > 0 ? ` (남은 돈 ${won(now)})` : ""}` : won(now);
        return `<div class="bal-row${a.hidden ? " hid" : ""}">
          <span class="bal-name">${ICON[a.type] || ""} ${esc(a.name)}</span>
          <span class="bal-now small muted">지금 ${shown}</span>
          <input type="text" class="amt-in bal-in" data-neg inputmode="numeric" autocomplete="off" data-bal="${esc(a.id)}" value="${esc(draft[a.id] ?? "")}" placeholder="${card ? "갚을 카드값" : "실제 잔액"}" aria-label="${esc(a.name)} ${card ? "갚을 카드값" : "실제 잔액"}">
          <label class="bal-hide" title="숨기기"><input type="checkbox" data-hide="${esc(a.id)}"${a.hidden ? " checked" : ""}> 🙈</label>
        </div>`;
      }).join("") || '<p class="muted small">자산이 아직 없어요.</p>'}</div>
      ${list.length ? `<div class="row" style="flex:0 0 auto;align-items:center"><button class="btn" type="button" data-bal-go>맞추기</button><span class="small muted">빈 칸은 그대로 둬요.</span></div>` : ""}`;
  }
  root.addEventListener("input", (e) => { if (e.target.dataset.bal) draft[e.target.dataset.bal] = e.target.value; });
  root.addEventListener("change", (e) => {
    const id = e.target.dataset.hide; if (!id) return;
    const be = env.backend(); if (!be) return;
    act(be.update("accounts", id, { hidden: e.target.checked || null }), e.target.checked ? "🙈 숨겼어요. 예전 기록은 그대로예요." : "다시 보이게 했어요.").catch(() => { e.target.checked = !e.target.checked; });
  });
  root.addEventListener("click", (e) => {
    if (!e.target.closest("[data-bal-go]")) return;
    const be = env.backend(); if (!be) return;
    const S = env.S, bal = env.balances(), patch = {}, names = [];
    for (const [id, v] of Object.entries(draft)) {
      if (!String(v).trim() || !S.accounts.has(id)) continue;
      const a = S.accounts.get(id), n = parseInt(String(v).replace(/[^\d-]/g, ""), 10) || 0;
      const target = a.type === "card" ? -Math.abs(n) : n, now = bal[id] || 0;
      if (target === now) continue;
      patch[`accounts/${id}/initial`] = (Number(a.initial) || 0) + (target - now);
      names.push(a.name);
    }
    if (!names.length) { toast("바뀐 잔액이 없어요."); return; }
    act(be.rootUpdate(patch), `${names.length}개 자산 잔액을 맞췄어요.`).then(() => { for (const k of Object.keys(draft)) delete draft[k]; render(); }).catch(() => {});
  });
  return { render };
}
