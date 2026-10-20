// 📥 편한가계부 엑셀 가져오기 (냐냐 가계부 전용 — 욱진 보드 짝 코드 아님)
// 편한가계부 → 설정 → 엑셀 내보내기 파일 (.xlsx, 시트 '내역'):
//   날짜(엑셀 날짜 숫자) · 자산 · 분류 · 소분류 · 내용 · 금액(원) · 수입/지출(지출|수입|이체지출|빈칸=잔액수정) · 메모 · 금액 · 화폐
// 바꾸는 규칙:
//   지출 → expense, 수입 → income (마이너스 금액 = 환불·취소, 그대로 마이너스로 둠)
//   이체지출 → move (자산 → 분류에 적힌 자산). 마이너스면 방향을 바꿔서 플러스로
//   잔액수정(분류 '잔액수정', 수입/지출 빈칸) → 기록이 아니라 그 자산의 시작 잔액(accounts.initial)에 더함
//     엑셀엔 금액만 있고 +/−가 안 나오지만 2026-10-21 냐냐 실제 파일로 확인: 30줄 모두 '늘린 것'
//     (닫은 통장들이 +로 볼 때만 정확히 0원으로 끝남). 넣은 합은 accounts.pkAdj에 적어 둬서 다시 눌러도 두 번 안 더해짐
//     [🧮 잔액수정만 넣기] 버튼 = 기록은 안 건드리고 자산 시작 잔액만 (가져오기 버튼도 같이 넣음)
//   분류에 '공통비용'이 들어가면 ❤️ common: true (고를 수 있음)
// 같은 파일을 또 가져와도 겹치지 않게: 기록 id = 줄 내용으로 만든 값 (같은 줄 → 같은 id → 덮어씀)
// 파일은 이 브라우저에서만 읽고, 저장은 지금 열린 보드에만 해요.

const SHEETJS = "https://cdn.sheetjs.com/xlsx-0.20.3/package/xlsx.mjs";
const KIND = { "지출": "expense", "수입": "income", "이체지출": "move" };

// 문자열 → 짧은 해시 (기록 id용)
function hash(s) {
  let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) { const c = s.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(36) + (h1 >>> 0).toString(36);
}
const pad = (n) => String(n).padStart(2, "0");
// 엑셀 날짜 숫자 → YYYY-MM-DD (그 나라 시간 그대로)
function serialDate(v) {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v)) return v.slice(0, 10);
  const n = Number(v); if (!isFinite(n)) return null;
  const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}
// 자산 이름: "신한_110-…" 같은 계좌번호 꼬리 떼기 (고를 수 있음)
export const cleanName = (n) => String(n || "").replace(/_[\d-]{6,}$/, "").trim() || String(n || "");
// 이름으로 종류 짐작 (미리보기에서 바꿀 수 있음)
export function guessType(n) {
  const s = String(n);
  if (/적금|예금|청약|도약|세이프박스|플러스박스|증권|업비트|우리사주|보증금|저축|투자|금\)/.test(s)) return "save";
  if (/^현금$|머니|페이|빌려준|받기/.test(s)) return "cash";
  if (/_[\d-]{6,}$|은행|뱅크|통장|\(\d{6}\)/.test(s)) return "bank";
  if (/^(BC|현대|롯데|국민|삼성|하나|우리|신한|NH|농협|카드)$|카드|현대|롯데|아시아나|대한항공/.test(s)) return "card";
  return "bank";
}

