import { openRangePicker, rangeLabel, shiftRange, wholeMonth } from "./range.js?v=20261021a";   // 냐냐 쪽에서 더함 (내역 기간 고르기)
// 💰 돈 관리 (가계부) — ⚠️ 욱진 보드 docs/money.js를 가져온 짝 코드 (냐냐 보드 docs/money/money.js).
//   고칠 때 욱진 보드에도 필요한 고침인지 생각하고, 그렇다면 "욱진 보드도 같이 고칠까?" 물어보기 (CLAUDE.md).
//   냐냐 쪽에서 바꾼 곳: localStorage 키 ukjin- → nyanya-, 💝 줄 돈은 env.give === false면 안 보임, ❤️ 공통(common) 표시,
//   내역 줄 마이너스 금액(환불) 부호 (txRow), 탭에 common, 🙈 숨긴 자산(accounts.hidden)은 sortedAccts에서 뺌,
//   pieHtml o.full(가운데 구멍·글자 없이 꽉 찬 원형) — env.pieFull이면 분류 원형(통계·내역 지출·예산)에 씀 (자산 구성 원형은 그대로),
//   통계에서 💙 공통비용을 누르면 공통 분류별로 펼침(#stCcSub, ui.stCc),
//   🏷 공통 분류(E.commonCats, ccOn·ccOf: ❤️ 체크하면 분류 칸이 공통 대분류·소분류 → 기록 ccat·csub, 내 분류는 '💙 공통비용'),
//   💑 내 몫으로 보기(cntAmt·mineOn: 공통비용 절반·욱진입금 빼고, 기본 꺼짐),
//   💸 이체 '공통비용 정산' 체크(#mSettle → 공통 저장소 정산 장부 settles/{이체 id}에 금액, 기록 settle: true, 메모 비면 '2511 잔액 …', 체크 빼거나 지우면 장부에서도 뺌),
//   달력 칸 합계(수입−지출) 줄은 수입·지출 하나만 있어도 보임,
//   분류 색 = 원형마다 금액 큰 8개가 서로 다른 색(늘 쓰는 색 먼저), 9번째부터 '그 밖' (E.catRank, setCatView),
//   자산 탭: 🤝 공동 자산은 내 합계에서 빼고 '🤝 공동' 묶음으로 따로(renderAssets) · 💳 결제 버튼은 오른쪽 아래 ＋ 왼쪽(.as-fabs), 양쪽 칸 따로 스크롤(nyanya.css) · ▦ 다건입력 채우기 손잡이(bulkFillInit, 엑셀처럼 끌어서 복사) · 자산·분류는 안 고르면 빈칸(꼭 골라야 저장) · 날짜·고르는 칸에서도 Ctrl+V 붙여넣기(bulkPasteKey),
//   자산 고르는 칸 = 자산 탭 순서로 현금·통장·카드·저축 묶음 + 이름_계좌번호 (acctOptsHtml),
//   금액 +/- 기호 없음 (색으로만, app.js won = 부호 없음) — 직접 -로 적은 금액만 - (amtText), 지출·수입·분류 합계가 마이너스면 - (wonN),
//   ✏️ 분류·소분류 이름 바꾸기(renameCat·renameSub: 기록·예산·반복도 같이, 있는 이름이면 합침) + 기록에만 남은 분류 표시,
//   자산 계좌번호(accounts.number)·메모(accounts.memo) = 목록·자산별 보기에 보임 (고치는 곳은 acctset.js),
//   제목 = env.tabTitles[탭] (냐냐: 예산·내역·달력…), 💳 cardDue = 이용기간 끝난 최근 결제(저번 달 사용분, 결제일 없어도) · 결제 기록 내용 '카드정산 결제',
//   🧾 내역 기간 고르기(ui.txRange, ./range.js 창 — 달 이름·[이번 달]을 누르면 열림, txPick·txShift) — 내역 표·요약 칸·아래 '지출' 칸이 그 기간을 따라감.
//   📊 예산(planOf): 💑 내 몫 보기를 끄면 공통비용 예산 두 배(planX, 저장은 내 몫) · 지난달 월급은 있고 이번 달 월급은 아직이면 수입 = 지난달 (hasSalary),
// (원래 설명) 보드(index.html)와 가계부 모드(money.html → index.html?app=money)가 같이 쓰는 코드
// 한 달 예산 · 지출 기록 · 자산(통장·카드·현금, 카드 결제일) · 분류·색·원형 그래프 · 줄 돈 15일 자동 · 카드값 할 일 · 연습 데이터
// 화면 마크업은 index.html의 #moneyPage(⚙ 설정 탭 #catEditor·#curEditor 포함) · #acctDlg · #mDrawer · #bulkDlg. 보드 쪽 공통 함수·상태는 시작할 때 bindMoney(env)로 받음
// (따로 떼어 새 가계부를 만들 땐: 이 파일 + index.html의 위 마크업 + env로 넘기는 공통 함수(저장소·$·toast 등)만 가져가면 됨)

let E = null;   // 보드 쪽 환경 (값이 바뀌는 backend·testMode·realBackend 는 E.이름 으로 읽음)
let $, DEFAULTS, DEMO, S, act, amtVal, clone, closeDlg, commaNum, deepMerge, esc, isAdminDevice, moneyShort, monthLabel, openDlg, pad, partner, quietly, ready, render, rid, rows, shiftMonth, shortDate, shrinkPic, statTile, toast, today, ui, viewPic, won;
export function bindMoney(env) {
  E = env;
  ({ $, DEFAULTS, DEMO, S, act, amtVal, clone, closeDlg, commaNum, deepMerge, esc, isAdminDevice, moneyShort, monthLabel, openDlg, pad, partner, quietly, ready, render, rid, rows, shiftMonth, shortDate, shrinkPic, statTile, toast, today, ui, viewPic, won } = env);
}

export const MONEY_CATS = {
  income: ["월급", "현장 수당", "부업·알바", "이자·환급", "기타 수입"],
  transfer: ["생활비", "용돈", "데이트 통장", "저축", "기타"],
  expense: ["식비", "카페·간식", "장보기", "주거·관리비", "교통·차량", "통신", "데이트", "생필품", "쇼핑", "병원·약", "경조사", "공구·작업", "자기계발", "기타"]
};
export const ACCT_TYPES = { bank: "통장", card: "카드", cash: "현금", save: "저축" };
export const KIND_LABEL = { income: "수입", expense: "지출", transfer: "보낸 돈", move: "이체" };
// 💱 화폐: 기본 원 (cur 없음). settings.currencies에 더한 화폐(달러·엔…)도 고를 수 있고, 원이 아닌 기록은 합계·잔액에서 빼고 금액만 그 화폐로 보여 줌
export const isWon = (x) => !x || !x.cur || x.cur === "원";
export const currencies = () => ["원"].concat((S.settings.currencies || []).filter((c) => c && c !== "원"));
// 합계(지출·수입·분류별)가 마이너스면 - (= 냐냐가 -로 적은 게 더 커서). 잔액·순합계(수입−지출)는 기호 없이 색으로만
export const wonN = (n) => (Math.round(Number(n) || 0) < 0 ? "-" : "") + won(n);
// 💑 내 몫으로 보기 (냐냐 쪽에서 더함, E.mineView + settings.moneyMine, 기본 꺼짐): 켜면 합계·통계·달력·예산에서
//   💙 공통비용(❤️ 체크했거나 분류에 '공통비용')은 절반만, 💚 욱진입금(분류에 '욱진입금')은 수입에서 빼고 '정산 받은 돈'으로 따로. 기록·잔액은 그대로
export const mineOn = () => !!(E && E.mineView && S.settings.moneyMine);
export const isSettleIn = (x) => x.kind === "income" && /욱진입금/.test(x.cat || "");
export function cntAmt(x) {
  const a = Number(x.amount) || 0; if (!mineOn()) return a;
  if (isSettleIn(x)) return 0;
  if ((x.kind === "expense" || !x.kind) && (x.common || /공통비용/.test(x.cat || ""))) return a / 2;
  return a;
}
// 🏷 공통 분류 (냐냐 쪽에서 더함, E.commonCats = 공통 저장소의 [{n 대분류, s [소분류]}]): ❤️ 공통비용을 체크하면 분류·소분류 칸이 공통 분류로.
//   기록엔 cat = 내 '💙 공통비용' 분류(내 통계·예산엔 한 덩어리), ccat·csub = 공통 대분류·소분류 (공통 저장소엔 이걸로)
export const commonCatName = () => moneyCats("expense").find((c) => /공통비용/.test(c)) || "💙 공통비용";
const ccList = () => (E && typeof E.commonCats === "function" && E.commonCats()) || null;
export const ccOn = () => ui.kind === "expense" && !!$("mCommon") && $("mCommon").checked && !!ccList();
// 예전 방식 기록(분류 '공통비용' + 소분류 '식비(외식)')에서 공통 대분류·소분류 읽기
export function ccOf(x) {
  if (x.ccat) return { c: x.ccat, s: x.csub || null };
  const m = /^(.+?)\((.+)\)$/.exec(x.sub || "");
  if (m) return { c: m[1], s: m[2] === "쇼핑" && m[1] === "식비" ? "장보기" : m[2] };
  return { c: x.sub || "기타", s: null };
}
export const amtText = (x) => (Number(x.amount) < 0 ? "-" : "") + (isWon(x) ? won(x.amount) : `${commaNum(Math.abs(Number(x.amount) || 0))} ${x.cur}`);   // 냐냐: 직접 -로 적은 금액만 - (won은 부호 없이)
// 분류는 설정에서 바꿀 수 있음 (없으면 기본)
export const moneyCats = (kind) => ((S.settings.moneyCats && S.settings.moneyCats[kind]) || MONEY_CATS[kind] || []).slice();
// 🎨 분류 색: --c0~--c7 (파랑·코랄·민트·노랑·보라·분홍·청록·갈색), --c8 회색. 기본은 분류 목록 순서대로, '기타…'는 회색
// 분류 설정에서 바꾼 색은 settings.catColors[kind][키] = 0~8 (키 = 분류 이름을 Firebase 키로 쓸 수 있게 바꾼 것)
export const CAT_N = 8;
export const catKey = (c) => encodeURIComponent(c).replace(/\./g, "%2E");
// 냐냐 쪽 (E.catRank): 분류 색 8가지가 한 원형 안에서 안 겹치게.
//   원형마다 금액 큰 8개 분류가 서로 다른 색: 각 분류의 '늘 쓰는 색'(지금까지 쓴 돈 순위 1~8)이 비어 있으면 그 색, 아니면 남은 색.
//   9번째부터는 회색 '그 밖' 한 조각. 통계 목록 색 동그라미는 바로 그 원형과 같은 색 (viewMap)
let rankCache = null, viewMap = {};
function setCatView(k, cats) {   // cats = 금액 큰 순서
  const m = {}, used = new Set(), top = cats.slice(0, CAT_N);
  top.forEach((c) => { const p = catRankIdx(k, c); if (p < CAT_N && !used.has(p)) { m[c] = p; used.add(p); } });
  top.forEach((c) => { if (c in m) return; for (let j = 0; j < CAT_N; j++) if (!used.has(j)) { m[c] = j; used.add(j); break; } });
  viewMap[k] = m;
}
export function resetCatRank() { rankCache = null; }
function catRankIdx(k, cat) {
  if (!rankCache) {
    const sum = { expense: {}, income: {}, transfer: {} };
    S.money.forEach((x) => { if (!x || x.kind === "move" || !x.cat || !isWon(x)) return; const kk = x.kind || "expense", a = Number(x.amount) || 0; if (sum[kk] && a > 0) sum[kk][x.cat] = (sum[kk][x.cat] || 0) + a; });
    rankCache = {};
    for (const [kk, m] of Object.entries(sum)) { rankCache[kk] = {}; Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, CAT_N).forEach(([c], i) => { rankCache[kk][c] = i; }); }
  }
  const m = rankCache[k] || {}; return cat in m ? m[cat] : CAT_N;
}
export function catIdx(kind, cat) {
  const k = kind === "move" ? "expense" : kind || "expense";
  if (E.catRank) return viewMap[k] ? (cat in viewMap[k] ? viewMap[k][cat] : CAT_N) : catRankIdx(k, cat);   // 원형에 없는 분류(마이너스·9번째부터)는 회색
  const set = ((S.settings.catColors || {})[k] || {})[catKey(cat || "")];
  if (Number.isInteger(set) && set >= 0 && set <= CAT_N) return set;
  if (!cat || /^기타/.test(cat)) return CAT_N;
  if (k === "expense" && catMap && cat in catMap) return catMap[cat];
  const i = moneyCats(k).indexOf(cat);
  return i < 0 ? CAT_N : i % CAT_N;
}
// 보고 있는 달에 쓰는 지출 분류끼리는 색이 안 겹치게 (분류는 14개, 색은 8개). 직접 고른 색은 그대로, 나머지는 기본 색이 이미 쓰였으면 다음 빈 색
export let catMap = null;
export function setCatMap(cats) {
  catMap = null; rankCache = null;
  if (E.catRank) return;
  const set = (S.settings.catColors || {}).expense || {}, list = moneyCats("expense"), used = new Set(), map = {};
  const mine = (c) => Number.isInteger(set[catKey(c)]) ? set[catKey(c)] : null;
  const todo = [...new Set(cats)].filter((c) => c && !/^기타/.test(c));
  todo.forEach((c) => { if (mine(c) != null) used.add(mine(c)); });
  todo.filter((c) => mine(c) == null).sort((a, b) => (list.indexOf(a) + 1 || 999) - (list.indexOf(b) + 1 || 999)).forEach((c) => {
    let i = catIdx("expense", c);
    if (i < CAT_N && used.has(i)) { for (let j = 1; j < CAT_N; j++) { const n = (i + j) % CAT_N; if (!used.has(n)) { i = n; break; } } }
    map[c] = i; if (i < CAT_N) used.add(i);
  });
  catMap = map;
}
export const catVar = (kind, cat) => `var(--c${catIdx(kind, cat)})`;
export const catDot = (kind, cat) => `<span class="cdot" style="--c:${catVar(kind, cat)}" aria-hidden="true"></span>`;
// 🥧 원형(도넛): 바깥에 이름·% (선으로 이어서), 가운데 제목, 마우스 올리면(폰은 누르면) 그 조각만 진하게 + 이름·%·금액 상자
// list = [{cat, amt}], o = { legend(아래 목록, 기본 켬), color(x → 색), center(가운데 글자 색), amount(가운데 금액, 기본 켬), full(구멍 없는 꽉 찬 원형, 가운데 글자 없음) }. 10개 넘으면 작은 것들은 '그 밖'
export const PIE_WARM = ["#FF5A3C", "#FF8A4C", "#F5A623", "#F7C948", "#A8D84E", "#4CC38A", "#3BB3C3", "#8E7CF0"];
export const PIE_COOL = ["#2F6FEB", "#3DD6C4", "#5BC0EB", "#8E7CF0", "#A8D84E", "#F7C948", "#FF8A4C", "#D9488F"];
export function pieHtml(kind, list, label, o = {}) {
  let xs = list.filter((x) => x.amt > 0).sort((a, b) => b.amt - a.amt);
  const total = xs.reduce((t, x) => t + x.amt, 0);
  if (!total) return "";
  if (E.catRank && kind && !o.color) {   // 냐냐: 금액 큰 8개는 서로 다른 색, 9번째부터 '그 밖' 한 조각
    const kk = kind === "move" ? "expense" : kind;
    setCatView(kk, xs.map((x) => x.cat));
    const keep = xs.slice(0, CAT_N), rest = xs.slice(CAT_N);
    xs = rest.length ? keep.concat([{ cat: rest.length === 1 ? rest[0].cat : "그 밖", amt: rest.reduce((t, x) => t + x.amt, 0), other: true }]) : keep;
  }
  if (xs.length > 10) xs = xs.slice(0, 9).concat([{ cat: "그 밖", amt: xs.slice(9).reduce((t, x) => t + x.amt, 0), other: true }]);
  const col = (x) => x.other ? `var(--c${CAT_N})` : o.color ? o.color(x) : catVar(kind, x.cat), pctS = (x) => (x.amt / total * 100).toFixed(1).replace(/\.0$/, "");
  // 냐냐: 꽉 찬 원형(o.full, 통계·공통)은 크게 — 옆 여백을 줄이고 반지름을 키움 (이름표는 칸 여백까지 넘쳐도 보이게 nyanya.css)
  const W = o.full ? 400 : 460, H = o.full ? 300 : 280, cx = W / 2, cy = H / 2, R = o.full ? 118 : 92, r0 = o.full ? 0 : 58, f = (v) => v.toFixed(1);
  const pt = (a, rr) => `${f(cx + rr * Math.cos(a))} ${f(cy + rr * Math.sin(a))}`;
  const arc = (a1, a2, ro, ri) => {
    if (a2 - a1 > Math.PI * 2 - 0.01) { const h = a1 + Math.PI; return `M${pt(a1, ro)}A${ro} ${ro} 0 1 1 ${pt(h, ro)}A${ro} ${ro} 0 1 1 ${pt(a1, ro)}Z` + (ri ? `M${pt(a1, ri)}A${ri} ${ri} 0 1 0 ${pt(h, ri)}A${ri} ${ri} 0 1 0 ${pt(a1, ri)}Z` : ""); }   // 한 조각 = 고리 전체
    const lg = a2 - a1 > Math.PI ? 1 : 0; return `M${pt(a1, ro)}A${ro} ${ro} 0 ${lg} 1 ${pt(a2, ro)}L${pt(a2, ri)}A${ri} ${ri} 0 ${lg} 0 ${pt(a1, ri)}Z`;
  };
  let a = -Math.PI / 2;
  const sl = xs.map((x) => { const a1 = a, a2 = a + Math.max(x.amt / total * Math.PI * 2, 0.0001); a = a2; return { x, a1, a2, mid: (a1 + a2) / 2, c: col(x) }; });
  // 이름표: 오른쪽·왼쪽으로 나눠 위에서 아래로 겹치지 않게 (두 줄이라 28 간격)
  [true, false].forEach((right) => {
    const side = sl.filter((p) => (Math.cos(p.mid) >= 0) === right).map((p) => (p.ly = cy + (R + 22) * Math.sin(p.mid), p)).sort((p, q) => p.ly - q.ly);
    side.forEach((p, k) => { if (k && p.ly < side[k - 1].ly + 28) p.ly = side[k - 1].ly + 28; });
    for (let k = side.length - 1, lim = H - 16; k >= 0; k--) { if (side[k].ly > lim) side[k].ly = lim; lim = side[k].ly - 28; }
    side.forEach((p) => { if (p.ly < 14) p.ly = 14; p.right = right; });
  });
  const g = sl.map((p) => {
    const gap = o.full ? 22 : 34, cut = o.full ? 7 : 14, ex = p.right ? cx + R + gap : cx - R - gap, name = p.x.cat.length > cut ? p.x.cat.slice(0, cut - 1) + "…" : p.x.cat;
    return `<g class="sl" tabindex="0" data-n="${esc(p.x.cat)}" data-p="${pctS(p.x)}" data-v="${esc(won(p.x.amt))}" data-c="${esc(p.c)}">` +
      `<path class="halo" d="${arc(p.a1, p.a2, R + 9, R)}" fill="${p.c}"/><path class="seg" d="${arc(p.a1, p.a2, R, r0)}" fill="${p.c}"/>` +
      `<polyline class="pl-l" points="${pt(p.mid, R + 3)} ${pt(p.mid, R + 13)} ${f(ex)} ${f(p.ly)}" stroke="${p.c}"/>` +
      `<text class="pl-n" x="${f(ex + (p.right ? 4 : -4))}" y="${f(p.ly - 1)}" text-anchor="${p.right ? "start" : "end"}">${esc(name)}</text>` +
      `<text class="pl-p" x="${f(ex + (p.right ? 4 : -4))}" y="${f(p.ly + 13)}" text-anchor="${p.right ? "start" : "end"}">${pctS(p.x)} %</text><title>${esc(p.x.cat)} ${won(p.x.amt)} (${pctS(p.x)}%)</title></g>`;
  }).join("");
  const mid = o.full ? "" : `<text class="pc-l" x="${cx}" y="${o.amount === false ? cy + 6 : cy - 2}" fill="${o.center || "var(--fg)"}">${esc(label)}</text>` + (o.amount === false ? "" : `<text class="pc-v" x="${cx}" y="${cy + 17}">${moneyShort(total)}</text>`);
  return `<div class="pie2"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)} ${won(total)} 원형">${g}${mid}</svg><div class="pie-tip" hidden></div>` +
    (o.legend === false ? "" : `<ul class="pie-legend">${xs.map((x) => `<li><i style="background:${col(x)}"></i><span>${esc(x.cat)}</span><b>${won(x.amt)}</b><small>${pctS(x)}%</small></li>`).join("")}</ul>`) + "</div>";
}
// 원형 위 상자: 이름 · % · 금액 (마우스를 올리거나 누른 조각)
function pieTip(ev) {
  const g = ev.target && ev.target.closest && ev.target.closest(".pie2 .sl");
  document.querySelectorAll(".pie2").forEach((b) => { if (g && b.contains(g)) return; b.querySelector(".pie-tip").hidden = true; b.querySelectorAll(".sl.on").forEach((x) => x.classList.remove("on")); });
  if (!g) return;
  const box = g.closest(".pie2"), t = box.querySelector(".pie-tip"), rc = box.getBoundingClientRect();
  box.querySelectorAll(".sl.on").forEach((x) => { if (x !== g) x.classList.remove("on"); }); g.classList.add("on");
  const n = document.createElement("b"), p = document.createElement("span"), v = document.createElement("b");
  n.textContent = g.dataset.n; p.textContent = g.dataset.p + "%"; v.textContent = g.dataset.v; v.className = "v"; v.style.color = g.dataset.c;
  t.replaceChildren(n, p, v); t.hidden = false;
  const x = Math.min(ev.clientX - rc.left + 14, rc.width - t.offsetWidth - 4), y = ev.clientY - rc.top + 14;
  t.style.left = Math.max(4, x) + "px"; t.style.top = y + "px";
}

