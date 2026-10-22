// 💳 카드 승인내역 올리기 (냐냐 가계부 전용, 가계부 설정 '가져오기' 탭 — 2026-10-22 냐냐 요청)
// BC카드 홈페이지·앱 '승인내역' 엑셀(.xls, 칸: 승인일시 · 승인카드 · 이용카드 · 승인번호 · 가맹점명 · 승인금액 · 이용구분 · 접수현황 · 결제일 · 취소일자/취소금액)
//   → 승인취소(접수현황 '취소' 또는 취소금액 = 승인금액)는 빼고, 부분취소는 남은 금액만 지출로.
//   → 이미 가계부에 있는 건 건너뜀: ① 전에 올린 것(기록 id = bc-승인번호-날짜) ② 같은 날 · 같은 자산 · 같은 금액 기록
//      ③ 같은 날 같은 자산 기록 몇 개를 합친 금액이 같음 (예: 이마트 55,860원을 3건으로 나눠 적은 것)
//      ④ 반대로 그날 승인 몇 개를 가계부에 한 건으로 합쳐 적은 것 (예: 인형뽑기 5,000+1,000+1,000 → 7,000원 한 건)
//   → 같은 날 같은 가게 여러 번(인형뽑기·노래방)은 한 건으로 합침 (문화생활·오락 같은 곳은 기본으로, 줄마다 [합치기]/[나누기]) → bcNo = "승인번호1,승인번호2…"
//   → 분류는 전에 같은 가게(메모 note)를 적은 분류로 미리 골라 둠 (❤️ 공통비용이었으면 공통 분류까지). 미리보기에서 바꾸고 [기록하기].
//   기록 = { kind expense, amount, date, account, cat, sub, memo "", note 가맹점명, src "BC카드", bcNo 승인번호 } (공통이면 cat '💙 공통비용' + common·ccat·csub)
// 파일은 이 브라우저에서만 읽고 저장소에 안 올라감.
const SHEETJS = "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
const norm = (s) => String(s || "").replace(/\s+/g, "");
const num = (v) => typeof v === "number" ? v : Number(String(v || "").replace(/[^\d.-]/g, "")) || 0;
// 가게 이름 비교용: (주)·㈜·주식회사·공백·끝의 _0 / _가승인 같은 꼬리 떼기
const shopKey = (s) => norm(s).replace(/\(주\)|㈜|주식회사/g, "").replace(/_[^_]*$/, "").toLowerCase();

// 엑셀 → [{ no, date, time, shop, amount, cancel }] (취소 건도 cancel 표시해서 같이 돌려줌)
export async function readCardFile(file) {
  const XLSX = await import(SHEETJS);
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  for (const name of wb.SheetNames) {
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "" });
    const hi = rows.findIndex((r) => r.some((c) => norm(c) === "승인번호") && r.some((c) => norm(c) === "가맹점명"));
    if (hi < 0) continue;
    const head = rows[hi].map(norm), col = (f) => head.findIndex(f);
    const c = { when: col((h) => h.startsWith("승인일")), no: col((h) => h === "승인번호"), shop: col((h) => h === "가맹점명"), amt: col((h) => h.startsWith("승인금액")),
      st: col((h) => h.startsWith("접수현황")), cancel: col((h) => h.startsWith("취소")) };
    if (c.when < 0 || c.shop < 0 || c.amt < 0) continue;
    const out = [];
    for (const r of rows.slice(hi + 1)) {
      const m = /(\d{4})[.\-/](\d{1,2})[.\-/](\d{1,2})\D*(\d{1,2}:\d{2}(?::\d{2})?)?/.exec(String(r[c.when]));
      if (!m) continue;
      const amount = num(r[c.amt]); if (!amount) continue;
      const cm = /(-?[\d,]+)\s*원/.exec(String(c.cancel >= 0 ? r[c.cancel] : "")), cancelAmt = cm ? Math.abs(num(cm[1])) : 0;
      const canceled = (c.st >= 0 && norm(r[c.st]) === "취소") || (cancelAmt && cancelAmt >= amount);
      out.push({ no: c.no >= 0 ? norm(r[c.no]) : "", date: `${m[1]}-${m[2].padStart(2, "0")}-${m[3].padStart(2, "0")}`, time: m[4] || "",
        shop: String(r[c.shop]).trim(), amount: canceled ? amount : amount - cancelAmt, canceled, partial: !canceled && cancelAmt > 0 });
    }
    if (out.length) return out;
  }
  throw new Error("카드 승인내역 엑셀이 아닌 것 같아요 (승인번호·가맹점명 칸을 못 찾았어요).");
}