// 📒 공통비용 미정산 엑셀 (냐냐가 따로 관리하던 것): 시트 'YY년 M월…'마다 공통비용 줄 + 정산여부("완료"면 정산됨)
//   → { rows: [{d, a, amt, done}], months: {YYYY-MM: {open, done}}, last: "YYYY-MM"(파일의 가장 늦은 달) }
export async function readSettleFile(file) {
  const XLSX = await import(SHEETJS);
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const list = [], months = {}; let last = null, n = 0, done = 0;
  for (const name of wb.SheetNames) {
    if (!/^\d\d년/.test(name)) continue;
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: "" });
    const head = (rows[0] || []).map((h) => String(h).trim());
    const c = { date: head.indexOf("날짜"), acct: head.indexOf("자산"), amt: head.indexOf("금액(원)") >= 0 ? head.indexOf("금액(원)") : head.indexOf("금액"), st: head.indexOf("정산여부") };
    if (c.date < 0 || c.acct < 0 || c.amt < 0) continue;
    for (const r of rows.slice(1)) {
      if (typeof r[c.date] !== "number") continue;   // 합계·정산 같은 아래 줄은 건너뜀
      const d = serialDate(r[c.date]), ok = c.st >= 0 && String(r[c.st]).trim() === "완료";
      list.push({ d, a: String(r[c.acct]).trim(), amt: Math.round(Number(r[c.amt]) || 0), done: ok });
      const mm = (months[d.slice(0, 7)] = months[d.slice(0, 7)] || { open: 0, done: 0 }); if (ok) mm.done++; else mm.open++;
      n++; if (ok) done++;
      if (!last || d.slice(0, 7) > last) last = d.slice(0, 7);
    }
  }
  if (!n) throw new Error("미정산 엑셀에서 공통비용 줄을 못 찾았어요 ('YY년 M월' 시트에 날짜·자산·금액 칸이 있어야 해요).");
  return { rows: list, months, last, n, done };
}

export async function readFile(file) {
  const XLSX = await import(SHEETJS);
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const ws = wb.Sheets[wb.SheetNames.includes("내역") ? "내역" : wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, defval: "" });
  const head = (rows[0] || []).map((h) => String(h).trim());
  const col = (name) => head.indexOf(name);
  const C = { date: col("날짜"), acct: col("자산"), cat: col("분류"), sub: col("소분류"), title: col("내용"), amt: col("금액(원)") >= 0 ? col("금액(원)") : col("금액"), kind: col("수입/지출"), memo: col("메모"), cur: col("화폐") };
  if (C.date < 0 || C.acct < 0 || C.amt < 0 || C.kind < 0) throw new Error("편한가계부 엑셀 모양이 아니에요 (날짜·자산·금액·수입/지출 칸이 없어요).");
  return { head, C, rows: rows.slice(1).filter((r) => r.length && r[C.date] !== "") };
}