// 🗓️ 매달 1일 '예산 입력하기' · 15일 '수입 입력하기' 할 일 (이번 달·다음 달, 지난 날짜는 안 만듦, 한 번 만든 건 지워도 다시 안 만듦)
// 예산·수입이 들어오면 저절로 체크. 실천 시간으로는 안 침 (noPractice). 구글 캘린더에도 할 일로 가서 폰 알림
export let moneyTaskSyncing = false;
// 돈 할 일인지: 자동으로 만든 mt-budget/income-{YYYY-MM}, 또는 직접 넣었다가 바꾼 할 일(mt{k,m})
export function moneyTaskKind(x, id) {
  const mm = /^mt-(budget|income)-(\d{4}-\d{2})$/.exec(id || (x && x.id) || "");
  if (mm) return { k: mm[1], m: mm[2] };
  return x && x.mt && x.mt.k ? { k: x.mt.k, m: x.mt.m } : null;
}
// 이름: 아직이면 '○○ 입력하기', 들어오면 '🗓️ 10월 예산 760,000원' · '💰 10월 월급 2,600,000원' (월급 기록이 없으면 '수입')
function moneyTaskTitle(k, m, filled) {
  if (!filled) return k === "budget" ? "🗓️ 이번 달 예산 입력하기" : "💰 이번 달 수입 입력하기";
  const mon = +m.slice(5);
  if (k === "budget") return `🗓️ ${mon}월 예산 ${won(planOf(m).saved)}`;
  const r = monthTotals(m), sal = r.items.some((x) => x.kind === "income" && x.cat === "월급");
  return `💰 ${mon}월 ${sal ? "월급" : "수입"} ${won(r.inc)}`;
}
export function syncMoneyTasks() {
  if (moneyTaskSyncing || !E.backend || !S.loaded || E.testMode) return;
  const t = today(), made = S.settings.autoTasks || {}, jobs = [], flags = {}, budgets = S.settings.budgets || {};
  [t.slice(0, 7), shiftMonth(t.slice(0, 7), 1)].forEach((m) => {
    [["budget", "01"], ["income", "15"]].forEach(([k, dd]) => {
      const ok = k === "budget" ? !!budgets[m] : monthTotals(m).inc > 0, key = `mt-${k}-${m}`, date = `${m}-${dd}`, want = moneyTaskTitle(k, m, ok);
      let id = key, x = S.tasks.get(key);
      if (!x) { const f = [...S.tasks].find(([, v]) => v && v.mt && v.mt.k === k && v.mt.m === m); if (f) { id = f[0]; x = f[1]; } }
      if (!x && !made[key]) {   // 직접 넣은 '예산 입력…'·'수입 입력…' 할 일(그 달 하루짜리)은 이 할 일로 바꿈 — 붙은 시간 기록은 지움 (실천 아님, ↶로 되돌릴 수 있음)
        const re = k === "budget" ? /예산\s*입력/ : /수입\s*입력/;
        const own = [...S.tasks].find(([tid, v]) => v && (!v.repeat || v.repeat === "none") && v.date && v.date.slice(0, 7) === m && re.test(v.title || "") && !/^(mt|cp)-/.test(tid) && !v.mt);
        if (own) {
          const [oid, ov] = own;
          jobs.push(async () => {
            await E.backend.update("tasks", oid, { mt: { k, m }, noPractice: true, minutes: null, title: want, done: ok, doneDate: ok ? (ov.doneDate || t) : null });
            for (const l of rows(S.logs).filter((l) => l.taskId === oid)) await E.backend.remove("logs", l.id);
          });
          flags[key] = true; return;
        }
      }
      if (!x && !made[key] && date >= t) { jobs.push(() => E.backend.set("tasks", key, { title: want, repeat: "none", date, done: ok, doneDate: ok ? t : null, noPractice: true, createdAt: Date.now() })); flags[key] = true; }
      else if (x && ok && (!x.done || x.title !== want)) jobs.push(() => E.backend.update("tasks", id, { done: true, doneDate: x.doneDate || t, title: want }));
      else if (x && !ok && x.title !== want) jobs.push(() => E.backend.update("tasks", id, { done: false, doneDate: null, title: want }));   // 지우면 원래대로
    });
  });
  if (!jobs.length) return;
  moneyTaskSyncing = true;
  quietly(async () => { for (const j of jobs) await j(); if (Object.keys(flags).length) await E.backend.saveSettingsDeep({ autoTasks: flags }); }).catch(() => {}).finally(() => { moneyTaskSyncing = false; });
}
// 💳 카드값: 결제일이 되면 '💳 ○○카드 값 이체하기 (예상 …원)' 할 일 (tasks.cardPay). 체크하면 금액 확인 창 → [이체 기록하기]로
// '빠지는 통장 → 카드' 이체 기록 (자동으로 넣지 않음). id = cp-{카드}-{YYYY-MM} (할 일·이체 같은 id), 지우면 다시 안 만듦 (settings.autoTasks)
export let cardPaySyncing = false;
export const cardValue = (n) => /카드$/.test(n || "") ? n + "값" : (n || "카드") + " 카드값";   // 현대카드 → 현대카드값, 신한 → 신한 카드값
export function dayInMonth(m, d) { const last = new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate(); return `${m}-${pad(Math.min(d, last))}`; }
export function cardPayPlan(p, m) { return { date: dayInMonth(m, p.day), from: dayInMonth(shiftMonth(m, p.fm ?? -1), p.fd || 1), to: dayInMonth(shiftMonth(m, p.tm ?? -1), p.td || 31) }; }
export function cardSpent(id, from, to) { let s = 0; S.money.forEach((x) => { if ((x.kind === "expense" || !x.kind) && isWon(x) && x.account === id && x.date >= from && x.date <= to) s += Number(x.amount) || 0; }); return s; }
export function syncCardPays() {
  if (cardPaySyncing || !E.backend || !S.loaded || E.testMode) return;
  const t = today(), m = t.slice(0, 7), made = S.settings.autoTasks || {}, jobs = [], flags = {};
  S.accounts.forEach((a, id) => {
    const p = a && a.type === "card" && a.pay; if (!p || !p.day || !p.from || !S.accounts.has(p.from)) return;
    const pl = cardPayPlan(p, m), key = `cp-${id}-${m}`;
    if (pl.date > t || pl.date < (p.since || t) || made[key] || S.money.has(key) || S.tasks.has(key)) return;
    const amt = cardSpent(id, pl.from, pl.to);
    flags[key] = true;
    jobs.push(() => E.backend.set("tasks", key, { title: `💳 ${cardValue(a.name)} 이체하기 (${amt > 0 ? "예상 " + won(amt) : "이 기간 사용 없음"})`, repeat: "none", date: pl.date, done: false, doneDate: null, noPractice: true,
      cardPay: { card: id, from: p.from, start: pl.from, end: pl.to }, createdAt: Date.now() }));
  });
  if (!jobs.length) return;
  cardPaySyncing = true;
  quietly(async () => { for (const j of jobs) await j(); await E.backend.saveSettingsDeep({ autoTasks: flags }); }).catch(() => {}).finally(() => { cardPaySyncing = false; });
}
// 💝 줄 돈: 이번 달 15일이 되면 '보낸 돈'(transfer)을 money/give-{YYYY-MM}로 자동 기록 (그 달에 이미 직접 보낸 만큼은 빼고, 다 보냈으면 안 넣음)
// 한 번 넣은 달은 다시 안 넣음 (settings.autoTasks) — 지우거나 고쳐도 그대로
export let giveSyncing = false;
export function syncGive() {
  if (giveSyncing || !E.backend || !S.loaded || E.testMode) return;
  const t = today(), m = t.slice(0, 7), id = `give-${m}`, made = S.settings.autoTasks || {};
  if (t < `${m}-15` || made[id] || S.money.has(id)) return;
  const pl = planOf(m); if (!(pl.give > 0)) return;
  const amt = pl.give - monthTotals(m).out;
  giveSyncing = true;
  quietly(async () => {
    if (amt > 0) await E.backend.set("money", id, { kind: "transfer", cat: moneyCats("transfer")[0] || "생활비", amount: amt, date: `${m}-15`, account: S.accounts.has(S.settings.giveFrom) ? S.settings.giveFrom : null, memo: `💝 ${+m.slice(5)}월 줄 돈 (자동)`, auto: true, createdAt: Date.now() });
    await E.backend.saveSettingsDeep({ autoTasks: { [id]: true } });
  }).catch(() => {}).finally(() => { giveSyncing = false; });
}
// 💳 카드값 결제 확인 창: 할 일 '카드값 이체하기' 체크, 또는 자산 탭 카드의 [결제]
// 금액(미리 계산, 고칠 수 있음) · 날짜 · 빠지는 통장을 확인하고 [이체 기록하기]를 눌러야 '통장 → 카드' 이체로 기록 (자동으로 안 넣음)
// 할 일에서 왔거나 그 결제의 할 일이 아직이면 같은 id(cp-카드-월)로 기록하고 할 일도 체크
export let cardPayFor = null;
export function openCardPay(taskId) {
  const x = S.tasks.get(taskId), c = x && x.cardPay; if (!c) return;
  showCardPay({ taskId, card: c.card, from: c.from, start: c.start, end: c.end, date: x.date || today(), amt: cardSpent(c.card, c.start, c.end) });
}
function showCardPay(o) {
  const card = S.accounts.get(o.card); if (!card) return;
  cardPayFor = o;
  const banks = sortedAccts().filter((a) => a.type !== "card");
  $("mvTitle").textContent = `💳 ${cardValue(card.name)} 결제`;
  $("mvText").innerHTML = `<p class="small muted">${o.start ? `이용기간 ${shortDate(o.start)} ~ ${shortDate(o.end)} 사용분이에요. ` : ""}카드 앱의 실제 청구 금액과 다르면 고쳐 주세요 (할부·연회비 등). [이체 기록하기]를 눌러야 기록돼요.</p>` +
    `<div class="form"><label class="f">금액 (원)<input type="text" class="amt-in" id="cpAmt" inputmode="numeric" autocomplete="off" value="${o.amt ? commaNum(o.amt) : ""}"></label>` +
    `<div class="row"><label class="f">날짜<input type="date" id="cpDate" value="${esc(o.date || today())}"></label>` +
    `<label class="f">빠지는 통장<select id="cpFrom">${acctOptsHtml(banks, o.from) || '<option value="">통장을 먼저 추가해 주세요</option>'}</select></label></div>` +
    `<p class="small muted" style="margin:0">→ 받는 곳: 💳 ${esc(card.name)}</p></div>`;
  $("mvBtns").innerHTML = '<button class="btn" type="button" data-act="cardPayDo">이체 기록하기</button><button class="btn ghost" type="button" data-act="mvClose">취소</button>';
  openDlg($("moveDlg"));
}
export function doCardPay() {
  const o = cardPayFor, amt = amtVal($("cpAmt")), from = $("cpFrom").value, date = $("cpDate").value || today(); if (!o || !ready()) return;
  if (!(amt > 0)) { toast("금액을 적어 주세요."); return; }
  if (!S.accounts.has(from)) { toast("카드값이 빠지는 통장을 골라 주세요."); return; }
  cardPayFor = null; closeDlg($("moveDlg"));
  const card = S.accounts.get(o.card), t = today(), id = o.taskId;
  const doc = { kind: "move", account: from, toAccount: o.card, amount: amt, date, memo: "카드정산 결제", note: o.start ? `${shortDate(o.start)}~${shortDate(o.end)} 사용분` : null, createdAt: Date.now() };   // 냐냐: 편한가계부처럼 내용 '카드정산 결제' (원래: 💳 ○○카드값 (기간 사용분))
  act((async () => {
    if (id) { await E.backend.set("money", id, doc); await E.backend.update("tasks", id, { done: true, doneDate: t }); }
    else await E.backend.add("money", doc);
  })(), `💳 카드값 ${won(amt)} 이체를 기록했어요.`).catch(() => {});
}
// 결제예정 = 지금 카드값 − 그 결제 이용기간 뒤에 쓴 돈(미결제)
// 냐냐 쪽 (편한가계부처럼): 이용기간이 끝난 가장 최근 결제 = '저번 달 사용분'을 결제예정으로. 결제일을 안 정한 카드도 지난달 1일~말일로
//   (욱진 보드 원래: 결제일이 안 지났으면 이번 달, 지났으면 다음 달 결제 · 결제일 없으면 null)
export function cardDue(a, owed) {
  if (!a || a.type !== "card") return null;
  const p = a.pay && a.pay.day ? a.pay : { day: 1, fm: -1, fd: 1, tm: -1, td: 31 };
  const t = today(), m0 = t.slice(0, 7);
  let m = m0, pl = cardPayPlan(p, m0);
  if (pl.to >= t) { m = shiftMonth(m0, -1); pl = cardPayPlan(p, m); }
  let open = 0; S.money.forEach((x) => { if ((x.kind === "expense" || !x.kind) && isWon(x) && x.account === a.id && x.date > pl.to) open += Number(x.amount) || 0; });
  return { m, ...pl, open: Math.min(open, Math.max(0, owed)), due: Math.max(0, owed - open) };
}
function payCardNow(id) {
  const a = S.accounts.get(id); if (!a) return;
  const owed = Math.max(0, -(balances()[id] || 0)), d = cardDue({ ...a, id }, owed), t = today(), m0 = t.slice(0, 7);
  const banks = sortedAccts().filter((x) => x.type !== "card"), p = a.pay || {};
  const from = S.accounts.has(p.from) ? p.from : S.accounts.has(lastAcct("move")) && S.accounts.get(lastAcct("move")).type !== "card" ? lastAcct("move") : banks[0] ? banks[0].id : "";
  // 아직 안 한 '카드값 이체하기' 할 일이 있으면 그걸로 (이번 달 → 다음 결제 달)
  const taskId = [m0, d ? d.m : m0].map((mm) => `cp-${id}-${mm}`).find((k) => S.tasks.has(k) && !S.tasks.get(k).done && !S.money.has(k)) || null;
  const tc = taskId && S.tasks.get(taskId).cardPay;
  showCardPay({ taskId, card: id, from, start: tc ? tc.start : d ? d.from : null, end: tc ? tc.end : d ? d.to : null, date: t, amt: tc ? cardSpent(id, tc.start, tc.end) : d ? d.due : owed });
}

// ---------- 한 달 예산: settings.budgets[월] = { income, items: {id: {cat, memo, amount, createdAt}} } ----------
// 쓸 돈을 분류별로 미리 정해 두면, 예상 수입에서 빼서 여자친구에게 줄 수 있는 돈이 얼마쯤인지 보임
// 예산이 없는 달은 그 전 가장 가까운 달 예산을 그대로 이어서 씀 (고치는 순간 그 달 것으로 저장)
export function planSource(m) {
  const all = S.settings.budgets || {};
  if (all[m]) return m;
  const ks = Object.keys(all).filter((k) => k < m && all[k]).sort();
  return ks.length ? ks[ks.length - 1] : null;
}
// 💑 냐냐: 공통비용 예산은 '내 몫'으로 적어 둠 → 내 몫 보기를 끄면 두 배(전체)로 보여 줌 (저장은 늘 내 몫, 고칠 때 ÷2)
export const planX = (cat) => E && E.mineView && !mineOn() && /공통비용/.test(cat || "") ? 2 : 1;
// 냐냐: 그 달에 월급(분류에 '월급')이 들어왔는지
function hasSalary(mm) { let f = false; S.money.forEach((x) => { if (!f && x && x.kind === "income" && (x.date || "").slice(0, 7) === mm && /월급/.test(x.cat || "")) f = true; }); return f; }
export function planOf(m) {
  const src = planSource(m), b = (src && S.settings.budgets[src]) || {};
  const items = Object.entries(b.items || {}).filter(([, v]) => v && v.cat).map(([id, v]) => ({ id, ...v, show: (Number(v.amount) || 0) * planX(v.cat) }))
    .sort((a, b2) => (a.createdAt || 0) - (b2.createdAt || 0));
  // 수입: 이번 달 실제 수입 → 아직이면 지난달 실제 수입 (incAuto). 예상 수입을 따로 넣는 칸은 없앰 (예전에 넣은 income은 안 씀)
  // 💝 줄 돈(give): 욱진이가 예산에서 정한 금액 (안 정하면 null → 남는 돈은 다 잔액)
  // 냐냐: 지난달엔 월급이 있었는데 이번 달엔 아직이면 지난달 수입으로 (월초 이자 몇 원만 들어와 수입이 0처럼 보이던 것, 2026-10-27)
  const prevM = shiftMonth(m, -1), cur = monthTotals(m).inc, prevInc = monthTotals(prevM).inc, incAuto = prevInc > 0 && (!cur || (!hasSalary(m) && hasSalary(prevM)));
  const give = b.give == null || b.give === "" ? null : Number(b.give) || 0;
  return { income: incAuto ? prevInc : cur, incAuto, incFrom: incAuto ? prevM : null, give, items, total: items.reduce((t, v) => t + v.show, 0), saved: items.reduce((t, v) => t + (Number(v.amount) || 0), 0), from: src && src !== m ? src : null };
}
export function savePlan(m, patch, msg) {
  if (!ready()) return Promise.resolve();
  const pl = planOf(m);
  if (pl.from) {   // 이어서 쓰던 예산을 이 달 것으로 옮겨 적고 바꿀 칸만 덮어씀
    const base = { items: {} };
    if (pl.give != null) base.give = pl.give;   // 이어 쓰던 줄 돈도 같이 옮김
    pl.items.forEach((v) => { base.items[v.id] = { cat: v.cat, memo: v.memo || "", amount: Number(v.amount) || 0, createdAt: v.createdAt || Date.now() }; });
    patch = deepMerge(base, patch);
  }
  return act(E.backend.saveSettingsDeep({ budgets: { [m]: patch } }), msg).catch(() => {});
}
// 💝 줄 돈: 욱진이가 정한 금액 그대로 (수입에 따라 안 바뀜). 네(관리자)가 [확인했어요] 하면 settings.giveConfirm[월] = {inc, give, at}
export function giveOf(m, r, pl) {
  const conf = (S.settings.giveConfirm || {})[m];
  const ok = pl.give != null && conf && r.inc > 0 && conf.inc === r.inc && Number(conf.give) === pl.give;
  return { give: pl.give, state: pl.give == null ? "none" : ok ? "ok" : "set" };
}
export function renderPlan(m, r) {
  const pl = planOf(m), g = giveOf(m, r, pl), give = g.give, adm = moneyAdminView();
  $("planSub").textContent = pl.from
    ? `${monthLabel(m)} · ${monthLabel(pl.from)} 예산을 이어서 쓰는 중 (고치면 이 달 것만 바뀌어요)`
    : `${monthLabel(m)} · 쓸 돈을 분류별로 정해 두는 곳 (다음 달로 그대로 이어져요)`;
  const left = pl.income - pl.total - (give || 0);   // 잔액 = 수입 − 쓸 돈 − 줄 돈
  $("planTiles").innerHTML =
    `<div class="plan-tile"><span>수입</span><b>${pl.income ? won(pl.income) : "-"}</b><small>${pl.incAuto ? `지난달 기준 (${monthLabel(pl.incFrom)} 실제)${r.inc ? " · 월급 들어오면 이번 달로" : ""}` : r.inc ? "이번 달 실제" : "수입이 들어오면 계산돼요"}</small></div>` +
    `<div class="plan-tile"><span>쓸 돈 (예산)</span><b>${won(pl.total)}</b><small>${adm ? `${pl.items.length}개 분류` : pl.items.length ? `실제 ${won(r.exp)} 씀` : "분류별로 추가해요"}</small></div>` +
    (E.give === false ? "" : (() => {   // 💝 줄 돈 → 15일에 자동으로 '보낸 돈' 기록되면 '준 돈 ✅' + [고치기] (그 기록 열기)
      const gid = `give-${m}`, auto = S.money.get(gid), sent = give != null && r.out >= give;
      const sub = give == null ? (adm ? "욱진이가 예산에서 정해요" : "아래에서 정해요")
        : auto || sent ? `${auto ? shortDate(auto.date) + " " : ""}${won(r.out)} 보냄${r.out < give ? ` · 남은 ${won(give - r.out)}` : ""}${auto && !adm ? ` · <button class="link-btn" type="button" data-act="editMoney" data-id="${gid}">고치기</button>` : ""}`
        : r.out ? `${won(r.out)} 보냄 · 남은 ${won(give - r.out)} · 15일 자동 기록` : "15일에 자동으로 '보낸 돈' 기록";
      return `<div class="plan-tile give"><span>💝 ${esc(partner())}에게 ${auto || sent ? "준 돈 ✅" : "줄 돈"}${g.state === "ok" ? " ✔" : ""}</span><b>${give == null ? "아직 안 정함" : won(give)}</b><small>${sub}</small></div>`;
    })()) +
    `<div class="plan-tile left${left < 0 ? " minus" : ""}"><span>잔액</span><b>${pl.income ? wonN(left) : "-"}</b><small>수입 − 쓸 돈${give == null ? "" : " − 줄 돈"}</small></div>`;
  $("planPie").innerHTML = pieHtml("expense", pl.items.map((v) => ({ cat: v.cat, amt: v.show })), "예산", { full: E.pieFull });
  if (document.activeElement !== $("planGive")) $("planGive").value = give == null ? "" : commaNum(give);
  const gf = $("planGiveFrom"), gfv = S.settings.giveFrom || "";
  gf.innerHTML = '<option value="">선택 안 함</option>' + sortedAccts().filter((x) => x.type !== "card").map((x) => `<option value="${esc(x.id)}">${ACCT_ICON[x.type] || ""} ${esc(x.name)}</option>`).join("");
  gf.value = S.accounts.has(gfv) ? gfv : "";
  const planned = new Set(pl.items.map((v) => v.cat));
  const extra = Object.entries(r.byCat).filter(([c]) => !planned.has(c)).reduce((t, [, v]) => t + v, 0);
  if (adm) {
    $("planRows").innerHTML = pl.items.map((v) => `<div class="plan-row plan-ro"><span class="plan-cat">${catDot("expense", v.cat)}${esc(v.cat)}${v.memo ? ` <span class="muted small" style="font-weight:400">· ${esc(v.memo)}</span>` : ""}</span><span class="won">${won(v.show)}</span></div>`).join("") ||
      '<p class="small muted" style="margin:0">아직 예산이 없어요.</p>';
    return;
  }
  $("planRows").innerHTML = pl.items.map((v) => {
    const used = r.byCat[v.cat] || 0, amt = v.show, over = used > amt;
    return `<div class="plan-row"><span class="plan-cat">${catDot("expense", v.cat)}${esc(v.cat)}</span>` +
      `<input type="text" class="plan-memo" maxlength="40" value="${esc(v.memo || "")}" placeholder="메모" data-plan-memo="${esc(v.id)}" aria-label="${esc(v.cat)} 메모">` +
      `<input type="text" class="plan-amt amt-in" inputmode="numeric" autocomplete="off" value="${amt ? commaNum(amt) : ""}" data-plan-amt="${esc(v.id)}" aria-label="${esc(v.cat)} 예산">` +
      `<div class="plan-use"><div class="bar${over ? " over" : ""}"><i style="width:${amt ? Math.min(100, Math.round(used / amt * 100)) : used ? 100 : 0}%;--cat:${catVar("expense", v.cat)}"></i></div>` +
      `<span class="small muted">${won(used)} 씀 · ${over ? `<span class="won minus">${won(used - amt)} 초과</span>` : `<span class="won plus">${won(amt - used)} 남음</span>`}</span></div>` +
      `<button class="icon-btn" type="button" data-act="planDel" data-id="${esc(v.id)}" aria-label="${esc(v.cat)} 예산 빼기">빼기</button></div>`;
  }).join("") + (pl.items.length && extra ? `<div class="plan-row extra"><span class="plan-cat">예산 밖</span><span class="won">${won(extra)}</span><span class="small">예산에 없는 분류로 쓴 돈</span><span></span></div>` : "") +
    (pl.items.length ? "" : '<p class="small muted" style="margin:0">예: 식비 300,000 · 교통·차량 150,000 · 통신 60,000. 분류는 돈 기록의 지출 분류와 같게 쓰면 실제로 쓴 돈이 같이 보여요.</p>');
  $("planCatList").innerHTML = moneyCats("expense").filter((c) => !planned.has(c)).map((c) => `<option value="${esc(c)}">`).join("");
}

