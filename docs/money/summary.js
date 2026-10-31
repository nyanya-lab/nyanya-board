// 📝 이번 달 정리 (냐냐 전용) — API 없이 가계부 숫자로 문장을 만듦 (2026-10-29)
// 둘 다 씀: 예산 탭 '한 달 예산' 아래 #sumPanel = 한 줄 + [자세히 ›](env.openReport) · 📑 보고서 탭 '📝 월간 정리' 카드·화면 = full(m)·card(m)
// 고른 달(예산 탭 달 넘기기)을 지난달·평소(앞 12달 평균, 기록 있는 달만)와 비교. 이번 달이면 오늘 날짜까지만, 비교하는 달도 같은 날짜까지.
// 💑 내 몫 보기면 money.js monthTotals와 같게 공통비용 절반·욱진입금 뺌 (env.cntAmt). 데이터는 안 바꿈.
export function mountSummary(root, env) {
  const { esc, won, S } = env;
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const shift = (m, k) => { const [y, mo] = m.split("-").map(Number), d = new Date(y, mo - 1 + k, 1); return ymd(d).slice(0, 7); };
  const lastDay = (m) => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo, 0).getDate(); };
  const rangeOf = (m, day) => ({ from: `${m}-01`, to: `${m}-${String(Math.min(day, lastDay(m))).padStart(2, "0")}` });
  const man = (n) => { const a = Math.abs(Math.round(n)); return a >= 100000 ? `${Math.round(a / 10000).toLocaleString()}만` : won(a); };
  const diffTxt = (d, unit = "") => Math.abs(d) < 10000 ? "비슷" : `${man(d)} ${d > 0 ? "더" : "덜"}${unit}`;
  const label = (x) => x.note || x.memo || x.sub || x.cat || "";

  // 그 기간 기록: 분류별 지출(r.byCat, 💑 반영) + 지출 기록 목록(큰 순) + 저축 통장으로 넘긴 돈
  function take(range) {
    const r = env.monthTotals(null, range), list = [];
    let save = 0, food = 0, foodN = 0, taxi = 0, taxiN = 0;
    const typeOf = (id) => ((S.accounts.get(id) || {}).type);
    r.items.forEach((x) => {
      if (!env.isWon(x)) return;
      if (x.kind === "move") {
        const f = typeOf(x.account) === "save", t = typeOf(x.toAccount) === "save", a = Number(x.amount) || 0;
        if (t && !f) save += a; else if (f && !t) save -= a;
      } else if (x.kind === "expense" || !x.kind) {
        list.push({ ...x, amt: env.cntAmt(x) });
        const a = Number(x.amount) || 0;
        if ((x.common || /공통비용/.test(x.cat || "")) && /식비/.test(x.ccat || "") && /외식|배달/.test(x.csub || "")) { food += a / 2; if (a > 0) foodN++; }   // 늘 내 몫(반)으로
        if (/택시/.test(x.sub || "")) { taxi += a; if (a > 0) taxiN++; }
      }
    });
    list.sort((a, b) => b.amt - a.amt);
    return { exp: r.exp, inc: r.inc, byCat: r.byCat, list, save, food, foodN, taxi, taxiN };
  }

  function build(m) {
    const t = ymd(new Date()), cur = t.slice(0, 7), now = m === cur, day = now ? Number(t.slice(8)) : 31;
    if (m > cur) return { empty: `${Number(m.slice(5))}월은 아직 안 왔어요. 지난달 정리는 ‹ 이전 달에서 볼 수 있어요.` };
    const me = take(rangeOf(m, day)), prev = take(rangeOf(shift(m, -1), day));
    const past = []; for (let k = 1; k <= 12; k++) { const p = take(rangeOf(shift(m, -k), day)); if (p.exp > 0) past.push(p); }
    if (!me.exp && !me.inc) return { empty: "이 달은 아직 기록이 없어요." };
    const n = past.length || 1, avgExp = past.reduce((s, p) => s + p.exp, 0) / n;
    const cats = new Set(Object.keys(me.byCat)); past.forEach((p) => Object.keys(p.byCat).forEach((c) => cats.add(c)));
    const rows = [...cats].map((c) => { const avg = past.reduce((s, p) => s + (p.byCat[c] || 0), 0) / n, v = me.byCat[c] || 0; return { c, v, avg, d: v - avg }; });
    const big = (c) => me.list.find((x) => (x.cat || "기타") === c);
    // 평소 합이 마이너스인 분류(👩🏻엄마처럼 받는 돈이 더 많은 곳)는 비교에서 뺌
    const up = rows.filter((x) => x.avg >= 0 && x.d >= 30000 && x.d >= x.avg * 0.2).sort((a, b) => b.d - a.d).slice(0, 3);
    const down = rows.filter((x) => x.avg > 0 && -x.d >= 30000 && -x.d >= x.avg * 0.2).sort((a, b) => a.d - b.d).slice(0, 3);
    const pl = env.planOf(m), over = pl.items.map((v) => ({ c: v.cat, amt: v.show, used: me.byCat[v.cat] || 0 })).filter((v) => v.used > v.amt && v.amt > 0).sort((a, b) => (b.used - b.amt) - (a.used - a.amt));
    const avgOf = (k) => past.reduce((t, p) => t + p[k], 0) / n;
    return { m, now, day, me, prev, avgExp, n, up, down, big, pl, over, avgFood: avgOf("food"), avgFoodN: avgOf("foodN"), avgTaxiN: avgOf("taxiN"), range: rangeOf(m, day) };
  }

  // 🏦 순자산: 자산 탭 합계와 같게 (숨긴 자산·공동 빼고, 카드값은 마이너스)
  function netWorth(s) {
    const accts = env.sortedAccts().filter((a) => !a.joint), sum = (b) => accts.reduce((t, a) => t + (b[a.id] || 0), 0);
    const now = sum(env.balances(s.range.to)), prevEnd = `${shift(s.m, -1)}-${String(lastDay(shift(s.m, -1))).padStart(2, "0")}`;
    return { now, d: now - sum(env.balances(prevEnd)) };
  }
  const headline = (s) => { const d = s.me.exp - s.avgExp; return Math.abs(d) < 10000 ? "평소랑 비슷하게 썼어요." : d < 0 ? `평소보다 <b class="sm-good">${man(d)} 덜</b> 썼어요 👍` : `평소보다 <b class="sm-bad">${man(d)} 더</b> 썼어요.`; };
  const subOf = (s) => { const mon = Number(s.m.slice(5)); return `${s.now ? `${mon}월 1일~${s.day}일 · 지난달·평소도 ${s.day}일까지로 비교` : `지난달 · 평소(앞 ${s.n}달 평균)와 비교`}${env.mineOn() ? " · 💑 내 몫 기준" : ""}`; };
  function html(s) {
    const b = [];
    const dAvg = s.me.exp - s.avgExp, dPrev = s.me.exp - s.prev.exp;
    b.push(headline(s) + ` <span class="muted">(평소 ${man(s.avgExp)} · 지난달 ${man(s.prev.exp)}보다 ${diffTxt(dPrev)})</span>`);
    if (s.up.length) b.push(`<b>평소보다 많이 쓴 곳</b><ul>${s.up.map((x) => { const g = s.big(x.c); return `<li>${esc(x.c)} <b>${man(x.v)}</b> <span class="sm-bad">+${man(x.d)}</span>${g ? ` <span class="muted">· 제일 큰 건 ${esc(label(g))} ${man(g.amt)}</span>` : ""}</li>`; }).join("")}</ul>`);
    if (s.down.length) b.push(`<b>평소보다 덜 쓴 곳</b><ul>${s.down.map((x) => `<li>${esc(x.c)} <b>${man(x.v)}</b> <span class="sm-good">−${man(x.d)}</span></li>`).join("")}</ul>`);
    if (s.pl.items.length) {
      const pct = s.pl.total ? Math.round(s.me.exp / s.pl.total * 100) : 0, time = s.now ? Math.round(s.day / lastDay(s.m) * 100) : 100;
      b.push(`<b>예산</b> ${man(s.pl.total)} 중 <b>${pct}%</b> 씀${s.now ? ` <span class="muted">(한 달의 ${time}% 지남)</span>` : ""}` +
        (s.over.length ? `<ul>${s.over.map((v) => `<li>${esc(v.c)} <span class="sm-bad">${man(v.used - v.amt)} 초과</span> <span class="muted">(${man(v.used)} / ${man(v.amt)})</span></li>`).join("")}</ul>` : ` · 분류마다 예산 안이에요 👍`));
    }
    if (s.me.list.length) b.push(`<b>큰 지출</b><ul>${s.me.list.slice(0, 3).map((x) => `<li>${esc(label(x))} <b>${man(x.amt)}</b> <span class="muted">· ${esc(x.cat || "")} · ${Number(x.date.slice(5, 7))}/${Number(x.date.slice(8))}</span></li>`).join("")}</ul>`);
    if (s.me.food || s.me.foodN) b.push(`🍽️ 같이 먹은 외식·배달 <b>${man(s.me.food)}</b> (내 몫, ${s.me.foodN}번) <span class="muted">· 평소 ${man(s.avgFood)}, ${Math.round(s.avgFoodN)}번</span>`);
    if (s.me.taxiN) b.push(`🚖 택시 <b>${s.me.taxiN}번</b> ${man(s.me.taxi)} <span class="muted">· 평소 ${Math.round(s.avgTaxiN)}번</span>`);
    b.push(s.me.save > 0 ? `💰 저축·투자 통장으로 <b class="sm-good">${man(s.me.save)}</b> 넘겼어요.` : s.me.save < 0 ? `💰 저축·투자 통장에서 <b>${man(s.me.save)}</b> 꺼내 썼어요.` : `💰 이번 달은 저축 통장으로 넘긴 돈이 아직 없어요.`);
    const nw = netWorth(s);
    b.push(`🏦 순자산 <b>${nw.now < 0 ? "−" : ""}${man(nw.now)}</b> <span class="muted">· 지난달 끝보다</span> ${Math.abs(nw.d) < 10000 ? "비슷" : `<b class="${nw.d > 0 ? "sm-good" : "sm-bad"}">${man(nw.d)} ${nw.d > 0 ? "늘었어요" : "줄었어요"}</b>`} <span class="muted">(🙈 숨긴 자산·🤝 공동 빼고)</span>`);
    const left = s.me.inc - s.me.exp;
    return `<p class="muted small sm-sub">${subOf(s)}</p>
      <div class="plan-tiles sm-tiles">
        <div class="plan-tile"><span>쓴 돈</span><b>${won(s.me.exp)}</b><small>평소보다 ${diffTxt(dAvg)}</small></div>
        <div class="plan-tile"><span>들어온 돈</span><b>${won(s.me.inc)}</b><small>지난달 ${man(s.prev.inc)}</small></div>
        <div class="plan-tile${left < 0 ? " minus" : " left"}"><span>남은 돈</span><b>${left < 0 ? "-" : ""}${won(left)}</b><small>들어온 돈 − 쓴 돈</small></div>
        <div class="plan-tile"><span>저축으로</span><b>${s.me.save < 0 ? "-" : ""}${won(s.me.save)}</b><small>저축·투자 통장으로 넘긴 돈</small></div>
      </div>
      <div class="sm-list">${b.map((x) => `<div class="sm-li">${x}</div>`).join("")}</div>`;
  }

  // 📑 보고서 화면 (월간 정리)
  function full(m) { const s = build(m); return s.empty ? `<p class="muted">${esc(s.empty)}</p>` : html(s); }
  // 📑 보고서 첫 화면 카드: 쓴 돈 + 한 줄
  function card(m) { const s = build(m); return s.empty ? { exp: 0, line: s.empty } : { exp: s.me.exp, line: headline(s).replace(/<[^>]+>/g, "") }; }
  // 💰 저축 목표: settings.saveGoals[월] = 금액, 안 정한 달은 그 전 가장 가까운 달 것 (예산처럼 이어짐)
  function goalOf(m) {
    const all = S.settings.saveGoals || {}, ks = Object.keys(all).filter((k) => k <= m && all[k] != null).sort();
    return ks.length ? Number(all[ks[ks.length - 1]]) || 0 : 0;
  }
  function saveRow(m) {
    const goal = goalOf(m), t = ymd(new Date()), now = m === t.slice(0, 7);
    if (m > t.slice(0, 7) && !goal) return `<div class="sm-goal"><b class="sm-t">💰 저축 목표</b><input type="text" inputmode="numeric" id="smGoal" placeholder="금액 (원)" aria-label="저축 목표"></div>`;
    const moved = m > t.slice(0, 7) ? 0 : take(rangeOf(m, now ? Number(t.slice(8)) : 31)).save, pct = goal ? Math.max(0, Math.min(100, Math.round(moved / goal * 100))) : 0;
    const inc = env.planOf(m), rest = inc.income - inc.total - goal;
    return `<div class="sm-goal"><b class="sm-t">💰 저축 목표</b><input type="text" inputmode="numeric" id="smGoal" value="${goal ? goal.toLocaleString() : ""}" placeholder="금액 (원)" aria-label="저축 목표">` +
      `<span class="sm-txt">${esc(String(Number(m.slice(5))))}월에 넘긴 돈 <b>${moved < 0 ? "−" : ""}${won(moved)}</b>${goal ? ` · ${moved >= goal ? `<b class="sm-good">목표 달성 🎉</b>` : `${man(goal - moved)} 남음`}` : ""}${goal && inc.items.length ? ` <span class="muted">· 예산대로 쓰고 저축하면 ${rest < 0 ? `<span class="sm-bad">${man(rest)} 모자라요</span>` : `${man(rest)} 남아요`}</span>` : ""}</span>` +
      (goal ? `<div class="bar sm-bar"><i style="width:${pct}%"></i></div>` : "") + `</div>`;
  }
  // 📅 오늘 쓸 수 있는 돈 (이번 달·예산 있을 때만): (예산 − 예산 분류에 쓴 돈 − 아직 안 나간 고정비) ÷ 남은 날(오늘 포함)
  // 고정비 = 🔁 매월 반복 중 이번 달 아직 안 만들어진 지출(예산 분류만) + 지난달 소분류 '이자' 중 이번 달 아직 없는 것
  function pendingFixed(m, planned) {
    let t = 0; const day = Number(ymd(new Date()).slice(8));
    Object.values(S.settings.moneyRepeat || {}).forEach((r) => { if (r && (r.kind || "expense") === "expense" && planned.has(r.cat) && !(r.made || {})[m] && (!r.from || r.from <= m) && (Number(r.day) || 1) >= day) t += Number(r.amount) || 0; });
    const prevM = shift(m, -1); let was = 0, has = false;
    S.money.forEach((x) => { if (!x || x.sub !== "이자" || x.kind !== "expense" || !planned.has(x.cat)) return; const mm = (x.date || "").slice(0, 7); if (mm === prevM) was += Number(x.amount) || 0; else if (mm === m) has = true; });
    return t + (has ? 0 : was);
  }
  function daily(m) {   // 그 달 기록이 아직 없어도 보임
    const t = ymd(new Date()), day = Number(t.slice(8)), pl = env.planOf(m); if (m !== t.slice(0, 7) || !pl.items.length) return "";
    const byCat = env.monthTotals(m).byCat, planned = new Set(pl.items.map((v) => v.cat)), used = [...planned].reduce((a, c) => a + (byCat[c] || 0), 0), fixed = pendingFixed(m, planned), days = lastDay(m) - day + 1, left = pl.total - used - fixed;
    return `<div class="sm-line sm-day"><b class="sm-t">📅 오늘 쓸 수 있는 돈</b><span class="sm-txt">${left > 0 ? `하루 <b class="sm-big">${won(Math.floor(left / days))}</b>` : `<b class="sm-bad">이번 달 예산을 다 썼어요</b>`} <span class="muted">· 남은 예산 ${left < 0 ? "−" : ""}${man(left)} (곧 나갈 고정비 ${man(fixed)} 뺌) ÷ ${days}일</span></span></div>`;
  }
  // 💰 예산 탭: 오늘 쓸 돈 · 저축 목표 · 한 줄 + 자세히 ›
  function render() {
    const m = env.month();
    if (!m || !S.loaded) return;
    const s = build(m), mon = Number(m.slice(5));
    let line = s.empty ? esc(s.empty) : headline(s);
    if (!s.empty && s.pl.items.length) line += ` <span class="muted">· 예산 ${s.pl.total ? Math.round(s.me.exp / s.pl.total * 100) : 0}% 씀${s.over.length ? ` · <span class="sm-bad">${s.over.length}개 분류 초과</span>` : ""}</span>`;
    if (root.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;   // 저축 목표를 적는 중엔 안 그림
    root.innerHTML = daily(m) + saveRow(m) + `<div class="sm-line"><b class="sm-t">📝 ${mon}월 정리</b><span class="sm-txt">${line}</span>${s.empty ? "" : `<button type="button" class="btn ghost small" data-sm="more">자세히 ›</button>`}</div>`;
  }
  root.addEventListener("click", (e) => { if (e.target.closest("[data-sm='more']")) env.openReport(env.month()); });
  root.addEventListener("change", (e) => {
    if (e.target.id !== "smGoal") return;
    const be = env.backend(), n = Number(String(e.target.value).replace(/[^\d]/g, "")) || 0, m = env.month(); if (!be) return;
    e.target.blur();
    Promise.resolve(be.saveSettingsDeep({ saveGoals: { [m]: n } })).then(() => env.toast(`💰 ${Number(m.slice(5))}월부터 저축 목표 ${won(n)}`)).catch(() => env.toast("저장하지 못했어요."));
  });
  return { render, full, card };
}
