// ★ 두 가계부(냐냐·욱진)가 같이 쓰는 파일 — 원본은 냐냐 보드 docs/money/, 욱진 보드 docs/는 글자 하나까지 같은 복사본. 한쪽만 고치지 말고, 보드마다 달라야 하는 건 env로 가르기.
// ✂️ 기록 창 금액 나눠 적기 (2026-11-02 냐냐 요청, 지출·수입, 새 기록·고치기 둘 다)
// 위 금액 칸 = 전체. 나눈 줄마다 금액·분류·소분류·내용을 따로 고르고, 위 칸 기록은 나머지 금액으로 저장 → 기록이 여러 건으로 들어감.
// 날짜·자산·화폐·메모는 위 칸과 같음, 내용은 비우면 위 칸과 같게. 사진·보험금 연결은 위 칸 기록에만 남음. 고치기면 카드 승인번호(bcNo)도 복사해서 다시 올려도 안 겹침.
// 🤲 분류에서 '🤲 받을 돈'을 고르면 소분류 칸이 이름 칸으로 → 그 금액은 받을 돈으로 (recv.js).
// 분류에서 '💙 공통비용'을 고르면 소분류 칸이 공통 분류('식비 · 외식')로 → 기록 common·ccat·csub (엑셀 업로드 cardimport.js와 같은 방식).
export function mountRecSplit(env) {
  const { $, esc, won, amtVal } = env;
  let lines = [], n = 0, kind = "";
  const on = () => env.kind() === "expense" || env.kind() === "income";
  const isCc = (cat) => env.kind() === "expense" && !!cat && cat === env.commonCatName();
  const isR = (cat) => env.kind() === "expense" && !!env.recv() && cat === env.recv().cat;
  const left = () => amtVal($("mAmount")) - lines.reduce((a, l) => a + l.amt, 0);

  function subHtml(l) {
    if (!isCc(l.cat)) return env.subOptions(env.kind(), l.cat, l.sub, false);
    return '<option value="">공통 분류 -</option>' + (env.commonCats() || []).map((c) => (c.s && c.s.length ? c.s : [""]).map((s) => {
      const v = `${c.n}|${s}`;
      return `<option value="${esc(v)}"${v === l.sub ? " selected" : ""}>${esc(c.n + (s ? " · " + s : ""))}</option>`;
    }).join("")).join("");
  }
  function restHtml() {
    const total = amtVal($("mAmount")), r = left();
    if (!total) return `<span class="m-sp-bad">위 금액 칸에 전체 금액을 먼저 적어 주세요</span>`;
    if (r <= 0) return `<span class="m-sp-bad">나눈 금액이 전체 ${esc(won(total))}보다 많거나 같아요</span>`;
    return `위 칸 기록은 나머지 <b>${esc(won(r))}</b>`;
  }
  function draw() {
    const box = $("mSplit"); box.hidden = !on();
    if (!lines.length) { box.innerHTML = `<button type="button" class="m-sp-open" data-sp="add">✂️ 금액 나눠 적기</button>`; return; }
    const cats = env.moneyCats(env.kind()).concat(env.kind() === "expense" && env.recv() ? [env.recv().cat] : []);
    box.innerHTML = `<div class="m-sp"><div class="m-sp-head"><b>✂️ 나눠 적기</b><span data-sp-rest>${restHtml()}</span></div>
      ${lines.map((l) => `<div class="m-sp-l" data-k="${l.k}">
        <input type="text" class="amt-in" inputmode="numeric" autocomplete="off" data-f="amt" value="${l.amt ? l.amt.toLocaleString() : ""}" placeholder="금액" aria-label="나눌 금액">
        <select data-f="cat" aria-label="분류"><option value="">분류</option>${cats.map((c) => `<option${c === l.cat ? " selected" : ""}>${esc(c)}</option>`).join("")}</select>
        ${isR(l.cat) ? `<input type="text" data-f="recv" list="recvNames" maxlength="20" autocomplete="off" value="${esc(l.recv)}" placeholder="받을 사람" aria-label="받을 사람 이름">` : `<select data-f="sub" aria-label="소분류"${l.cat ? "" : " disabled"}>${subHtml(l)}</select>`}
        <button type="button" class="m-sp-del" data-sp="del" aria-label="이 줄 빼기">×</button>
        <input type="text" data-f="memo" maxlength="80" value="${esc(l.memo)}" placeholder="내용 (비우면 위 내용과 같게)" aria-label="내용"></div>`).join("")}
      <div class="m-sp-btns"><button type="button" class="m-sp-open" data-sp="add">＋ 줄 더</button><button type="button" class="m-sp-open" data-sp="off">안 나누기</button></div></div>`;
  }
  const showRest = () => { const el = $("mSplit").querySelector("[data-sp-rest]"); if (el) el.innerHTML = restHtml(); };

  $("mSplit").addEventListener("click", (e) => {
    const b = e.target.closest("[data-sp]"); if (!b) return;
    if (b.dataset.sp === "add") {
      lines.push({ k: n++, amt: 0, cat: "", sub: "", memo: "", recv: "" }); draw();
      const all = $("mSplit").querySelectorAll('[data-f="amt"]'); all[all.length - 1].focus();
    } else if (b.dataset.sp === "off") { lines = []; draw(); }
    else { const k = +b.closest("[data-k]").dataset.k; lines = lines.filter((l) => l.k !== k); draw(); }
  });
  const lineOf = (el) => { const row = el.closest("[data-k]"); return row && lines.find((l) => l.k === +row.dataset.k); };
  $("mSplit").addEventListener("input", (e) => {
    const l = lineOf(e.target), f = e.target.dataset.f; if (!l) return;
    if (f === "amt") { l.amt = amtVal(e.target); showRest(); } else if (f === "memo") l.memo = e.target.value;
    else if (f === "recv") l.recv = e.target.value;
  });
  $("mSplit").addEventListener("change", (e) => {
    const l = lineOf(e.target), f = e.target.dataset.f; if (!l) return;
    if (f === "cat") {
      l.cat = e.target.value; l.sub = ""; draw();
      if (isR(l.cat)) $("mSplit").querySelector(`[data-k="${l.k}"] [data-f="recv"]`).focus();
    }
    else if (f === "sub") l.sub = e.target.value;
  });
  $("mAmount").addEventListener("input", showRest);

  return {
    reset() { lines = []; kind = env.kind(); draw(); },
    // 기록 창을 다시 그릴 때: 구분이 바뀌면 나눈 줄을 비움, 아니면 적던 칸 그대로
    sync() { if (kind !== env.kind()) { kind = env.kind(); lines = []; draw(); } else showRest(); },
    // 저장 전 확인: 안 나눴으면 null, 안 맞으면 { error }, 맞으면 { left, lines }
    collect(total) {
      if (!on() || !lines.length) return null;
      if (lines.some((l) => !(l.amt > 0))) return { error: "나눌 금액을 적어 주세요." };
      const r = left(); if (r <= 0) return { error: `나눈 금액이 전체 ${won(total)}보다 많거나 같아요.` };
      if (lines.some((l) => !l.cat)) return { error: "나눈 줄의 분류를 골라 주세요." };
      const rs = lines.filter((l) => isR(l.cat));
      if (rs.some((l) => !l.recv.trim())) return { error: "받을 사람 이름을 적어 주세요." };
      if (rs.length && $("mCur").value && $("mCur").value !== "원") return { error: "🤲 받을 돈은 원화만 적을 수 있어요." };
      if (rs.some((l) => env.recv().idOf(l.recv) === $("mAcct").value)) return { error: "낸 곳과 받을 돈 자산이 같아요." };
      return { left: r, lines: lines.slice() };
    },
    async save(sp, doc, oldId) {
      const old = (oldId && env.S.money.get(oldId)) || {};
      for (const [i, l] of sp.lines.entries()) {
        const cc = isCc(l.cat), [c, s] = cc ? l.sub.split("|") : [], r = isR(l.cat);
        const d = { kind: doc.kind, amount: l.amt, date: doc.date, cat: r ? env.recv().storeCat() : l.cat, sub: cc || r ? null : l.sub || null, cur: doc.cur, memo: l.memo.trim() || doc.memo, note: doc.note, account: doc.account, toAccount: null,
          common: cc ? true : null, ccat: cc ? c || null : null, csub: cc ? s || null : null, settle: null, pics: null, src: old.src || null, bcNo: old.bcNo || null, createdAt: Date.now() + i, recvTo: r ? env.recv().idOf(l.recv) : null };
        const id = await env.backend().add("money", d);
        if (d.recvTo) await env.recv().sync(id, d);
      }
    },
  };
}
