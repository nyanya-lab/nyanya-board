// 🤲 받을 돈 (2026-11-02 냐냐 요청): 욱진·친구 몫을 내가 대신 낸 돈을 체크 하나로 적고, 받을 때는 목록에서 골라 이체 한 번으로.
// 냐냐가 편한가계부 때부터 적던 방식 그대로: 실제 지출(BC 31,500) + 받을 돈 자산에 같은 금액 마이너스 지출(짝) → 내 지출은 0, 받을 돈만 자산에 남음.
// 기록: 실제 지출 recvTo = 받을 돈 자산 id / 짝 money/{id}-rv = { amount -금액, account 받을 돈 자산, recvOf 실제 지출 id } (날짜·분류·내용은 실제 지출과 같음)
// 받았을 때: 받을 돈 자산 → 통장 이체 한 건 + 고른 줄마다 recvPaid = 이체 id. 그 이체를 지우면 다시 안 받은 돈으로 돌아옴.
// 받을 돈 자산 = accounts.recv (안 정했으면 이름에 빌려준·받기·받을). 자산 관리 🤲에서 켜고 끔.
// 2026-11-02 전에 적은 기록은 잔액이 다 맞춰져 있어서 목록에 안 나옴 (RECV_FROM).
const RECV_FROM = new Date("2026-11-02T00:00:00+09:00").getTime();

export const isRecvAcct = (a) => !!a && !a.hidden && (a.recv ?? /빌려준|받기|받을/.test(a.name || ""));
export const recvShort = (a) => { const m = /\((.+)\)/.exec(a.name || ""); return m ? m[1] : a.name; };
// 기록 하나의 짝 찾기 (지우기·고치기에 씀)
export const recvPartner = (S, id) => { const x = S.money.get(id); if (!x) return null; const o = x.recvOf || (x.recvTo ? `${id}-rv` : null); return o && S.money.has(o) ? o : null; };
// 짝 기록 칸 (엑셀 업로드처럼 rootUpdate로 한 번에 넣는 곳에서도 씀)
export const recvPair = (id, doc, to, at) => ({ kind: "expense", amount: -Math.abs(Number(doc.amount) || 0), date: doc.date, cat: doc.cat, sub: doc.sub || null, cur: null, memo: doc.memo || "", note: doc.note || null, account: to, toAccount: null, recvOf: id, createdAt: at });

