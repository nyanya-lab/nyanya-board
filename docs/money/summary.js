// 📝 이번 달 정리 (냐냐 전용) — API 없이 가계부 숫자로 문장을 만듦 (2026-10-29)
// 둘 다 씀: 예산 탭 '한 달 예산' 아래 #sumPanel = 한 줄 + [자세히 ›](env.openReport) · 📑 보고서 탭 '📝 월간 정리' 카드·화면 = full(m)·card(m)
// 고른 달(예산 탭 달 넘기기)을 지난달과 비교 (2026-11-05 전엔 평소 = 앞 12달 평균도). 이번 달이면 오늘 날짜까지만, 지난달도 같은 날짜까지.
// 화면: 쓴 돈 칸 4개 → 한 줄 → 왼쪽 분류별 차이 막대(diverge) · 오른쪽 예산·큰 지출·외식·택시·저축·순자산 (폰은 위아래)
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
        if (x.recvTo || x.recvOf) return;   // 🤲 대신 낸 돈은 내 지출 아님 (합계는 짝과 합쳐 0)
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
    if (!me.exp && !me.inc) return { empty: "이 달은 아직 기록이 없어요." };
    // 분류마다 이번 달 vs 지난달 (2026-11-05 냐냐: 평소 말고 지난달과, 차이 큰 순 — 더 쓴 곳 위, 덜 쓴 곳 아래)
    const cats = new Set([...Object.keys(me.byCat), ...Object.keys(prev.byCat)]);
    const rows = [...cats].map((c) => { const v = me.byCat[c] || 0, p = prev.byCat[c] || 0; return { c, v, p, d: v - p }; })
      .filter((x) => Math.round(x.v) || Math.round(x.p)).sort((a, b) => b.d - a.d);
    const pl = env.planOf(m), over = pl.items.map((v) => ({ c: v.cat, amt: v.show, used: me.byCat[v.cat] || 0 })).filter((v) => v.used > v.amt && v.amt > 0).sort((a, b) => (b.used - b.amt) - (a.used - a.amt));
    return { m, now, day, me, prev, rows, pl, over, range: rangeOf(m, day) };
  }

  // 🏦 순자산: 자산 탭 합계와 같게 (숨긴 자산·공동 빼고, 카드값은 마이너스)
  function netWorth(s) {
    const accts = env.sortedAccts().filter((a) => !a.joint), sum = (b) => accts.reduce((t, a) => t + (b[a.id] || 0), 0);
    const now = sum(env.balances(s.range.to)), prevEnd = `${shift(s.m, -1)}-${String(lastDay(shift(s.m, -1))).padStart(2, "0")}`;
    return { now, d: now - sum(env.balances(prevEnd)) };
  }
  // 모두 지난달과 비교 (2026-11-05 냐냐: 평소 말고 지난달), 지난달 기록이 없으면 이번 달만
  const headline = (s) => {
    if (!(s.prev.exp > 0)) return `지난달 기록이 없어서 비교할 게 없어요.`;
    const d = s.me.exp - s.prev.exp;
    return Math.abs(d) < 10000 ? `지난달이랑 비슷하게 썼어요.` : d < 0 ? `지난달보다 <b class="sm-good">${man(d)} 덜</b> 썼어요 👍` : `지난달보다 <b class="sm-bad">${man(d)} 더</b> 썼어요.`;
  };
  const subOf = (s) => { const mon = Number(s.m.slice(5)); return `${s.now ? `${mon}월 1일~${s.day}일 · 지난달도 ${s.day}일까지로 비교` : `지난달과 비교`}${env.mineOn() ? " · 💑 내 몫 기준" : ""}`; };
  const val = (n) => (n < 0 ? "−" : "") + man(n);
  const vsPrev = (prev) => `<span class="muted">· 지난달 ${val(prev)}</span>`;
  // 📊 분류마다 차이 막대 (가운데 선 기준 오른쪽 빨강 = 더 씀, 왼쪽 초록 = 덜 씀) — 냐냐 고름: 시안 C-2 + C-4
  function diverge(s) {
    const mon = Number(s.m.slice(5)), pm = Number(shift(s.m, -1).slice(5)), mx = Math.max(10000, ...s.rows.map((x) => Math.abs(x.d)));
    const bar = (d) => {
      const w = Math.round(Math.abs(d) / mx * 60), t = `<span class="sm-dv-v">${man(d)}</span>`;
      if (Math.abs(d) < 10000) return `<span class="sm-dv-l"></span><span class="sm-dv-r"><span class="sm-dv-v muted">비슷</span></span>`;
      return d < 0 ? `<span class="sm-dv-l down">${t}<i style="width:${w}%"></i></span><span class="sm-dv-r"></span>` : `<span class="sm-dv-l"></span><span class="sm-dv-r up"><i style="width:${w}%"></i>${t}</span>`;
    };
    const row = (c, v, p, d, cls = "") => `<div class="sm-dv-row${cls}"><span class="sm-dv-n">${c}<small>${val(v)} ← ${val(p)}</small></span>${bar(d)}</div>`;
    return `<div class="sm-dv"><div class="sm-dv-row sm-dv-h"><span class="sm-dv-n">분류 <small>${mon}월 ← ${pm}월</small></span><span class="sm-dv-l">◀ 덜 씀</span><span class="sm-dv-r">더 씀 ▶</span></div>
      ${s.rows.map((x) => row(esc(x.c), x.v, x.p, x.d)).join("")}${row("합계", s.me.exp, s.prev.exp, s.me.exp - s.prev.exp, " sm-dv-sum")}</div>`;
  }
  function html(s) {
    const b = [];
    if (s.pl.items.length) {
      const pct = s.pl.total ? Math.round(s.me.exp / s.pl.total * 100) : 0, time = s.now ? Math.round(s.day / lastDay(s.m) * 100) : 100;
      b.push(`<b>예산</b> ${man(s.pl.total)} 중 <b>${pct}%</b> 씀${s.now ? ` <span class="muted">(한 달의 ${time}% 지남)</span>` : ""}` +
        (s.over.length ? `<ul>${s.over.map((v) => `<li>${esc(v.c)} <span class="sm-bad">${man(v.used - v.amt)} 초과</span> <span class="muted">(${man(v.used)} / ${man(v.amt)})</span></li>`).join("")}</ul>` : ` · 분류마다 예산 안이에요 👍`));
    }
    if (s.me.list.length) b.push(`<b>큰 지출</b><ul>${s.me.list.slice(0, 3).map((x) => `<li>${esc(label(x))} <b>${man(x.amt)}</b> <span class="muted">· ${esc(x.cat || "")} · ${Number(x.date.slice(5, 7))}/${Number(x.date.slice(8))}</span></li>`).join("")}</ul>`);
    if (s.me.food || s.me.foodN || s.prev.foodN) b.push(`🍽️ 같이 먹은 외식·배달 <b>${man(s.me.food)}</b> (내 몫, ${s.me.foodN}번) <span class="muted">· 지난달 ${man(s.prev.food)}, ${s.prev.foodN}번</span>`);
    if (s.me.taxiN || s.prev.taxiN) b.push(`🚖 택시 <b>${s.me.taxiN}번</b> ${man(s.me.taxi)} <span class="muted">· 지난달 ${s.prev.taxiN}번 ${man(s.prev.taxi)}</span>`);
    b.push((s.me.save > 0 ? `💰 저축·투자 통장으로 <b class="sm-good">${man(s.me.save)}</b> 넘겼어요.` : s.me.save < 0 ? `💰 저축·투자 통장에서 <b>${man(s.me.save)}</b> 꺼내 썼어요.` : `💰 이번 달은 저축 통장으로 넘긴 돈이 아직 없어요.`) + ` ${vsPrev(s.prev.save)}`);
    const nw = netWorth(s);
    b.push(`🏦 순자산 <b>${nw.now < 0 ? "−" : ""}${man(nw.now)}</b> <span class="muted">· 지난달 끝보다</span> ${Math.abs(nw.d) < 10000 ? "비슷" : `<b class="${nw.d > 0 ? "sm-good" : "sm-bad"}">${man(nw.d)} ${nw.d > 0 ? "늘었어요" : "줄었어요"}</b>`} <span class="muted">(🙈 숨긴 자산·🤝 공동 빼고)</span>`);
    const left = s.me.inc - s.me.exp;
    return `<p class="muted small sm-sub">${subOf(s)}</p>
      <div class="plan-tiles sm-tiles">
        <div class="plan-tile"><span>쓴 돈</span><b>${won(s.me.exp)}</b><small>${s.prev.exp > 0 ? `지난달보다 ${diffTxt(s.me.exp - s.prev.exp)}` : "지난달 기록 없음"}</small></div>
        <div class="plan-tile"><span>들어온 돈</span><b>${won(s.me.inc)}</b><small>지난달 ${man(s.prev.inc)}</small></div>
        <div class="plan-tile${left < 0 ? " minus" : " left"}"><span>남은 돈</span><b>${left < 0 ? "-" : ""}${won(left)}</b><small>들어온 돈 − 쓴 돈</small></div>
        <div class="plan-tile"><span>저축으로</span><b>${s.me.save < 0 ? "-" : ""}${won(s.me.save)}</b><small>저축·투자 통장으로 넘긴 돈</small></div>
      </div>
      <p class="sm-head">${headline(s)}${s.prev.exp > 0 ? ` <span class="muted">(${Number(s.m.slice(5))}월 ${man(s.me.exp)} · ${Number(shift(s.m, -1).slice(5))}월 ${man(s.prev.exp)})</span>` : ""}</p>
      <div class="sm-grid">${diverge(s)}<div class="sm-list">${b.map((x) => `<div class="sm-li">${x}</div>`).join("")}</div></div>`;
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