// 읽은 줄 → 가계부 기록 · 자산 · 분류 (opts: strip 계좌번호 떼기, common 공통비용→❤️, types {원래 이름: 종류}, names {원래 이름: 바꿀 이름})
export function convert(parsed, opts) {
  const { C, rows } = parsed;
  const nameOf = (raw) => (opts.names && opts.names[raw]) || (opts.strip ? cleanName(raw) : String(raw));
  const out = { money: {}, accts: {}, adj: {}, cats: { expense: new Set(), income: new Set() }, subs: { expense: {}, income: {} }, skipped: 0, count: { expense: 0, income: 0, move: 0, common: 0, settled: 0, adj: 0 }, from: null, to: null, curSkip: 0 };
  // 미정산 파일이 있으면 공통비용 줄마다 정산여부 찾기:
  //   ① 날짜·자산·금액이 같은 줄 → ② 날짜·자산이 같은 줄(나중에 금액을 고친 것) → ③ 못 찾으면 그 달 상태
  //   (그 달이 파일에서 다 '완료'면 정산됨, 하나라도 미정산이면 미정산, 파일 마지막 달보다 늦으면 미정산, 파일보다 앞이면 정산됨)
  let settledOf = () => false;
  if (opts.settle) {
    const used = new Set(), idx = (keyFn) => { const m = {}; opts.settle.rows.forEach((r, i) => { (m[keyFn(r)] = m[keyFn(r)] || []).push(i); }); return m; };
    const exact = idx((r) => `${r.d}|${r.a}|${r.amt}`), byDA = idx((r) => `${r.d}|${r.a}`);
    const take = (list) => { const i = (list || []).find((j) => !used.has(j)); if (i == null) return null; used.add(i); return opts.settle.rows[i]; };
    const pending = [];   // ②는 ①을 다 한 뒤에 (금액이 같은 줄이 먼저 짝을 찾게)
    settledOf = (date, acctRaw, amount, doc) => {
      const hit = take(exact[`${date}|${acctRaw}|${amount}`]);
      if (hit) return hit.done;
      pending.push({ date, acctRaw, doc });
      return null;
    };
    out.finishSettle = () => {
      for (const p of pending) {
        const hit = take(byDA[`${p.date}|${p.acctRaw}`]);
        const m = p.date.slice(0, 7), ms = opts.settle.months[m];
        const done = hit ? hit.done : ms ? ms.open === 0 : !(opts.settle.last && m > opts.settle.last);
        if (done) { p.doc.settled = true; out.count.settled++; }
      }
    };
  }
  const seen = {};
  const acctId = (raw) => {
    const id = "pk-" + hash("acct|" + raw);
    if (!out.accts[id]) out.accts[id] = { raw, name: nameOf(raw), type: (opts.types && opts.types[raw]) || guessType(raw) };
    return id;
  };
  for (const r of rows) {
    const kindRaw = String(r[C.kind] || "").trim(), kind = KIND[kindRaw];
    if (!kind && !kindRaw && String(r[C.cat] || "").trim() === "잔액수정") {   // 잔액수정 → 그 자산 시작 잔액에 + (위 설명)
      const amt = Math.round(Number(String(r[C.amt]).replace(/[^\d.-]/g, "")) || 0), acctRaw = String(r[C.acct] || "").trim();
      if (!amt || !acctRaw || (C.cur >= 0 && r[C.cur] && String(r[C.cur]).trim() !== "KRW")) { out.skipped++; continue; }
      const id = acctId(acctRaw); out.adj[id] = (out.adj[id] || 0) + amt; out.count.adj++;
      continue;
    }
    if (!kind) { out.skipped++; continue; }
    if (C.cur >= 0 && r[C.cur] && String(r[C.cur]).trim() !== "KRW") { out.curSkip++; continue; }
    const date = serialDate(r[C.date]); if (!date) { out.skipped++; continue; }
    let amount = Math.round(Number(String(r[C.amt]).replace(/[^\d.-]/g, "")) || 0); if (!amount) { out.skipped++; continue; }
    const acctRaw = String(r[C.acct] || "").trim(), catRaw = String(r[C.cat] || "").trim(), sub = String(r[C.sub] || "").trim();
    const title = String(r[C.title] ?? "").trim(), memo = String(r[C.memo] ?? "").trim();
    const key = [r[C.date], acctRaw, kindRaw, amount, catRaw, sub, title, memo].join("|");
    seen[key] = (seen[key] || 0) + 1;   // 똑같은 줄이 여러 개면 몇 번째인지로 구별
    const id = "pk-" + hash(key + "|" + seen[key]);
    let doc;
    if (kind === "move") {
      let from = acctId(acctRaw), to = acctId(catRaw);
      if (amount < 0) { [from, to] = [to, from]; amount = -amount; }
      doc = { kind, amount, date, account: from, toAccount: to, cat: null, sub: null, memo: title, note: memo || null };
    } else {
      doc = { kind, amount, date, account: acctId(acctRaw), cat: catRaw || "기타", sub: sub || null, memo: title, note: memo || null };
      out.cats[kind].add(doc.cat);
      if (sub) { (out.subs[kind][doc.cat] = out.subs[kind][doc.cat] || new Set()).add(sub); }
      if (kind === "expense" && opts.common && /공통비용/.test(catRaw)) {
        doc.common = true; out.count.common++;
        if (settledOf(date, acctRaw, amount, doc) === true) { doc.settled = true; out.count.settled++; }   // 공통 저장소로 처음 복사될 때 정산됨으로
      }
    }
    doc.createdAt = Date.now(); doc.src = "편한가계부";
    out.money[id] = doc; out.count[kind]++;
    if (!out.from || date < out.from) out.from = date;
    if (!out.to || date > out.to) out.to = date;
  }
  if (out.finishSettle) { out.finishSettle(); delete out.finishSettle; }
  return out;
}

