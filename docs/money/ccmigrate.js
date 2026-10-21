// 🏷 예전 공통비용 기록 → 공통 분류로 옮기기 (냐냐 가계부 전용, 가계부 설정 '분류' 칸 아래, 한 번 쓰고 나면 안 보임)
// 예전: 분류 '💙 공통비용' + 소분류 '식비(외식)' → 지금: ccat '식비' · csub '외식' (식비(쇼핑)은 '장보기'), 소분류는 비움, ❤️ common = true.
// 정산 여부·내용(여행 이름)·금액·날짜는 그대로. [옮기기]를 눌러야 바뀜 (500건씩 나눠 저장)

export function mountCcMigrate(root, env) {
  const { esc, won } = env;
  let busy = false;
  const todo = () => {
    const out = [];
    env.S.money.forEach((x, id) => { if (x && (x.kind === "expense" || !x.kind) && !x.ccat && (x.common || /공통비용/.test(x.cat || ""))) out.push({ id, x, o: env.ccOf(x) }); });
    return out;
  };
  function render() {
    const list = todo();
    if (!list.length || !env.commonCats()) { root.classList.add("ccm-none"); root.innerHTML = ""; return; }   // 탭 바꿀 때 hidden이 풀려서 class로 숨김
    root.classList.remove("ccm-none");
    const g = {};
    list.forEach(({ x, o }) => { const k = `${x.sub || "(소분류 없음)"}→${o.c}${o.s ? " · " + o.s : ""}`; (g[k] ||= { from: x.sub || "(소분류 없음)", to: o.c + (o.s ? " · " + o.s : ""), n: 0, amt: 0 }); g[k].n++; g[k].amt += Number(x.amount) || 0; });
    const rows = Object.values(g).sort((a, b) => b.n - a.n);
    const names = new Set((env.commonCats() || []).map((c) => c.n)), unknown = rows.filter((r) => !names.has(r.to.split(" · ")[0]));
    root.innerHTML = `<div class="panel-head"><div><h3>🏷 예전 공통비용 기록 옮기기</h3><span class="muted small">편한가계부에서 가져온 공통비용 <b>${list.length.toLocaleString()}건</b>을 공통 분류로 옮겨요. 정산 여부·내용(여행 이름)·금액·날짜는 그대로예요.</span></div></div>
      <div class="ccm-tbl"><div class="ccm-row ccm-th"><span>지금 소분류</span><span>→ 공통 분류</span><span>건</span><span>금액</span></div>
      ${rows.map((r) => `<div class="ccm-row"><span>${esc(r.from)}</span><span>→ ${esc(r.to)}</span><span>${r.n.toLocaleString()}</span><span>${esc(won(r.amt))}</span></div>`).join("")}</div>
      ${unknown.length ? `<p class="small" style="margin:0;color:var(--danger)">공통 분류에 없는 대분류가 있어요: ${unknown.map((r) => esc(r.to.split(" · ")[0])).join(", ")} — 공통 탭 '🏷 공통 분류'에 더하거나, 옮긴 뒤 고쳐 주세요.</p>` : ""}
      <div class="row" style="flex:0 0 auto;align-items:center"><button class="btn" type="button" data-ccm-go${busy ? " disabled" : ""}>${busy ? "옮기는 중…" : `🏷 ${list.length.toLocaleString()}건 옮기기`}</button></div>`;
  }
  root.addEventListener("click", async (e) => {
    if (!e.target.closest("[data-ccm-go]") || busy) return;
    const be = env.backend(); if (!be) return;
    const list = todo(); if (!list.length) return;
    if (!confirm(`공통비용 ${list.length.toLocaleString()}건을 공통 분류로 옮길까요? (정산 여부·내용·금액·날짜는 그대로)`)) return;
    busy = true; render();
    try {
      const cat = env.commonCatName();
      for (let i = 0; i < list.length; i += 500) {
        const p = {};
        list.slice(i, i + 500).forEach(({ id, o }) => { p[`money/${id}/ccat`] = o.c; p[`money/${id}/csub`] = o.s || null; p[`money/${id}/sub`] = null; p[`money/${id}/common`] = true; p[`money/${id}/cat`] = cat; });
        await be.rootUpdate(p);
      }
      env.toast(`🏷 ${list.length.toLocaleString()}건을 공통 분류로 옮겼어요.`);
    } catch (err) { env.toast("옮기다가 멈췄어요. 다시 누르면 남은 것만 옮겨요."); }
    busy = false; render();
  });
  return { render };
}
