// 🏥 보험금 챙기기 · 🎯 큰돈 모으기 (냐냐 전용, 2026-10-31) — 📑 보고서 첫 화면 카드 → 화면 (report.js가 그려 줌)
// 🏥 병원비(지출, 소분류에 병원·약국, ❤️ 공통 빼고) 마다 money/{id}/ins = "asked"(청구함) | "got"(받음) | "skip"(청구 안 함), 없으면 아직 표시 안 함. 금액은 안 바꿈.
// 🔗 보험금 ↔ 병원비 잇기 (2026-11-01 냐냐 요청): 🏥보험금 수입을 저장하면 고르는 창 #insPick → 수입 money/{id}/insFor/{병원비 id} = true, 병원비 money/{id}/insBy/{수입 id} = true + ins "got".
//    한 보험금에 병원비 여러 건, 병원비 하나에 보험금 여러 건(중복) 다 됨. 이어진 보험금을 지우면 그 병원비는 다시 '청구 전'으로 보임(statusOf). 금액은 안 바꿈.
// 🔔 못 받은 병원비: 최근 3달 청구 전·청구함이 있으면 왼쪽 메뉴 '가계부 설정' 아래 #insSide, 폰은 예산 탭 맨 위 #insPhone (떠 있는 알림이 내용을 가려서 2026-11-01 옮김).
// 🎯 settings.funds/{id} = {name, goal, saved, date(목표일, 없어도 됨), at} — 통장 잔액과 상관없는 '봉투' 메모. 기록·잔액은 안 건드림.
const ST = { asked: "청구함", got: "받음", skip: "청구 안 함" };
export function mountExtras(env) {
  const { esc, won, S } = env;
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const ui = { per: 3, show: "" };   // 🏥 몇 달 · 보는 상태 ("" = 청구 전, "in" = 들어온 보험금)
  // 상태: 이어진 보험금이 살아 있으면 받음. 이어졌던 보험금을 다 지웠으면 표시 없음으로
  const liveBy = (x) => Object.keys(x.insBy || {}).filter((id) => S.money.has(id));
  const statusOf = (x) => liveBy(x).length ? "got" : x.insBy ? "" : (x.ins || "");
  const isIns = (x) => x && x.kind === "income" && /보험금/.test(x.cat || "");
  const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8))}`;
  const fromOf = (n) => { const d = new Date(); return ymd(new Date(d.getFullYear(), d.getMonth() - n + 1, 1)); };
  const isClaim = (x) => x && (x.kind === "expense" || !x.kind) && !x.common && !/공통비용/.test(x.cat || "") && /병원|약국/.test(x.sub || "") && (Number(x.amount) || 0) > 0;
  function claims(from) {
    const out = []; S.money.forEach((x, id) => { if (isClaim(x) && env.isWon(x) && x.date >= from) out.push({ ...x, id }); });
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
  }
  const total = (l) => l.reduce((t, x) => t + (Number(x.amount) || 0), 0);
  function insList(from) { const out = []; S.money.forEach((x, id) => { if (isIns(x) && env.isWon(x) && x.date >= from) out.push({ ...x, id }); }); return out.sort((a, b) => (a.date < b.date ? 1 : -1)); }
  const gotIns = (from) => total(insList(from));

  function claimCard() {
    const l = claims(fromOf(3)), todo = l.filter((x) => !statusOf(x)), asked = l.filter((x) => statusOf(x) === "asked");
    return `<button type="button" class="rpt-card rpt-annual" data-rf="claims"><span class="rpt-cn">🏥 보험금 챙기기 <small class="rpt-badge">기본</small></span>` +
      `<span class="rpt-cp">최근 3달 병원비 · 약값</span>` +
      `<span class="rpt-cv"><small>아직 청구 전인 병원비</small><b class="won">${won(total(todo))}</b></span>` +
      `<span class="rpt-cc">${todo.length}건 · 청구하고 기다리는 것 ${asked.length}건 ${won(total(asked))}</span></button>`;
  }
  function claimHtml() {
    const from = fromOf(ui.per), all = claims(from), by = (k) => all.filter((x) => statusOf(x) === k), list = ui.show === "in" ? [] : by(ui.show), incs = insList(from);
    const tile = (k, label) => { const g = by(k); return `<button type="button" class="plan-tile ex-tile${ui.show === k ? " on" : ""}" data-rf="clf" data-k="${k}"><span>${label}</span><b>${won(total(g))}</b><small>${g.length}건</small></button>`; };
    const rows = list.map((x) => `<div class="ex-row"><div class="ex-main"><b>${esc(x.note || x.memo || x.sub)}</b><span class="muted small">${Number(x.date.slice(5, 7))}/${Number(x.date.slice(8))} · ${esc(x.cat || "")} › ${esc(x.sub || "")}</span></div>` +
      `<b class="won ex-amt">${won(x.amount)}</b><div class="ex-btns">${Object.entries(ST).map(([k, n]) => `<button type="button" class="rpt-chip${statusOf(x) === k ? " on" : ""}" aria-pressed="${statusOf(x) === k}" data-rf="cls" data-k="${esc(x.id)}" data-s="${k}">${n}</button>`).join("")}${liveBy(x).map((id) => { const i = S.money.get(id); return `<button type="button" class="ex-link" data-rf="clo" data-k="${esc(id)}">🔗 ${md(i.date)} 보험금 ${won(i.amount)}</button>`; }).join("")}</div></div>`).join("");
    // 들어온 보험금: 누르면 기록, [잇기]로 병원비 고르기
    const inRows = incs.map((x) => { const f = Object.keys(x.insFor || {}).filter((id) => S.money.has(id)); return `<div class="ex-row"><div class="ex-main"><button type="button" class="ex-open" data-rf="clo" data-k="${esc(x.id)}"><b>${esc(x.memo || x.note || x.sub || "보험금")}</b></button><span class="muted small">${md(x.date)} · ${esc(x.sub || "")}</span></div><b class="won plus ex-amt">${won(x.amount)}</b><div class="ex-btns"><button type="button" class="rpt-chip${f.length ? "" : " on"}" data-rf="cli" data-k="${esc(x.id)}">${f.length ? "고치기" : "병원비 잇기"}</button>${f.map((id) => { const e = S.money.get(id); return `<button type="button" class="ex-link" data-rf="clo" data-k="${esc(id)}">🔗 ${md(e.date)} ${esc(e.note || e.sub || "")} ${won(e.amount)}</button>`; }).join("")}</div></div>`; }).join("");
    return `<div class="rpt-top"><button type="button" class="btn ghost small" data-rf="back">‹ 보고서</button><h2 class="rpt-title">🏥 보험금 챙기기</h2></div>
      <div class="rpt-chips">${[3, 6, 12].map((n) => `<button type="button" class="rpt-chip${ui.per === n ? " on" : ""}" data-rf="clp" data-k="${n}">최근 ${n}달</button>`).join("")}</div>
      <div class="panel sm-panel">
        <div class="plan-tiles ex-tiles">${tile("", "청구 전")}${tile("asked", "청구함")}${tile("got", "받음")}${tile("skip", "청구 안 함")}<button type="button" class="plan-tile ex-tile${ui.show === "in" ? " on" : ""}" data-rf="clf" data-k="in"><span>🔗 들어온 보험금</span><b>${won(total(incs))}</b><small>${incs.filter((x) => !Object.keys(x.insFor || {}).length).length}건 안 이음</small></button></div>
        <p class="muted small sm-sub">같은 기간 들어온 보험금 ${won(gotIns(from))} · 🏥보험금 수입을 저장하면 병원비를 고르는 창이 떠요. 이어도 금액은 안 바뀌어요.</p>
        <div class="ex-list">${(ui.show === "in" ? inRows : rows) || `<p class="muted small" style="margin:0">여기엔 아직 없어요.</p>`}</div>
      </div>`;
  }

  // ---------- 🎯 큰돈 모으기 ----------
  const funds = () => Object.entries(S.settings.funds || {}).filter(([, v]) => v && v.name).sort((a, b) => (a[1].at || 0) - (b[1].at || 0));
  const num = (v) => Number(String(v == null ? "" : v).replace(/[^\d-]/g, "")) || 0;
  function monthsLeft(date) { const d = new Date(), t = new Date(`${date}T00:00:00`); return (t.getFullYear() - d.getFullYear()) * 12 + t.getMonth() - d.getMonth() + 1; }
  const needOf = (v) => { const left = (Number(v.goal) || 0) - (Number(v.saved) || 0); if (left <= 0 || !v.date) return null; const n = monthsLeft(v.date); return n > 0 ? Math.ceil(left / n) : null; };
  function fundCard() {
    const l = funds(), goal = l.reduce((t, [, v]) => t + (Number(v.goal) || 0), 0), saved = l.reduce((t, [, v]) => t + (Number(v.saved) || 0), 0);
    return `<button type="button" class="rpt-card rpt-annual" data-rf="funds"><span class="rpt-cn">🎯 큰돈 모으기 <small class="rpt-badge">기본</small></span>` +
      `<span class="rpt-cp">여행·경조사처럼 한 번에 크게 나갈 돈</span>` +
      (l.length ? `<span class="rpt-cv"><small>모은 돈</small><b class="won">${won(saved)}</b></span><span class="rpt-cc">목표 ${won(goal)} · ${l.length}개</span>`
        : `<span class="rpt-cc">아직 목표가 없어요. 눌러서 만들어요.</span>`) + `</button>`;
  }
  function fundHtml() {
    const rows = funds().map(([id, v]) => {
      const goal = Number(v.goal) || 0, saved = Number(v.saved) || 0, pct = goal ? Math.min(100, Math.round(saved / goal * 100)) : 0, need = needOf(v);
      return `<div class="ex-fund"><div class="ex-fh"><b>${esc(v.name)}</b><span class="muted small">${v.date ? `${esc(v.date.replace(/-/g, "."))}까지` : "날짜 없음"}</span><button type="button" class="icon-btn" data-rf="fdel" data-k="${esc(id)}">지우기</button></div>
        <div class="bar"><i style="width:${pct}%"></i></div>
        <div class="ex-fs"><span><b class="won">${won(saved)}</b> <span class="muted small">/ ${won(goal)} · ${pct}%</span></span>${need ? `<span class="muted small">달마다 ${won(need)}씩 모으면 돼요</span>` : saved >= goal && goal ? `<span class="small">다 모았어요 🎉</span>` : ""}</div>
        <form class="ex-add" data-fadd="${esc(id)}"><input type="text" inputmode="numeric" autocomplete="off" placeholder="금액 (뺄 땐 -)" aria-label="${esc(v.name)} 모은 돈 더하기"><button type="submit" class="btn ghost small">＋ 모으기</button></form></div>`;
    }).join("");
    return `<div class="rpt-top"><button type="button" class="btn ghost small" data-rf="back">‹ 보고서</button><h2 class="rpt-title">🎯 큰돈 모으기</h2></div>
      <div class="panel sm-panel"><p class="muted small sm-sub">통장 잔액과는 따로 적어 두는 메모예요. 기록·잔액은 안 바뀌어요.</p>
        <div class="ex-funds">${rows || `<p class="muted small" style="margin:0">아직 목표가 없어요.</p>`}</div>
        <form class="ex-new" id="fundNew" autocomplete="off"><input type="text" name="n" maxlength="20" placeholder="이름 (예: 내년 여행)" aria-label="이름"><input type="text" name="g" inputmode="numeric" placeholder="목표 금액" aria-label="목표 금액"><input type="date" name="d" aria-label="목표일 (없어도 돼요)"><button type="submit" class="btn small">＋ 추가</button></form>
      </div>`;
  }
  const saveFund = (patch, msg) => { const be = env.backend(); if (be) Promise.resolve(be.saveSettingsDeep({ funds: patch })).then(() => { if (msg) env.toast(msg); }).catch(() => env.toast("저장하지 못했어요.")); };
  // report.js 화면(root)에 붙는 입력칸: ＋ 추가 · ＋ 모으기
  function onSubmit(e) {
    const f = e.target;
    if (f.id === "fundNew") {
      e.preventDefault();
      const name = f.n.value.trim(), goal = num(f.g.value); if (!name || goal <= 0) { env.toast("이름과 목표 금액을 적어 주세요."); return true; }
      const id = "f" + Date.now().toString(36);
      saveFund({ [id]: { name, goal, saved: 0, date: f.d.value || "", at: Date.now() } }, `🎯 ${name} 목표를 만들었어요.`); return true;
    }
    if (f.dataset && f.dataset.fadd) {
      e.preventDefault();
      const id = f.dataset.fadd, v = (S.settings.funds || {})[id], a = num(f.querySelector("input").value); if (!v || !a) return true;
      saveFund({ [id]: { saved: Math.max(0, (Number(v.saved) || 0) + a) } }, "모은 돈을 고쳤어요."); return true;
    }
    return false;
  }
  // report.js 클릭: 처리했으면 true
  async function onClick(k, v, b) {
    if (k === "clf") { ui.show = v; return true; }
    if (k === "clp") { ui.per = Number(v) || 3; return true; }
    if (k === "cls") {
      const x = S.money.get(v), be = env.backend(); if (!x || !be) return true;
      const s = b.dataset.s; await be.update("money", v, { ins: x.ins === s ? null : s }); return true;
    }
    if (k === "clo") { env.editMoney(v); return false; }
    if (k === "cli") { pick(v); return false; }
    if (k === "fdel") { const f = (S.settings.funds || {})[v]; if (f && confirm(`'${f.name}' 목표를 지울까요? (기록·잔액은 그대로예요)`)) saveFund({ [v]: null }, "목표를 지웠어요."); return true; }
    return false;
  }
  // ---------- 🔗 병원비 고르는 창 ----------
  let dlg = null, pk = null;   // pk = { id(보험금), sel:Set, all(이미 받은 것도 보기) }
  function pickHtml() {
    const inc = S.money.get(pk.id), wantDog = /돌돌이/.test(inc.sub || ""), wantMe = /실손/.test(inc.sub || "");
    const from = fromOf(pk.per), l = claims(from).filter((x) => pk.any || !(wantDog || wantMe) || (wantDog ? /돌돌이/.test(x.cat || "") : !/돌돌이/.test(x.cat || "")) || pk.sel.has(x.id));
    const open = l.filter((x) => ["", "asked"].includes(statusOf(x)) || pk.sel.has(x.id)), done = l.filter((x) => !open.includes(x));
    const row = (x) => { const by = liveBy(x).filter((i) => i !== pk.id); return `<label class="ex-pk"><input type="checkbox" data-pk="${esc(x.id)}"${pk.sel.has(x.id) ? " checked" : ""}><span class="ex-main"><b>${esc(x.note || x.memo || x.sub)}</b><span class="muted small">${md(x.date)} · ${esc(x.cat || "")}${by.length ? ` · 이미 보험금 ${by.length}건 이어짐` : ""}</span></span><b class="won">${won(x.amount)}</b></label>`; };
    const sum = claims("2000-01-01").filter((x) => pk.sel.has(x.id)).reduce((t, x) => t + (Number(x.amount) || 0), 0), amt = Number(inc.amount) || 0;
    return `<div class="dlg-head"><h3>🔗 어떤 병원비의 보험금이에요?</h3></div>
      <div class="rpt-ed-body"><div class="rpt-es"><p class="small" style="margin:0">${md(inc.date)} ${esc(inc.sub || "보험금")} <b class="won plus">${won(amt)}</b> · 여러 건 고를 수 있고, 이미 받은 병원비도 또 고를 수 있어요.</p>
        <div class="rpt-chips">${[3, 6, 12, 36].map((n) => `<button type="button" class="rpt-chip${pk.per === n ? " on" : ""}" data-pkp="${n}">최근 ${n}달</button>`).join("")}${wantDog || wantMe ? `<button type="button" class="rpt-chip${pk.any ? " on" : ""}" data-pka="1">${wantDog ? "돌돌이" : "내"} 것만 말고 다 보기</button>` : ""}</div></div>
        <div class="rpt-es"><h4>아직 못 받은 것 (${open.length})</h4><div class="ex-list">${open.map(row).join("") || `<p class="muted small" style="margin:0">없어요.</p>`}</div></div>
        ${done.length ? `<div class="rpt-es"><h4>이미 받았거나 청구 안 한 것 (${done.length})</h4><div class="ex-list">${done.map(row).join("")}</div></div>` : ""}</div>
      <div class="dlg-foot rpt-ed-foot"><span class="small">고른 병원비 ${pk.sel.size}건 <b class="won">${won(sum)}</b>${sum ? ` <span class="muted">· 돌려받은 비율 ${Math.round(amt / sum * 100)}%</span>` : ""}</span><span class="rpt-ed-btns"><button type="button" class="btn ghost" data-pkc="1">건너뛰기</button><button type="button" class="btn" data-pks="1">🔗 잇기</button></span></div>`;
  }
  function pick(id) {
    const inc = S.money.get(id); if (!inc || !isIns(inc)) return;
    if (!dlg) {
      dlg = document.createElement("dialog"); dlg.className = "dlg rpt-dlg"; dlg.id = "insPick"; document.body.appendChild(dlg);
      dlg.addEventListener("change", (e) => { const v = e.target.dataset.pk; if (v == null) return; if (e.target.checked) pk.sel.add(v); else pk.sel.delete(v); draw(); });
      dlg.addEventListener("click", (e) => {
        const b = e.target.closest("button"); if (!b) return;
        if (b.dataset.pkp) { pk.per = Number(b.dataset.pkp); draw(); }
        else if (b.dataset.pka) { pk.any = !pk.any; draw(); }
        else if (b.dataset.pkc) dlg.close();
        else if (b.dataset.pks) savePick();
      });
    }
    const sel = new Set(Object.keys(inc.insFor || {}).filter((x) => S.money.has(x)));
    pk = { id, sel, was: new Set(sel), per: 6, any: false };
    draw(); dlg.showModal();
  }
  function draw() { const top = dlg.querySelector(".rpt-ed-body"), y = top ? top.scrollTop : 0; dlg.innerHTML = pickHtml(); const t = dlg.querySelector(".rpt-ed-body"); if (t) t.scrollTop = y; }
  function savePick() {
    const be = env.backend(); if (!be) return;
    const p = {}, id = pk.id;
    pk.sel.forEach((x) => { if (!pk.was.has(x)) { p[`money/${id}/insFor/${x}`] = true; p[`money/${x}/insBy/${id}`] = true; p[`money/${x}/ins`] = "got"; } });
    pk.was.forEach((x) => { if (!pk.sel.has(x)) { p[`money/${id}/insFor/${x}`] = null; p[`money/${x}/insBy/${id}`] = null; if (!liveBy(S.money.get(x)).some((i) => i !== id)) p[`money/${x}/ins`] = null; } });
    const n = pk.sel.size; dlg.close();
    if (!Object.keys(p).length) return;
    Promise.resolve(be.rootUpdate(p)).then(() => env.toast(n ? `🔗 병원비 ${n}건을 이었어요.` : "이은 걸 풀었어요.")).catch(() => env.toast("저장하지 못했어요."));
  }
  // 💰 기록 창에서 🏥보험금 수입을 저장한 뒤 (money.js E.onMoneySaved)
  function onSaved(id) { setTimeout(() => { const x = S.money.get(id); if (isIns(x)) pick(id); }, 300); }

  // ---------- 🔔 못 받은 병원비: 왼쪽 메뉴 '가계부 설정' 아래 #insSide + 폰은 예산 탭 #insPhone (폰 메뉴는 ≡ 안에 숨어 있어서) ----------
  function renderBar() {
    if (!S.loaded) return;
    const l = claims(fromOf(3)).filter((x) => ["", "asked"].includes(statusOf(x)));
    const html = l.length ? `<span>🏥 못 받은 병원비</span><b>${l.length}건 ${won(total(l))}</b>` : "";
    const side = document.getElementById("insSide"), ph = document.getElementById("insPhone");
    if (side) { side.hidden = !l.length; side.innerHTML = html; }
    if (ph) ph.innerHTML = l.length ? `<button type="button" class="ins-side" data-ins-go="1">${html}<i>›</i></button>` : "";
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest("#insSide, [data-ins-go]")) return;
    const sc = document.querySelector('.scrim[data-act="menuClose"]');
    if (sc && !sc.hidden) sc.click();   // 폰 메뉴가 열려 있으면 닫기
    ui.show = ""; env.openClaims();
  });
  return { claimCard, claimHtml, fundCard, fundHtml, onClick, onSubmit, onSaved, renderBar, pick };
}
