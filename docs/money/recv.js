// ★ 두 가계부(냐냐·욱진)가 같이 쓰는 파일 — 원본은 냐냐 보드 docs/money/, 욱진 보드 docs/는 글자 하나까지 같은 복사본. 한쪽만 고치지 말고, 보드마다 달라야 하는 건 env로 가르기.
// 🤲 받을 돈 (2026-11-02 냐냐 요청): 욱진·친구 몫을 내가 대신 낸 돈을 체크 하나로 적고, 받을 때는 목록에서 골라 이체 한 번으로.
// 냐냐가 편한가계부 때부터 적던 방식 그대로: 실제 지출(BC 31,500) + 받을 돈 자산에 같은 금액 마이너스 지출(짝) → 내 지출은 0, 받을 돈만 자산에 남음.
// 기록: 실제 지출 recvTo = 받을 돈 자산 id / 짝 money/{id}-rv = { amount -금액, account 받을 돈 자산, recvOf 실제 지출 id } (날짜·분류·내용은 실제 지출과 같음)
// 받았을 때: 받을 돈 자산 → 통장 이체 한 건 + 고른 줄마다 recvPaid = 이체 id. 그 이체를 지우면 다시 안 받은 돈으로 돌아옴.
// 받을 돈 자산 = accounts.recv (안 정했으면 이름에 빌려준·받기·받을). 자산 관리 🤲에서 켜고 끔.
// 고르는 곳 (같은 날 냐냐: 체크가 번거로움): 분류 칸의 '🤲 받을 돈'(RECV_CAT, 진짜 분류 아님) → 소분류 칸이 이름 칸. 저장은 그대로 두 줄이고 분류는 기타로 (합이 0이라 통계엔 안 보임), 내역 줄엔 txRow가 '🤲 받을 돈'·이름으로 보여 줌.
// 이름 직접 적기 (같은 날 냐냐 요청): 칸에 이름을 적으면 그 이름의 자산을 찾고(이름 또는 괄호 안 이름, 자동완성 #recvNames), 없으면 '받기(이름)' 자산을 새로 만듦.
// 잔액 0원이면 자산 탭 목록·고르는 칸에서 저절로 숨김 (zero, 기록은 그대로, 같은 이름을 다시 적으면 이어짐). 이체 받는 곳에는 남겨 둠 (돈을 빌려줄 때 고를 수 있게).
// 2026-11-02 전에 적은 기록은 잔액이 다 맞춰져 있어서 목록에 안 나옴 (RECV_FROM).
const RECV_FROM = new Date("2026-11-02T00:00:00+09:00").getTime();

export const RECV_CAT = "🤲 받을 돈";
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
  const pending = new Map();   // 새로 만들 자산: id → 이름 (저장할 때 만듦)
  const same = (x, y) => x.trim().toLowerCase() === y.trim().toLowerCase();
  // 이름 → 자산 id (없으면 새 id를 정해 둠)
  function idOf(name) {
    const hit = accts().find((a) => same(a.name, name) || same(recvShort(a), name)); if (hit) return hit.id;
    const p = [...pending].find(([, n]) => same(n, name)); if (p) return p[0];
    const id = env.rid(); pending.set(id, name.trim()); return id;
  }
  const newDoc = (id) => pending.has(id) ? { name: `받기(${pending.get(id)})`, type: "cash", initial: 0, recv: true, createdAt: Date.now() } : null;
  async function ensure(id) { const d = newDoc(id); if (d) { await env.backend().set("accounts", id, d); pending.delete(id); } }
  // 자동완성 목록 (다 받은 사람도 나옴)
  function fillNames() { $("recvNames").innerHTML = accts().map((a) => `<option value="${esc(recvShort(a))}"></option>`).join(""); }
  // 받을 돈 자산인데 잔액 0원? (한 번 그리는 동안 한 번만 계산)
  let zb = null;
  function zero(id) {
    if (!isRecvAcct(S.accounts.get(id))) return false;
    if (!zb) { zb = env.balances(); queueMicrotask(() => { zb = null; }); }
    return Math.round(zb[id] || 0) === 0;
  }

  // ── 기록 창 칸 ──
  const isOn = () => env.kind() === "expense" && $("mCat").value === RECV_CAT;
  const storeCat = () => { const c = env.moneyCats("expense"); return c.find((x) => /기타/.test(x)) || c[0] || ""; };
  function formSync(fill) {
    const box = $("mRecvTo"), on = isOn();
    $("mRecvWrap").hidden = !on; $("mSubWrap").hidden = on;
    if (fill) { const a = fill.recvTo && S.accounts.get(fill.recvTo); box.value = a ? recvShort(a) : ""; }
    else if (!on) box.value = "";
    fillNames();
  }
  // 저장 전 확인: 받을 돈 자산 id | null | { error }
  function collect() {
    if (!isOn()) return null;
    const name = $("mRecvTo").value.trim();
    if (!name) return { error: "받을 사람 이름을 적어 주세요." };
    const to = idOf(name);
    if ($("mCur").value && $("mCur").value !== "원") return { error: "🤲 받을 돈은 원화만 적을 수 있어요." };
    if ($("mAcct").value === to) return { error: "낸 곳과 받을 돈 자산이 같아요." };
    return to;
  }
  // 저장 뒤: 짝 만들기·고치기·지우기 (update라서 받은 표시 recvPaid는 그대로)
  async function sync(id, doc) {
    const be = env.backend(), pid = `${id}-rv`;
    if (!doc.recvTo) { if (S.money.has(pid)) await be.remove("money", pid); return; }
    await ensure(doc.recvTo);
    const had = S.money.get(pid), d = recvPair(id, doc, doc.recvTo, had ? had.createdAt : Date.now());
    if (had) await be.update("money", pid, d); else await be.set("money", pid, d);   // 욱진 보드의 로컬·테스트 저장소 update는 없는 칸을 안 만들어서 새 짝은 set
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
    if (!list.length) return `<div class="rv-box"><b>🤲 아직 안 받은 돈</b><p class="muted small">없어요. 대신 낸 돈은 기록 창 분류 칸에서 🤲 받을 돈을 고르면 여기에 모여요.</p></div>`;
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
  $("mCat").addEventListener("change", () => { formSync(); if (isOn()) $("mRecvTo").focus(); });
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
  return { cat: RECV_CAT, storeCat, nameOf: (id) => { const a = S.accounts.get(id); return a ? recvShort(a) : ""; },
    // 창을 닫으면: 다음 기록에 안 남게
    clear() { $("mRecvTo").value = ""; if ($("mCat").value === RECV_CAT) $("mCat").selectedIndex = 0; formSync(); },
    accts, idOf, newDoc, done: (id) => pending.delete(id), fillNames, zero, formSync, collect, sync, panel, partner: (id) => recvPartner(S, id) };
}