export const curMonth = () => ui.month;   // 냐냐: 📝 이번 달 정리(summary.js)가 예산 탭에서 고른 달을 읽음
export function monthTotals(m, range) {   // range = {from, to} 이면 그 기간 (내역 기간 고르기)
  const r = { inc: 0, out: 0, exp: 0, byCat: {}, items: [], settleIn: 0 };
  S.money.forEach((x, id) => {
    if (!x.date || (range ? x.date < range.from || x.date > range.to : x.date.slice(0, 7) !== m)) return;
    const a = isWon(x) ? cntAmt(x) : 0;   // 다른 화폐는 목록엔 보이고 합계엔 안 들어감. 💑 내 몫 보기면 공통비용 절반·욱진입금 0
    if (mineOn() && isWon(x) && isSettleIn(x)) r.settleIn += Number(x.amount) || 0;
    r.items.push({ id, ...x });
    if (x.kind === "income") r.inc += a;
    else if (x.kind === "transfer") r.out += a;
    else if (x.kind === "expense" || !x.kind) { r.exp += a; r.byCat[x.cat || "기타"] = (r.byCat[x.cat || "기타"] || 0) + a; }
    // move(내 자산끼리 이체)는 수입·지출이 아님
  });
  r.left = r.inc - r.out - r.exp;
  return r;
}
// 자산별 잔액: 시작 잔액 + 들어온 돈 − 나간 돈 (카드는 음수 = 갚을 카드값). upTo = 그 날까지만
export function balances(upTo) {
  const b = {};
  S.accounts.forEach((a, id) => { b[id] = Number(a.initial) || 0; });
  S.money.forEach((x) => {
    if (!isWon(x) || (upTo && x.date > upTo)) return;
    const amt = Number(x.amount) || 0;
    if (x.kind === "income") { if (x.account in b) b[x.account] += amt; }
    else if (x.kind === "move") { if (x.account in b) b[x.account] -= amt; if (x.toAccount in b) b[x.toAccount] += amt; }
    else if (x.account in b) b[x.account] -= amt;
  });
  return b;
}
export const acctName = (id) => !id ? "자산 미지정" : S.accounts.has(id) ? S.accounts.get(id).name : "지운 자산";
export const sortedAccts = () => rows(S.accounts).filter((a) => !a.hidden).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));   // 🙈 숨긴 자산은 목록·합계·고르는 칸에서 빼기 (냐냐 쪽에서 더함, 기록은 그대로)
export const ACCT_ICON = { bank: "🏦", card: "💳", cash: "💵", save: "🐷" };

// 관리자(여자친구) 기기에선 지출·자산은 안 보이게 (예산 금액 · 수입 · 보낸 돈만). 화면에서만 숨김
export function moneyAdminView() { return isAdminDevice() && !DEMO; }
export function moneyShown(x) { return !moneyAdminView() || x.kind === "income" || x.kind === "transfer"; }   // 달력 날짜·검색에서도 같게
// 돈 관리 탭: 예산 · 지출 · 자산 · 통계 (이 기기에 기억). 관리자 기기는 자산 탭 없음, 지출 탭은 '내역'(수입·보낸 돈 목록만)
export function mTab() { let v = "budget"; try { v = localStorage.getItem("nyanya-mtab") || "budget"; } catch (e) { /* 무시 */ } if (!["budget", "spend", "cal", "assets", "stats", "report", "settings", "common"].includes(v)   // 📑 report = 보고서 탭 (냐냐 전용, report.js — 2026-10-26 숨겼다가 카드 먼저 모양으로 다시 만들어 켬)
     || ((v === "assets" || v === "settings" || v === "cal") && moneyAdminView())) v = "budget"; return v; }
