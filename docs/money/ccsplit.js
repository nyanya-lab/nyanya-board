// 🏷 공통 '문화생활' 소분류 나누기 (냐냐 가계부 전용, 가계부 설정 '분류' 칸 아래, 한 번 쓰고 나면 안 보임 — 2026-10-22 냐냐와 정함)
// 소분류가 빈 공통 문화생활 기록을 내용(memo) → 없으면 가게 이름 메모(note)로 보고 나눔. 인형뽑기는 오락실에 합치고, 콘서트·야구는 '공연 및 스포츠'.
// 공통 분류 목록도 같이 바꿈: 인형뽑기 → 오락실, 콘서트·야구 → 공연 및 스포츠, 보드게임·방탈출·게임·사진 더함.
// 규칙에 안 맞는 것(놀이공원·마사지·빈칸 등)은 소분류 없이 그대로. 금액·날짜·내용·정산은 안 건드림. [나누기]를 눌러야 바뀜
const CAT = "문화생활";
const RULES = [
  ["오락실", /인형뽑기|뽑기|오락실|어뮤즈먼트|모듈앤컴퍼니|사격|볼링|포켓볼/],
  ["보드게임", /보드게임|팬데믹/],
  ["방탈출", /방탈출/],
  ["사진", /사진|포토/],
  ["영화", /영화|CGV|스파이더맨|올리브네트웍스/],
  ["노래방", /노래/],
  ["공연 및 스포츠", /야구|콘서트|서커스/],
  ["게임", /닌텐도|게임/]
];
const RENAME = { 인형뽑기: "오락실", 콘서트: "공연 및 스포츠", 야구: "공연 및 스포츠" };
const ADD = ["보드게임", "방탈출", "게임", "사진"];
const ruleOf = (t) => (t ? (RULES.find(([, re]) => re.test(t)) || [null])[0] : null);

export function mountCcSplit(root, env) {
  const { esc, won } = env;
  let busy = false;
  const newCats = () => {
    const cats = env.commonCats(); if (!cats) return null;
    const out = cats.map((c) => {
      if (c.n !== CAT) return c;
      const s = [];
      c.s.forEach((x) => { const y = RENAME[x] || x; if (!s.includes(y)) s.push(y); });
      ADD.forEach((x) => { if (!s.includes(x)) s.push(x); });
      return { n: c.n, s };
    });
    return JSON.stringify(out) === JSON.stringify(cats) ? null : out;   // null = 목록은 이미 바뀜
  };
  const todo = () => {
    const out = [], left = [];
    env.S.money.forEach((x, id) => {
      if (!x || x.ccat !== CAT || !(x.kind === "expense" || !x.kind)) return;
      if (x.csub && RENAME[x.csub]) { out.push({ id, x, to: RENAME[x.csub] }); return; }
      if (x.csub) return;
      const to = ruleOf(x.memo) || ruleOf(x.note);
      (to ? out : left).push({ id, x, to });
    });
    return { out, left };
  };
  function render() {
    const { out, left } = todo(), cats = newCats();
    if (!env.commonCats() || (!out.length && !cats)) { root.classList.add("ccm-none"); root.innerHTML = ""; return; }
    root.classList.remove("ccm-none");
    const g = {};
    out.forEach(({ x, to }) => { const r = (g[to] ||= { to, n: 0, amt: 0, ex: {} }); r.n++; r.amt += Number(x.amount) || 0; const e = x.memo || x.note || "(빈칸)"; r.ex[e] = (r.ex[e] || 0) + 1; });
    const rows = Object.values(g).sort((a, b) => b.n - a.n);
    const exText = (ex) => Object.entries(ex).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([e, n]) => (n > 1 ? `${e} ×${n}` : e)).join(", ") + (Object.keys(ex).length > 4 ? " …" : "");
    const lex = {}; left.forEach(({ x }) => { const e = x.memo || x.note || "(빈칸)"; lex[e] = (lex[e] || 0) + 1; });
    const lamt = left.reduce((a, { x }) => a + (Number(x.amount) || 0), 0);
    const catsLine = cats ? (cats.find((c) => c.n === CAT) || { s: [] }).s.join(" · ") : "";
    root.innerHTML = `<div class="panel-head"><div><h3>🏷 공통 문화생활 소분류 나누기</h3><span class="muted small">소분류가 빈 공통 문화생활 기록 <b>${out.length.toLocaleString()}건</b>을 내용(없으면 가게 이름)으로 나눠요. 금액·날짜·내용·정산은 그대로예요.</span></div></div>
      ${cats ? `<p class="small" style="margin:0">문화생활 소분류 목록 → <b>${esc(catsLine)}</b></p>` : ""}
      ${rows.length ? `<div class="ccm-tbl"><div class="ccm-row ccm-th"><span>→ 소분류</span><span>내용</span><span>건</span><span>금액</span></div>
      ${rows.map((r) => `<div class="ccm-row"><span>→ ${esc(r.to)}</span><span>${esc(exText(r.ex))}</span><span>${r.n.toLocaleString()}</span><span>${esc(won(r.amt))}</span></div>`).join("")}
      ${left.length ? `<div class="ccm-row" style="opacity:.7"><span>(소분류 없이 그대로)</span><span>${esc(exText(lex))}</span><span>${left.length.toLocaleString()}</span><span>${esc(won(lamt))}</span></div>` : ""}</div>` : ""}
      <div class="row" style="flex:0 0 auto;align-items:center"><button class="btn" type="button" data-ccs-go${busy ? " disabled" : ""}>${busy ? "나누는 중…" : `🏷 ${out.length ? out.length.toLocaleString() + "건 나누기" : "목록 바꾸기"}`}</button></div>`;
  }
  root.addEventListener("click", async (e) => {
    if (!e.target.closest("[data-ccs-go]") || busy) return;
    const be = env.backend(); if (!be) return;
    const { out } = todo(), cats = newCats();
    if (!out.length && !cats) return;
    if (!confirm(`공통 문화생활 ${out.length.toLocaleString()}건에 소분류를 넣고 소분류 목록을 바꿀까요? (금액·날짜·내용·정산은 그대로)`)) return;
    busy = true; render();
    try {
      if (cats) await env.saveCommonCats(cats);
      for (let i = 0; i < out.length; i += 500) {
        const p = {};
        out.slice(i, i + 500).forEach(({ id, to }) => { p[`money/${id}/csub`] = to; });
        await be.rootUpdate(p);
      }
      env.toast(`🏷 문화생활 ${out.length.toLocaleString()}건을 소분류로 나눴어요.`);
    } catch (err) { env.toast("나누다가 멈췄어요. 다시 누르면 남은 것만 해요."); }
    busy = false; render();
  });
  return { render };
}
