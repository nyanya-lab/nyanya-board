// 🏥 보험금 챙기기 · 🎯 큰돈 모으기 (냐냐 전용, 2026-10-31) — 📑 보고서 첫 화면 카드 → 화면 (report.js가 그려 줌)
// 🏥 병원비(지출, 소분류에 병원·약국, ❤️ 공통 빼고) 마다 money/{id}/ins = "asked"(청구함) | "got"(받음) | "skip"(청구 안 함), 없으면 아직 표시 안 함. 금액은 안 바꿈.
// 🎯 settings.funds/{id} = {name, goal, saved, date(목표일, 없어도 됨), at} — 통장 잔액과 상관없는 '봉투' 메모. 기록·잔액은 안 건드림.
const ST = { asked: "청구함", got: "받음", skip: "청구 안 함" };
export function mountExtras(env) {
  const { esc, won, S } = env;
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const ui = { per: 3, show: "" };   // 🏥 몇 달 · 보는 상태 ("" = 아직 표시 안 함)
  const fromOf = (n) => { const d = new Date(); return ymd(new Date(d.getFullYear(), d.getMonth() - n + 1, 1)); };
  const isClaim = (x) => x && (x.kind === "expense" || !x.kind) && !x.common && !/공통비용/.test(x.cat || "") && /병원|약국/.test(x.sub || "") && (Number(x.amount) || 0) > 0;
  function claims(from) {
    const out = []; S.money.forEach((x, id) => { if (isClaim(x) && env.isWon(x) && x.date >= from) out.push({ ...x, id }); });
    return out.sort((a, b) => (a.date < b.date ? 1 : -1));
  }
  const total = (l) => l.reduce((t, x) => t + (Number(x.amount) || 0), 0);
  function gotIns(from) { let t = 0; S.money.forEach((x) => { if (x && x.kind === "income" && env.isWon(x) && /보험금/.test(x.cat || "") && x.date >= from) t += Number(x.amount) || 0; }); return t; }

  function claimCard() {
    const l = claims(fromOf(3)), todo = l.filter((x) => !x.ins), asked = l.filter((x) => x.ins === "asked");
    return `<button type="button" class="rpt-card rpt-annual" data-rf="claims"><span class="rpt-cn">🏥 보험금 챙기기 <small class="rpt-badge">기본</small></span>` +
      `<span class="rpt-cp">최근 3달 병원비 · 약값</span>` +
      `<span class="rpt-cv"><small>아직 표시 안 한 병원비</small><b class="won">${won(total(todo))}</b></span>` +
      `<span class="rpt-cc">${todo.length}건 · 청구하고 기다리는 것 ${asked.length}건 ${won(total(asked))}</span></button>`;
  }
  function claimHtml() {
    const from = fromOf(ui.per), all = claims(from), by = (k) => all.filter((x) => (x.ins || "") === k), list = by(ui.show);
    const tile = (k, label) => { const g = by(k); return `<button type="button" class="plan-tile ex-tile${ui.show === k ? " on" : ""}" data-rf="clf" data-k="${k}"><span>${label}</span><b>${won(total(g))}</b><small>${g.length}건</small></button>`; };
    const rows = list.map((x) => `<div class="ex-row"><div class="ex-main"><b>${esc(x.note || x.memo || x.sub)}</b><span class="muted small">${Number(x.date.slice(5, 7))}/${Number(x.date.slice(8))} · ${esc(x.cat || "")} › ${esc(x.sub || "")}</span></div>` +
      `<b class="won ex-amt">${won(x.amount)}</b><div class="ex-btns">${Object.entries(ST).map(([k, n]) => `<button type="button" class="rpt-chip${x.ins === k ? " on" : ""}" aria-pressed="${x.ins === k}" data-rf="cls" data-k="${esc(x.id)}" data-s="${k}">${n}</button>`).join("")}</div></div>`).join("");
    return `<div class="rpt-top"><button type="button" class="btn ghost small" data-rf="back">‹ 보고서</button><h2 class="rpt-title">🏥 보험금 챙기기</h2></div>
      <div class="rpt-chips">${[3, 6, 12].map((n) => `<button type="button" class="rpt-chip${ui.per === n ? " on" : ""}" data-rf="clp" data-k="${n}">최근 ${n}달</button>`).join("")}</div>
      <div class="panel sm-panel">
        <div class="plan-tiles">${tile("", "아직 표시 안 함")}${tile("asked", "청구함")}${tile("got", "받음")}${tile("skip", "청구 안 함")}</div>
        <p class="muted small sm-sub">같은 기간 들어온 보험금 ${won(gotIns(from))} · 받은 금액은 전처럼 🏥보험금 수입으로 적어요. 여기 표시는 병원비 금액을 안 바꿔요.</p>
        <div class="ex-list">${rows || `<p class="muted small" style="margin:0">여기엔 아직 없어요.</p>`}</div>
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
    if (k === "fdel") { const f = (S.settings.funds || {})[v]; if (f && confirm(`'${f.name}' 목표를 지울까요? (기록·잔액은 그대로예요)`)) saveFund({ [v]: null }, "목표를 지웠어요."); return true; }
    return false;
  }
  return { claimCard, claimHtml, fundCard, fundHtml, onClick, onSubmit };
}