export function setMTab(k) { try { localStorage.setItem("nyanya-mtab", k); } catch (e) { /* 무시 */ } if (k === "assets") { ui.asSel = null; ui.asOpen = false; } renderMoney(); }
export function renderMTabs() {
  const adm = moneyAdminView(), tab = adm ? "stats" : mTab();   // 관리자 보드 '예산'은 통계만 (실제 수입 · 보낸 돈 · 나머지)
  $("mTabs").hidden = adm;
  // 가계부 모드: 옆 메뉴(PC)·아래 메뉴(폰)의 예산·지출·자산·통계 / 제목: 관리자 보드는 '예산', 그 외 '가계부'
  document.querySelectorAll('.m-nav, #mBottom button').forEach((b) => { const on = b.dataset.k === tab; b.setAttribute(b.tagName === "A" ? "aria-current" : "aria-pressed", on ? (b.tagName === "A" ? "page" : "true") : (b.tagName === "A" ? "" : "false")); if (b.tagName === "A" && !on) b.removeAttribute("aria-current"); });
  $("moneyTitle").textContent = adm ? "예산" : (E.tabTitles && E.tabTitles[tab]) || "가계부";   // 냐냐: 탭 이름을 제목으로 (env.tabTitles)
  document.querySelectorAll("#mTabs button").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.k === tab));
    b.hidden = adm && b.dataset.k === "assets";
    if (b.dataset.k === "spend") b.textContent = "🧾 내역";
  });
  $("mTabs").classList.toggle("seg3", adm);
  document.querySelectorAll("#moneyPage [data-mtab]").forEach((el) => { el.hidden = el.dataset.mtab !== tab; });
  // 맨 위 달 넘기기는 예산 탭만 (내역·달력·자산·통계는 자기 칸에 따로), 맨 위 요약 4칸은 관리자 보드만 (내역 탭에 요약 칸이 있어서)
  document.querySelector("#moneyPage .month-nav").hidden = !adm && tab !== "budget"; $("moneyStats").hidden = !adm;
  const mb = $("mineBtn"); if (mb) { mb.hidden = !E.mineView || !["budget", "spend", "cal", "stats", "report"].includes(tab); mb.setAttribute("aria-pressed", String(mineOn())); }   // 💑 내 몫으로 보기 (냐냐)
  if (tab === "settings" && !$("catEditor").contains(document.activeElement)) { renderCatEditor(); renderCurEditor(); }
}
export function renderMoney() {
  const m = ui.month, r = monthTotals(m), bal = balances(), adm = moneyAdminView();
  renderMTabs();
  setCatMap(planOf(m).items.map((v) => v.cat).concat(Object.keys(r.byCat)));
  $("monthLabel").textContent = monthLabel(m);
  $("moneyPage").classList.toggle("admin-view", adm);
  $("moneyIntro").textContent = adm ? "💡 지출은 욱진이만 보여요. 기능 오류나 추가 기능이 있으면 욱진이에게 자세히 설명해 달라고 하자!" : "통장·카드별로 기록하면 자산마다 잔액이 계산돼요.";
  $("moneyStats").classList.toggle("three", adm);
  $("moneyStats").innerHTML = adm
    ? statTile("실제 수입", won(r.inc)) + statTile(partner() + "에게 보낸 돈", won(r.out), r.inc ? `수입의 ${Math.round(r.out / r.inc * 100)}%` : "") +
      statTile("나머지", won(r.inc - r.out), "실제 수입 − 보낸 돈", "left" + (r.inc - r.out < 0 ? " minus" : ""))
    : statTile("수입", won(r.inc)) +
    statTile(partner() + "에게 보낸 돈", won(r.out), r.inc ? `수입의 ${Math.round(r.out / r.inc * 100)}%` : "") +
    statTile("지출", won(r.exp), r.inc ? `수입의 ${Math.round(r.exp / r.inc * 100)}%` : "") +
    statTile("남은 돈", won(r.left), r.inc ? `수입의 ${Math.round(r.left / r.inc * 100)}%` : "", r.left < 0 ? "minus" : "plus");

  // 내 자산
  const accts = sortedAccts();
  renderAssets(accts, bal);

  renderPlan(m, r);

  // 지출 예산·분류 (한 달 예산을 짰으면 그 합계, 아니면 예전 '한 달 지출 예산')
  // 내역에서 기간을 골랐으면(ui.txRange) 이 칸도 그 기간 지출 — 예산은 한 달 단위라 기간일 땐 막대·예산 칸을 숨기고 합계만
  const rng = ui.txRange, rs = rng ? monthTotals(null, rng) : r;
  const planTotal = planOf(m).total;
  const budget = rng ? 0 : planTotal || Number(S.settings.budget) || 0;
  $("budgetForm").hidden = !!planTotal || !!rng; $("budgetFromPlan").hidden = !planTotal || !!rng;
  const bar = $("budgetBar"); bar.hidden = !!rng;
  bar.classList.toggle("over", budget > 0 && rs.exp > budget);
  bar.firstElementChild.style.width = (budget ? Math.min(100, Math.round(rs.exp / budget * 100)) : 0) + "%";
  $("budgetLeft").innerHTML = rng ? `${esc(rangeLabel(rng.from, rng.to))} 지출 <span class="won">${wonN(rs.exp)}</span>`
    : budget
    ? `예산 ${won(budget)} 중 <span class="won">${wonN(rs.exp)}</span> 씀 · ` + (rs.exp > budget ? `<span class="won minus">${won(rs.exp - budget)} 초과</span>` : `<span class="won plus">${won(budget - rs.exp)} 남음</span>`)
    : "예산을 넣으면 남은 금액이 보여요";
  if (document.activeElement !== $("budgetIn")) $("budgetIn").value = commaNum(planTotal || Number(S.settings.budget) || "");
  $("catBars").innerHTML = pieHtml("expense", Object.entries(rs.byCat).map(([cat, amt]) => ({ cat, amt })), "지출", { full: E.pieFull }) || `<div class="muted small">${rng ? "이 기간" : "이번 달"} 지출 기록이 아직 없어요.</div>`;

  // 최근 내역 조회: 6개월 · 1년 · 기간 (오늘 기준, 새 달이 위). 줄을 누르면 그 달로 (위 예산·내역이 그 달 것으로)
  const tm = today().slice(0, 7), hr = ui.histRange || "6";
  let from = shiftMonth(tm, -5), to = tm;
  if (hr === "12") from = shiftMonth(tm, -11);
  if (hr === "custom") { from = ui.histFrom || shiftMonth(tm, -5); to = ui.histTo || tm; if (from > to) [from, to] = [to, from]; }
  document.querySelectorAll("#histRange button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === hr)));
  $("histCustom").hidden = hr !== "custom";
  if (hr === "custom" && document.activeElement !== $("histFrom") && document.activeElement !== $("histTo")) { $("histFrom").value = from; $("histTo").value = to; }
  const months = []; for (let mm = to; mm >= from && months.length < 60; mm = shiftMonth(mm, -1)) months.push(mm);
  const sum = { inc: 0, plan: 0, out: 0, exp: 0, left: 0 };
  let trs = "";
  months.forEach((mm) => {
    const x = monthTotals(mm), p = planOf(mm).total;
    sum.inc += x.inc; sum.plan += p; sum.out += x.out; sum.exp += x.exp; sum.left += x.left;
    trs += `<tr class="clickable${mm === m ? " cur" : ""}" data-act="histMonth" data-m="${mm}" title="눌러서 ${monthLabel(mm)} 보기"><td class="mono">${monthLabel(mm)}</td><td class="num won">${won(x.inc)}</td>` +
      (adm ? `<td class="num won">${won(x.out)}</td><td class="num won ${x.inc - x.out < 0 ? "minus" : "plus"}">${won(x.inc - x.out)}</td>`
        : `<td class="num won">${p ? won(p) : "-"}</td><td class="num won">${won(x.out)}</td><td class="num won">${won(x.exp)}</td><td class="num won ${x.left < 0 ? "minus" : "plus"}">${won(x.left)}</td>`) + "</tr>";
  });
  const tot = months.length > 1 ? `<tr class="sum"><td>합계 (${months.length}달)</td><td class="num won">${won(sum.inc)}</td>` +
    (adm ? `<td class="num won">${won(sum.out)}</td><td class="num won ${sum.inc - sum.out < 0 ? "minus" : "plus"}">${won(sum.inc - sum.out)}</td>`
      : `<td class="num won">${won(sum.plan)}</td><td class="num won">${won(sum.out)}</td><td class="num won">${won(sum.exp)}</td><td class="num won ${sum.left < 0 ? "minus" : "plus"}">${won(sum.left)}</td>`) + "</tr>" : "";
  $("monthTable").innerHTML = `<thead><tr><th>월</th><th class="num">${adm ? "실제 수입" : "수입"}</th>${adm ? '<th class="num">보낸 돈</th><th class="num">나머지</th>' : '<th class="num">예산 (쓸 돈)</th><th class="num">보낸 돈</th><th class="num">지출</th><th class="num">남은 돈</th>'}</tr></thead><tbody>${trs}${tot}</tbody>`;

  renderMoneyForm();

  renderTx(m, ui.txRange ? monthTotals(null, ui.txRange) : r);
  if (mTab() === "stats" && !moneyAdminView()) renderStats();
  if (mTab() === "cal" && !moneyAdminView()) renderMCal(m, r);
}

// ---------- 🏦 자산 탭: 왼쪽 목록(현금·통장·카드·저축 묶음, 합계, 접기) + 오른쪽 자세히 ----------
// 자세히 = 그 달 입금·출금·합계·누적잔액 + 내역(줄마다 그때 잔액). 접은 묶음은 이 기기에 기억 (ukjin-as-fold)
// 좁은 화면(≤1100px)은 목록만 → 자산을 누르면 자세히(ui.asOpen), [‹ 목록]으로 돌아감
const AS_GROUPS = [["cash", "현금"], ["bank", "통장"], ["card", "카드"], ["save", "저축"]];
function lsGet(k) { try { return localStorage.getItem(k) || ""; } catch (e) { return ""; } }
function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* 무시 */ } }
function asFold() { try { return JSON.parse(lsGet("nyanya-as-fold") || "{}") || {}; } catch (e) { return {}; } }
// 고른 자산: 탭에 처음 들어오면 '전체'(__all = 자산·부채·합계 한눈에)
export function asSelected() { return S.accounts.has(ui.asSel) ? ui.asSel : "__all"; }
// 이 자산에 들고 난 돈 (d: + 들어옴 / − 나감), 날짜 → 넣은 순서
export function acctFlow(id) {
  const out = [];
  S.money.forEach((x, mid) => {
    if (!isWon(x)) return;
    const amt = Number(x.amount) || 0; let d = 0;
    if (x.kind === "move") { if (x.account === id) d -= amt; if (x.toAccount === id) d += amt; }
    else if (x.account === id) d = x.kind === "income" ? amt : -amt;
    if (d) out.push({ ...x, id: mid, d });
  });
  return out.sort((a, b) => (a.date || "").localeCompare(b.date || "") || (a.createdAt || 0) - (b.createdAt || 0));
}
// 그 달에 보여 줄 기간: 보통은 달력 한 달. 결제일을 정한 카드는 결제일 기준 = 그 달에 빠지는 카드값의 이용기간 (date = 결제일)
export function acctPeriod(a, m) { return a && a.type === "card" && a.pay && a.pay.day ? cardPayPlan(a.pay, m) : { from: `${m}-01`, to: dayInMonth(m, 31) }; }
const ymdDot = (s) => `${s.slice(2, 4)}.${+s.slice(5, 7)}.${+s.slice(8)}`;   // 2026-10-01 → 26.10.1
function renderAssets(all, bal) {
  // 냐냐: 🤝 공동 자산(accounts.joint, 데이트통장 등)은 내 자산·부채·합계에서 빼고 맨 아래 '🤝 공동' 묶음으로 따로 (기록 칸에선 그대로 고를 수 있음)
  const accts = all.filter((a) => !a.joint), joints = all.filter((a) => a.joint);
  const fold = asFold(), sel = asSelected(), owedOf = (a) => Math.max(0, -(bal[a.id] || 0));
  const total = accts.reduce((s2, a) => s2 + (bal[a.id] || 0), 0);
  const owed = accts.filter((a) => a.type === "card").reduce((s2, a) => s2 + owedOf(a), 0);
  // 위 3칸: 자산(+ 잔액 합) · 부채(− 잔액·카드값 합) · 합계 — + 빨강 / − 파랑
  const sg = (v) => v > 0 ? " plus" : v < 0 ? " minus" : "", A0 = accts.reduce((s2, a) => s2 + Math.max(0, bal[a.id] || 0), 0), D0 = accts.reduce((s2, a) => s2 + Math.max(0, -(bal[a.id] || 0)), 0);
  $("assetTotal").hidden = !accts.length;
  $("assetTotal").innerHTML = `<div><span>자산</span><b class="won plus">${won(A0)}</b></div><div><span>부채</span><b class="won minus">${won(D0)}</b></div><div><span>합계</span><b class="won${sg(A0 - D0)}">${won(A0 - D0)}</b></div>`;
  $("acctList").innerHTML = (accts.length ? `<button type="button" class="as-all${sel === "__all" ? " on" : ""}" data-act="asSel" data-id="__all" aria-pressed="${sel === "__all"}"><span>전체<small>${accts.length}</small></span><b class="won${sg(total)}">${won(total)}</b></button>` : "") + (accts.length ? AS_GROUPS.map(([t, label]) => {
    const list = accts.filter((a) => (ACCT_TYPES[a.type] ? a.type : "bank") === t); if (!list.length) return "";
    const card = t === "card", shut = !!fold[t], sum = list.reduce((s2, a) => s2 + (card ? owedOf(a) : bal[a.id] || 0), 0);
    // 💳 카드는 결제일 기준 두 칸: 결제예정(다음 결제일에 빠질 돈) · 미결제(그 뒤 이용기간에 쓰는 중). 결제일을 안 정했으면 갚을 카드값 전체를 결제예정 칸에
    const dues = card ? list.map((a) => cardDue(a, owedOf(a)) || { due: owedOf(a), open: 0, none: true }) : [];
    const two = (l1, v1, l2, v2) => `<span class="as-cp"><span><small>${l1}</small><b class="won minus">${v1}</b></span><span><small>${l2}</small><b class="won minus">${v2}</b></span></span>`;
    return `<div class="as-group t-${t}"><button type="button" class="as-gh" data-act="asFold" data-k="${t}" aria-expanded="${!shut}">` +
      `<span>${ACCT_ICON[t]} ${label}<small>${list.length}</small><i class="as-chev" aria-hidden="true"></i></span>` +
      (card ? two("결제예정", won(dues.reduce((s2, d) => s2 + d.due, 0)), "미결제", won(dues.reduce((s2, d) => s2 + d.open, 0))) : `<b class="won${sg(sum)}">${won(sum)}</b>`) + "</button>" +
      (shut ? "" : list.map((a, i) => { const v = bal[a.id] || 0, d = dues[i];
        return `<button type="button" class="as-row${a.id === sel ? " on" : ""}" data-act="asSel" data-id="${esc(a.id)}" aria-pressed="${a.id === sel}"><span class="as-name">${esc(a.name)}${a.number ? `<small class="as-num">${esc(a.number)}</small>` : ""}</span>` +   // 냐냐: 계좌번호 (accounts.number)
          (card ? `<span class="as-cp"><b class="won${d.due ? " minus" : ""}">${won(d.due)}</b><b class="won${d.open ? " minus" : ""}">${d.none ? "-" : won(d.open)}</b></span>` : `<b class="won${sg(v)}">${won(v)}</b>`) + "</button>";
      }).join("")) + "</div>";
  }).join("") + (joints.length ? (() => {   // 🤝 공동 (내 합계에 안 들어감, 공통 탭 🏦 공동 자산에서 둘이 같이 봄)
    const shut = !!fold.joint, jsum = joints.reduce((s2, a) => s2 + (bal[a.id] || 0), 0);
    return `<div class="as-group t-joint"><button type="button" class="as-gh" data-act="asFold" data-k="joint" aria-expanded="${!shut}"><span>🤝 공동<small>${joints.length}</small><i class="as-chev" aria-hidden="true"></i></span><b class="won${sg(jsum)}">${won(jsum)}</b></button>` +
      (shut ? "" : `<p class="as-jnote small muted">내 합계엔 안 들어가요 · 공통 탭 🏦 공동 자산에서 같이 봐요</p>` + joints.map((a) => { const v = bal[a.id] || 0;
        return `<button type="button" class="as-row${a.id === sel ? " on" : ""}" data-act="asSel" data-id="${esc(a.id)}" aria-pressed="${a.id === sel}"><span class="as-name">${esc(a.name)}${a.number ? `<small class="as-num">${esc(a.number)}</small>` : ""}</span><b class="won${sg(v)}">${won(v)}</b></button>`; }).join("")) + "</div>";
  })() : "") : '<p class="muted small" style="margin:0">통장·카드·현금을 추가하면 어디서 쓰고 어디로 들어왔는지 기록하고, 자산마다 잔액을 볼 수 있어요.</p>');
  $("asGrid").classList.toggle("as-open", !!ui.asOpen && !!sel);
  renderAssetDetail(sel);
}
// 🏦 자산 전체: 자산 · 부채 · 합계, 최근 12달 합계 흐름, 자산 구성 · 부채 구성 원형
function renderAssetAll() {
  const box = $("asDetail"), accts = sortedAccts().filter((a) => !a.joint), bal = balances(), m = ui.month;   // 냐냐: 🤝 공동 자산은 빼고
  if (!accts.length) { box.innerHTML = '<p class="muted small" style="margin:0">자산을 추가하면 여기에 자산·부채·합계가 보여요.</p>'; return; }
  const part = (sign) => accts.map((a) => ({ cat: a.name, amt: sign * (bal[a.id] || 0) })).filter((x) => x.amt > 0).sort((x1, x2) => x2.amt - x1.amt).map((x, i) => ({ ...x, col: (sign > 0 ? PIE_WARM : PIE_COOL)[i % PIE_WARM.length] }));
  const plus = part(1), minus = part(-1), A = plus.reduce((t, x) => t + x.amt, 0), D = minus.reduce((t, x) => t + x.amt, 0);
  const pts = Array.from({ length: 12 }, (_, i) => shiftMonth(m, i - 11)).map((mm) => { const b = balances(dayInMonth(mm, 31)), v = accts.reduce((t, a) => t + (b[a.id] || 0), 0);
    const pA = accts.reduce((t, a) => t + Math.max(0, b[a.id] || 0), 0), pD = accts.reduce((t, a) => t + Math.max(0, -(b[a.id] || 0)), 0);
    return { lab: `${+mm.slice(5)}월`, v, on: mm === m, tip: `${monthLabel(mm)} 끝 합계 ${won(v)}`,
      box: [`${monthLabel(mm)}`, `합계 <span class="won${v < 0 ? " minus" : " plus"}">${v < 0 ? "-" : ""}${won(v)}</span>`, `자산 <span class="won plus">${won(pA)}</span>`, `부채 <span class="won minus">${won(pD)}</span>`] }; });   // 냐냐: 점 누르면 합계·자산·부채
  const tile = (label, v, cls) => `<div><span>${label}</span><b class="won${cls ? " " + cls : ""}">${v}</b></div>`;
  const sec = (cls, label, sum, list, name) => `<div class="as-sec ${cls}"><span>${label}</span><b class="won">${won(sum)}</b></div>` + (list.length ? pieHtml(null, list, name, { color: (x) => x.col, legend: false, amount: false, center: name === "부채" ? "var(--blue)" : "var(--coral)" }) : `<p class="muted small" style="margin:0">${name === "부채" ? "갚을 카드값·빚이 없어요." : "잔액이 있는 자산이 없어요."}</p>`);
  box.innerHTML =
    `<div class="as-head"><button class="icon-btn as-back" type="button" data-act="asBack">‹ 목록</button><h3><span class="as-title">자산 전체</span></h3>` +
    `<div class="as-month"><button class="chip" type="button" data-act="month" data-d="-1" aria-label="이전 달">‹</button><b>${monthLabel(m)}</b><button class="chip" type="button" data-act="month" data-d="1" aria-label="다음 달">›</button></div></div>` +
    `<div class="as-stats as-stats3">${tile("자산", won(A), "plus")}${tile("부채", won(D), "minus")}${tile("합계", won(A - D), A - D < 0 ? "minus" : "plus")}</div>` +
    `<div class="as-chart-h small muted">달마다 합계 (그 달 끝) · 최근 12달</div><div class="as-chart" id="asChart"></div>` +
    sec("plus", "자산 구성", A, plus, "자산") + sec("minus", "부채 구성", D, minus, "부채") +
    '<button class="fab" type="button" data-act="txAdd" aria-label="기록하기" title="기록하기">＋</button>';
  setChart($("asChart"), { pts, label: "달마다 합계", fit: true });
}
function renderAssetDetail(id) {
  if (id === "__all") { renderAssetAll(); return; }
  const box = $("asDetail"), a = id && S.accounts.get(id);
  if (!a) { box.innerHTML = '<p class="muted small" style="margin:0">자산을 추가하면 여기에 그 달 내역과 잔액이 보여요.</p>'; return; }
  const m = ui.month, card = a.type === "card", p = acctPeriod(a, m), shown = [], payCard = card && !!p.date;
  const flow = acctFlow(id), init = Number(a.initial) || 0;
  let run = init, endBal = run, inn = 0, out = 0;
  // 결제일 기준 카드: 쓴 돈은 이용기간, 낸 돈(통장 → 카드)은 지난달 결제일 다음 날 ~ 이 달 결제일
  const prevPay = payCard ? cardPayPlan(a.pay, shiftMonth(m, -1)).date : "";
  const inP = (x) => payCard && x.d > 0 ? x.date > prevPay && x.date <= p.date : x.date >= p.from && x.date <= p.to;
  flow.forEach((x) => {
    run += x.d; x.bal = run;
    if (x.date <= p.to) endBal = run;
    if (inP(x)) { shown.push(x); if (x.d > 0) inn += x.d; else out -= x.d; }
  });
  // 📈 최근 12달 (보고 있는 달까지): 통장·현금·저축 = 그 달 끝 잔액 꺾은선, 카드 = 그 달 기간에 쓴 돈 막대
  const asPts = Array.from({ length: 12 }, (_, i) => shiftMonth(m, i - 11)).map((mm) => {
    const q = acctPeriod(a, mm), v = card ? flow.reduce((t, x) => t + (x.d < 0 && x.date >= q.from && x.date <= q.to ? -x.d : 0), 0) : init + flow.reduce((t, x) => t + (x.date <= q.to ? x.d : 0), 0);
    return { lab: `${+mm.slice(5)}월`, v, on: mm === m, tip: `${monthLabel(mm)} ${card ? "쓴 돈" : "끝 잔액"} ${won(v)}` };
  });
  const balTxt = (v) => card ? `카드값 ${won(Math.max(0, -v))}` : `잔액 ${won(v)}`;
  const tile = (label, v, cls) => `<div><span>${label}</span><b class="won${cls ? " " + cls : ""}">${v}</b></div>`;
  box.innerHTML =
    `<div class="as-head"><button class="icon-btn as-back" type="button" data-act="asBack">‹ 목록</button>` +
    `<h3><span aria-hidden="true">${ACCT_ICON[a.type] || "🏦"}</span><span class="as-title">${esc(a.name)}</span><button class="icon-btn" type="button" data-act="editAcct" data-id="${esc(id)}" aria-label="${esc(a.name)} 고치기" title="이름·잔액${card ? "·결제일" : ""} 고치기">✏️</button></h3>` +
    `<div class="as-month"><button class="chip" type="button" data-act="month" data-d="-1" aria-label="이전 달">‹</button><b>${monthLabel(m)}</b><button class="chip" type="button" data-act="month" data-d="1" aria-label="다음 달">›</button></div></div>` +
    `<p class="small muted as-period">${payCard ? `<b>${+m.slice(5)}월 ${+p.date.slice(8)}일 결제</b> · 이용기간 ${ymdDot(p.from)} ~ ${ymdDot(p.to)}`
      : `기간 ${ymdDot(p.from)} ~ ${ymdDot(p.to)}${card ? ` · <button class="link-btn" type="button" data-act="editAcct" data-id="${esc(id)}">결제일을 정하면</button> 결제일 기준으로 보여요` : ""}`}</p>` +
    (a.number || a.memo ? `<p class="small as-info">${a.number ? `<span class="mono">${esc(a.number)}</span>` : ""}${a.number && a.memo ? " · " : ""}${a.memo ? `<span class="as-memo">📝 ${esc(a.memo)}</span>` : ""}</p>` : "") +   // 냐냐: 계좌번호 · 자산 메모 (가계부 설정 '자산 관리'에서)
    `<div class="as-stats">${payCard
      ? tile("결제할 돈", won(out), "minus") + tile("낸 돈", won(inn), "plus") + tile("남은 결제액", won(Math.max(0, out - inn)), out > inn ? "minus" : "") + tile("지금 카드값", won(Math.max(0, -run)))
      : tile(card ? "갚은 돈" : "입금", won(inn), "plus") + tile(card ? "쓴 돈" : "출금", won(out), "minus") + tile("합계", won(inn - out), inn - out < 0 ? "minus" : "plus") +
        tile(card ? "남은 카드값" : "누적잔액", card ? won(Math.max(0, -endBal)) : won(endBal), !card && endBal < 0 ? "minus" : "")}</div>` +
    `<div class="as-chart-h small muted">${payCard ? "달마다 결제할 돈 (결제일 기준)" : card ? "달마다 쓴 돈" : "달마다 잔액 (그 달 끝)"} · 최근 12달</div><div class="as-chart" id="asChart"></div>` +
    // 내역: 내역 탭과 같은 표 (날짜 · 자산 · 분류 · 소분류 · 금액 · 내용 · 메모), 금액은 이 자산 쪽에서 본 +/−, 밑에 그때 잔액
    `<div class="tx-list as-tx">${shown.length ? `<div class="tx-row tx-th no-ck"><span>날짜</span><span>자산</span><span>분류</span><span>소분류</span><span class="tx-amt">금액</span><span>내용</span><span>메모</span></div>` +
      shown.reverse().map((x) => txRow(x, false, { d: x.d, bal: balTxt(x.bal) })).join("") : `<p class="muted small" style="margin:8px 0 0">${monthLabel(m)}에 이 자산 기록이 없어요.</p>`}</div>` +
    // 냐냐: 💳 결제 버튼은 카드 이름 옆 대신 오른쪽 아래 ＋ 왼쪽에 작게
    `<div class="as-fabs">${card ? `<button class="fab fab-sub as-pay" type="button" data-act="cardPayNow" data-id="${esc(id)}" aria-label="${esc(a.name)} 결제" title="${esc(a.name)} 카드값 결제">결제</button>` : ""}` +
    `<button class="fab" type="button" data-act="asAdd" data-id="${esc(id)}" aria-label="${esc(a.name)}(으)로 기록하기" title="${esc(a.name)}(으)로 기록하기">＋</button></div>`;
  if (box.dataset.acct !== id) { box.scrollTop = 0; box.dataset.acct = id; }   // 냐냐: 자산 탭 양쪽 따로 스크롤 — 다른 자산을 고르면 오른쪽은 맨 위부터
  setChart($("asChart"), { bars: card, pts: asPts, label: card ? "달마다 쓴 돈" : "달마다 잔액", fit: !card });
}
// 📈 그래프: 칸 너비 그대로 그림 (글자가 안 줄어들게), 너비가 바뀌면 다시 그림 (ResizeObserver)
// data = { bars(막대면 true), pts: [{ lab 아래 글자, v 값, on 지금 보는 칸, tip 마우스 올리면 }], label }
const axisWon = (v) => { const n = Math.abs(v), s = v < 0 ? "-" : ""; return n >= 1e8 ? s + +(n / 1e8).toFixed(1) + "억" : n >= 1e4 ? s + Math.round(n / 1e4).toLocaleString("ko-KR") + "만" : s + n.toLocaleString("ko-KR"); };
function niceStep(span) { const raw = span / 4 || 1, p = Math.pow(10, Math.floor(Math.log10(raw))), f = raw / p; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10) * p; }
let chartRO = null;
export function setChart(el, data) {
  if (!el) return;
  el._chart = data; drawChart(el);
  if (window.ResizeObserver) { chartRO = chartRO || new ResizeObserver((es) => es.forEach((e) => { const w = Math.round(e.contentRect.width); if (w && w !== e.target._w) drawChart(e.target); })); chartRO.observe(el); }
}
function drawChart(el) {
  const d = el._chart; if (!d) return;
  const pts = d.pts, W = Math.max(260, el.clientWidth || 600), H = 170, L = 44, R = 8, T = 8, B = 24, pw = W - L - R, ph = H - T - B;
  el._w = Math.round(el.clientWidth);
  const vs = pts.map((p) => p.v);
  let lo = Math.min(0, ...vs), hi = Math.max(0, ...vs);
  // 냐냐: 잔액 꺾은선(d.fit)은 0부터 말고 값 범위에 맞춤 → 7천만 원 근처에서 몇십만 원 오르내리는 것도 보이게 (막대는 그대로 0부터)
  if (d.fit && !d.bars && vs.length) { lo = Math.min(...vs); hi = Math.max(...vs); const pad = (hi - lo) * 0.2 || Math.max(Math.abs(hi) * 0.01, 10000); lo -= pad; hi += pad; }
  if (hi === lo) hi = lo + 10000;
  const st = niceStep(hi - lo); lo = Math.floor(lo / st) * st; hi = Math.ceil(hi / st) * st;
  const n = pts.length, cw = pw / n, x = (i) => L + cw * (i + 0.5), y = (v) => T + ph - (v - lo) / (hi - lo) * ph, f = (v) => v.toFixed(1);
  let s = `<rect x="${L}" y="${T}" width="${f(pw)}" height="${ph}" class="bg"/>`;
  for (let k = 0, steps = Math.round((hi - lo) / st); k <= steps; k++) { const v = lo + k * st; s += `<line x1="${L}" x2="${f(W - R)}" y1="${f(y(v))}" y2="${f(y(v))}"${v === 0 ? ' class="z"' : ""}/><text x="${L - 6}" y="${f(y(v) + 3.5)}" class="yl">${axisWon(v)}</text>`; }
  const ci = pts.findIndex((p) => p.on);
  if (ci >= 0) s += `<line x1="${f(x(ci))}" x2="${f(x(ci))}" y1="${T}" y2="${T + ph}" class="cur"/>`;
  if (d.bars) { const bw = Math.min(26, cw * 0.55); s += pts.map((p, i) => `<rect x="${f(x(i) - bw / 2)}" y="${f(Math.min(y(p.v), y(0)))}" width="${f(bw)}" height="${f(p.v ? Math.max(1.5, Math.abs(y(0) - y(p.v))) : 0)}" rx="3" class="cbar${p.on ? " on" : ""}"><title>${esc(p.tip || "")}</title></rect>`).join(""); }
  else s += `<polyline points="${pts.map((p, i) => f(x(i)) + "," + f(y(p.v))).join(" ")}" class="ln"/>` + pts.map((p, i) => `<circle cx="${f(x(i))}" cy="${f(y(p.v))}" r="${p.on ? 4.5 : 3}" class="dot"><title>${esc(p.tip || "")}</title></circle>`).join("");
  const every = Math.max(1, Math.ceil(34 / cw));
  s += pts.map((p, i) => (n - 1 - i) % every ? "" : `<text x="${f(x(i))}" y="${H - 7}" class="xl${p.on ? " on" : ""}">${esc(p.lab)}</text>`).join("");
  // 냐냐: 점마다 p.box(줄 목록)가 있으면 그 칸을 누르면 위에 작은 상자 (예: 자산 전체 = 합계·자산·부채)
  const boxed = pts.some((p) => p.box);
  if (boxed) s += pts.map((p, i) => `<rect class="hit" x="${f(L + cw * i)}" y="${T}" width="${f(cw)}" height="${ph}" data-i="${i}"><title>${esc(p.tip || "")}</title></rect>`).join("");
  el.innerHTML = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(d.label || "그래프")}">${s}</svg>` + (boxed ? '<div class="ch-box" hidden></div>' : "");
  if (boxed && !el._boxBound) {
    el._boxBound = true;
    el.addEventListener("click", (ev) => {
      const r = ev.target.closest && ev.target.closest("rect.hit"), box = el.querySelector(".ch-box"), dd = el._chart; if (!box || !dd) return;
      if (!r) { box.hidden = true; return; }
      const i = +r.dataset.i, p = dd.pts[i]; if (!p || !p.box) return;
      if (!box.hidden && box.dataset.i === String(i)) { box.hidden = true; return; }
      box.dataset.i = String(i); box.innerHTML = p.box.map((l, k) => k ? `<div>${l}</div>` : `<b>${l}</b>`).join(""); box.hidden = false;
      const cx = (+r.getAttribute("x")) + (+r.getAttribute("width")) / 2, w = box.offsetWidth || 160;
      box.style.left = Math.max(4, Math.min(el.clientWidth - w - 4, cx - w / 2)) + "px";
    });
  }
}

// ---------- 🧾 내역 (지출 탭): 요약 칸 = 전체 · 수입 · 지출 · 💝 준 돈 (누르면 그것만), 표 = ☐ 날짜 · 자산 · 분류 · 소분류 · 금액 · 내용 · 메모 ----------
// 이체(내 자산끼리)는 전체에서만 줄로 보이고 합계엔 안 들어감. 줄을 누르면 서랍 창에서 고치기, ☐로 골라 [선택 삭제]
const TX_KINDS = [["all", "전체"], ["income", "수입"], ["expense", "지출"], ["transfer", "💝 준 돈"]];
const txSel = new Set();
function renderTx(m, r) {
  const f = TX_KINDS.some(([k]) => k === ui.txKind) ? ui.txKind : "all", cnt = { all: r.items.length, income: 0, expense: 0, transfer: 0 };
  r.items.forEach((x) => { const k = x.kind || "expense"; if (k in cnt && k !== "all") cnt[k]++; });
  const sums = { all: r.inc - r.exp - r.out, income: r.inc, expense: r.exp, transfer: r.out };
  const lab = ui.txRange ? rangeLabel(ui.txRange.from, ui.txRange.to) : monthLabel(m);
  $("txMonth").textContent = lab;
  const mn = $("mineNote"); if (mn) { mn.hidden = !mineOn(); mn.textContent = mineOn() ? `💑 내 몫으로 보는 중 — 💙 공통비용은 절반만${r.settleIn ? ` · 💚 정산 받은 돈 ${won(r.settleIn)}은 수입에서 뺐어요` : ""}` : ""; }
  $("txSum").innerHTML = TX_KINDS.map(([k, l]) => `<button type="button" class="tx-k k-${k}" role="tab" data-act="txKind" data-k="${k}" aria-selected="${f === k}"><span>${l} (${cnt[k]})</span><b class="won${k === "all" ? (sums.all < 0 ? " minus" : " plus") : ""}"><span class="tx-l">${k === "all" ? won(sums[k]) : wonN(sums[k])}</span><span class="tx-short">${k !== "all" && sums[k] < 0 ? "-" : ""}${moneyShort(Math.abs(sums[k]))}</span></b></button>`).join("");
  const items = r.items.filter((x) => f === "all" || (x.kind || "expense") === f).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  [...txSel].forEach((id) => { if (!items.some((x) => x.id === id)) txSel.delete(id); });
  $("txSel").hidden = !txSel.size;
  $("txSel").innerHTML = txSel.size ? `<span><b>${txSel.size}개</b> 골랐어요</span><button class="btn small danger-txt ghost" type="button" data-act="txDel">선택 삭제</button><button class="btn small ghost" type="button" data-act="txSelNone">고르기 취소</button>` : "";
  const all = items.length && items.every((x) => txSel.has(x.id));
  $("txList").innerHTML = !S.loaded ? '<p class="muted small">불러오는 중…</p>'
    : !items.length ? `<p class="muted small" style="margin:8px 0">${lab} ${f === "all" ? "" : TX_KINDS.find(([k]) => k === f)[1] + " "}기록이 없어요. 오른쪽 아래 ＋로 기록해요.</p>`
    : `<div class="tx-row tx-th"><label class="tx-ck"><input type="checkbox" data-txall ${all ? "checked" : ""} aria-label="모두 고르기"></label><span>날짜</span><span>자산</span><span>분류</span><span>소분류</span><span class="tx-amt">금액</span><span>내용</span><span>메모</span></div>` +
      items.map((x) => txRow(x, true)).join("");
}
// 내역 한 줄 (ck = ☐ 고르기 칸 같이) — 지출 탭 · 통계 탭이 같이 씀
export function txRow(x, ck, o = {}) {   // o.d = 이 자산 쪽에서 본 +/− (자산 화면), o.bal = 금액 밑 그때 잔액
        const kind = x.kind || "expense", n = x.pics && typeof x.pics === "object" ? Object.keys(x.pics).length : 0;
        const where = kind === "move" ? `${esc(acctName(x.account))} → ${esc(acctName(x.toAccount))}` : esc(acctName(x.account));
        const cat = kind === "move" ? '<span class="muted">이체</span>' : `${x.cat ? esc(x.cat) : esc(KIND_LABEL[kind])}${kind === "transfer" ? ' <span class="muted small">💝</span>' : ""}${x.common ? ' <span class="m-common-mark" title="공통비용">❤️</span>' : ""}`;   // 표·목록 줄엔 색 동그라미 없이 (색은 원형·그 옆 목록·예산·설정에만)
        return `<div class="tx-row k-${kind}${ck ? "" : " no-ck"}${ui.mEdit === x.id ? " cur" : ""}${ck && txSel.has(x.id) ? " sel" : ""}" data-act="editMoney" data-id="${esc(x.id)}" role="button" tabindex="0">` +
          (ck ? `<label class="tx-ck" data-noedit><input type="checkbox" data-txck="${esc(x.id)}" ${txSel.has(x.id) ? "checked" : ""} aria-label="고르기"></label>` : "") +
          `<span class="tx-d mono">${shortDate(x.date)}</span><span class="tx-a">${where}</span><span class="tx-c">${cat}</span><span class="tx-s">${x.common && E.commonCats ? (() => { const o = ccOf(x); return esc(o.c + (o.s ? " · " + o.s : "")); })() : esc(x.sub || "")}</span>` +
          (o.d != null ? `<span class="tx-amt won ${o.d > 0 ? "plus" : "minus"}">${Number(x.amount) < 0 ? "-" : ""}${won(Math.abs(o.d))}${o.bal ? `<small class="tx-bal">${o.bal}</small>` : ""}</span>`
            : (() => {   // 마이너스 금액(환불·취소)은 부호를 뒤집어 보여 줌 (냐냐 쪽에서 더함 — 편한가계부 가져온 환불 줄)
              const neg = Number(x.amount) < 0, plus = kind === "income" ? !neg : kind === "move" ? null : neg;
              return `<span class="tx-amt won ${plus == null ? "" : plus ? "plus" : "minus"}">${amtText(x)}</span>`;   // 냐냐: +·- 기호 없이 색으로만, 직접 -로 적은 것만 -
            })()) +
          `<span class="tx-m">${esc(x.memo || "")}</span><span class="tx-n">${x.note ? esc(x.note) : ""}${n ? ` <span class="m-mark">📷${n > 1 ? n : ""}</span>` : ""}</span></div>`;
}

