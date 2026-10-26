// 🏦 자산 관리 (가계부 설정 탭, 냐냐 가계부 전용 — 욱진 보드 짝 코드 아님)
// 자산마다 이름 · 계좌번호(accounts.number) · 메모(accounts.memo) · 🤝 공동(accounts.joint) · 🙈 숨기기(accounts.hidden)를 한곳에서 고침.
// 🤝 공동 = 둘이 같이 쓰는 통장(데이트통장, 결혼 후 합친 통장): 이 자산으로 적은 ❤️ 공통비용은 '같이 냄'(정산할 돈에서 빠짐, 2026-10-26부터 적은 것만 — app.js mirrorCommon)
// 칸에서 나가면(change) 그 칸만 저장. 계좌번호·메모는 자산 목록·자산별 보기에 보임 (money.js).
// 숨긴 자산도 여기엔 다 보임 (흐리게) → 다시 보이게 할 수 있음.

const ICON = { cash: "💵", bank: "🏦", card: "💳", save: "🐷" };
const GROUPS = [["cash", "현금"], ["bank", "통장"], ["card", "카드"], ["save", "저축·투자"]];

export function mountAcctSet(root, env) {
  const { esc } = env;
  function render() {
    if (root.contains(document.activeElement) && document.activeElement.tagName === "INPUT" && document.activeElement.type === "text") return;   // 쓰는 중엔 다시 안 그림
    const all = env.rows(env.S.accounts).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
    const hid = all.filter((a) => a.hidden).length;
    root.innerHTML = `<div class="panel-head"><div><h3>🏦 자산 관리</h3><span class="muted small">이름 · 계좌번호 · 메모를 고치고, 안 쓰는 자산은 🙈로 숨겨요 (숨겨도 예전 기록은 그대로). 계좌번호·메모는 자산 탭 목록과 자산별 보기에 보여요.${hid ? ` 지금 숨긴 자산 ${hid}개.` : ""}</span></div></div>
      <div class="ak-list">${GROUPS.map(([t, label]) => {
        const list = all.filter((a) => (ICON[a.type] ? a.type : "bank") === t); if (!list.length) return "";
        return `<div class="ak-gh">${ICON[t]} ${label} ${list.length}</div>` + list.map((a) => `<div class="ak-row${a.hidden ? " hid" : ""}">
          <span aria-hidden="true">${ICON[a.type] || "🏦"}</span>
          <input type="text" data-ak="name" data-id="${esc(a.id)}" value="${esc(a.name)}" maxlength="30" aria-label="${esc(a.name)} 이름">
          <input type="text" class="ak-num" data-ak="number" data-id="${esc(a.id)}" value="${esc(a.number || "")}" maxlength="40" placeholder="계좌번호" aria-label="${esc(a.name)} 계좌번호">
          <input type="text" class="ak-memo" data-ak="memo" data-id="${esc(a.id)}" value="${esc(a.memo || "")}" maxlength="200" placeholder="메모 (예: 월급통장, 적금 만기 27.3)" aria-label="${esc(a.name)} 메모">
          <label class="ak-hide" title="공동 통장: 이 자산으로 낸 ❤️ 공통비용은 '같이 냄'"><input type="checkbox" data-ak="joint" data-id="${esc(a.id)}"${a.joint ? " checked" : ""}> 🤝</label>
          <label class="ak-hide" title="숨기기"><input type="checkbox" data-ak="hidden" data-id="${esc(a.id)}"${a.hidden ? " checked" : ""}> 🙈</label>
        </div>`).join("");
      }).join("") || '<p class="muted small" style="margin:0">자산이 아직 없어요.</p>'}</div>`;
  }
  root.addEventListener("change", (e) => {
    const k = e.target.dataset.ak, id = e.target.dataset.id; if (!k || !id) return;
    const be = env.backend(), a = env.S.accounts.get(id); if (!be || !a) return;
    if (k === "joint") {
      env.act(be.update("accounts", id, { joint: e.target.checked || null }), e.target.checked ? `🤝 ${a.name}: 공동 통장으로 했어요. 앞으로 이 자산으로 적는 ❤️ 공통비용은 '같이 냄'이에요.` : `${a.name}: 공동 통장 표시를 뺐어요.`).catch(() => { e.target.checked = !e.target.checked; });
      return;
    }
    if (k === "hidden") {
      env.act(be.update("accounts", id, { hidden: e.target.checked || null }), e.target.checked ? `🙈 ${a.name} 숨겼어요. 예전 기록은 그대로예요.` : `${a.name} 다시 보이게 했어요.`).catch(() => { e.target.checked = !e.target.checked; });
      return;
    }
    const v = e.target.value.trim();
    if (k === "name" && !v) { e.target.value = a.name; env.toast("이름은 비울 수 없어요."); return; }
    if ((a[k] || "") === v) return;
    env.act(be.update("accounts", id, { [k]: v || null }), k === "name" ? "이름을 고쳤어요." : k === "number" ? "계좌번호를 저장했어요." : "메모를 저장했어요.").catch(() => {});
  });
  return { render };
}
