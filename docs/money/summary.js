// ★ 두 가계부(냐냐·욱진)가 같이 쓰는 파일 — 원본은 냐냐 보드 docs/money/, 욱진 보드 docs/는 글자 하나까지 같은 복사본. 한쪽만 고치지 말고, 보드마다 달라야 하는 건 env로 가르기.
// 📝 이번 달 정리 (2026-10-29 냐냐 가계부에서 시작, 비교 기준·표·내역 창 2026-11-05). 예산 탭 '한 달 예산' 아래 #sumPanel 한 줄 + 📑 보고서 '월간 정리' 카드·화면. API 없이 가계부 숫자로 문장을 만듦
// 둘 다 씀: 예산 탭 '한 달 예산' 아래 #sumPanel = 한 줄 + [자세히 ›](env.openReport) · 📑 보고서 탭 '📝 월간 정리' 카드·화면 = full(m)·card(m)
// 고른 달(예산 탭 달 넘기기)을 고른 비교 기준(지난달·최근 6개월·최근 1년·작년 같은 달)과 비교. 이번 달이면 오늘 날짜까지만, 비교하는 달도 같은 날짜까지.
// 화면: 쓴 돈 칸 4개 → 한 줄 → 왼쪽 분류별 차이 막대(diverge) · 오른쪽 예산·큰 지출·외식·택시·저축·순자산 (폰은 위아래)
// 보드마다 다른 것 (env): ls = 기기 기억 이름 앞말("nyanya"/"ukjin") · adminView() = 관리자 기기면 안 보임(욱진) · give = true(욱진)면 💝 줄 돈(transfer)은 쓴 돈이 아니라 따로 (남은 돈 = 들어온 돈 − 준 돈 − 쓴 돈). 예산 금액은 planOf items.amount. 관리자 기기(지출 숨김)에선 안 보임.
// 💑 내 몫 보기면 money.js monthTotals와 같게 공통비용 절반·욱진입금 뺌 (env.cntAmt). 데이터는 안 바꿈.
export function mountSummary(root, env) {
  const { esc, won, S } = env, GIVE = !!env.give, LS_CMP = (env.ls || "nyanya") + "-sm-cmp", adminView = () => !!(env.adminView && env.adminView());
  const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const shift = (m, k) => { const [y, mo] = m.split("-").map(Number), d = new Date(y, mo - 1 + k, 1); return ymd(d).slice(0, 7); };
  const lastDay = (m) => { const [y, mo] = m.split("-").map(Number); return new Date(y, mo, 0).getDate(); };
  const rangeOf = (m, day) => ({ from: `${m}-01`, to: `${m}-${String(Math.min(day, lastDay(m))).padStart(2, "0")}` });
  // 금액 글자는 모두 '만' 단위 (2026-11-05 냐냐: 만·원이 섞여서 정신없음) — 100만 넘으면 정수, 그 아래는 소수 한 자리 (예: 253만 · 8.1만)
  const man = (n) => { const a = Math.abs(n) / 10000; return `${(a >= 100 ? Math.round(a) : Math.round(a * 10) / 10).toLocaleString()}만`; };
  const tn = (n) => (n < 0 ? "−" : "") + (Math.abs(n) / 10000).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 });   // 표 칸: 만원, 소수 한 자리
  const diffTxt = (d, unit = "") => Math.abs(d) < 10000 ? "비슷" : `${man(d)} ${d > 0 ? "더" : "덜"}${unit}`;
  const label = (x) => x.note || x.memo || x.sub || x.cat || "";

  // 그 기간 기록: 분류별 지출(r.byCat, 💑 반영) + 지출 기록 목록(큰 순) + 저축 통장으로 넘긴 돈
  function take(range) {
    const r = env.monthTotals(null, range), list = [];
    let save = 0, food = 0, foodN = 0, taxi = 0, taxiN = 0; const bySub = {};
    const typeOf = (id) => ((S.accounts.get(id) || {}).type);
    r.items.forEach((x) => {
      if (!env.isWon(x)) return;
      if (x.kind === "move") {
        const f = typeOf(x.account) === "save", t = typeOf(x.toAccount) === "save", a = Number(x.amount) || 0;
        if (t && !f) save += a; else if (f && !t) save -= a;
      } else if (x.kind === "expense" || !x.kind) {
        if (x.recvTo || x.recvOf) return;   // 🤲 대신 낸 돈은 내 지출 아님 (합계는 짝과 합쳐 0)
        // 소분류별 (💙 공통비용은 report.js처럼 소분류 대신 공통 분류 ccat로)
        const c = x.cat || "기타", sk = (x.common || /공통비용/.test(c)) ? env.ccOf(x).c : (x.sub || ""), o = bySub[c] || (bySub[c] = {});
        list.push({ ...x, amt: env.cntAmt(x), sk });
        o[sk] = (o[sk] || 0) + env.cntAmt(x);
        const a = Number(x.amount) || 0;
        if ((x.common || /공통비용/.test(x.cat || "")) && /식비/.test(x.ccat || "") && /외식|배달/.test(x.csub || "")) { food += a / 2; if (a > 0) foodN++; }   // 늘 내 몫(반)으로
        if (/택시/.test(x.sub || "")) { taxi += a; if (a > 0) taxiN++; }
      }
    });
    list.sort((a, b) => b.amt - a.amt);
    return { exp: r.exp, inc: r.inc, out: GIVE ? r.out || 0 : 0, byCat: r.byCat, bySub, list, save, food, foodN, taxi, taxiN };
  }

  function build(m) {
    const t = ymd(new Date()), cur = t.slice(0, 7), now = m === cur, day = now ? Number(t.slice(8)) : 31;
    if (m > cur) return { empty: `${Number(m.slice(5))}월은 아직 안 왔어요. 지난달 정리는 ‹ 이전 달에서 볼 수 있어요.` };
    const me = take(rangeOf(m, day));
    if (!me.exp && !me.inc) return { empty: "이 달은 아직 기록이 없어요." };
    const cmp = getCmp(), prev = baseOf(m, day, cmp);
    // 분류마다 이번 달 vs 비교 (차이 큰 순 — 더 쓴 곳 위, 덜 쓴 곳 아래)
    const cats = new Set([...Object.keys(me.byCat), ...Object.keys(prev.byCat)]);
    const subsOf = (c) => {   // 분류를 누르면 펼치는 소분류 줄 (2026-11-05 냐냐)
      // 그림 없는 예전 이름('식비')은 그림 붙은 이름('🍽️ 식비')과 합침
      const keys = [...new Set([...Object.keys(me.bySub[c] || {}), ...Object.keys(prev.bySub[c] || {})])];
      const to = (k) => keys.find((k2) => k2 !== k && k2.replace(/^\S+\s/, "") === k) || k;
      const fold = (o) => { const r = {}; Object.entries(o || {}).forEach(([k, v]) => { r[to(k)] = (r[to(k)] || 0) + v; }); return r; };
      const a = fold(me.bySub[c]), b = fold(prev.bySub[c]);
      return [...new Set([...Object.keys(a), ...Object.keys(b)])].map((k) => ({ c: k, v: a[k] || 0, p: b[k] || 0, d: (a[k] || 0) - (b[k] || 0) }))
        .filter((x) => Math.round(x.v) || Math.round(x.p)).sort((x, y) => y.d - x.d);
    };
    const rows = [...cats].map((c) => { const v = me.byCat[c] || 0, p = prev.byCat[c] || 0; return { c, v, p, d: v - p, subs: subsOf(c) }; })
      .filter((x) => Math.round(x.v) || Math.round(x.p)).sort((a, b) => b.d - a.d);
    const pl = env.planOf(m), over = pl.items.map((v) => ({ c: v.cat, amt: v.show, used: me.byCat[v.cat] || 0 })).filter((v) => v.used > v.amt && v.amt > 0).sort((a, b) => (b.used - b.amt) - (a.used - a.amt));
    return { m, now, day, me, prev, cmp, rows, pl, over, range: rangeOf(m, day) };
  }
  // 🔀 비교 기준 (2026-11-05 냐냐: 지난달 · 최근 6개월 · 최근 1년 · 1년 전 같은 달) — 이 기기에만 기억 (localStorage {env.ls}-sm-cmp)
  const BAR_MAX = 1000000;   // 차이 막대 고정 눈금 (원)
  const openCats = new Set();   // 월간 정리 표에서 펼친 분류 (메모리에만)
  const CMPS = { prev: "지난달", m6: "최근 6개월", y1: "최근 1년", ly: "작년 같은 달" };
  function getCmp() { try { const v = localStorage.getItem(LS_CMP); return CMPS[v] ? v : "prev"; } catch (e) { return "prev"; } }
  function setCmp(v) { try { localStorage.setItem(LS_CMP, v); } catch (e) { /* 무시 */ } }
  // 비교할 숫자: 지난달·작년 같은 달은 그 달, 6개월·1년은 기록 있는 달만 평균 (이번 달이면 모두 같은 날짜까지)
  // name = 문장에 쓰는 이름, col = 표 머리줄
  function baseOf(m, day, cmp) {
    const mon = Number(m.slice(5));
    if (cmp === "prev" || cmp === "ly") {
      const k = cmp === "prev" ? -1 : -12, b = take(rangeOf(shift(m, k), day));
      return { ...b, ok: b.exp > 0, name: cmp === "prev" ? "지난달" : `작년 ${mon}월`, col: cmp === "prev" ? `${Number(shift(m, -1).slice(5))}월` : `작년 ${mon}월` };
    }
    const N = cmp === "m6" ? 6 : 12, ps = [];
    for (let k = 1; k <= N; k++) { const p = take(rangeOf(shift(m, -k), day)); if (p.exp > 0) ps.push(p); }
    const n = ps.length, avg = (f) => n ? ps.reduce((t, p) => t + f(p), 0) / n : 0, byCat = {};
    const bySub = {};
    ps.forEach((p) => {
      Object.entries(p.byCat).forEach(([c, v]) => { byCat[c] = (byCat[c] || 0) + v / n; });
      Object.entries(p.bySub).forEach(([c, o]) => { const t = bySub[c] || (bySub[c] = {}); Object.entries(o).forEach(([k, v]) => { t[k] = (t[k] || 0) + v / n; }); });
    });
    const nm = cmp === "m6" ? "최근 6개월" : "최근 1년";
    return { exp: avg((p) => p.exp), inc: avg((p) => p.inc), out: avg((p) => p.out || 0), save: avg((p) => p.save), food: avg((p) => p.food), foodN: avg((p) => p.foodN), taxi: avg((p) => p.taxi), taxiN: avg((p) => p.taxiN), byCat, bySub, n, ok: n > 0,
      name: `${nm} 평균`, col: `${N === 6 ? "6달" : "1년"} 평균`, avg: true };
  }

  // 🏦 순자산: 자산 탭 합계와 같게 (숨긴 자산·공동 빼고, 카드값은 마이너스)
  function netWorth(s) {
    const accts = env.sortedAccts().filter((a) => !a.joint), sum = (b) => accts.reduce((t, a) => t + (b[a.id] || 0), 0);
    const now = sum(env.balances(s.range.to)), prevEnd = `${shift(s.m, -1)}-${String(lastDay(shift(s.m, -1))).padStart(2, "0")}`;
    return { now, d: now - sum(env.balances(prevEnd)) };
  }
  // 첫 줄: 고른 비교 기준과 (2026-11-05 냐냐), 비교할 기록이 없으면 그렇다고
  const headline = (s) => {
    const b = s.prev; if (!b.ok) return `${b.name} 기록이 없어서 비교할 게 없어요.`;
    const d = s.me.exp - b.exp;
    return Math.abs(d) < 10000 ? `${b.name}이랑 비슷하게 썼어요.` : d < 0 ? `${b.name}보다 <b class="sm-good">${man(d)} 덜</b> 썼어요 👍` : `${b.name}보다 <b class="sm-bad">${man(d)} 더</b> 썼어요.`;
  };
  const subOf = (s) => { const mon = Number(s.m.slice(5)); return [s.now ? `${mon}월 1일~${s.day}일 · 비교하는 달도 ${s.day}일까지` : "", s.prev.avg ? `기록 있는 ${s.prev.n}달 평균` : "", env.mineOn() ? "💑 내 몫 기준" : ""].filter(Boolean).join(" · "); };   // 지난달 비교일 때 끝에 ' · '가 남던 것 고침
  const val = (n) => (n < 0 ? "−" : "") + man(n);
  const cnt = (n) => `${Math.round(n * 10) / 10}번`;
  const vsB = (s, t) => `<span class="muted">· ${s.prev.name} ${t}</span>`;
  const cmpBar = (s) => `<div class="sm-cmp" role="group" aria-label="비교 기준"><span class="muted">비교</span>${Object.entries(CMPS).map(([k, t]) => `<button type="button" data-smcmp="${k}" aria-pressed="${k === s.cmp}">${t}</button>`).join("")}</div>`;
  // 📊 분류마다 금액 표 + 차이 막대 (가운데 선 기준 오른쪽 빨강 = 더 씀, 왼쪽 초록 = 덜 씀) — 냐냐 고름: 시안 C-2 + C-4, 폰은 막대 없이 표만
  function diverge(s) {
    // 막대 길이는 고정 눈금: 100만 = 반쪽 끝까지 (2026-11-05 냐냐: 달마다 눈금이 바뀌면 비교가 안 돼서), 넘으면 끝에 잘림 표시
    const mon = Number(s.m.slice(5)), mx = BAR_MAX;
    const dt = (d) => `<span class="${Math.abs(d) < 10000 ? "muted" : d > 0 ? "sm-bad" : "sm-good"}">${d > 0 ? "+" : d < 0 ? "−" : ""}${tn(Math.abs(d))}</span>`;   // 1만 원 안은 회색
    const bar = (d) => { const w = Math.min(100, Math.round(Math.abs(d) / mx * 100)), i = `<i style="width:${w}%"${Math.abs(d) > mx ? ` class="cut" title="${man(d)} (막대는 ${man(mx)}까지)"` : ""}></i>`; return Math.abs(d) < 10000 ? `<span class="sm-dv-b"><span class="sm-dv-l"></span><span class="sm-dv-r"></span></span>` : `<span class="sm-dv-b"><span class="sm-dv-l">${d < 0 ? i : ""}</span><span class="sm-dv-r">${d > 0 ? i : ""}</span></span>`; };
    const cells = (v, p) => `<span class="num">${tn(v)}</span><span class="num muted">${tn(p)}</span><span class="num">${dt(v - p)}</span>${bar(v - p)}`;
    // 분류 줄: 소분류가 있으면 눌러서 펼침 (▸/▾, 펼친 분류는 openCats에 기억 — 달·비교를 바꿔도 그대로)
    const catRow = (x) => {
      const has = x.subs.length > 1 || (x.subs.length === 1 && x.subs[0].c), on = has && openCats.has(x.c);
      const head = has ? `<button type="button" class="sm-dv-row sm-dv-cat" data-smcat="${esc(x.c)}" aria-expanded="${on}"><span class="sm-dv-n"><span class="sm-dv-car" aria-hidden="true">${on ? "▾" : "▸"}</span>${esc(x.c)}</span>${cells(x.v, x.p)}</button>`
        : `<button type="button" class="sm-dv-row sm-dv-cat" data-smrec data-c="${esc(x.c)}"><span class="sm-dv-n"><span class="sm-dv-car" aria-hidden="true"></span>${esc(x.c)}</span>${cells(x.v, x.p)}</button>`;
      // 소분류 줄(과 소분류 없는 분류 줄)을 누르면 그 내역 창 (2026-11-05 냐냐)
      return head + (on ? x.subs.map((y) => `<button type="button" class="sm-dv-row sm-dv-sub" data-smrec data-c="${esc(x.c)}" data-s="${esc(y.c)}"><span class="sm-dv-n">${y.c ? esc(y.c) : "소분류 없음"}</span>${cells(y.v, y.p)}</button>`).join("") : "");
    };
    return `<div class="sm-dv"><div class="sm-dv-row sm-dv-h"><span class="sm-dv-n">분류 <small>(만원)</small></span><span class="num">${mon}월</span><span class="num">${esc(s.prev.col)}</span><span class="num">차이</span><span class="sm-dv-b" aria-hidden="true">${[[0, `−${man(BAR_MAX)}`, " s"], [25, `−${man(BAR_MAX / 2)}`, ""], [50, "0", ""], [75, `+${man(BAR_MAX / 2)}`, ""], [100, `+${man(BAR_MAX)}`, " e"]].map(([p, t, c]) => `<span class="sm-dv-tk${c}" style="left:${p}%">${t}</span>`).join("")}</span></div>
      ${s.rows.map(catRow).join("")}<div class="sm-dv-row sm-dv-sum"><span class="sm-dv-n">합계</span>${cells(s.me.exp, s.prev.exp)}</div></div>`;
  }
  function html(s) {
    const b = [], B = s.prev;
    if (s.pl.items.length) {
      const pct = s.pl.total ? Math.round(s.me.exp / s.pl.total * 100) : 0, time = s.now ? Math.round(s.day / lastDay(s.m) * 100) : 100;
      b.push(`<b>예산</b> ${man(s.pl.total)} 중 <b>${pct}%</b> 씀${s.now ? ` <span class="muted">(한 달의 ${time}% 지남)</span>` : ""}` +
        (s.over.length ? `<ul>${s.over.map((v) => `<li>${esc(v.c)} <span class="sm-bad">${man(v.used - v.amt)} 초과</span> <span class="muted">(${man(v.used)} / ${man(v.amt)})</span></li>`).join("")}</ul>` : ` · 분류마다 예산 안이에요 👍`));
    }
    if (s.me.food || s.me.foodN || B.foodN) b.push(`🍽️ 같이 먹은 외식·배달 <b>${man(s.me.food)}</b> (내 몫, ${s.me.foodN}번) ${vsB(s, `${man(B.food)}, ${cnt(B.foodN)}`)}`);
    if (s.me.taxiN || B.taxiN) b.push(`🚖 택시 <b>${s.me.taxiN}번</b> ${man(s.me.taxi)} ${vsB(s, `${cnt(B.taxiN)} ${man(B.taxi)}`)}`);
    b.push((s.me.save > 0 ? `💰 저축·투자 통장으로 <b class="sm-good">${man(s.me.save)}</b> 넘겼어요.` : s.me.save < 0 ? `💰 저축·투자 통장에서 <b>${man(s.me.save)}</b> 꺼내 썼어요.` : `💰 이번 달은 저축 통장으로 넘긴 돈이 아직 없어요.`) + ` ${vsB(s, val(B.save))}`);
    if (s.me.out > 0 || B.out > 0) b.push(`💝 ${esc(env.partner())}에게 <b>${man(s.me.out)}</b> 보냈어요. ${vsB(s, man(B.out))}`);
    const nw = netWorth(s);
    b.push(`🏦 순자산 <b>${nw.now < 0 ? "−" : ""}${man(nw.now)}</b> <span class="muted">· 지난달 끝보다</span> ${Math.abs(nw.d) < 10000 ? "비슷" : `<b class="${nw.d > 0 ? "sm-good" : "sm-bad"}">${man(nw.d)} ${nw.d > 0 ? "늘었어요" : "줄었어요"}</b>`} <span class="muted">(🙈 숨긴 자산·🤝 공동 빼고)</span>`);
    // 정리 칸은 모두 표 아래로 (2026-11-05 냐냐: 표를 크게)
    const big = s.me.list.length ? `<div class="sm-li"><b>큰 지출</b><ul>${s.me.list.slice(0, 3).map((x) => `<li>${esc(label(x))} <b>${man(x.amt)}</b> <span class="muted">· ${esc(x.cat || "")} · ${Number(x.date.slice(5, 7))}/${Number(x.date.slice(8))}</span></li>`).join("")}</ul></div>` : "";
    const left = s.me.inc - s.me.out - s.me.exp, sub = subOf(s);
    return `${cmpBar(s)}${sub ? `<p class="muted small sm-sub">${sub}</p>` : ""}
      <div class="plan-tiles sm-tiles">
        <div class="plan-tile"><span>쓴 돈</span><b>${won(s.me.exp)}</b><small>${B.ok ? `${B.name}보다 ${diffTxt(s.me.exp - B.exp)}` : `${B.name} 기록 없음`}</small></div>
        <div class="plan-tile"><span>들어온 돈</span><b>${won(s.me.inc)}</b><small>${B.name} ${man(B.inc)}</small></div>
        <div class="plan-tile${left < 0 ? " left minus" : " left"}"><span>남은 돈</span><b>${left < 0 ? "−" : ""}${won(left)}</b><small>${s.me.out > 0 ? "들어온 돈 − 준 돈 − 쓴 돈" : "들어온 돈 − 쓴 돈"}</small></div>
        <div class="plan-tile"><span>저축으로</span><b>${s.me.save < 0 ? "−" : ""}${won(s.me.save)}</b><small>저축·투자 통장으로 넘긴 돈</small></div>
      </div>
      <p class="sm-head">${headline(s)}${B.ok ? ` <span class="muted">(${Number(s.m.slice(5))}월 ${man(s.me.exp)} · ${esc(B.col)} ${man(B.exp)})</span>` : ""}</p>
      ${diverge(s)}<div class="sm-list sm-notes">${b.map((x) => `<div class="sm-li">${x}</div>`).join("")}${big}</div>`;
  }

  // 📑 보고서 화면 (월간 정리)
  let shown = null;   // 지금 화면에 그린 월간 정리 (내역 창이 씀)
  function full(m) { if (adminView()) { shown = null; return `<p class="muted">관리자 기기에선 지출을 안 보여서 정리도 안 보여요.</p>`; } const s = build(m); shown = s.empty ? null : s; return s.empty ? `<p class="muted">${esc(s.empty)}</p>` : html(s); }
  // 🧾 내역 창: 분류(›소분류)의 이번 달 기록 + 비교 달 기록(지난달·작년 같은 달일 때, 평균이면 이번 달만). 줄을 누르면 그 기록 고치기
  function recPop(c, sub) {
    const s = shown; if (!s) return;
    const hit = (x) => (x.cat || "기타") === c && (sub == null || x.sk === sub || sub.replace(/^\S+\s/, "") === x.sk);
    const part = (t, list) => { const xs = list.filter(hit).sort((a, b) => (b.date || "").localeCompare(a.date || "")), tot = xs.reduce((a, x) => a + x.amt, 0);
      return `<h3 class="sm-pop-t">${esc(t)} <span class="muted">${xs.length}건 · ${won(tot)}</span></h3>` + (xs.length ? xs.map((x) => { const d = new Date(`${x.date}T00:00`), m2 = x.memo && x.memo !== label(x) ? x.memo : "";
        return `<button type="button" class="sm-pop-r" data-smedit="${esc(x.id)}"><span class="muted">${d.getMonth() + 1}/${d.getDate()} (${"일월화수목금토"[d.getDay()]})</span><span class="sm-pop-l">${esc(label(x))}${m2 ? `<small>${esc(m2)}</small>` : ""}</span><b class="${x.amt < 0 ? "sm-good" : ""}">${x.amt < 0 ? "−" : ""}${won(Math.abs(x.amt))}</b></button>`; }).join("") : `<p class="muted small">기록이 없어요.</p>`); };
    let dl = document.getElementById("smPop");
    if (!dl) { dl = document.createElement("dialog"); dl.id = "smPop"; dl.className = "sm-pop"; document.body.append(dl); dl.addEventListener("click", (e) => { if (e.target === dl) dl.close(); }); }
    dl.innerHTML = `<div class="sm-pop-h"><b>${esc(c)}${sub != null ? ` › ${sub ? esc(sub) : "소분류 없음"}` : ""}</b><button type="button" class="sm-pop-x" data-smclose aria-label="닫기">×</button></div>
      <div class="sm-pop-b">${part(`${Number(s.m.slice(5))}월${s.now ? ` (1~${s.day}일)` : ""}`, s.me.list)}${s.prev.list ? part(s.prev.col + (s.now ? ` (1~${s.day}일)` : ""), s.prev.list) : `<p class="muted small sm-pop-t">${esc(s.prev.name)}과 비교 중이라 내역은 이번 달만 보여요.</p>`}</div>`;
    if (!dl.open) dl.showModal();
  }
  // 📑 보고서 첫 화면 카드: 쓴 돈 + 한 줄 (관리자 기기는 카드 없음)
  function card(m) { if (adminView()) return null; const s = build(m); return s.empty ? { exp: 0, line: s.empty } : { exp: s.me.exp, line: headline(s).replace(/<[^>]+>/g, "") }; }
  // 💰 저축 목표: settings.saveGoals[월] = 금액, 안 정한 달은 그 전 가장 가까운 달 것 (예산처럼 이어짐)
  function goalOf(m) {
    const all = S.settings.saveGoals || {}, ks = Object.keys(all).filter((k) => k <= m && all[k] != null).sort();
    return ks.length ? Number(all[ks[ks.length - 1]]) || 0 : 0;
  }
  function saveRow(m) {
    const goal = goalOf(m), t = ymd(new Date()), now = m === t.slice(0, 7);
    if (m > t.slice(0, 7) && !goal) return `<div class="sm-goal"><b class="sm-t">💰 저축 목표</b><input type="text" inputmode="numeric" id="smGoal" placeholder="금액 (원)" aria-label="저축 목표"></div>`;
    const moved = m > t.slice(0, 7) ? 0 : take(rangeOf(m, now ? Number(t.slice(8)) : 31)).save, pct = goal ? Math.max(0, Math.min(100, Math.round(moved / goal * 100))) : 0;
    const inc = env.planOf(m), rest = inc.income - inc.total - (GIVE ? inc.give || 0 : 0) - goal;   // 욱진: 💝 줄 돈도 빼고
    return `<div class="sm-goal"><b class="sm-t">💰 저축 목표</b><input type="text" inputmode="numeric" id="smGoal" value="${goal ? goal.toLocaleString() : ""}" placeholder="금액 (원)" aria-label="저축 목표">` +
      `<span class="sm-txt">${esc(String(Number(m.slice(5))))}월에 넘긴 돈 <b>${moved < 0 ? "−" : ""}${won(moved)}</b>${goal ? ` · ${moved >= goal ? `<b class="sm-good">목표 달성 🎉</b>` : `${man(goal - moved)} 남음`}` : ""}${goal && inc.items.length ? ` <span class="muted">· 예산대로 쓰고 ${GIVE ? "💝 줄 돈·저축까지 하면" : "저축하면"} ${rest < 0 ? `<span class="sm-bad">${man(rest)} 모자라요</span>` : `${man(rest)} 남아요`}</span>` : ""}</span>` +
      (goal ? `<div class="bar sm-bar"><i style="width:${pct}%"></i></div>` : "") + `</div>`;
  }
  // 📅 오늘 쓸 수 있는 돈 (이번 달·예산 있을 때만): (예산 − 예산 분류에 쓴 돈 − 아직 안 나간 고정비) ÷ 남은 날(오늘 포함). (욱진) 💝 줄 돈은 예산 밖이라 계산에 안 들어감
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
    if (!m || !S.loaded || adminView()) return;   // 탭마다 보이기·숨기기는 money.js(data-mtab), 관리자 기기는 .no-admin
    const s = build(m), mon = Number(m.slice(5));
    let line = s.empty ? esc(s.empty) : headline(s);
    if (!s.empty && s.pl.items.length) line += ` <span class="muted">· 예산 ${s.pl.total ? Math.round(s.me.exp / s.pl.total * 100) : 0}% 씀${s.over.length ? ` · <span class="sm-bad">${s.over.length}개 분류 초과</span>` : ""}</span>`;
    if (root.contains(document.activeElement) && document.activeElement.tagName === "INPUT") return;   // 저축 목표를 적는 중엔 안 그림
    root.innerHTML = daily(m) + saveRow(m) + `<div class="sm-line"><b class="sm-t">📝 ${mon}월 정리</b><span class="sm-txt">${line}</span>${s.empty ? "" : `<button type="button" class="btn ghost small" data-sm="more">자세히 ›</button>`}</div>`;
  }
  root.addEventListener("click", (e) => { if (e.target.closest("[data-sm='more']")) env.openReport(env.month()); });
  // 🔀 비교 기준 바꾸기 (월간 정리 화면은 보고서 탭 안이라 문서 전체에서 받음) → 예산 탭 한 줄·보고서 다시 그림
  document.addEventListener("click", (e) => {
    const r = e.target.closest("[data-smrec]");
    if (r) { recPop(r.dataset.c, r.dataset.s == null ? null : r.dataset.s); return; }
    const ed = e.target.closest("[data-smedit]");
    if (ed) { document.getElementById("smPop").close(); if (env.editMoney) env.editMoney(ed.dataset.smedit); return; }
    if (e.target.closest("[data-smclose]")) { document.getElementById("smPop").close(); return; }
    const c = e.target.closest("[data-smcat]");
    if (c) { const k = c.dataset.smcat; if (openCats.has(k)) openCats.delete(k); else openCats.add(k); if (env.rerender) env.rerender(); return; }
    const b = e.target.closest("[data-smcmp]"); if (!b) return; setCmp(b.dataset.smcmp); render(); if (env.rerender) env.rerender();
  });
  root.addEventListener("change", (e) => {
    if (e.target.id !== "smGoal") return;
    const be = env.backend(), n = Number(String(e.target.value).replace(/[^\d]/g, "")) || 0, m = env.month(); if (!be) return;
    e.target.blur();
    Promise.resolve(be.saveSettingsDeep({ saveGoals: { [m]: n } })).then(() => env.toast(`💰 ${Number(m.slice(5))}월부터 저축 목표 ${won(n)}`)).catch(() => env.toast("저장하지 못했어요."));
  });
  return { render, full, card };
}