// ---------- 📅 가계부 달력: 위 칸 전체 · 수입 · 지출 (💝 준 돈은 지출에, 이체는 안 보임), 칸마다 +수입 · −지출 · 합계 ----------
const MC_KINDS = [["all", "전체"], ["income", "수입"], ["expense", "지출"]];
const WDS = ["일", "월", "화", "수", "목", "금", "토"];
function renderMCal(m, r) {
  const f = MC_KINDS.some(([k]) => k === ui.mcKind) ? ui.mcKind : "all", t = today();
  const items = r.items.filter((x) => x.kind !== "move"), isInc = (x) => x.kind === "income";
  const want = (x) => f === "all" || (f === "income" ? isInc(x) : !isInc(x));
  const day = {}; items.forEach((x) => { if (!isWon(x)) return; const d = (day[x.date] ||= { inc: 0, out: 0 }), a = cntAmt(x); if (isInc(x)) d.inc += a; else d.out += a; });
  const cnt = { all: items.length, income: items.filter(isInc).length, expense: items.filter((x) => !isInc(x)).length }, inc = r.inc, out = r.exp + r.out;
  const sums = { all: inc - out, income: inc, expense: out };
  $("mcMonth").textContent = monthLabel(m);
  $("mcSum").innerHTML = MC_KINDS.map(([k, l]) => `<button type="button" class="tx-k k-${k}" role="tab" data-act="mcKind" data-k="${k}" aria-selected="${f === k}"><span>${l} (${cnt[k]})</span><b class="won${k === "all" ? (sums.all < 0 ? " minus" : " plus") : ""}"><span class="tx-l">${k === "all" ? won(sums[k]) : wonN(sums[k])}</span><span class="tx-short">${k !== "all" && sums[k] < 0 ? "-" : ""}${moneyShort(Math.abs(sums[k]))}</span></b></button>`).join("");
  const first = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1), last = new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate(), lead = first.getDay();
  const sel = ui.mcDay && ui.mcDay.slice(0, 7) === m ? ui.mcDay : t.slice(0, 7) === m ? t : `${m}-01`;
  const short = (v) => v >= 1e5 ? Math.round(v / 1e4) + "만" : v >= 1e4 ? +(v / 1e4).toFixed(1) + "만" : commaNum(v);   // 폰 칸: 160만 · 4.4만 · 8,700
  const num = (v, cls, sign) => `<i class="${cls}"><span class="l">${sign}${commaNum(v)}</span><span class="s">${sign}${short(v)}</span></i>`;
  let h = WDS.map((w, i) => `<div class="mc-wd${i === 0 ? " sun" : i === 6 ? " sat" : ""}">${w}</div>`).join("");
  for (let i = 0; i < Math.ceil((lead + last) / 7) * 7; i++) {
    const dt = new Date(+m.slice(0, 4), +m.slice(5, 7) - 1, 1 - lead + i), d = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`, v = day[d] || { inc: 0, out: 0 }, dow = dt.getDay();
    const lines = (f !== "expense" && v.inc ? num(Math.abs(v.inc), "plus", v.inc < 0 ? "-" : "") : "") + (f !== "income" && v.out ? num(Math.abs(v.out), "minus", v.out < 0 ? "-" : "") : "") + (f === "all" && (v.inc || v.out) ? num(Math.abs(v.inc - v.out), v.inc - v.out < 0 ? "net minus" : "net plus", "") : "");   // 냐냐: 기호 없이 색으로만
    h += `<button type="button" class="mc-d${d.slice(0, 7) !== m ? " out" : ""}${d === t ? " today" : ""}${d === sel ? " on" : ""}${dow === 0 ? " sun" : dow === 6 ? " sat" : ""}" data-act="mcDay" data-day="${d}" aria-label="${shortDate(d)}"><span class="mc-n">${d.slice(0, 7) !== m ? `${dt.getMonth() + 1}/` : ""}${dt.getDate()}</span><span class="mc-v">${lines}</span></button>`;
  }
  $("mcCal").innerHTML = h;
  // 고른 날: 수입 · 지출 + 내역 (누르면 서랍 창에서 고치기)
  const its = items.filter((x) => x.date === sel && want(x)).sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0)), dv = day[sel] || { inc: 0, out: 0 };
  $("mcDay").innerHTML = `<div class="mc-dh"><b>${shortDate(sel)}</b><button class="btn small" type="button" data-act="mcAdd">＋ 내역 추가</button></div>` +
    `<div class="mc-ds"><span>수입<b class="won plus">${won(dv.inc)}</b></span><span>지출<b class="won minus">${won(dv.out)}</b></span></div>` +
    `<div class="mc-list">${its.map((x) => { const k = x.kind || "expense";
      return `<button type="button" class="mc-it" data-act="editMoney" data-id="${esc(x.id)}"><span class="c">${x.cat ? esc(x.cat) : esc(KIND_LABEL[k])}${x.sub ? ` <span class="muted small">· ${esc(x.sub)}</span>` : ""}${k === "transfer" ? " 💝" : ""}</span>` +
        `<span class="a won ${k === "income" ? "plus" : k === "transfer" ? "give" : "minus"}">${amtText(x)}</span><span class="m">${esc([x.memo, acctName(x.account)].filter(Boolean).join(" · "))}${memoMarks({ ...x, sub: null })}</span></button>`; }).join("") ||
      '<p class="muted small" style="margin:0">이 날 기록이 없어요.</p>'}</div>`;
}

// ---------- 📊 통계 탭: [수입 | 지출] + 오른쪽 위 ‹ 기간 › [주간 · 월간 · 연간 · 기간] (처음엔 이번 달 월간) ----------
// 왼쪽 = 분류별 원형 + 목록 (누르면 그 분류만), 오른쪽 = 합계 · 최근 흐름 그래프 · 그 기간 내역
const ST_P = { week: "주간", month: "월간", year: "연간", range: "기간" };
const addDaysS = (d, n) => { const t = new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8) + n); return `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`; };
const sundayOfS = (d) => addDaysS(d, -new Date(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8)).getDay());
// 기간 하나: anchor 날짜가 든 주(일~토)·달·해, k칸 앞뒤로 옮긴 것
export function stRange(p, anchor, k = 0) {   // (냐냐: 공통 탭 지출도 같은 기간 계산을 씀)
  if (p === "week") { const s = addDaysS(sundayOfS(anchor), 7 * k); return { from: s, to: addDaysS(s, 6), lab: `${+s.slice(5, 7)}/${+s.slice(8)}`, name: `${ymdDot(s)} ~ ${ymdDot(addDaysS(s, 6)).slice(3)}` }; }
  if (p === "year") { const y = +anchor.slice(0, 4) + k; return { from: `${y}-01-01`, to: `${y}-12-31`, lab: `${y}`, name: `${y}년` }; }
  const m = shiftMonth(anchor.slice(0, 7), k); return { from: `${m}-01`, to: dayInMonth(m, 31), lab: `${+m.slice(5)}월`, name: m };
}
function stState() {
  const p = ST_P[ui.stP] ? ui.stP : "month", anchor = ui.stAt || today();
  let cur = p === "range" ? { from: ui.stFrom || `${today().slice(0, 7)}-01`, to: ui.stTo || today() } : stRange(p, anchor);
  if (p === "range" && cur.from > cur.to) cur = { from: cur.to, to: cur.from };
  if (p === "range") cur.name = `${ymdDot(cur.from)} ~ ${ymdDot(cur.to)}`;
  return { p, anchor, cur, kind: ui.stK === "income" ? "income" : "expense" };
}
function renderStats() {
  const st = stState(), { p, cur, kind } = st, label = kind === "income" ? "수입" : "지출";
  document.querySelectorAll("#stKind button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.k === kind)));
  $("stLabel").textContent = cur.name; $("stPer").value = p;
  $("stPrev").hidden = $("stNext").hidden = p === "range"; $("stRangeRow").hidden = p !== "range";
  if (p === "range" && document.activeElement !== $("stFrom") && document.activeElement !== $("stTo")) { $("stFrom").value = cur.from; $("stTo").value = cur.to; }
  const recs = []; S.money.forEach((x, id) => { if ((x.kind || "expense") === kind && isWon(x) && x.date >= cur.from && x.date <= cur.to && !(mineOn() && isSettleIn(x))) recs.push({ ...x, id }); });   // 💑 내 몫 보기면 욱진입금 빼고
  const byCat = {}; recs.forEach((x) => { const c = x.cat || "기타"; byCat[c] = (byCat[c] || 0) + cntAmt(x); });
  const total = recs.reduce((t, x) => t + cntAmt(x), 0), cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
  const sel = ui.stCat && byCat[ui.stCat] != null ? ui.stCat : null, pct = (v) => total ? Math.round(v / total * 100) : 0;
  $("stPie").innerHTML = pieHtml(kind, cats.map(([cat, amt]) => ({ cat, amt })), label, { legend: false, full: E.pieFull }) || `<p class="muted small" style="margin:0">${esc(cur.name)} ${label} 기록이 없어요.</p>`;
  // 오른쪽: 합계 · 흐름 그래프 (그 칸 포함 앞 12칸, 기간이면 그 안의 달) · 내역
  let shown = sel ? recs.filter((x) => (x.cat || "기타") === sel) : recs, stot = sel ? byCat[sel] : total;
  // 🏷 💙 공통비용을 누르면 왼쪽 목록에서 바로 밑으로 공통 분류별 펼치기 (냐냐): 대분류마다 % · 금액, 누르면 그 대분류 기록만
  const isCc = !!sel && kind === "expense" && /공통비용/.test(sel) && !!E.commonCats;
  let ccHtml = "";
  if (isCc) {
    const g = {}; shown.forEach((x) => { const c = ccOf(x).c; g[c] = (g[c] || 0) + cntAmt(x); });
    const rows = Object.entries(g).sort((a, b) => b[1] - a[1]), base = rows.reduce((t, [, v]) => t + v, 0);
    if (ui.stCc && !(ui.stCc in g)) ui.stCc = null;
    ccHtml = `<div class="st-cc">` + rows.map(([c, v]) => `<button type="button" class="st-cat st-sub${ui.stCc === c ? " on" : ""}" data-act="stCc" data-k="${esc(c)}"><i class="st-pct">${base ? Math.round(v / base * 100) : 0}%</i><span>${esc(c)}</span><b class="won">${wonN(v)}</b></button>`).join("") + `</div>`;
    if (ui.stCc) { shown = shown.filter((x) => ccOf(x).c === ui.stCc); stot = g[ui.stCc]; }
  } else ui.stCc = null;
  if ($("stCcSub")) $("stCcSub").hidden = true;
  $("stCats").innerHTML = `<button type="button" class="st-cat all${sel ? "" : " on"}" data-act="stCat" data-k=""><span>${label} 전체 <small>${recs.length}</small></span><b class="won">${wonN(total)}</b></button>` +
    cats.map(([c, v]) => `<button type="button" class="st-cat${sel === c ? " on" : ""}" data-act="stCat" data-k="${esc(c)}"><i class="st-pct" style="--c:${catVar(kind, c)}">${pct(v)}%</i><span>${catDot(kind, c)}${esc(c)}</span><b class="won">${wonN(v)}</b></button>` + (sel === c ? ccHtml : "")).join("");
  $("stHead").innerHTML = `<h3>${esc(sel ? sel + (ui.stCc ? " › " + ui.stCc : "") : label + " 전체")}</h3><b class="won">${wonN(stot)}</b>`;
  $("stChip").innerHTML = `<i class="st-pct" style="--c:${sel ? catVar(kind, sel) : "var(--coral)"}">${sel ? pct(stot) : 100}%</i> ${esc(sel || "전체")} <b class="won">${won(stot)}</b>`;
  const sum = (from, to) => { let t = 0; S.money.forEach((x) => { if ((x.kind || "expense") === kind && isWon(x) && x.date >= from && x.date <= to && (!sel || (x.cat || "기타") === sel)) t += cntAmt(x); }); return t; };
  let pts;
  if (p === "range") { const ms = []; for (let mm = cur.from.slice(0, 7); mm <= cur.to.slice(0, 7) && ms.length < 24; mm = shiftMonth(mm, 1)) ms.push(mm); pts = ms.map((mm) => { const v = sum(mm + "-01" < cur.from ? cur.from : mm + "-01", dayInMonth(mm, 31) > cur.to ? cur.to : dayInMonth(mm, 31)); return { lab: `${+mm.slice(5)}월`, v, on: false, tip: `${mm} ${won(v)}` }; }); }
  else pts = Array.from({ length: p === "year" ? 5 : 12 }, (_, i) => i - (p === "year" ? 4 : 11)).map((k) => { const r = stRange(p, st.anchor, k), v = sum(r.from, r.to); return { lab: r.lab, v, on: k === 0, tip: `${r.name} ${won(v)}` }; });
  setChart($("stChart"), { pts, label: `${label} 흐름` });
  shown.sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0));
  $("stList").innerHTML = shown.length ? `<div class="tx-row tx-th no-ck"><span>날짜</span><span>자산</span><span>분류</span><span>소분류</span><span class="tx-amt">금액</span><span>내용</span><span>메모</span></div>` + shown.map((x) => txRow(x, false)).join("")
    : `<p class="muted small" style="margin:8px 0">${esc(cur.name)} ${esc(sel || label)} 기록이 없어요.</p>`;
}
// ---------- ▦ 다건입력: 줄마다 구분·날짜·자산·분류(이체는 받는 곳)·소분류·금액·화폐·내용·메모 → [저장]으로 한 번에 ----------
const BULK_KINDS = ["income", "expense", "transfer", "move"];
function bulkAcctOpts(kind, cur) {
  return '<option value="">-</option>' + acctOptsHtml(sortedAccts().filter((a) => !(kind === "income" && a.type === "card")), cur);
}
function bulkRowHtml(v) {
  const k = BULK_KINDS.includes(v.kind) ? v.kind : "expense", cats = moneyCats(k === "move" ? "expense" : k);
  const cat = k === "move" ? bulkAcctOpts(k, v.cat) : '<option value="">-</option>' + cats.map((c) => `<option${c === v.cat ? " selected" : ""}>${esc(c)}</option>`).join("");   // 냐냐: 안 고르면 비어 있게 (첫 분류 자동 X)
  return `<tr class="k-${k}"><td class="bk-n"></td>` +
    `<td><select data-c="kind" aria-label="구분">${BULK_KINDS.map((x) => `<option value="${x}"${x === k ? " selected" : ""}>${KIND_LABEL[x]}</option>`).join("")}</select></td>` +
    `<td><input type="date" data-c="date" value="${esc(v.date || today())}" aria-label="날짜"></td>` +
    `<td><select data-c="acct" aria-label="자산">${bulkAcctOpts(k, v.acct)}</select></td>` +
    `<td><select data-c="cat" aria-label="${k === "move" ? "받는 곳" : "분류"}">${cat}</select></td>` +
    `<td><select data-c="sub" aria-label="소분류"${k === "move" ? " disabled" : ""}>${k === "move" ? "" : subOptions(k, v.cat && cats.includes(v.cat) ? v.cat : "", v.sub && v.sub !== "__add" ? v.sub : "", !!(v.cat && cats.includes(v.cat)))}</select></td>` +
    `<td><input type="text" data-c="amt" class="amt-in" inputmode="numeric" value="${esc(v.amt || "")}" aria-label="금액"></td>` +
    `<td><select data-c="cur" aria-label="화폐">${currencies().map((c) => `<option${c === (v.cur || "원") ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></td>` +
    `<td><input type="text" data-c="memo" maxlength="80" value="${esc(v.memo || "")}" aria-label="내용"></td>` +
    `<td><input type="text" data-c="note" maxlength="500" value="${esc(v.note || "")}" aria-label="메모"></td>` +
    `<td><button class="bk-del" type="button" data-act="bulkDel" aria-label="이 줄 비우기" title="이 줄 비우기">✕</button></td></tr>`;
}
const bulkRead = (tr) => { const v = {}; tr.querySelectorAll("[data-c]").forEach((el) => { v[el.dataset.c] = el.value; }); return v; };
function bulkNumber() { [...$("bulkBody").rows].forEach((tr, i) => { tr.cells[0].textContent = i + 1; }); bulkCount(); }
function bulkCount() { const n = [...$("bulkBody").rows].filter((tr) => amtVal(tr.querySelector('[data-c="amt"]')) > 0).length; $("bulkCount").textContent = n ? `${n}줄 저장할 거예요` : ""; }
function bulkAdd(n) { $("bulkBody").insertAdjacentHTML("beforeend", Array.from({ length: n }, () => bulkRowHtml({})).join("")); bulkNumber(); }   // 냐냐: 자산도 안 고르면 비어 있게 (마지막 자산 자동 X)
function bulkOpen() {
  if (!$("bulkBody").rows.length) bulkAdd(10);
  openDlg($("bulkDlg"));
  const first = $("bulkBody").querySelector('[data-c="amt"]'); if (first) first.focus();
}
// 구분을 바꾸면 그 줄의 자산·분류 칸을 그 구분에 맞게 다시 (적은 값은 그대로)
function bulkRekind(tr) { const v = bulkRead(tr), tmp = document.createElement("tbody"); tmp.innerHTML = bulkRowHtml(v); const nt = tmp.firstElementChild; tr.replaceWith(nt); bulkNumber(); return nt; }
function bulkSave() {
  if (!ready()) return;
  const docs = [], bad = [];
  [...$("bulkBody").rows].forEach((tr, i) => {
    const v = bulkRead(tr), amount = amtVal(tr.querySelector('[data-c="amt"]')), k = v.kind;
    tr.classList.remove("bad");
    if (v.sub === "__add") v.sub = "";
    if (!(amount > 0)) { if (v.memo.trim() || v.note.trim()) { bad.push(i + 1); tr.classList.add("bad"); } return; }
    if (!v.acct || !v.cat || (k === "move" && v.acct === v.cat)) { bad.push(i + 1); tr.classList.add("bad"); return; }   // 자산·분류(이체는 받는 곳) 꼭 고르기
    const base = { kind: k, amount, date: v.date || today(), cur: v.cur && v.cur !== "원" ? v.cur : null, memo: v.memo.trim(), note: v.note.trim() || null, account: v.acct || null };
    docs.push(k === "move" ? { ...base, cat: null, sub: null, toAccount: v.cat } : { ...base, cat: v.cat, sub: v.sub || null, toAccount: null });
  });
  if (bad.length) { toast(`${bad.join(", ")}번 줄을 확인해 주세요 (금액·자산·분류, 이체는 보내는 곳·받는 곳).`); return; }
  if (!docs.length) { toast("금액을 적은 줄이 없어요."); return; }
  const t0 = Date.now();
  act((async () => { for (let i = 0; i < docs.length; i++) await E.backend.add("money", { ...docs[i], createdAt: t0 + i }); })(), `▦ ${docs.length}건을 한 번에 기록했어요.`)
    .then(() => { $("bulkBody").innerHTML = ""; closeDlg($("bulkDlg")); const m = docs[0].date.slice(0, 7); if (m !== ui.month) { ui.month = m; renderMoney(); } }).catch(() => {});
}
// 엑셀에서 복사한 칸 붙여넣기: 탭(칸)·줄바꿈(줄)대로 지금 칸부터 채움. 고르는 칸은 글자가 같은 것으로, 날짜는 2026.10.16 · 10/16도 됨
function bulkCell(el, raw) {
  const s = String(raw || "").trim();
  if (el.tagName === "SELECT") {
    let o = [...el.options].find((x) => x.text.trim() === s || x.value === s);
    if (!o && el.dataset.c === "sub" && s) { o = new Option(s, s); el.add(o, el.options.length - 1); }   // 목록에 없는 소분류도 그 줄엔 남김
    if (o) el.value = o.value; return;
  }
  if (el.dataset.c === "date") { const p = s.split(/[^\d]+/).filter(Boolean); const y = p.length >= 3 ? (p[0].length === 2 ? "20" + p[0] : p[0]) : today().slice(0, 4), mm = p.length >= 3 ? p[1] : p[0], dd = p.length >= 3 ? p[2] : p[1]; if (mm && dd) el.value = `${y}-${pad(+mm)}-${pad(+dd)}`; return; }
  el.value = el.dataset.c === "amt" ? commaNum(s) : s;
}
function bulkPaste(ev) {
  const text = (ev.clipboardData && ev.clipboardData.getData("text")) || "", start = ev.target.closest && ev.target.closest("[data-c]");
  if (!start || !/[\t\n]/.test(text.replace(/\s+$/, ""))) return;
  ev.preventDefault();
  bulkPasteText(start, text);
}
// 날짜·고르는 칸에선 브라우저가 붙여넣기(paste)를 안 보내줘서, Ctrl+V를 직접 받아 클립보드를 읽음 (냐냐 쪽에서 더함)
function bulkPasteKey(ev) {
  const start = ev.target.closest && ev.target.closest("[data-c]");
  if (!start || !(ev.ctrlKey || ev.metaKey) || ev.altKey || String(ev.key).toLowerCase() !== "v") return;
  if (!(start.tagName === "SELECT" || start.type === "date")) return;
  if (!navigator.clipboard || !navigator.clipboard.readText) return;
  ev.preventDefault();
  navigator.clipboard.readText().then((text) => { if (text.trim()) bulkPasteText(start, text); })
    .catch(() => toast("클립보드를 못 읽었어요. 브라우저가 물어보면 '허용'을 눌러 주세요."));
}
function bulkPasteText(start, text) {
  const lines = text.replace(/\r/g, "").replace(/\n+$/, "").split("\n").map((l) => l.split("\t"));
  const body = $("bulkBody"), cols = [...start.closest("tr").querySelectorAll("[data-c]")].map((x) => x.dataset.c);
  let r0 = [...body.rows].indexOf(start.closest("tr")); const c0 = cols.indexOf(start.dataset.c);
  if (body.rows.length < r0 + lines.length) bulkAdd(r0 + lines.length - body.rows.length);
  lines.forEach((cells, r) => {
    let tr = body.rows[r0 + r];
    cells.forEach((v, c) => {
      const col = cols[c0 + c]; if (!col) return;
      bulkCell(tr.querySelector(`[data-c="${col}"]`), v);
      if (col === "kind") tr = bulkRekind(tr);
      if (col === "cat" && tr.querySelector('[data-c="kind"]').value !== "move") tr.querySelector('[data-c="sub"]').innerHTML = subOptions(tr.querySelector('[data-c="kind"]').value, tr.querySelector('[data-c="cat"]').value, "", !!tr.querySelector('[data-c="cat"]').value);
    });
  });
  bulkCount();
}

// ⬛ 채우기 손잡이 (냐냐 쪽에서 더함, 엑셀처럼): 고른 칸 오른쪽 아래 작은 네모를 아래(위)로 끌면 그 줄들 같은 칸에 같은 값 복사
//   구분을 복사하면 그 줄 칸을 구분에 맞게 다시 만들고, 분류를 복사하면 소분류 고르는 칸도 그 분류 것으로
let bkSrc = null;
function bulkFillPlace() {
  const h = $("bkFill"), wrap = h && h.parentElement; if (!h) return;
  const el = bkSrc && bkSrc.isConnected ? bkSrc : null; if (!el) { h.hidden = true; return; }
  const td = el.closest("td"), r = td.getBoundingClientRect(), w = wrap.getBoundingClientRect();
  h.hidden = false; h.style.left = (r.right - w.left + wrap.scrollLeft - 5) + "px"; h.style.top = (r.bottom - w.top + wrap.scrollTop - 5) + "px";
}
function bulkFillInit() {
  const body = $("bulkBody"), wrap = body.closest(".bulk-wrap");
  wrap.style.position = "relative";
  wrap.insertAdjacentHTML("beforeend", '<div class="bk-fill" id="bkFill" hidden title="끌어서 아래 줄에 복사"></div>');
  const h = $("bkFill");
  body.addEventListener("focusin", (ev) => { if (ev.target.dataset.c) { bkSrc = ev.target; bulkFillPlace(); } });
  wrap.addEventListener("scroll", bulkFillPlace);
  window.addEventListener("resize", bulkFillPlace);
  let drag = null;
  const rowAt = (x, y) => { const el = document.elementFromPoint(x, y), tr = el && el.closest && el.closest("#bulkBody tr"); return tr ? [...body.rows].indexOf(tr) : -1; };
  const mark = (on) => { body.querySelectorAll(".bk-fill-on").forEach((td) => td.classList.remove("bk-fill-on")); if (!on || !drag) return; const [a, z] = [Math.min(drag.r0, drag.r1), Math.max(drag.r0, drag.r1)]; for (let i = a; i <= z; i++) { const c = body.rows[i] && body.rows[i].querySelector(`[data-c="${drag.col}"]`); if (c) c.closest("td").classList.add("bk-fill-on"); } };
  h.addEventListener("pointerdown", (ev) => {
    if (!bkSrc || !bkSrc.isConnected) return;
    ev.preventDefault(); h.setPointerCapture(ev.pointerId);
    const r0 = [...body.rows].indexOf(bkSrc.closest("tr")); drag = { r0, r1: r0, col: bkSrc.dataset.c }; mark(true);
  });
  h.addEventListener("pointermove", (ev) => {
    if (!drag) return;
    const i = rowAt(ev.clientX, ev.clientY); if (i >= 0 && i !== drag.r1) { drag.r1 = i; mark(true); }
    const w = wrap.getBoundingClientRect(); if (ev.clientY > w.bottom - 20) wrap.scrollTop += 12; else if (ev.clientY < w.top + 30) wrap.scrollTop -= 12;   // 끝에 가면 저절로 넘김
  });
  const end = () => {
    if (!drag) return;
    const d = drag; drag = null; mark(false);
    if (d.r1 === d.r0) return;
    const src = body.rows[d.r0].querySelector(`[data-c="${d.col}"]`), val = src.value, text = src.tagName === "SELECT" ? (src.selectedOptions[0] || {}).text || "" : src.value;
    const srcCat = body.rows[d.r0].querySelector('[data-c="cat"]').value;
    const [a, z] = [Math.min(d.r0, d.r1), Math.max(d.r0, d.r1)];
    for (let i = a; i <= z; i++) {
      if (i === d.r0) continue;
      let tr = body.rows[i], el = tr.querySelector(`[data-c="${d.col}"]`); if (!el) continue;
      if (d.col === "kind") { el.value = val; tr = bulkRekind(tr); continue; }
      if (d.col === "sub" && tr.querySelector('[data-c="cat"]').value !== srcCat) continue;   // 소분류는 같은 분류 줄에만
      if (el.tagName === "SELECT") { if ([...el.options].some((o) => o.value === val)) el.value = val; else bulkCell(el, text); }
      else el.value = val;
      if (d.col === "cat" && tr.querySelector('[data-c="kind"]').value !== "move") tr.querySelector('[data-c="sub"]').innerHTML = subOptions(tr.querySelector('[data-c="kind"]').value, el.value, "");
    }
    bulkCount();
    const back = body.rows[d.r0] && body.rows[d.r0].querySelector(`[data-c="${d.col}"]`); if (back) { bkSrc = back; bulkFillPlace(); }
  };
  h.addEventListener("pointerup", end); h.addEventListener("pointercancel", end);
}

// 지출 탭 ＋: 새 기록 (지출, 마지막에 쓴 자산)
function txAdd() {
  ui.mEdit = null; ui.kind = "expense"; ui.asFor = null;
  $("mAmount").value = ""; $("mMemo").value = ""; $("mSub").value = ""; $("mNote").value = ""; $("mDate").value = today(); $("mAcct").value = ""; $("mCat").value = ""; setMPics([]);
  renderMoneyForm();
  openDrawer(); $("mAmount").focus();
}

// 내역 줄 내용 뒤 작은 표시: 소분류 · 📝 메모 · 📷 사진 수
function memoMarks(x) {
  const n = x.pics && typeof x.pics === "object" ? Object.keys(x.pics).length : 0;
  return (x.sub ? ` <span class="muted small">· ${esc(x.sub)}</span>` : "") + (x.note ? ` <span class="m-mark" title="${esc(x.note)}">📝</span>` : "") + (n ? ` <span class="m-mark">📷${n > 1 ? n : ""}</span>` : "");
}
// 📄 월급 기록이면 월급명세서 사진을 붙이라고 (사진이 있으면 안 보임)
const isSalary = () => ui.kind === "income" && $("mCat").value === "월급";
function salaryHint() { $("mSalaryHint").hidden = !isSalary() || mPics.length > 0; }
// 📷 메모 사진: 고르기·찍기, PC는 캡처 후 Ctrl+V. 긴 쪽 1280px + 작은 사진 360px로 줄여서 pics/{사진id}에 (돈 기록 money.pics = {사진id: 날짜})
const M_PIC_MAX = 4;
let mPics = [];   // [{ id, old(이미 저장된 것), thumb, full }]
function setMPics(list) {
  mPics = list; renderMPics();
  list.filter((p) => p.old && !p.thumb && E.backend && E.backend.getPic).forEach((p) => E.backend.getPic(p.id, "thumb").then((v) => { if (typeof v === "string" && v.startsWith("data:image/")) { p.thumb = v; renderMPics(); } }, () => {}));
}
function renderMPics() {
  salaryHint();
  $("mPics").innerHTML = mPics.map((p, i) => `<span class="req-pic"><button type="button" class="m-pic-v" data-act="mPicView" data-i="${i}" aria-label="메모 사진 ${i + 1} 크게 보기">${p.thumb ? `<img src="${p.thumb}" alt="">` : "📷"}</button><button type="button" data-act="mPicDel" data-i="${i}" aria-label="사진 빼기">✕</button></span>`).join("");
}
async function addMPics(files) {
  const imgs = [...files].filter((f) => f && (f.type || "").startsWith("image/"));
  if (!imgs.length) return false;
  for (const f of imgs) {
    if (mPics.length >= M_PIC_MAX) { toast(`메모 사진은 ${M_PIC_MAX}장까지예요.`); break; }
    try { mPics.push({ id: null, old: false, full: await shrinkPic(f), thumb: await shrinkPic(f, 360, 40000) }); } catch (e) { toast("그림을 못 읽었어요."); }
    renderMPics();
  }
  return true;
}
// 지금 기록 칸이 화면에 있는지 (서랍 창이 열렸거나 지출 탭에서 칸 안에 있을 때만 붙여넣기 받음)
function mFormActive() { const p = $("moneyPanel"); return $("mDrawer").open || (!!p.offsetParent && p.contains(document.activeElement)); }

// 자산 고르는 칸 (냐냐 쪽에서 더함, 편한가계부처럼): 자산 탭과 같은 순서로 현금 · 통장 · 카드 · 저축 묶음, 이름_계좌번호
export const acctLabel = (a) => a.name + (a.number ? "_" + a.number : "");
export function acctOptsHtml(list, cur) {
  return AS_GROUPS.map(([t, label]) => {
    const g = list.filter((a) => (ACCT_TYPES[a.type] ? a.type : "bank") === t); if (!g.length) return "";
    return `<optgroup label="${label}">${g.map((a) => `<option value="${esc(a.id)}"${a.id === cur ? " selected" : ""}>${esc(acctLabel(a))}</option>`).join("")}</optgroup>`;
  }).join("");
}
// 돈 기록 폼: 종류에 맞게 자산·분류 칸 바꾸기
export function acctOptions(sel, cur, kind) {
  const list = sortedAccts();
  // 수입은 카드로 받을 일이 없으니 카드 빼기
  const ok = list.filter((a) => !(kind === "income" && a.type === "card"));
  sel.innerHTML = '<option value="">선택 안 함</option>' + acctOptsHtml(ok) +
    (cur && !ok.some((a) => a.id === cur) ? `<option value="${esc(cur)}">${esc(acctName(cur))}</option>` : "");
  sel.value = cur || "";
}
export function lastAcct(kind) { try { return localStorage.getItem("nyanya-lastacct-" + kind) || ""; } catch (e) { return ""; } }
export function rememberAcct(kind, id) { try { localStorage.setItem("nyanya-lastacct-" + kind, id || ""); } catch (e) { /* 무시 */ } }
export function renderMoneyForm(fill) {
  const k = ui.kind, editing = ui.mEdit && S.money.get(ui.mEdit);
  document.querySelectorAll("#kindSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === k)));
  $("mFormTitle").textContent = editing ? "기록 고치기" : "돈 기록하기";
  $("mCancel").hidden = !editing; $("mDelete").hidden = !editing;
  if (!editing) { const d = $("mDelete"); d.classList.remove("armed"); d.textContent = "이 기록 삭제"; delete d.dataset.armed; }
  $("mAcctLabel").textContent = k === "income" ? "들어온 곳" : k === "expense" ? "낸 곳 (카드·통장·현금)" : k === "transfer" ? "보낸 곳" : "보내는 곳";
  $("mToWrap").hidden = k !== "move"; $("mCatWrap").hidden = k === "move";
  const keepAcct = fill ? fill.account : ($("mAcct").value || lastAcct(k));
  acctOptions($("mAcct"), keepAcct, k);
  if (k === "move") acctOptions($("mTo"), fill ? fill.toAccount : ($("mTo").value || lastAcct("moveTo")), k);
  const mc = $("mCat");
  if (fill && $("mCommon")) $("mCommon").checked = k === "expense" && !!fill.common;
  if (ccOn()) {   // 🏷 ❤️ 공통비용이면 공통 분류 (냐냐)
    const cc = ccList(), f0 = fill ? ccOf(fill) : null, want = f0 ? f0.c : mc.dataset.cc === "1" ? mc.value : "";
    const names = cc.map((c) => c.n); if (want && !names.includes(want)) names.push(want);
    mc.innerHTML = names.map((c) => `<option>${esc(c)}</option>`).join(""); if (want) mc.value = want;
    mc.dataset.cc = "1";
  } else {
    const want = fill ? fill.cat : mc.dataset.cc === "1" ? "" : mc.value, list = moneyCats(k === "move" ? "expense" : k);
    if (want && !list.includes(want)) list.push(want);
    mc.innerHTML = list.map((c) => `<option>${esc(c)}</option>`).join("");
    if (want && list.includes(want)) mc.value = want;
    mc.dataset.cc = "";
  }
  const lbl = $("mCatWrap") && $("mCatWrap").querySelector(".cat-lbl"); if (lbl) lbl.textContent = ccOn() ? "공통 분류" : "분류";
  // 💱 화폐 (끝에 '＋ 화폐 추가') · 소분류 (그 분류에서 전에 쓴 것 추천)
  const curs = currencies(), cv0 = fill ? fill.cur || "원" : $("mCur").value, cv = cv0 && cv0 !== "__add" ? cv0 : "원";
  if (!curs.includes(cv)) curs.push(cv);
  $("mCur").innerHTML = curs.map((c) => `<option>${esc(c)}</option>`).join("") + '<option value="__add">＋ 화폐 추가</option>';
  $("mCur").value = cv;
  if (fill) $("mNote").value = fill.note || "";
  const sv = fill ? (ccOn() ? ccOf(fill).s || "" : fill.sub || "") : $("mSub").value;
  $("mSub").innerHTML = ccOn() ? ccSubOptions(mc.value, sv && sv !== "__add" ? sv : "") : subOptions(k, mc.value, sv && sv !== "__add" ? sv : "");
  salaryHint();
  // ❤️ 공통비용 (냐냐 보드만 칸이 있음): 지출만. 체크하면 공통 저장소로 복사돼서 욱진이 가계부에도 보임
  const cw = $("mCommonWrap"); if (cw) cw.hidden = k !== "expense";
  // 💸 이체할 때 '공통비용 정산' 체크 (냐냐 쪽에서 더함, E.settleCommon): 체크하고 저장하면 이 금액만큼 선입선출 정산. 이미 정산한 이체는 ✅만
  const sw = $("mSettleWrap");
  if (sw) {
    sw.hidden = k !== "move" || !E.settleCommon;
    const done = !!(fill && fill.settle) || !!(editing && S.money.get(ui.mEdit) && S.money.get(ui.mEdit).settle);
    if (fill || !editing) $("mSettle").checked = done;
    sw.querySelector(".ms-done").hidden = !done;   // 체크를 빼고 저장하면 정산 장부에서도 빠짐
  }
  $("mHint").textContent = k === "income" ? "월급, 수당 같은 들어온 돈이에요."
    : k === "expense" ? "카드로 냈으면 카드를 고르세요. 카드값은 나중에 '이체'로 통장 → 카드로 적으면 돼요."
    : k === "transfer" ? `${partner()}에게 보낸 돈이에요. 남은 돈에서 빠져요.`
    : "내 자산끼리 옮긴 돈이에요 (통장 → 통장, 통장 → 카드값). 수입·지출로 치지 않아요.";
  $("mSubmit").textContent = editing ? "고친 내용 저장" : { income: "수입 기록", expense: "지출 기록", transfer: "보낸 돈 기록", move: "이체 기록" }[k];
  if (!$("mDate").value) $("mDate").value = today();
}
export function editMoney(id) {
  const x = S.money.get(id); if (!x) return;
  ui.mEdit = id; ui.kind = x.kind || "expense";
  $("mAmount").value = commaNum(x.amount || ""); $("mDate").value = x.date || today(); $("mMemo").value = x.memo || "";
  setMPics(Object.keys(x.pics && typeof x.pics === "object" ? x.pics : {}).map((pid) => ({ id: pid, old: true, thumb: null })));
  renderMoneyForm(x); renderMoney();
  openDrawer();   // 어느 탭에서든 서랍 창에서 고침
}
export function resetMoneyForm() {
  ui.mEdit = null; $("mAmount").value = ""; $("mMemo").value = ""; $("mDate").value = today();
  $("mSub").value = ""; $("mNote").value = ""; $("mCur").value = "원"; setMPics([]);
  if ($("mCommon")) $("mCommon").checked = false;
  closeDrawer();
  renderMoney();
}
// ＋ 서랍 창: 지출 탭의 '돈 기록하기' 칸(#moneyPanel)을 그대로 빌려 와 #mDrawer에 넣음 (PC 오른쪽, 폰 아래에서). 닫히면 제자리로
let drawerHome = null;
function openDrawer() {
  const d = $("mDrawer"), p = $("moneyPanel");
  if (p.parentNode !== d) { drawerHome = p.parentNode; d.appendChild(p); }
  openDlg(d);
}
// 닫을 때 바로 제자리로 (close 이벤트는 늦게 올 때가 있어서 직접), 고치던 건 취소
export function closeDrawer() { closeDlg($("mDrawer")); drawerClosed(); }
function drawerClosed() {
  if ($("mDrawer").open) return;   // 늦게 온 close 이벤트가 다시 연 창을 건드리지 않게
  if (drawerHome && $("moneyPanel").parentNode !== drawerHome) drawerHome.appendChild($("moneyPanel"));
  ui.asFor = null;
  if (ui.mEdit) resetMoneyForm();
}
// 저장한 기록이 보이는 달: 보통은 그 날짜의 달. 자산 탭에서 결제일 정한 카드를 보는 중이면 결제 달
// (쓴 돈 = 그 날이 이용기간에 든 달, 낸 돈 = 지난 결제일 다음 날 ~ 그 결제일에 든 달)
function shownMonth(doc) {
  const m0 = doc.date.slice(0, 7), sel = $("mDrawer").open && asSelected(), a = sel && S.accounts.get(sel);
  if (!a || a.type !== "card" || !a.pay || !a.pay.day || (doc.account !== sel && doc.toAccount !== sel)) return m0;
  const pay = doc.toAccount === sel;
  for (let k = -1; k <= 2; k++) {
    const m = shiftMonth(m0, k), p = cardPayPlan(a.pay, m);
    if (pay ? doc.date > cardPayPlan(a.pay, shiftMonth(m, -1)).date && doc.date <= p.date : doc.date >= p.from && doc.date <= p.to) return m;
  }
  return m0;
}
// 자산 화면 ＋: 그 자산이 골라진 지출 기록 (수입·보낸 돈·이체로 바꿔도 그 자산 그대로)
function asAdd(id) {
  if (!S.accounts.has(id)) return;
  ui.mEdit = null; ui.kind = "expense"; ui.asFor = id;
  $("mAmount").value = ""; $("mMemo").value = ""; $("mDate").value = today(); setMPics([]);
  renderMoneyForm({ account: id });
  openDrawer(); $("mAmount").focus();
}

// ---------- 자산 작은 창 ----------
export const ac = { id: null, type: "bank" };
export function openAcct(id) {
  const a = id ? S.accounts.get(id) : null;
  ac.id = id || null; ac.type = (a && a.type) || "bank";
  $("acTitle").textContent = a ? "자산 고치기" : "자산 추가";
  $("acName").value = a ? a.name : "";
  $("acInit").value = a ? commaNum((ac.type === "card" ? -(Number(a.initial) || 0) : Number(a.initial) || 0) || "", true) : "";
  const del = $("acDel"); del.hidden = !a; del.classList.remove("armed"); del.textContent = "이 자산 삭제"; delete del.dataset.armed;
  // 💳 카드 결제일·빠지는 통장·이용기간 (기본 전월 1일 ~ 전월 말일, 31 = 말일)
  const p = (a && a.pay) || {}, days = (max, last) => Array.from({ length: max }, (_, i) => i + 1).map((n) => `<option value="${n}">${n === 31 && last ? "말일" : n + "일"}</option>`).join("");
  $("acPayDay").innerHTML = '<option value="">아직 안 정함</option>' + days(31, true);
  $("acFromD").innerHTML = days(31, true); $("acToD").innerHTML = days(31, true);
  $("acPayFrom").innerHTML = acctOptsHtml(sortedAccts().filter((x) => x.type !== "card")) || '<option value="">통장을 먼저 추가해 주세요</option>';
  $("acPayDay").value = p.day || ""; if (p.from) $("acPayFrom").value = p.from;
  $("acFromM").value = String(p.fm ?? -1); $("acFromD").value = String(p.fd || 1); $("acToM").value = String(p.tm ?? -1); $("acToD").value = String(p.td || 31);
  renderAcctForm(); openDlg($("acctDlg"));
}
export function renderAcctForm() {
  document.querySelectorAll("#acTypeSeg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.k === ac.type)));
  const card = ac.type === "card";
  $("acInitLabel").textContent = card ? "지금 남아 있는 카드값 (원)" : "지금 잔액 (원)";
  $("acHint").textContent = card ? "카드로 쓴 지출만큼 카드값이 늘고, 통장 → 카드 '이체'로 갚으면 줄어요." : "앞으로 이 자산으로 들어오고 나간 기록이 잔액에 반영돼요.";
  $("acPay").hidden = !card;
}

// ---------- ⚙ 가계부 설정: 분류 · 소분류 · 화폐 ----------
// 소분류: settings.moneySubs[kind][catKey(분류)] = ["점심", "저녁"…] (기록·다건입력에서 골라서 씀)
export function subsOf(kind, cat) { const v = (((S.settings.moneySubs || {})[kind === "move" ? "expense" : kind] || {})[catKey(cat || "")]); return Array.isArray(v) ? v.filter(Boolean) : v && typeof v === "object" ? Object.values(v).filter(Boolean) : []; }
function saveSubs(kind, cat, list, msg) {
  if (!ready()) return Promise.resolve();
  const all = clone(S.settings.moneySubs || {}); all[kind] = all[kind] || {};
  if (list.length) all[kind][catKey(cat)] = list; else delete all[kind][catKey(cat)];
  return act(E.backend.saveSettings({ moneySubs: all }), msg).then(() => { renderCatEditor(); renderMoneyForm(); }).catch(() => {});
}
// 소분류 고르는 칸: 선택 안 함 + 그 분류 소분류 (+ 목록에 없는 예전 값) + '＋ 소분류 추가'
export function subOptions(kind, cat, cur, add = true) {
  const list = subsOf(kind, cat).slice(); if (cur && !list.includes(cur)) list.push(cur);
  return '<option value="">-</option>' + list.map((v) => `<option${v === cur ? " selected" : ""}>${esc(v)}</option>`).join("") + (add ? '<option value="__add">＋ 소분류 추가</option>' : "");
}
// 🏷 공통 소분류 고르는 칸 (공통 분류에서, 더하기는 공통 탭 '🏷 공통 분류'에서)
function ccSubOptions(cat, cur) {
  const c = (ccList() || []).find((x) => x.n === cat), list = c ? c.s.slice() : []; if (cur && !list.includes(cur)) list.push(cur);
  return '<option value="">-</option>' + list.map((v) => `<option${v === cur ? " selected" : ""}>${esc(v)}</option>`).join("");
}
// 고르는 칸에서 '＋ 소분류 추가' → 이름 묻고 설정에 더한 뒤 그걸로 골라 둠
export function askNewSub(kind, cat, sel) {
  const name = (prompt(`'${cat}' 소분류 이름 (예: 점심)`) || "").trim().slice(0, 20);
  if (!name) { sel.value = ""; return; }
  const list = subsOf(kind, cat); if (list.includes(name)) { sel.value = name; return; }
  saveSubs(kind, cat, list.concat([name]), `'${cat}' 소분류에 '${name}'을 더했어요.`).then(() => { sel.innerHTML = subOptions(kind, cat, name); sel.value = name; });
}
// 🏷 공통 분류 편집 (냐냐 쪽에서 더함): 설정 '분류'의 💙 공통비용 밑에 대분류마다 소분류 칩. 공통 저장소에 저장 (E.saveCommonCats), 욱진 보드엔 이 칸이 없음
function ccEditHtml() {
  const cc = ccList() || [];
  return `<div class="cc-edit"><div class="small muted">🏷 공통 분류 — ❤️ 체크하고 적을 때 이 분류로 골라요. ${esc(partner())}와 같이 쓰고, 고치는 건 냐냐만 해요.</div>` +
    cc.map((c, i) => `<div class="cc-row"><b>${esc(c.n)}</b><span class="sub-chips">${c.s.map((v, j) => `<span class="chip">${esc(v)} <button class="link-btn" type="button" data-act="ccSubDel" data-i="${i}" data-j="${j}" aria-label="${esc(v)} 빼기">×</button></span>`).join("")}` +
      `<form class="sub-add" data-cc-sub="${i}" autocomplete="off"><input type="text" maxlength="20" placeholder="＋ 소분류" aria-label="${esc(c.n)} 소분류 더하기"></form></span>` +
      `<button class="link-btn" type="button" data-act="ccCatDel" data-i="${i}" aria-label="${esc(c.n)} 빼기" title="공통 대분류 빼기">×</button></div>`).join("") +
    `<form class="mini-row" data-cc-cat autocomplete="off"><input type="text" maxlength="12" placeholder="새 공통 대분류" aria-label="공통 대분류 더하기"><button class="btn small ghost" type="submit">공통 분류 추가</button></form></div>`;
}
function saveCc(list, msg) { return act(E.saveCommonCats(list), msg).then(() => { renderCatEditor(); renderMoneyForm(); }).catch(() => {}); }
const ccCopy = () => (ccList() || []).map((c) => ({ n: c.n, s: c.s.slice() }));
export function renderCatEditor() {
  const groups = [["expense", "지출 분류"], ["income", "수입 분류"], ["transfer", "보낸 돈 분류"]];
  $("catEditor").innerHTML = groups.map(([k, label]) =>
    `<div class="set-grp"><h4>${label}</h4><div class="cat-rows">` +
    moneyCats(k).map((c, i) => `<div class="cat-row"><span class="cat-name"><button type="button" class="cdot-btn" data-act="catColor" data-k="${k}" data-i="${i}" style="--c:${catVar(k, c)}" aria-label="${esc(c)} 색 바꾸기" title="눌러서 색 바꾸기"></button><span class="nm">${esc(c)}</span><button class="link-btn" type="button" data-act="catRen" data-k="${k}" data-c="${esc(c)}" aria-label="${esc(c)} 이름 바꾸기" title="이름 바꾸기 (기록도 같이)">✏️</button><button class="link-btn" type="button" data-act="catDel" data-k="${k}" data-i="${i}" aria-label="${esc(c)} 분류 지우기" title="분류 지우기">×</button></span>` +
      (k === "expense" && c === commonCatName() && ccList() && E.saveCommonCats ? ccEditHtml() :   // 🏷 💙 공통비용 밑엔 공통 분류 (냐냐만 고침)
      `<div class="sub-chips">${subsOf(k, c).map((v, j) => `<span class="chip"><button class="link-btn sub-nm" type="button" data-act="subRen" data-k="${k}" data-c="${esc(c)}" data-s="${esc(v)}" title="눌러서 이름 바꾸기 (기록도 같이)">${esc(v)}</button> <button class="link-btn" type="button" data-act="subDel" data-k="${k}" data-i="${i}" data-j="${j}" aria-label="${esc(v)} 소분류 지우기">×</button></span>`).join("")}` +
      `<form class="sub-add" data-sub-form="${k}" data-i="${i}" autocomplete="off"><input type="text" maxlength="20" placeholder="＋ 소분류" aria-label="${esc(c)} 소분류 추가"></form></div>`) + `</div>`).join("") +
    `</div>${(() => {   // 냐냐: 목록엔 없는데 기록엔 남아 있는 분류 → ✏️로 다른 분류로 옮기기
      const have = new Set(moneyCats(k)), odd = {};
      S.money.forEach((x) => { if (x && x.kind !== "move" && (x.kind || "expense") === k && x.cat && !have.has(x.cat)) odd[x.cat] = (odd[x.cat] || 0) + 1; });
      const list = Object.entries(odd); if (!list.length) return "";
      return `<p class="small muted cat-odd">목록에 없는 분류 (기록엔 있음): ${list.map(([c, n]) => `<span class="chip">${esc(c)} ${n}건 <button class="link-btn" type="button" data-act="catRen" data-k="${k}" data-c="${esc(c)}" title="다른 이름·분류로 옮기기">✏️</button></span>`).join(" ")}</p>`;
    })()}<form class="mini-row" data-cat-form="${k}" autocomplete="off"><input type="text" maxlength="12" placeholder="새 분류 이름" aria-label="${label} 추가"><button class="btn small" type="submit">분류 추가</button></form></div>`
  ).join("") + '<div class="set-foot"><button class="btn ghost small" type="button" data-act="catReset">기본 분류로 되돌리기</button><span class="small muted">✏️·소분류 이름을 누르면 이름을 바꿔요 — 이미 적은 기록도 같이 바뀌어요 (있는 이름이면 합쳐져요). ×로 지우면 목록에서만 빠지고 기록은 그대로예요. 소분류는 입력하고 Enter.</span></div>';
}
function renderCurEditor() {
  $("curEditor").innerHTML = `<div class="sub-chips">${currencies().map((c, i) => `<span class="chip">${esc(c)}${i ? ` <button class="link-btn" type="button" data-act="curDel" data-i="${i}" aria-label="${esc(c)} 지우기">×</button>` : ' <span class="muted small">기본</span>'}</span>`).join("")}` +
    '<form class="sub-add" id="curForm" autocomplete="off"><input type="text" maxlength="8" placeholder="＋ 화폐 (예: 달러)" aria-label="화폐 추가"></form></div>';
}
function saveCurs(list, msg) { if (!ready()) return Promise.resolve(); return act(E.backend.saveSettings({ currencies: list }), msg).then(() => { renderCurEditor(); renderMoneyForm(); }).catch(() => {}); }
export function saveCats(kind, list) {
  if (!ready()) return;
  const all = { income: moneyCats("income"), expense: moneyCats("expense"), transfer: moneyCats("transfer") };
  if (kind) all[kind] = list;
  act(E.backend.saveSettings({ moneyCats: kind ? all : null }), "분류를 저장했어요.").then(() => { renderCatEditor(); renderMoneyForm(); }).catch(() => {});
}

// ✏️ 분류·소분류 이름 바꾸기 (냐냐 쪽에서 더함): 목록 · 색 · 소분류 · 이미 적은 기록 · 예산 · 매월 반복을 한 번에 (backend.rootUpdate)
//   새 이름이 이미 있으면 합침 (소분류도 합침). 목록에 없는 '기록에만 있는' 분류도 옮길 수 있음
const kindOfRec = (x) => x.kind || "expense";
function renameCat(k, old) {
  if (!ready() || !E.backend.rootUpdate) return;
  const name = (prompt(`'${old}' 분류의 새 이름 (이미 있는 분류 이름을 쓰면 합쳐져요)`, old) || "").trim().slice(0, 20);
  if (!name || name === old) return;
  const list = moneyCats(k), merge = list.includes(name), ids = [];
  S.money.forEach((x, id) => { if (x && x.kind !== "move" && kindOfRec(x) === k && x.cat === old) ids.push(id); });
  if (!confirm(`'${old}' → '${name}'${merge ? " (있는 분류와 합치기)" : ""}
기록 ${ids.length.toLocaleString()}건의 분류도 같이 바꿀까요?`)) return;
  const p = {}, oK = catKey(old), nK = catKey(name);
  const nl = list.filter((c) => c !== old); if (!merge) { const i = list.indexOf(old); nl.splice(i < 0 ? nl.length : i, 0, name); }
  p[`settings/moneyCats/${k}`] = nl;
  ["income", "expense", "transfer"].forEach((kk) => { if (kk !== k && !(S.settings.moneyCats || {})[kk]) p[`settings/moneyCats/${kk}`] = moneyCats(kk); });   // 기본 목록을 쓰던 종류도 같이 저장 (saveCats와 같게)
  const col = ((S.settings.catColors || {})[k] || {})[oK];
  if (col != null) { p[`settings/catColors/${k}/${oK}`] = null; if (!merge || ((S.settings.catColors || {})[k] || {})[nK] == null) p[`settings/catColors/${k}/${nK}`] = col; }
  const subs = subsOf(k, old); if (subs.length || merge) { const ms = subsOf(k, name).slice(); subs.forEach((v) => { if (!ms.includes(v)) ms.push(v); }); p[`settings/moneySubs/${k}/${oK}`] = null; p[`settings/moneySubs/${k}/${nK}`] = ms; }
  ids.forEach((id) => { p[`money/${id}/cat`] = name; });
  if (k === "expense") Object.entries(S.settings.budgets || {}).forEach(([m, b]) => Object.entries((b && b.items) || {}).forEach(([iid, v]) => { if (v && v.cat === old) p[`settings/budgets/${m}/items/${iid}/cat`] = name; }));
  Object.entries(S.settings.moneyRepeat || {}).forEach(([rid0, r]) => { if (r && r.kind !== "move" && (r.kind || "expense") === k && r.cat === old) p[`settings/moneyRepeat/${rid0}/cat`] = name; });
  act(E.backend.rootUpdate(p), `'${old}' → '${name}'로 바꿨어요 (기록 ${ids.length.toLocaleString()}건).`).then(() => { renderCatEditor(); renderMoneyForm(); render(); }).catch(() => {});
}
function renameSub(k, cat, old) {
  if (!ready() || !E.backend.rootUpdate) return;
  const name = (prompt(`'${cat}'의 소분류 '${old}' 새 이름 (이미 있는 이름이면 합쳐져요)`, old) || "").trim().slice(0, 20);
  if (!name || name === old) return;
  const list = subsOf(k, cat), merge = list.includes(name), ids = [];
  S.money.forEach((x, id) => { if (x && x.kind !== "move" && kindOfRec(x) === k && x.cat === cat && x.sub === old) ids.push(id); });
  if (!confirm(`'${cat}' 소분류 '${old}' → '${name}'${merge ? " (합치기)" : ""}
기록 ${ids.length.toLocaleString()}건도 같이 바꿀까요?`)) return;
  const p = { [`settings/moneySubs/${k}/${catKey(cat)}`]: merge ? list.filter((v) => v !== old) : list.map((v) => v === old ? name : v) };
  ids.forEach((id) => { p[`money/${id}/sub`] = name; });
  Object.entries(S.settings.moneyRepeat || {}).forEach(([rid0, r]) => { if (r && (r.kind || "expense") === k && r.cat === cat && r.sub === old) p[`settings/moneyRepeat/${rid0}/sub`] = name; });
  act(E.backend.rootUpdate(p), `'${old}' → '${name}'로 바꿨어요 (기록 ${ids.length.toLocaleString()}건).`).then(() => { renderCatEditor(); renderMoneyForm(); render(); }).catch(() => {});
}

// 🧪 연습 가계부 가짜 데이터: 통장·카드·현금·저축, 지난 3달 + 이번 달 월급(10일)·지출·카드값(15일)·줄 돈(15일), 예산·줄 돈
// 특정 상황이 필요하면 여기에 더 넣으면 됨 (주인이 말해 주면 Claude가 상황에 맞게 추가)
export function makeDemoData() {
  const t = today(), m0 = t.slice(0, 7), now = Date.now(), money = {}, rnd = (a, b) => Math.round((a + Math.random() * (b - a)) / 100) * 100;
  let n = 0; const put = (doc) => { money["d" + (++n)] = { createdAt: now + n, ...doc }; };
  const accounts = {
    bank: { name: "국민 월급통장", type: "bank", initial: 1200000, createdAt: 1 },
    card: { name: "현대카드", type: "card", initial: 0, createdAt: 2, pay: { day: 15, from: "bank", fm: -1, fd: 4, tm: 0, td: 3, since: shiftMonth(m0, -3) + "-01" } },
    cash: { name: "현금", type: "cash", initial: 300000, createdAt: 3 },
    save: { name: "청년 적금", type: "save", initial: 3000000, createdAt: 4 }
  };
  const spend = [["식비", 8000, 15000, 10], ["카페·간식", 3000, 7000, 6], ["교통·차량", 10000, 50000, 3], ["장보기", 20000, 60000, 3], ["데이트", 30000, 80000, 2], ["통신", 59000, 59000, 1], ["생필품", 5000, 25000, 2], ["쇼핑", 20000, 70000, 1]];
  for (let k = -3; k <= 0; k++) {
    const m = shiftMonth(m0, k), last = new Date(+m.slice(0, 4), +m.slice(5, 7), 0).getDate(), upto = k === 0 ? +t.slice(8) : last, day = (d) => `${m}-${pad(Math.min(d, last))}`;
    if (upto >= 10) put({ kind: "income", cat: "월급", amount: 2600000 + (k % 2) * 100000, date: day(10), account: "bank", memo: `${+m.slice(5)}월 월급` });
    spend.forEach(([cat, lo, hi, times]) => { for (let i = 0; i < times; i++) { const d = 1 + Math.floor(Math.random() * upto); put({ kind: "expense", cat, amount: rnd(lo, hi), date: day(d), account: cat === "통신" ? "bank" : Math.random() < 0.75 ? "card" : Math.random() < 0.8 ? "bank" : "cash", memo: "" }); } });
    if (k < 0 || upto >= 15) put({ kind: "transfer", cat: "생활비", amount: 1500000, date: day(15), account: "bank", memo: `💝 ${+m.slice(5)}월 줄 돈` });
  }
  // 카드값: 15일에 이용기간(전월 4일 ~ 당월 3일) 카드 사용액만큼 통장 → 카드 (이번 달은 15일이 지났을 때만)
  for (let k = -2; k <= 0; k++) {
    const m = shiftMonth(m0, k), date = `${m}-15`, from = `${shiftMonth(m, -1)}-04`, to = `${m}-03`;
    if (date > t) continue;
    const amt = Object.values(money).filter((x) => x.kind === "expense" && x.account === "card" && x.date >= from && x.date <= to).reduce((a, x) => a + x.amount, 0);
    if (amt) put({ kind: "move", amount: amt, date, account: "bank", toAccount: "card", memo: `💳 현대카드값 (${+from.slice(5, 7)}/4~${+m.slice(5)}/3 사용분)` });
  }
  const items = { a: { cat: "식비", memo: "점심", amount: 300000, createdAt: 1 }, b: { cat: "교통·차량", memo: "", amount: 150000, createdAt: 2 }, c: { cat: "통신", memo: "", amount: 60000, createdAt: 3 }, d: { cat: "데이트", memo: "", amount: 200000, createdAt: 4 }, e: { cat: "기타", memo: "", amount: 50000, createdAt: 5 } };
  const budgets = {}; for (let k = -3; k <= 0; k++) budgets[shiftMonth(m0, k)] = { items: clone(items), give: 1500000 };
  const autoTasks = {}; for (let k = -3; k <= 0; k++) { const m = shiftMonth(m0, k); autoTasks[`give-${m}`] = true; autoTasks[`cp-card-${m}`] = true; }
  return { settings: { ...DEFAULTS, createdAt: now - 100 * 864e5, budgets, autoTasks, giveFrom: "bank" }, accounts, money, goals: {}, tasks: {}, logs: {}, requests: {}, wins: {} };
}


// 돈 관리 화면의 입력 칸 연결 (bindMoney 다음에 한 번)
export function initMoney() {
  document.addEventListener("mousemove", pieTip); document.addEventListener("click", pieTip);
  $("mCat").addEventListener("change", () => { $("mSub").innerHTML = ccOn() ? ccSubOptions($("mCat").value, "") : subOptions(ui.kind, $("mCat").value, ""); salaryHint(); });
  if ($("mCommon")) $("mCommon").addEventListener("change", () => renderMoneyForm());   // 🏷 ❤️ 체크하면 분류 칸이 공통 분류로 (냐냐)
  $("mSub").addEventListener("change", () => { if ($("mSub").value === "__add") askNewSub(ui.kind, $("mCat").value, $("mSub")); });
  // ▦ 다건입력: 구분 바꾸면 그 줄 칸 다시, Enter = 아래 칸 (마지막 줄이면 줄 더), 붙여넣기
  $("bulkBody").addEventListener("change", (ev) => {
    const t = ev.target, tr = t.closest("tr"), kind = tr && tr.querySelector('[data-c="kind"]').value;
    if (t.dataset.c === "kind") { const nt = bulkRekind(tr); nt.querySelector('[data-c="kind"]').focus(); }
    else if (t.dataset.c === "cat" && kind !== "move") tr.querySelector('[data-c="sub"]').innerHTML = subOptions(kind, t.value, "", !!t.value);
    else if (t.dataset.c === "sub" && t.value === "__add") askNewSub(kind, tr.querySelector('[data-c="cat"]').value, t);
    bulkCount();
  });
  $("bulkBody").addEventListener("input", bulkCount);
  $("bulkBody").addEventListener("paste", bulkPaste);
  $("bulkBody").addEventListener("keydown", bulkPasteKey);
  bulkFillInit();   // ⬛ 채우기 손잡이 (냐냐)
  $("bulkBody").addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" || ev.isComposing || !ev.target.dataset.c) return;
    ev.preventDefault();
    const tr = ev.target.closest("tr"), body = $("bulkBody"), i = [...body.rows].indexOf(tr);
    if (i === body.rows.length - 1) bulkAdd(5);
    const next = body.rows[i + 1].querySelector(`[data-c="${ev.target.dataset.c}"]`); if (next) next.focus();
  });
  $("bulkDlg").addEventListener("click", (ev) => { if (ev.target === ev.currentTarget) closeDlg(ev.currentTarget); });
  // ☐ 고르기: 줄을 눌러 고치기와 안 겹치게 체크칸 누름은 여기서만
  $("txList").addEventListener("click", (ev) => { if (ev.target.closest("[data-noedit], .tx-th")) ev.stopPropagation(); }, true);
  $("txList").addEventListener("change", (ev) => {
    const t = ev.target;
    if (t.dataset.txck) { if (t.checked) txSel.add(t.dataset.txck); else txSel.delete(t.dataset.txck); renderMoney(); }
    else if ("txall" in t.dataset) { const ids = [...$("txList").querySelectorAll("[data-txck]")].map((c) => c.dataset.txck); if (t.checked) ids.forEach((k) => txSel.add(k)); else txSel.clear(); renderMoney(); }
  });
  $("mCur").addEventListener("change", () => {
    if ($("mCur").value !== "__add") return;
    const name = (prompt("더할 화폐 이름 (예: 달러, 엔, 유로)") || "").trim().slice(0, 8);
    if (!name || currencies().includes(name)) { $("mCur").value = name && currencies().includes(name) ? name : "원"; return; }
    act(E.backend.saveSettings({ currencies: currencies().slice(1).concat([name]) }), `💱 '${name}'을 화폐에 더했어요.`).then(() => { renderMoneyForm(); $("mCur").value = name; }).catch(() => { $("mCur").value = "원"; });
  });
  $("mPicFile").addEventListener("change", (ev) => { addMPics(ev.target.files); ev.target.value = ""; });
  document.addEventListener("paste", (ev) => {
    if (!mFormActive() || $("proofDlg").open) return;
    const files = [...(ev.clipboardData && ev.clipboardData.items || [])].filter((it) => it.kind === "file").map((it) => it.getAsFile());
    if (files.some((f) => f && (f.type || "").startsWith("image/"))) { ev.preventDefault(); addMPics(files); }
  });
  // 서랍 창이 닫히면 (저장·✕·바깥 누름·Esc) 기록 칸을 지출 탭 제자리로, 고치던 건 취소
  $("mDrawer").addEventListener("close", drawerClosed);
  $("mDrawer").addEventListener("cancel", (ev) => { ev.preventDefault(); closeDrawer(); });   // Esc
  $("mDrawer").addEventListener("click", (ev) => { if (ev.target === ev.currentTarget) closeDrawer(); });
  $("moneyForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (!ready()) return;
    const amount = amtVal($("mAmount"));
    if (!(amount > 0)) { toast("금액을 적어 주세요."); return; }
    const date = $("mDate").value || today(), k = ui.kind;
    const account = $("mAcct").value || null, toAccount = k === "move" ? ($("mTo").value || null) : null;
    if (k === "move" && (!account || !toAccount)) { toast("이체는 보내는 곳과 받는 곳을 골라 주세요."); return; }
    if (k === "move" && account === toAccount) { toast("보내는 곳과 받는 곳이 같아요."); return; }
    if (isSalary() && !mPics.length && !confirm("📄 월급명세서 사진을 아직 안 붙였어요.\n사진 없이 저장할까요? ([취소]를 누르면 돌아가서 붙일 수 있어요)")) return;
    const cur = $("mCur").value && $("mCur").value !== "원" && $("mCur").value !== "__add" ? $("mCur").value : null;
    const doc = { kind: k, amount, date, cat: k === "move" ? null : $("mCat").value, sub: k === "move" || !$("mSub").value || $("mSub").value === "__add" ? null : $("mSub").value, cur,
      memo: $("mMemo").value.trim(), note: $("mNote").value.trim() || null, account, toAccount,
      common: k === "expense" && $("mCommon") && $("mCommon").checked ? true : null, ccat: null, csub: null };
    if (k === "expense" && ccOn()) { doc.ccat = doc.cat; doc.csub = doc.sub; doc.cat = commonCatName(); doc.sub = null; }   // 🏷 공통 분류 → ccat·csub, 내 분류는 '💙 공통비용'
    rememberAcct(k, account); if (k === "move") rememberAcct("moveTo", toAccount);
    const editing = ui.mEdit && S.money.has(ui.mEdit), id0 = editing ? ui.mEdit : null, old = editing ? S.money.get(id0).pics || {} : {};
    // 💸 공통비용 정산 (이체 + 체크 + 아직 이 이체로 정산 안 함): 미리보기 확인 → 저장 뒤 정산, 메모가 비면 '2511 잔액 601,900원'처럼
    // 💸 정산 장부: 새로 체크 → 미리보기 확인 후 장부에 한 줄 (이체 id로), 이미 정산한 이체 → 금액·날짜 바뀌면 장부도 고침, 체크 뺌 → 장부에서 지움
    const wasSettle = !!(editing && S.money.get(id0).settle), wantSettle = k === "move" && !!E.settleCommon && !!$("mSettle") && $("mSettle").checked;
    let settle = null;
    if (wantSettle && !wasSettle) {
      const pv = E.settlePreview(amount);
      if (!pv) { toast("공통 공간이 아직 안 열렸어요. 공통 탭을 한 번 열고 다시 해 주세요."); return; }
      if (!confirm(`💸 ${won(amount)}을 공통비용 정산으로 적을까요? (오래된 것부터 금액만큼)\n${pv.text}${pv.left ? `\n남는 돈 ${won(pv.left)}` : ""}\n→ ${pv.rest}`)) return;
      settle = pv; if (!doc.note) doc.note = pv.rest;
    }
    doc.settle = wantSettle ? true : null;
    // 📷 사진: 남긴 것 + 새로 붙인 것 → money.pics, 뺀 것은 pics/에서 지움
    const fresh = mPics.filter((p) => !p.old && p.full).map((p) => ({ ...p, id: rid() })), pics = {};
    mPics.filter((p) => p.old).forEach((p) => { pics[p.id] = old[p.id] || date; });
    fresh.forEach((p) => { pics[p.id] = date; });
    const gone = Object.keys(old).filter((pid) => !(pid in pics));
    doc.pics = Object.keys(pics).length ? pics : null;
    let savedId = null;
    act((async () => {
      const id = editing ? (await E.backend.update("money", id0, doc), id0) : await E.backend.add("money", { ...doc, createdAt: Date.now() });
      savedId = id;
      for (const p of fresh) await E.backend.putPic(p.id, { full: p.full, thumb: p.thumb, money: id, kind: "money", title: doc.memo || doc.cat || "", date, at: Date.now() });
      for (const pid of gone) await E.backend.putPic(pid, null);
      if (wantSettle) await E.settleCommon(amount, id, { date, memo: doc.memo || doc.note || "이체", money: id });
      else if (wasSettle) await E.unsettleCommon(id);
    })(), settle ? `💸 정산했어요. ${settle.rest}` : wasSettle && !wantSettle ? "정산 장부에서 뺐어요." : editing ? "고쳤어요." : "기록했어요.")
      .then(() => { const mm = shownMonth(doc); if (mm !== ui.month) ui.month = mm; resetMoneyForm(); if (E.onMoneySaved && savedId) E.onMoneySaved(savedId); }).catch(() => {});   // 냐냐: 🏥보험금 저장 → 병원비 고르는 창
  });

  $("acctForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (!ready()) return;
    const name = $("acName").value.trim(); if (!name) { toast("이름을 적어 주세요."); return; }
    const v = amtVal($("acInit"));
    const doc = { name, type: ac.type, initial: ac.type === "card" ? -Math.abs(v) : v };
    if (ac.type === "card") {   // 결제일을 정하면 그날부터 자동 이체 (정한 날 전 결제일은 건드리지 않음 — since)
      const day = parseInt($("acPayDay").value, 10) || 0, from = $("acPayFrom").value, old = (ac.id && (S.accounts.get(ac.id) || {}).pay) || {};
      if (day && !from) { toast("카드값이 빠지는 통장을 골라 주세요."); return; }
      doc.pay = day ? { day, from, fm: +$("acFromM").value, fd: +$("acFromD").value, tm: +$("acToM").value, td: +$("acToD").value, since: old.since || today() } : null;
    }
    act(ac.id ? E.backend.update("accounts", ac.id, doc) : E.backend.add("accounts", { ...doc, createdAt: Date.now() }), ac.id ? "자산을 고쳤어요." : "자산을 추가했어요.")
      .then(() => closeDlg($("acctDlg"))).catch(() => {});
  });
  $("catEditor").addEventListener("submit", (ev) => {
    const cs = ev.target.closest("[data-cc-sub]"), cf = ev.target.closest("[data-cc-cat]");
    if (cs || cf) {   // 🏷 공통 분류 더하기 (냐냐)
      ev.preventDefault();
      const v = (cs || cf).querySelector("input").value.trim().slice(0, 20), list = ccCopy(); if (!v) return;
      if (cf) { if (list.some((c) => c.n === v)) { toast("이미 있는 공통 대분류예요."); return; } list.push({ n: v, s: [] }); }
      else { const c = list[+cs.dataset.ccSub]; if (!c) return; if (c.s.includes(v)) { toast("이미 있는 소분류예요."); return; } c.s.push(v); }
      saveCc(list, `🏷 공통 분류에 '${v}'을 더했어요.`);
      return;
    }
    const sf = ev.target.closest("[data-sub-form]");
    if (sf) {   // 소분류 더하기 (Enter)
      ev.preventDefault();
      const k = sf.dataset.subForm, cat = moneyCats(k)[+sf.dataset.i], v = sf.querySelector("input").value.trim().slice(0, 20); if (!v || cat == null) return;
      const list = subsOf(k, cat); if (list.includes(v)) { toast("이미 있는 소분류예요."); return; }
      saveSubs(k, cat, list.concat([v]), `'${cat}' 소분류에 '${v}'을 더했어요.`).then(() => { const inp = $("catEditor").querySelector(`[data-sub-form="${k}"][data-i="${sf.dataset.i}"] input`); if (inp) inp.focus(); });
      return;
    }
    const f = ev.target.closest("[data-cat-form]"); if (!f) return;
    ev.preventDefault();
    const k = f.dataset.catForm, v = f.querySelector("input").value.trim(); if (!v) return;
    const list = moneyCats(k); if (list.includes(v)) { toast("이미 있는 분류예요."); return; }
    list.push(v); saveCats(k, list);
  });

  $("curEditor").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const v = (ev.target.querySelector("input").value || "").trim().slice(0, 8); if (!v) return;
    if (currencies().includes(v)) { toast("이미 있는 화폐예요."); return; }
    saveCurs(currencies().slice(1).concat([v]), `💱 '${v}'을 화폐에 더했어요.`);
  });
  $("stPer").addEventListener("change", () => { ui.stP = $("stPer").value; ui.stAt = today(); renderMoney(); });
  ["stFrom", "stTo"].forEach((k) => $(k).addEventListener("change", () => { ui[k] = $(k).value || null; renderMoney(); }));
  ["histFrom", "histTo"].forEach((k) => $(k).addEventListener("change", () => { ui[k] = $(k).value || null; renderMoney(); }));
  $("planAddForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    const m = ui.month, cat = $("planCat").value.trim(), memo = $("planMemo").value.trim(), amount = amtVal($("planAmt"));
    if (!cat) { toast("분류를 적어 주세요. 예: 식비"); return; }
    if (planOf(m).items.some((v) => v.cat === cat)) { toast("이미 있는 분류예요. 금액 칸을 고쳐 주세요."); return; }
    const id = "b" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
    savePlan(m, { items: { [id]: { cat, memo, amount: Math.round(amount / planX(cat)), createdAt: Date.now() } } }, `${cat} 예산을 넣었어요.`).then(() => { $("planCat").value = ""; $("planMemo").value = ""; $("planAmt").value = ""; $("planCat").focus(); });
  });
  $("planGiveFrom").addEventListener("change", () => act(E.backend.saveSettings({ giveFrom: $("planGiveFrom").value || null }), "💝 보내는 통장을 저장했어요.").catch(() => {}));
  $("planGive").addEventListener("change", () => { const v = $("planGive").value.trim(); savePlan(ui.month, { give: v ? amtVal($("planGive")) : null }, v ? `💝 줄 돈을 ${won(amtVal($("planGive")))}으로 정했어요.` : "💝 줄 돈을 비웠어요. 남는 돈은 다 잔액이에요."); });
  $("planRows").addEventListener("change", (ev) => {
    const d = ev.target.dataset || {};
    if (d.planMemo) { savePlan(ui.month, { items: { [d.planMemo]: { memo: ev.target.value.trim() } } }, "메모를 고쳤어요."); return; }
    const id = d.planAmt; if (!id) return;
    const v = planOf(ui.month).items.find((z) => z.id === id), x = v ? planX(v.cat) : 1;   // 💑 두 배로 보이던 공통비용은 ÷2 해서 내 몫으로 저장
    savePlan(ui.month, { items: { [id]: { amount: Math.round(amtVal(ev.target) / x) } } }, x > 1 ? "예산을 고쳤어요 (내 몫 = 절반으로 저장)." : "예산을 고쳤어요.");
  });
  $("budgetForm").addEventListener("submit", (ev) => {
    ev.preventDefault();
    if (!ready()) return;
    act(E.backend.saveSettings({ budget: amtVal($("budgetIn")) }), "예산을 저장했어요.").catch(() => {});
  });
}

