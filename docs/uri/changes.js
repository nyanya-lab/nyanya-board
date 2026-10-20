// 🤝 우리 탭 업데이트 내역 — 욱진 보드가 열릴 때 이 파일을 읽어서 자기 '업데이트 내역'·새 버전 알림에 날짜별로 섞어요.
// uri.js를 고쳐서 욱진이가 보는 게 바뀌면 맨 위(오늘 날짜 묶음)에 한 줄 추가하기. 욱진이가 읽는 글이라 쉬운 말로, "🤝 우리:"로 시작.
// date가 같으면 같은 날 묶음 (욱진 보드 changes.js와 같은 모양). 욱진 보드는 10분 단위로 새로 받아요.
// ⏸ 공개 전이라 비워 둠 (uri.js HOLD_UKJIN). 공개할 때 소개 줄을 그날 날짜로 다시 넣기.
export const URI_CHANGES = [];

// ⏸ 공개 전엔 욱진 보드에서 '우리' 메뉴·설명서 주제를 숨김 (냐냐 요청 2026-10-20).
//   욱진 보드가 열릴 때 이 파일을 불러오니까 여기서 숨기면 욱진 보드를 안 고쳐도 됨. 공개할 때 이 줄들을 지우기 (uri.js HOLD_UKJIN과 같이).
export const URI_HOLD = true;
if (URI_HOLD && typeof document !== "undefined" && location.hostname === "nyanya-lab.github.io" && location.pathname.startsWith("/-/")) {
  const hide = () => document.querySelectorAll('.nav a[href="#uri"], #helpTopics [data-k="uri"]').forEach((el) => { el.hidden = true; el.style.display = "none"; });
  hide();
  if (location.hash === "#uri") location.hash = "#calendar";
}