// ---------- 화면: 가계부 설정 탭의 '📥 편한가계부 가져오기' ----------
// env = { S, backend(), toast, act, esc, won, render }
const TYPE_LABEL = { bank: "🏦 통장", card: "💳 카드", cash: "💵 현금", save: "🐷 저축" };
export function mountImport(root, env) {
  const st = { parsed: null, settle: null, types: {}, names: {}, strip: true, common: true, busy: false };
  const esc = env.esc;
  const view = () => {
    if (!st.parsed) return null;
    return convert(st.parsed, { strip: st.strip, common: st.common, types: st.types, names: st.names, settle: st.settle });
  };
  function render() {
    const v = view();
    let h = `<div class="panel-head"><div><h3>📥 편한가계부 가져오기</h3><span class="muted small">편한가계부에서 내보낸 엑셀을 고르면 미리 보여 주고, [가져오기]를 눌러야 저장돼요. 파일은 이 브라우저에서만 읽어요.</span></div></div>
      <div class="imp-files">
        <label class="f">① 편한가계부 엑셀 (.xlsx)<input type="file" accept=".xlsx,.xls" data-imp="file"></label>
        <label class="f">② (선택) 공통비용 미정산 엑셀 — 정산된 것 표시용<input type="file" accept=".xlsx,.xls" data-imp="settle"></label>
      </div>`;
    if (st.settle) h += `<p class="small muted" style="margin:0">📒 미정산 파일: 공통비용 ${st.settle.n}줄 (정산 완료 ${st.settle.done}줄) · 마지막 달 ${esc(st.settle.last)} — 그 뒤 공통비용은 미정산으로 봐요.</p>`;
    if (v) {
      const accts = Object.values(v.accts).sort((a, b) => a.raw.localeCompare(b.raw));
      const useCount = {}; Object.values(v.money).forEach((d) => { [d.account, d.toAccount].forEach((id) => { if (id) useCount[id] = (useCount[id] || 0) + 1; }); });
      h += `<div class="imp-sum">
          <span>📅 ${esc(v.from)} ~ ${esc(v.to)}</span>
          <span>지출 <b>${v.count.expense.toLocaleString()}</b></span><span>수입 <b>${v.count.income.toLocaleString()}</b></span><span>이체 <b>${v.count.move.toLocaleString()}</b></span>
          <span>❤️ 공통 <b>${v.count.common.toLocaleString()}</b>${st.settle ? ` (정산됨 ${v.count.settled.toLocaleString()} · 미정산 ${(v.count.common - v.count.settled).toLocaleString()})` : ""}</span>
          <span>🧮 잔액수정 <b>${v.count.adj.toLocaleString()}</b></span>
          ${v.skipped || v.curSkip ? `<span class="muted">건너뜀 ${v.skipped}${v.curSkip ? ` · 원화 아닌 것 ${v.curSkip}` : ""}</span>` : ""}
        </div>`;
      const adjList = Object.entries(v.adj);
      if (adjList.length) {
        const bal = env.balances ? env.balances() : {};
        const todo = adjList.filter(([id, sum]) => !env.S.accounts.has(id) || (Number(env.S.accounts.get(id).pkAdj) || 0) !== sum);
        h += `<div class="imp-adj"><b>🧮 잔액수정 (자산 ${adjList.length}개)</b> <span class="small muted">— 기록이 아니라 그 자산의 시작 잔액에 더해요. 편한가계부에서 잔액을 고친 만큼이에요.</span>
          <div class="small" style="display:grid;gap:2px;margin:6px 0">${adjList.sort((a, b) => v.accts[a[0]].name.localeCompare(v.accts[b[0]].name)).map(([id, sum]) => {
            const a = env.S.accounts.get(id), prev = a ? Number(a.pkAdj) || 0 : 0, now = bal[id] || 0;
            return `<span>${esc(v.accts[id].name)} <b>+${esc(env.won(sum))}</b> <span class="muted">${!a ? "(새 자산)" : prev === sum ? "✅ 이미 넣음" : `지금 ${esc(env.won(now))} → ${esc(env.won(now - prev + sum))}`}</span></span>`;
          }).join("")}</div>
          <div class="row" style="flex:0 0 auto;align-items:center"><button class="btn ghost" type="button" data-imp="adj"${st.busy || !todo.length ? " disabled" : ""}>${todo.length ? `🧮 잔액수정만 넣기 (자산 ${todo.length}개)` : "✅ 잔액수정 다 넣었어요"}</button>
          <span class="small muted">기록은 안 건드려요. 🧮 실제 잔액 맞추기로 이미 맞춘 자산은 넣은 뒤 다시 맞춰 주세요.</span></div></div>`;
      }
      h += `
        <div class="imp-opts">
          <label><input type="checkbox" data-imp="strip"${st.strip ? " checked" : ""}> 자산 이름에서 계좌번호 떼기</label>
          <label><input type="checkbox" data-imp="common"${st.common ? " checked" : ""}> 💙 공통비용 → ❤️ 공통 (욱진이와 같이 보기)</label>
        </div>
        <h4 class="imp-h">자산 ${accts.length}개 — 종류와 이름을 맞춰 주세요</h4>
        <div class="imp-accts">${accts.map((a) => {
          const id = Object.keys(v.accts).find((k) => v.accts[k] === a), have = env.S.accounts.has(id);
          return `<div class="imp-acct"><input type="text" value="${esc(a.name)}" data-imp-name="${esc(a.raw)}" aria-label="자산 이름" maxlength="30">
            <select data-imp-type="${esc(a.raw)}">${Object.entries(TYPE_LABEL).map(([k, l]) => `<option value="${k}"${k === a.type ? " selected" : ""}>${l}</option>`).join("")}</select>
            <span class="small muted">${useCount[id] || 0}건${have ? " · 이미 있음" : ""}</span></div>`;
        }).join("")}</div>
        <p class="small muted" style="margin:0">잔액수정도 같이 넣어요. 그래도 실제와 다른 자산은 자산 탭 🧮 실제 잔액 맞추기로 맞추고, 카드는 결제일을 정해 주세요. 같은 파일을 다시 가져와도 같은 줄은 덮어써서 두 번 생기지 않아요.</p>
        <div class="row" style="flex:0 0 auto;align-items:center"><button class="btn" type="button" data-imp="go"${st.busy ? " disabled" : ""}>${st.busy ? "가져오는 중…" : `가져오기 (${(v.count.expense + v.count.income + v.count.move).toLocaleString()}건)`}</button></div>`;
    }
    root.innerHTML = h;
  }
  root.addEventListener("change", async (e) => {
    const t = e.target, k = t.dataset.imp;
    try {
      if (k === "file" && t.files[0]) { st.parsed = await readFile(t.files[0]); st.types = {}; st.names = {}; env.toast("엑셀을 읽었어요. 아래에서 확인해 주세요."); }
      else if (k === "settle" && t.files[0]) { st.settle = await readSettleFile(t.files[0]); env.toast("미정산 엑셀을 읽었어요."); }
      else if (k === "strip") { st.strip = t.checked; st.names = {}; }
      else if (k === "common") st.common = t.checked;
      else if (t.dataset.impType) st.types[t.dataset.impType] = t.value;
      else if (t.dataset.impName) st.names[t.dataset.impName] = t.value.trim();
      else return;
    } catch (err) { env.toast(err.message || "엑셀을 읽지 못했어요."); return; }
    render();
  });
  // 잔액수정 → 자산 시작 잔액: 지난번에 넣은 합(pkAdj)은 빼고 새 합을 더함 → 몇 번 눌러도 한 번만 더한 셈
  //   없는 자산은 새로 만듦 (시작 잔액 = 잔액수정 합)
  function adjPatch(v, patch, order) {
    let n = 0;
    for (const [id, sum] of Object.entries(v.adj)) {
      const a = env.S.accounts.get(id);
      if (!a) { const x = v.accts[id]; patch[`accounts/${id}`] = { name: x.name, type: x.type, initial: sum, pkAdj: sum, createdAt: order.n++, src: "편한가계부" }; n++; continue; }
      const prev = Number(a.pkAdj) || 0; if (prev === sum) continue;
      patch[`accounts/${id}/initial`] = (Number(a.initial) || 0) - prev + sum;
      patch[`accounts/${id}/pkAdj`] = sum; n++;
    }
    return n;
  }
  root.addEventListener("click", async (e) => {
    if (e.target.closest('[data-imp="adj"]') && !st.busy) {
      const be = env.backend(), v = view(); if (!be || !v) return;
      const patch = {}, n = adjPatch(v, patch, { n: Date.now() });
      if (!n) { env.toast("잔액수정은 이미 다 넣었어요."); return; }
      if (!confirm(`잔액수정 ${v.count.adj}줄을 자산 ${n}개의 시작 잔액에 더할까요? (기록은 안 건드려요)`)) return;
      st.busy = true; render();
      try { await be.rootUpdate(patch); env.toast(`🧮 자산 ${n}개에 잔액수정을 넣었어요.`); }
      catch (err) { env.toast("저장하지 못했어요. 인터넷 연결을 확인하고 다시 눌러 주세요."); }
      st.busy = false; render(); env.render();
      return;
    }
    if (!e.target.closest('[data-imp="go"]') || st.busy) return;
    const be = env.backend(), v = view(); if (!be || !v) return;
    const n = v.count.expense + v.count.income + v.count.move;
    if (!confirm(`${n.toLocaleString()}건을 가계부에 넣을까요? (자산 ${Object.keys(v.accts).length}개도 같이 만들어요)`)) return;
    st.busy = true; render();
    try {
      const S = env.S, patch = {};
      // 자산: 없는 것만 새로 (이미 있는 건 이름·잔액을 건드리지 않음)
      const order = { n: Date.now() };
      adjPatch(v, patch, order);   // 잔액수정 있는 자산 먼저 (새 자산이면 시작 잔액 = 잔액수정 합)
      for (const [id, a] of Object.entries(v.accts)) if (!S.accounts.has(id) && !patch[`accounts/${id}`]) patch[`accounts/${id}`] = { name: a.name, type: a.type, initial: 0, createdAt: order.n++, src: "편한가계부" };
      // 분류·소분류: 지금 목록 뒤에 없는 것만 더함
      const cats = S.settings.moneyCats || {};
      for (const kind of ["expense", "income"]) {
        const cur = (cats[kind] && cats[kind].length ? cats[kind] : env.defaultCats(kind)).slice();
        for (const c of v.cats[kind]) if (!cur.includes(c)) cur.push(c);
        patch[`settings/moneyCats/${kind}`] = cur;
        for (const [cat, subs] of Object.entries(v.subs[kind])) {
          const ck = env.catKey(cat), have = ((S.settings.moneySubs || {})[kind] || {})[ck];
          const list = Array.isArray(have) ? have.slice() : have && typeof have === "object" ? Object.values(have) : [];
          for (const s of subs) if (!list.includes(s)) list.push(s);
          patch[`settings/moneySubs/${kind}/${ck}`] = list;
        }
      }
      await be.rootUpdate(patch);
      // 기록: 500건씩
      const ids = Object.keys(v.money);
      for (let i = 0; i < ids.length; i += 500) {
        const p = {}; ids.slice(i, i + 500).forEach((id) => { p[`money/${id}`] = v.money[id]; });
        await be.rootUpdate(p);
      }
      env.toast(`📥 ${n.toLocaleString()}건을 가져왔어요!`);
      st.parsed = null; st.settle = null;
    } catch (err) { env.toast("가져오다가 멈췄어요. 인터넷 연결을 확인하고 다시 눌러 주세요 (이미 들어간 건 겹치지 않아요)."); }
    st.busy = false; render(); env.render();
  });
  render();
}