// 돈 관리 버튼 동작: 처리했으면 true (보드 쪽 클릭 처리기가 먼저 물어봄)
export function moneyAction(a, el, id, t) {
  if (a === "cardPayDo") { doCardPay(); return true; }
  if (a === "planDel") { const v = planOf(ui.month).items.find((z) => z.id === id); savePlan(ui.month, { items: { [id]: null } }, v ? `${v.cat} 예산을 뺐어요.` : ""); return true; }
  if (a === "histRange") { ui.histRange = el.dataset.k; renderMoney(); return true; }
  if (a === "histMonth") { ui.month = el.dataset.m; renderMoney(); const p = $("planPanel"); if (p) p.scrollIntoView({ behavior: "smooth", block: "start" }); toast(`${monthLabel(el.dataset.m)} 예산·내역을 보여요.`); return true; }
  if (a === "month") { ui.month = shiftMonth(ui.month, +el.dataset.d); renderMoney(); return true; }
  if (a === "kind") { ui.kind = el.dataset.k; if (!ui.mEdit) { $("mAcct").value = $("mDrawer").open && ui.asFor || ""; $("mTo").value = ""; $("mCat").value = ""; } renderMoneyForm(); return true; }
  if (a === "asAdd") { asAdd(id); return true; }
  if (a === "mPicDel") { mPics.splice(+el.dataset.i, 1); renderMPics(); return true; }
  if (a === "mPicView") { const p = mPics[+el.dataset.i]; if (!p) return true; if (p.full) { $("picImg").src = p.full; openDlg($("picDlg")); } else if (p.old) viewPic(p.id); return true; }
  if (a === "drawerClose") { closeDrawer(); return true; }
  if (a === "editMoney") { editMoney(id); return true; }
  if (a === "mCancel") { resetMoneyForm(); return true; }
  if (a === "mDelete") {
    if (!ready() || !ui.mEdit) return true;
    if (el.dataset.armed !== "1") { el.dataset.armed = "1"; el.classList.add("armed"); el.textContent = "정말 삭제?"; return true; }
    const gone0 = ui.mEdit, wasS = !!(S.money.get(gone0) || {}).settle;
    act(E.backend.remove("money", gone0).then(() => wasS && E.unsettleCommon ? E.unsettleCommon(gone0) : null), wasS ? "삭제했어요. 정산 장부에서도 뺐어요." : "삭제했어요.").then(resetMoneyForm).catch(() => {});
    return true;
  }
  if (a === "asSel") { ui.asSel = id; ui.asOpen = true; renderMoney(); if (window.matchMedia("(max-width: 1100px)").matches) $("asGrid").scrollIntoView({ block: "start" }); return true; }
  if (a === "asBack") { ui.asOpen = false; renderMoney(); $("asGrid").scrollIntoView({ block: "start" }); return true; }
  if (a === "cardPayNow") { payCardNow(id); return true; }
  if (a === "asFold") { const f = asFold(); if (f[el.dataset.k]) delete f[el.dataset.k]; else f[el.dataset.k] = 1; lsSet("nyanya-as-fold", JSON.stringify(f)); renderMoney(); return true; }
  if (a === "mcKind") { ui.mcKind = el.dataset.k; renderMoney(); return true; }
  if (a === "mcDay") { ui.mcDay = el.dataset.day; if (ui.mcDay.slice(0, 7) !== ui.month) ui.month = ui.mcDay.slice(0, 7); renderMoney(); if (window.matchMedia("(max-width: 1100px)").matches) $("mcDay").scrollIntoView({ behavior: "smooth", block: "nearest" }); return true; }
  if (a === "mcAdd") { const d = ui.mcDay && ui.mcDay.slice(0, 7) === ui.month ? ui.mcDay : today().slice(0, 7) === ui.month ? today() : `${ui.month}-01`; txAdd(); $("mDate").value = d; return true; }
  if (a === "stKind") { ui.stK = el.dataset.k; ui.stCat = null; renderMoney(); return true; }
  if (a === "stCat") { ui.stCat = el.dataset.k || null; ui.stCc = null; renderMoney(); return true; }
  if (a === "stCc") { ui.stCc = ui.stCc === el.dataset.k ? null : el.dataset.k || null; renderMoney(); return true; }   // 🏷 공통비용 펼친 줄 (냐냐)
  if (a === "stMove") { const st = stState(), d = +el.dataset.d; ui.stAt = st.p === "week" ? addDaysS(st.anchor, 7 * d) : st.p === "year" ? `${+st.anchor.slice(0, 4) + d}${st.anchor.slice(4)}` : `${shiftMonth(st.anchor.slice(0, 7), d)}-01`; renderMoney(); return true; }
  if (a === "txKind") { ui.txKind = el.dataset.k; renderMoney(); return true; }
  if (a === "txAdd") { txAdd(); return true; }
  if (a === "bulkOpen") { bulkOpen(); return true; }
  if (a === "bulkClose") { closeDlg($("bulkDlg")); return true; }
  if (a === "bulkMore") { bulkAdd(5); return true; }
  if (a === "bulkSave") { bulkSave(); return true; }
  if (a === "bulkDel") { const tr = el.closest("tr"); tr.replaceWith(Object.assign(document.createElement("tbody"), { innerHTML: bulkRowHtml({}) }).firstElementChild); bulkNumber(); return true; }
  if (a === "monthNow") { ui.month = today().slice(0, 7); renderMoney(); return true; }
  if (a === "mineToggle") { if (!ready()) return true; const on = !mineOn(); act(E.backend.saveSettings({ moneyMine: on || null }), on ? "💑 내 몫으로 보기: 공통비용은 절반, 욱진입금은 수입에서 빼고 봐요." : "실제로 오간 돈 그대로 봐요.").catch(() => {}); return true; }
  // 🧾 내역 기간: 달 이름·[이번 달] → 기간 고르기 창, ‹ › → 한 달이면 한 달씩, 아니면 같은 날 수만큼
  if (a === "txPick") {
    const cur = ui.txRange || { from: ui.month + "-01", to: `${ui.month}-${String(new Date(+ui.month.slice(0, 4), +ui.month.slice(5, 7), 0).getDate()).padStart(2, "0")}` };
    let first = t; S.money.forEach((x) => { if (x && x.date && x.date < first) first = x.date; });
    openRangePicker(el.closest(".tx-head") || el, { from: cur.from, to: cur.to, first, today: t }, ({ from, to }) => { const wm = wholeMonth(from, to); if (wm) { ui.month = wm; ui.txRange = null; } else ui.txRange = { from, to }; renderMoney(); });
    return true;
  }
  if (a === "txShift") {
    if (ui.txRange) { const r = shiftRange(ui.txRange.from, ui.txRange.to, +el.dataset.d), wm = wholeMonth(r.from, r.to); if (wm) { ui.month = wm; ui.txRange = null; } else ui.txRange = r; }
    else ui.month = shiftMonth(ui.month, +el.dataset.d);
    renderMoney(); return true;
  }
  if (a === "txSelNone") { txSel.clear(); renderMoney(); return true; }
  if (a === "txDel") {
    if (!ready() || !txSel.size) return true;
    if (el.dataset.armed !== "1") { el.dataset.armed = "1"; el.textContent = `정말 ${txSel.size}개 삭제?`; return true; }
    const ids = [...txSel]; txSel.clear();
    act((async () => { for (const k of ids) { const wasS = !!(S.money.get(k) || {}).settle; await E.backend.remove("money", k); if (wasS && E.unsettleCommon) await E.unsettleCommon(k); } })(), `${ids.length}개를 지웠어요. (↶로 되돌릴 수 있어요)`).catch(() => {});
    return true;
  }
  if (a === "newAcct") { openAcct(null); return true; }
  if (a === "editAcct") { openAcct(id); return true; }
  if (a === "demoReset") { try { localStorage.removeItem("nyanya-money-demo"); } catch (e) { /* 무시 */ } toast("연습 데이터를 새로 만들어요…"); setTimeout(() => location.reload(), 300); return true; }
  if (a === "mTab") { setMTab(el.dataset.k); return true; }
  if (a === "closeAcct") { closeDlg($("acctDlg")); return true; }
  if (a === "acType") { ac.type = el.dataset.k; renderAcctForm(); return true; }
  if (a === "delAcct") {
    if (!ready() || !ac.id) return true;
    if (el.dataset.armed !== "1") { el.dataset.armed = "1"; el.classList.add("armed"); el.textContent = "정말 삭제? (기록은 남아요)"; return true; }
    act(E.backend.remove("accounts", ac.id), "자산을 지웠어요.").then(() => closeDlg($("acctDlg"))).catch(() => {});
    return true;
  }
  if (a === "editCats") { closeDrawer(); setMTab("settings"); return true; }
  if (a === "subDel") { const k = el.dataset.k, cat = moneyCats(k)[+el.dataset.i]; if (cat == null) return true; const list = subsOf(k, cat), v = list[+el.dataset.j]; list.splice(+el.dataset.j, 1); saveSubs(k, cat, list, `'${v}' 소분류를 뺐어요.`); return true; }
  if (a === "curDel") { const list = currencies().slice(1), v = list[+el.dataset.i - 1]; list.splice(+el.dataset.i - 1, 1); saveCurs(list, `'${v}'을 화폐에서 뺐어요.`); return true; }
  if (a === "catColor") {
    if (!ready()) return true;
    const k = el.dataset.k, c = moneyCats(k)[+el.dataset.i]; if (c == null) return true;
    act(E.backend.saveSettingsDeep({ catColors: { [k]: { [catKey(c)]: (catIdx(k, c) + 1) % (CAT_N + 1) } } })).then(() => { renderCatEditor(); render(); }).catch(() => {});
    return true;
  }
  if (a === "catDel") { const list = moneyCats(el.dataset.k); list.splice(+el.dataset.i, 1); if (!list.length) { toast("분류는 하나 이상 있어야 해요."); return true; } saveCats(el.dataset.k, list); return true; }
  if (a === "catReset") { saveCats(null); return true; }
  if (a === "catRen") { renameCat(el.dataset.k, el.dataset.c); return true; }
  if ((a === "ccSubDel" || a === "ccCatDel") && E.saveCommonCats) {   // 🏷 공통 분류 빼기 (냐냐)
    const list = ccCopy(), c = list[+el.dataset.i]; if (!c) return true;
    if (a === "ccSubDel") { const v = c.s[+el.dataset.j]; c.s.splice(+el.dataset.j, 1); saveCc(list, `'${v}' 공통 소분류를 뺐어요. 이미 적은 기록은 그대로예요.`); }
    else { if (!confirm(`공통 대분류 '${c.n}'을 뺄까요? 이미 적은 기록은 그대로예요.`)) return true; list.splice(+el.dataset.i, 1); saveCc(list, `'${c.n}' 공통 대분류를 뺐어요.`); }
    return true;
  }
  if (a === "subRen") { renameSub(el.dataset.k, el.dataset.c, el.dataset.s); return true; }
  return false;
}