export function mountCardImport(root, env) {
  const { esc, won } = env;
  const st = { rows: null, acct: null, pick: {}, merge: {}, busy: false };   // pick[i] = { on, cat, sub } (사람이 바꾼 것), merge[묶음] = 합치기 켬/끔
  const cards = () => [...env.S.accounts.entries()].filter(([, a]) => a && a.type === "card" && !a.hidden);
  const defAcct = () => { const cs = cards(); return (cs.find(([, a]) => /^bc/i.test(a.name || "")) || cs[0] || [null])[0]; };
  // 가게별로 마지막에 적은 분류 (같은 이름 → 꼬리 뗀 이름)
  function lastCats() {
    const exact = {}, loose = {};
    [...env.S.money.values()].filter((x) => x && (x.kind === "expense" || !x.kind) && x.note && x.cat).sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.createdAt || 0) - (b.createdAt || 0))
      .forEach((x) => { const g = { cat: x.cat, sub: x.sub || "", common: !!x.common, ccat: x.ccat || "", csub: x.csub || "" }; exact[norm(x.note)] = g; loose[shopKey(x.note)] = g; });
    return (shop) => exact[norm(shop)] || loose[shopKey(shop)] || null;
  }
  // 이미 있는 것 찾기 → 각 승인에 have: "id" | "same" | "sum:n" | null
  function view() {
    if (!st.rows) return null;
    const acct = st.acct || defAcct(), S = env.S, guess = lastCats();
    const live = st.rows.map((r, i) => ({ ...r, i })).filter((r) => !r.canceled);
    const used = new Set(), byDay = {};
    S.money.forEach((x, id) => { if (x && x.account === acct && (x.kind === "expense" || !x.kind) && !x.bcNo) (byDay[x.date] ||= []).push({ id, amt: Number(x.amount) || 0 }); });
    const nos = new Set(); S.money.forEach((x) => { if (x && x.bcNo) String(x.bcNo).split(",").forEach((n) => nos.add(n)); });   // 전에 올린 승인번호 (합친 건 "1,2,3")
    live.forEach((r) => { r.id = `bc-${r.no || r.time.replace(/\D/g, "")}-${r.date.replace(/-/g, "")}`; if (S.money.has(r.id) || (r.no && nos.has(r.no))) r.have = "id"; });
    live.forEach((r) => { if (r.have) return; const c = (byDay[r.date] || []).find((x) => !used.has(x.id) && x.amt === r.amount); if (c) { used.add(c.id); r.have = "same"; } });
    live.forEach((r) => {   // 나눠 적은 것: 그날 남은 기록 중 2~6개 합이 같은 것
      if (r.have) return;
      const cand = (byDay[r.date] || []).filter((x) => !used.has(x.id) && x.amt > 0 && x.amt < r.amount);
      const hit = (function find(start, left, picked) {
        if (left === 0 && picked.length >= 2) return picked;
        if (left <= 0 || picked.length >= 6) return null;
        for (let k = start; k < cand.length; k++) { const f = find(k + 1, left - cand[k].amt, picked.concat(cand[k])); if (f) return f; }
        return null;
      })(0, r.amount, []);
      if (hit) { hit.forEach((x) => used.add(x.id)); r.have = `sum:${hit.length}`; }
    });
    Object.entries(byDay).forEach(([day, recs]) => recs.forEach((x) => {   // 반대로 합쳐 적은 것: 가계부 기록 1개 = 그날 승인 2~6개 합 (같은 가게 먼저)
      if (used.has(x.id)) return;
      const left = live.filter((r) => !r.have && r.date === day && r.amount < x.amt);
      const groups = Object.values(left.reduce((g, r) => ((g[shopKey(r.shop)] ||= []).push(r), g), {})).concat([left]);
      for (const cand of groups) {
        const hit = (function find(start, rest, picked) {
          if (rest === 0 && picked.length >= 2) return picked;
          if (rest <= 0 || picked.length >= 6) return null;
          for (let k = start; k < cand.length; k++) { const f = find(k + 1, rest - cand[k].amount, picked.concat(cand[k])); if (f) return f; }
          return null;
        })(0, x.amt, []);
        if (hit) { used.add(x.id); hit.forEach((r) => { r.have = `merged:${hit.length}`; }); return; }
      }
    }));
    live.forEach((r) => {
      const g = guess(r.shop) || {}, p = st.pick[r.i] || {};
      r.cat = p.cat ?? (g.common ? env.commonCatName() : g.cat || "");
      r.sub = p.sub ?? (g.common ? (g.ccat ? `${g.ccat}|${g.csub}` : "") : g.sub || "");
      r.on = p.on ?? true;
    });
    // 🧸 같은 날 같은 가게에서 여러 번 = 한 건으로 합치기 (인형뽑기·노래방처럼). 기본: 문화생활·오락 같은 곳만 켬, 줄마다 [합치기]/[나누기]
    const fresh = live.filter((r) => !r.have), grp = {};
    fresh.forEach((r) => { (grp[`g:${r.date}:${norm(r.shop)}`] ||= []).push(r); });
    const fun = (r) => /문화/.test(r.cat) || /^문화생활\|/.test(r.sub) || /인형|뽑기|오락|노래|코인|게임|포토|사진/.test(r.shop);
    const news = [];
    fresh.forEach((r) => {
      const gk = `g:${r.date}:${norm(r.shop)}`, items = grp[gk];
      if (items.length < 2) { news.push(r); return; }
      r.grp = gk; r.first = items[0] === r;
      if (!(st.merge[gk] ?? items.every(fun))) { news.push(r); return; }
      if (!r.first) return;
      const p = st.pick[gk] || {};
      news.push({ ...r, i: gk, amount: items.reduce((a, x) => a + x.amount, 0), nos: items.map((x) => x.no).filter(Boolean), parts: items.length, partial: items.some((x) => x.partial),
        cat: p.cat ?? r.cat, sub: p.sub ?? r.sub, on: p.on ?? true });
    });
    const dates = st.rows.map((r) => r.date).sort();
    return { acct, live, news, haves: live.filter((r) => r.have), canceled: st.rows.filter((r) => r.canceled).length, from: dates[0], to: dates[dates.length - 1] };
  }
  const isCc = (cat) => cat && cat === env.commonCatName();
  function subOpts(r) {
    if (isCc(r.cat)) {
      const cc = env.commonCats() || [];
      return '<option value="">공통 분류 -</option>' + cc.map((c) => (c.s && c.s.length ? c.s : [""]).map((s) => { const v = `${c.n}|${s}`; return `<option value="${esc(v)}"${v === r.sub ? " selected" : ""}>${esc(c.n + (s ? " · " + s : ""))}</option>`; }).join("")).join("");
    }
    const list = r.cat ? env.subs("expense", r.cat).slice() : []; if (r.sub && !list.includes(r.sub)) list.push(r.sub);
    return '<option value="">-</option>' + list.map((s) => `<option${s === r.sub ? " selected" : ""}>${esc(s)}</option>`).join("");
  }
  function render() {
    const v = view();
    let h = `<div class="panel-head"><div><h3>💳 카드 승인내역 올리기</h3><span class="muted small">BC카드 홈페이지·앱의 <b>승인내역</b> 엑셀을 올리면 승인취소는 빼고, 가계부에 아직 없는 것만 지출로 넣어요. 분류는 전에 같은 가게를 적은 대로 골라 둬요.</span></div></div>
      <label class="btn ghost" style="align-self:flex-start;cursor:pointer">📂 승인내역 엑셀 고르기<input type="file" accept=".xls,.xlsx" data-ci="file" hidden></label>`;
    if (v) {
      const cs = cards(), ready = v.news.filter((r) => r.on && r.cat), noCat = v.news.filter((r) => r.on && !r.cat).length;
      h += `<div class="imp-sum"><span>📅 ${esc(v.from)} ~ ${esc(v.to)}</span><span>승인 <b>${st.rows.length}</b></span><span>취소 빠짐 <b>${v.canceled}</b></span><span>이미 있음 <b>${v.haves.length}</b></span><span>새로 <b>${v.news.length}</b></span></div>
        <label class="small">카드 자산 <select data-ci="acct">${cs.map(([id, a]) => `<option value="${esc(id)}"${id === v.acct ? " selected" : ""}>${esc(a.name)}</option>`).join("")}</select></label>`;
      if (v.news.length) {
        h += `<div class="ci-tbl"><div class="ci-row ci-th"><span></span><span>날짜</span><span>가게</span><span>금액</span><span>분류</span><span>소분류</span></div>
          ${v.news.map((r) => `<div class="ci-row${r.on && !r.cat ? " bad" : ""}${r.on ? "" : " off"}"><input type="checkbox" data-ci="on" data-i="${esc(r.i)}"${r.on ? " checked" : ""} aria-label="넣기">
            <span class="mono">${esc(r.date.slice(5))}</span><span class="ci-shop">${esc(r.shop)}${r.parts ? ` <span class="muted small">(${r.parts}건 합)</span> <button type="button" class="ci-mg" data-ci="split" data-g="${esc(r.i)}">나누기</button>` : r.grp && r.first ? ` <button type="button" class="ci-mg" data-ci="join" data-g="${esc(r.grp)}">합치기</button>` : ""}${r.partial ? ' <span class="muted small">(부분취소)</span>' : ""}</span><span class="ci-amt">${esc(won(r.amount))}</span>
            <select data-ci="cat" data-i="${esc(r.i)}" aria-label="분류"><option value="">-</option>${env.cats("expense").map((c) => `<option${c === r.cat ? " selected" : ""}>${esc(c)}</option>`).join("")}</select>
            <select data-ci="sub" data-i="${esc(r.i)}" aria-label="소분류"${r.cat ? "" : " disabled"}>${subOpts(r)}</select></div>`).join("")}</div>
          <div class="row" style="flex:0 0 auto;align-items:center;gap:10px"><button class="btn" type="button" data-ci="go"${st.busy || !ready.length ? " disabled" : ""}>${st.busy ? "기록하는 중…" : `💳 ${ready.length}건 기록하기`}</button>
          ${noCat ? `<span class="small" style="color:var(--danger)">분류를 안 고른 ${noCat}건은 빼고 넣어요</span>` : ""}</div>`;
      } else h += `<p class="small" style="margin:0">✅ 새로 넣을 게 없어요. 다 가계부에 있어요.</p>`;
      if (v.haves.length) h += `<details class="small"><summary>이미 있어서 건너뛰는 ${v.haves.length}건 보기</summary><div class="ci-tbl" style="margin-top:6px">${v.haves.map((r) => `<div class="ci-row ci-have"><span></span><span class="mono">${esc(r.date.slice(5))}</span><span class="ci-shop">${esc(r.shop)}</span><span class="ci-amt">${esc(won(r.amount))}</span><span class="muted">${r.have === "id" ? "전에 올림" : r.have === "same" ? "같은 날 같은 금액" : r.have.startsWith("sum") ? `가계부에 ${r.have.slice(4)}건으로 나눠 적음` : `가계부에 ${r.have.slice(7)}건 합쳐 적음`}</span><span></span></div>`).join("")}</div></details>`;
    }
    root.innerHTML = h;
  }
  root.addEventListener("change", async (e) => {
    const t = e.target, k = t.dataset.ci, i = t.dataset.i;
    if (k === "file" && t.files[0]) {
      try { st.rows = await readCardFile(t.files[0]); st.pick = {}; st.merge = {}; env.toast("승인내역을 읽었어요. 아래에서 확인해 주세요."); }
      catch (err) { env.toast(err.message || "엑셀을 읽지 못했어요."); }
    } else if (k === "acct") st.acct = t.value;
    else if (k === "on") (st.pick[i] ||= {}).on = t.checked;
    else if (k === "cat") { (st.pick[i] ||= {}).cat = t.value; st.pick[i].sub = ""; }
    else if (k === "sub") (st.pick[i] ||= {}).sub = t.value;
    else return;
    render();
  });
  root.addEventListener("click", async (e) => {
    const mg = e.target.closest('[data-ci="join"], [data-ci="split"]');
    if (mg) { st.merge[mg.dataset.g] = mg.dataset.ci === "join"; render(); return; }
    if (!e.target.closest('[data-ci="go"]') || st.busy) return;
    const be = env.backend(), v = view(); if (!be || !v) return;
    const list = v.news.filter((r) => r.on && r.cat); if (!list.length) return;
    if (!confirm(`💳 ${list.length}건 (${won(list.reduce((a, r) => a + r.amount, 0))})을 가계부에 넣을까요?`)) return;
    st.busy = true; render();
    try {
      const p = {}, t0 = Date.now();
      list.slice().sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).forEach((r, n) => {
        const doc = { kind: "expense", amount: r.amount, date: r.date, account: v.acct, cat: r.cat, sub: r.sub || null, memo: "", note: r.shop, cur: null, toAccount: null, createdAt: t0 + n, src: "BC카드", bcNo: (r.nos ? r.nos.join(",") : r.no) || null, common: null, ccat: null, csub: null };
        if (isCc(r.cat)) { const [cc, cs] = (r.sub || "").split("|"); Object.assign(doc, { sub: null, common: true, ccat: cc || null, csub: cs || null }); }
        p[`money/${r.id}`] = doc;
      });
      await be.rootUpdate(p);
      env.toast(`💳 ${list.length}건을 기록했어요.`);
      st.pick = {};
    } catch (err) { env.toast("기록하다가 멈췄어요. 다시 누르면 이미 들어간 건 건너뛰어요."); }
    st.busy = false; render(); env.render();
  });
  return { render };
}
