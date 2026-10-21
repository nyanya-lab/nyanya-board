// 🔄 새 버전 알림 (욱진 보드와 같은 방식): 지금 페이지(index.html)를 캐시 없이 받아 app.js?v= 값이 지금 돌고 있는 것과 다르면 맨 위 띠
// 화면으로 돌아올 때마다 + 켜 둔 동안 10분마다 (GitHub Pages는 올린 뒤 몇 분~10분쯤 늦게 바뀜). [나중에]는 그 버전만 숨김
// 쓰는 법: startVerCheck(new URL(import.meta.url).searchParams.get("v"))  — 보드 app.js · 가계부 money/app.js 둘 다
export function startVerCheck(runVer) {
  if (!runVer || location.protocol === "file:") return;
  let busy = false, last = 0, shown = null;
  const skipKey = "nyanya-verskip";
  function bar(v) {
    if (shown === v) return; shown = v;
    let el = document.getElementById("verBar");
    if (!el) {
      el = document.createElement("div"); el.id = "verBar"; el.setAttribute("role", "status");
      el.style.cssText = "position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:200;display:flex;gap:10px;align-items:center;padding:10px 14px;border-radius:12px;background:var(--surface,#fff);border:1px solid var(--line,#ddd);box-shadow:0 8px 30px rgba(10,16,28,.18);font-size:14px;max-width:calc(100vw - 24px)";
      document.body.appendChild(el);
    }
    el.innerHTML = `<span>🔄 <b>새 버전이 나왔어요.</b> 새로고침하면 바뀐 걸 써요.</span><button type="button" data-v="go" style="font:inherit;border:0;border-radius:8px;padding:6px 12px;background:var(--coral,#f0604d);color:#fff;font-weight:600;cursor:pointer">새로고침</button><button type="button" data-v="later" style="font:inherit;border:0;background:none;color:var(--muted,#888);cursor:pointer">나중에</button>`;
    el.onclick = (e) => {
      const b = e.target.closest("button"); if (!b) return;
      if (b.dataset.v === "go") location.reload();
      else { try { localStorage.setItem(skipKey, v); } catch (err) { /* 무시 */ } el.remove(); }
    };
  }
  async function check() {
    if (busy || Date.now() - last < 60000) return;
    busy = true; last = Date.now();
    try {
      const html = await (await fetch(location.pathname, { cache: "no-store" })).text();
      const m = html.match(/app\.js\?v=([\w.-]+)/);
      let skip = null; try { skip = localStorage.getItem(skipKey); } catch (err) { /* 무시 */ }
      if (m && m[1] !== runVer && m[1] !== skip) bar(m[1]);
    } catch (e) { /* 오프라인이면 다음에 */ }
    busy = false;
  }
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") check(); });
  setInterval(check, 10 * 60 * 1000);
  setTimeout(check, 5000);
}
