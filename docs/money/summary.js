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
    let save = 0;
    const typeOf = (id) => ((S.accounts.get(id) || {}).type);
    r.items.forEach((x) => {
      if (!env.isWon(x)) return;
      if (x.kind === "move") {
        const f = typeOf(x.account) === "save", t = typeOf(x.toAccount) === "save", a = Number(x.amount) || 0;
        if (t && !f) save += a; else if (f && !t) save -= a;
      } else if (x.kind === "expense" || !x.kind) list.push({ ...x, amt: env.cntAmt(x) });
    });
    list.sort((a, b) => b.amt - a.amt);
    return { exp: r.exp, inc: r.inc, byCat: r.byCat, list, save };
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
    return { m, now, day, me, prev, avgExp, n, up, down, big, pl, over };
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
    b.push(s.me.save > 0 ? `💰 저축·투자 통장으로 <b class="sm-good">${man(s.me.save)}</b> 넘겼어요.` : s.me.save < 0 ? `💰 저축·투자 통장에서 <b>${man(s.me.save)}</b> 꺼내 썼어요.` : `💰 이번 달은 저축 통장으로 넘긴 돈이 아직 없어요.`);
    const left = s.me.inc - s.me.exp;
    return `<p class="muted small sm-sub">${subOf(s)}</p>
      <div class="plan-tiles sm-tiles">
        <div class="plan-tile"><span>쓴 돈</span><b>${won(s.me.exp)}</b><small>평소보다 ${diffTxt(dAvg)}</small></div>
        <div class="plan-tile"><span>들어온 돈</span><b>${won(s.me.inc)}</b><small>지난달 ${man(s.prev.inc)}</small></div>
        <div class="plan-tile${left < 0 ? " minus" : " left"}"><span>남은 돈</span><b>${left < 0 ? "−" : ""}${won(left)}</b><small>들어온 돈 − 쓴 돈</small></div>
        <div class="plan-tile"><span>저축으로</span><b>${s.me.save < 0 ? "−" : ""}${won(s.me.save)}</b><small>저축·투자 통장으로 넘긴 돈</small></div>
      </div>
      <div class="sm-list">${b.map((x) => `<div class="sm-li">${x}</div>`).join("")}</div>`;
  }

  // 📑 보고서 화면 (월간 정리)
  function full(m) { const s = build(m); return s.empty ? `<p class="muted">${esc(s.empty)}</p>` : html(s); }
  // 📑 보고서 첫 화면 카드: 쓴 돈 + 한 줄
  function card(m) { const s = build(m); return s.empty ? { exp: 0, line: s.empty } : { exp: s.me.exp, line: headline(s).replace(/<[^>]+>/g, "") }; }
  // 💰 예산 탭: 한 줄 + 자세히 ›
  function render() {
    const m = env.month();
    if (!m || !S.loaded) return;
    const s = build(m), mon = Number(m.slice(5));
    let line = s.empty ? esc(s.empty) : headline(s);
    if (!s.empty && s.pl.items.length) line += ` <span class="muted">· 예산 ${s.pl.total ? Math.round(s.me.exp / s.pl.total * 100) : 0}% 씀${s.over.length ? ` · <span class="sm-bad">${s.over.length}개 분류 초과</span>` : ""}</span>`;
    root.innerHTML = `<div class="sm-line"><b class="sm-t">📝 ${mon}월 정리</b><span class="sm-txt">${line}</span>${s.empty ? "" : `<button type="button" class="btn ghost small" data-sm="more">자세히 ›</button>`}</div>`;
  }
  root.addEventListener("click", (e) => { if (e.target.closest("[data-sm='more']")) env.openReport(env.month()); });
  return { render, full, card };
}