export function mountRecv(env) {
  const { $, S, esc, won } = env;
  const accts = () => [...S.accounts.entries()].filter(([, a]) => isRecvAcct(a)).map(([id, a]) => ({ id, ...a }));
  const off = new Set();   // 받을 때 체크를 뺀 줄 (기본은 다 체크)
  const form = { to: null, date: "" };

  // ── 기록 창 칸 ──
  function formSync(fill) {
    const wrap = $("mRecvWrap"), k = env.kind(), list = accts(); if (!wrap) return;
    wrap.hidden = k !== "expense" || !list.length;
    const ck = $("mRecv"), sel = $("mRecvTo"), want = fill ? fill.recvTo || "" : sel.value;
    if (fill) ck.checked = !!fill.recvTo;
    sel.innerHTML = list.map((a) => `<option value="${esc(a.id)}"${a.id === want ? " selected" : ""}>${esc(a.name)}</option>`).join("");
    sel.hidden = !ck.checked;
  }
  // 저장 전 확인: 받을 돈 자산 id | null | { error }
  function collect() {
    if (env.kind() !== "expense" || !$("mRecv").checked) return null;
    const to = $("mRecvTo").value;
    if (!to) return { error: "받을 사람을 골라 주세요." };
    if ($("mCommon") && $("mCommon").checked) return { error: "❤️ 공통비용과 🤲 받을 돈은 같이 못 적어요. 하나만 골라 주세요." };
    if ($("mCur").value && $("mCur").value !== "원") return { error: "🤲 받을 돈은 원화만 적을 수 있어요." };
    if ($("mAcct").value === to) return { error: "낸 곳과 받을 돈 자산이 같아요." };
    return to;
  }
  // 저장 뒤: 짝 만들기·고치기·지우기 (update라서 받은 표시 recvPaid는 그대로)
  async function sync(id, doc) {
    const be = env.backend(), pid = `${id}-rv`;
    if (!doc.recvTo) { if (S.money.has(pid)) await be.remove("money", pid); return; }
    const had = S.money.get(pid), d = recvPair(id, doc, doc.recvTo, had ? had.createdAt : Date.now());
    await be.update("money", pid, d);
  }

  // ── 자산 화면: 아직 안 받은 돈 ──
  function openOf(id) {
    const out = [];
    S.money.forEach((x, mid) => {
      if (!x || (x.recvPaid && S.money.has(x.recvPaid))) return;
      const inn = x.kind === "move" ? x.toAccount === id : (x.kind === "expense" || !x.kind) && x.account === id && (Number(x.amount) || 0) < 0;
      if (!inn || !(x.recvOf || (x.createdAt || 0) >= RECV_FROM)) return;
      out.push({ id: mid, date: x.date || "", amt: Math.abs(Number(x.amount) || 0), name: x.memo || x.note || x.cat || "이체" });
    });
    return out.sort((a, b) => a.date.localeCompare(b.date));
  }
  function panel(id) {
    const a = S.accounts.get(id); if (!isRecvAcct(a)) return "";
    const list = openOf(id), bal = env.balances()[id] || 0, on = list.filter((x) => !off.has(x.id)), sum = on.reduce((t, x) => t + x.amt, 0), all = list.reduce((t, x) => t + x.amt, 0);
    if (!list.length) return `<div class="rv-box"><b>🤲 아직 안 받은 돈</b><p class="muted small">없어요. 대신 낸 돈은 기록 창에서 🤲 받을 돈을 체크하면 여기에 모여요.</p></div>`;
    const banks = env.sortedAccts().filter((b) => !isRecvAcct(b) && b.type !== "card" && !b.joint), to = banks.some((b) => b.id === form.to) ? form.to : (banks.find((b) => b.id === env.lastAcct("moveTo")) || banks[0] || {}).id;
    return `<div class="rv-box" data-rv-acct="${esc(id)}"><div class="rv-head"><b>🤲 아직 안 받은 돈</b><b class="won plus">${won(all)}</b></div>
      <div class="rv-list">${list.map((x) => `<label class="rv-row"><input type="checkbox" data-rv="ck" data-id="${esc(x.id)}"${off.has(x.id) ? "" : " checked"} aria-label="${esc(x.name)} 받음"><span class="mono">${esc(env.shortDate(x.date))}</span><span class="rv-name">${esc(x.name)}</span><span class="won">${won(x.amt)}</span></label>`).join("")}</div>
      ${Math.round(bal) !== Math.round(all) ? `<p class="small muted" style="margin:0">자산 잔액 ${won(bal)}과 달라요 (목록 밖의 기록이나 일부만 받은 돈이 있어요)</p>` : ""}
      <div class="rv-go"><label class="f">받은 날<input type="date" data-rv="date" value="${esc(form.date || env.today())}"></label><label class="f">들어온 통장<select data-rv="to">${env.acctOptsHtml(banks, to)}</select></label>
        <button class="btn" type="button" data-rv="go"${on.length ? "" : " disabled"}>${on.length}건 받았어요 · ${won(sum)}</button></div></div>`;
  }
  // 체크할 때는 화면을 다시 그리지 않고 버튼 글자만 (스크롤·포커스가 안 튀게)
  function goText(box) {
    const on = openOf(box.dataset.rvAcct).filter((x) => !off.has(x.id)), go = box.querySelector('[data-rv="go"]');
    go.disabled = !on.length; go.textContent = `${on.length}건 받았어요 · ${won(on.reduce((t, x) => t + x.amt, 0))}`;
  }
  $("mRecv").addEventListener("change", () => formSync());
  $("asDetail").addEventListener("change", (e) => {
    const k = e.target.dataset.rv; if (!k) return;
    if (k === "ck") { if (e.target.checked) off.delete(e.target.dataset.id); else off.add(e.target.dataset.id); goText(e.target.closest("[data-rv-acct]")); }
    else if (k === "date") form.date = e.target.value;
    else if (k === "to") form.to = e.target.value;
  });
  $("asDetail").addEventListener("click", (e) => {
    const b = e.target.closest('[data-rv="go"]'); if (!b) return;
    const box = b.closest("[data-rv-acct]"), id = box.dataset.rvAcct, list = openOf(id).filter((x) => !off.has(x.id)); if (!list.length) return;
    const to = box.querySelector('[data-rv="to"]').value, date = box.querySelector('[data-rv="date"]').value || env.today(), sum = list.reduce((t, x) => t + x.amt, 0);
    if (!to) { env.toast("들어온 통장을 골라 주세요."); return; }
    const mid = env.rid(), p = {};
    p[`money/${mid}`] = { kind: "move", amount: sum, date, cat: null, sub: null, cur: null, memo: list.length > 1 ? `${list[0].name} 외 ${list.length - 1}건` : list[0].name, note: null, account: id, toAccount: to, createdAt: Date.now() };
    list.forEach((x) => { p[`money/${x.id}/recvPaid`] = mid; });
    env.rememberAcct("moveTo", to);
    env.act(env.backend().rootUpdate(p), `🤲 ${won(sum)} 받았다고 적었어요.`).then(() => { form.date = ""; env.render(); }).catch(() => {});
  });
  return { accts, formSync, collect, sync, panel, partner: (id) => recvPartner(S, id) };
}
