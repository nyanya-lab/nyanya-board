// 📖🎬 연동 — 스페인어 공부방·Watch LOG 기록을 **읽기만** 해요 (그쪽 데이터는 절대 안 고침).
// 두 앱 다 "동기화 비밀번호 = 서버 자리" 방식이라, 비밀번호만 알면 읽을 수 있어요.
//   스페인어: Firebase nyanya-vocab  vocab/{비번}__v3/diary/{날짜}  (없으면 옛 통째 저장 vocab/{비번}/nyanyaDiary)
//   왓치로그: Firebase nyanya-watchlog  watchlog/{비번}__v3/items/{id}
// 비밀번호 찾는 순서: 보드 설정(settings.links — 보드 비밀번호로 지켜짐, 모든 기기 공유) → 같은 주소(nyanya-lab.github.io)의 그 앱이 이 브라우저에 기억한 값.
// 계산 규칙은 각 앱과 같게 맞춤 — 앱 쪽 규칙이 바뀌면 여기도 같이 고치기 (스페인어 core.js calcStreak·dayActivity, 왓치로그 CLAUDE.md 데이터 모델).

const FB = "https://www.gstatic.com/firebasejs/10.12.2/";
const VOCAB_URL = "https://nyanya-vocab-default-rtdb.firebaseio.com";
const WATCH_URL = "https://nyanya-watchlog-default-rtdb.asia-southeast1.firebasedatabase.app";
export const APP_KEYS = { vocab: "nyanya_sync_password", watch: "watchlog_sync_password" };   // 각 앱이 이 브라우저에 기억하는 칸
const STREAK_REVIEW_RULE_FROM = "2026-10-09";   // 스페인어: 이날부터 연속은 '복습을 다 한 날'만

const lsGet = (k) => { try { return (localStorage.getItem(k) || "").trim(); } catch (e) { return ""; } };
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const isDate = (s) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s);

// ── 스페인어 계산 (core.js와 같은 규칙) ──
export function dayActivity(d) {
  if (!d) return 0;
  return (d.quizTotal || 0) + (d.aiSessions || 0) + (d.newWordsCount || 0) + (d.reviewCount || 0) + (d.gameCount || 0)
    + (d.newGrammarCount || 0) + (d.practiceCount || 0) + (d.numTotal || 0);
}
function isStreakDay(diary, ds) {
  const d = diary[ds];
  if (!d) return false;
  if (ds < STREAK_REVIEW_RULE_FROM) return dayActivity(d) - ((d.practiceCount || 0) + (d.numTotal || 0)) >= 1;
  return d.reviewDone === true && dayActivity(d) >= 1;
}
export function vocabStreak(diary) {
  const dates = Object.keys(diary || {}).filter((ds) => isStreakDay(diary, ds)).sort();
  if (!dates.length) return 0;
  const toDate = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const t = new Date(); t.setHours(0, 0, 0, 0);
  if (Math.round((t - toDate(dates[dates.length - 1])) / 86400000) > 1) return 0;
  let n = 1;
  for (let i = dates.length - 1; i > 0; i--) {
    if (Math.round((toDate(dates[i]) - toDate(dates[i - 1])) / 86400000) === 1) n++; else break;
  }
  return n;
}
// 오늘 상태: done(복습 다 함) / left(남은 개수, 앱에서 마지막으로 저장한 때 기준) / none(오늘 아직 안 열었음)
export function vocabToday(diary, today) {
  const d = diary && diary[today];
  if (!d) return { kind: "none" };
  if (d.reviewDone === true) return { kind: "done", act: dayActivity(d) };
  if (typeof d.reviewLeft === "number") return { kind: "left", left: d.reviewLeft, by: Array.isArray(d.reviewLeftBy) ? d.reviewLeftBy : null, act: dayActivity(d) };
  return { kind: "open", act: dayActivity(d) };
}

// ── 왓치로그 계산 ──
// 보는 중 = 처음 보기 시작했는데 끝난 날이 없음, 또는 다시 보기 시작했는데 끝난 날이 없음
export const isWatching = (x) => !!x && ((isDate(x.startDate) && !x.endDate) || (isDate(x.lastWatchStart) && !x.lastWatchEnd));
// 다 본 날들 (처음 끝낸 날 + 다시 본 끝낸 날)
export const finishDays = (x) => [x && x.endDate, x && x.lastWatchEnd].filter(isDate).map((s) => s.slice(0, 10));

// ── 연결 ──
export function createLinks({ onChange }) {
  const st = {
    vocab: { state: "off", pw: "", from: "", diary: {}, err: "" },
    watch: { state: "off", pw: "", from: "", items: {}, err: "" }
  };
  let sdk = null;
  const apps = {}, unsubs = { vocab: [], watch: [] };

  async function loadSdk() {
    if (sdk) return sdk;
    const [appMod, rt] = await Promise.all([import(FB + "firebase-app.js"), import(FB + "firebase-database.js")]);
    sdk = { appMod, rt };
    return sdk;
  }
  async function dbOf(kind) {
    const { appMod, rt } = await loadSdk();
    if (!apps[kind]) {
      const name = "link-" + kind;   // 보드 자기 저장소·우리 저장소와 섞이지 않게 이름 붙인 앱
      const app = appMod.getApps().find((a) => a.name === name) || appMod.initializeApp({ databaseURL: kind === "vocab" ? VOCAB_URL : WATCH_URL }, name);
      apps[kind] = rt.getDatabase(app);
    }
    return apps[kind];
  }

  function stop(kind) { unsubs[kind].forEach((u) => u()); unsubs[kind] = []; }

  async function connect(kind, pw, from) {
    const s = st[kind];
    if (s.pw === pw && (s.state === "ok" || s.state === "loading")) return;
    stop(kind);
    s.pw = pw; s.from = from; s.err = "";
    if (kind === "vocab") s.diary = {}; else s.items = {};
    if (!pw) { s.state = "nopw"; onChange(); return; }
    s.state = "loading"; onChange();
    try {
      const db = await dbOf(kind), { rt } = sdk;
      if (s.pw !== pw) return;   // 그사이 비밀번호가 바뀜
      const onErr = () => { s.state = "error"; s.err = "불러오지 못했어요"; onChange(); };
      if (kind === "watch") {
        unsubs.watch.push(rt.onValue(rt.ref(db, `watchlog/${pw}__v3/items`), (snap) => {
          s.items = snap.val() || {};
          s.state = Object.keys(s.items).length ? "ok" : "empty";
          onChange();
        }, onErr));
      } else {
        // 새 자리(__v3)에 일지가 있으면 그걸 실시간으로, 없으면 옛 통째 저장을 한 번 읽음
        const v3 = rt.ref(db, `vocab/${pw}__v3/diary`);
        const first = await rt.get(v3);
        if (s.pw !== pw) return;
        if (first.exists()) {
          unsubs.vocab.push(rt.onValue(v3, (snap) => { s.diary = snap.val() || {}; s.state = "ok"; onChange(); }, onErr));
        } else {
          const old = await rt.get(rt.ref(db, `vocab/${pw}/nyanyaDiary`));
          if (s.pw !== pw) return;
          s.diary = old.val() || {};
          s.state = Object.keys(s.diary).length ? "ok" : "empty";
          onChange();
        }
      }
    } catch (e) {
      if (s.pw !== pw) return;
      s.state = "error"; s.err = "연결하지 못했어요"; onChange();
    }
  }

  // 보드 설정에 적은 비밀번호가 먼저, 없으면 이 브라우저의 그 앱이 기억한 값
  function setPasswords(links) {
    for (const kind of ["vocab", "watch"]) {
      const saved = ((links && links[kind]) || "").trim();
      const local = lsGet(APP_KEYS[kind]);
      connect(kind, saved || local, saved ? "board" : local ? "app" : "");
    }
  }

  return { st, setPasswords, today: () => ymd(new Date()) };
}
