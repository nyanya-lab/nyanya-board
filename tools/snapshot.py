# 🔒 로컬 확인 모드용 사본 받기 (Claude용, 이 컴퓨터에서만)
#   python tools/snapshot.py  → docs/money/_local/snapshot.json (.gitignore로 막아 둠, 절대 올리지 않기)
#   그다음 http://localhost:8010/money/?local 을 열면 로그인 없이 진짜 숫자로 가계부 화면을 볼 수 있음 (보기 전용)
# 비밀번호 같은 값(settings.uriPw · links)은 사본에 넣지 않음. 사진(pics)도 안 받음.
import datetime, json, os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from db import req, url

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "docs", "money", "_local", "snapshot.json")

def get(store, path): return req(url(store, path)) or {}

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    settings = get("board", "settings")
    for k in ("uriPw", "links"): settings.pop(k, None)
    snap = {
        "at": datetime.datetime.now().strftime("%Y-%m-%d %H:%M"),
        "money": get("board", "money"), "accounts": get("board", "accounts"), "tasks": get("board", "tasks"), "settings": settings,
        "uri": {"costs": get("uri", "costs"), "cats": get("uri", "settings/cats") or None, "settles": get("uri", "settles"), "joint": get("uri", "joint")},
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(snap, open(OUT, "w", encoding="utf-8"), ensure_ascii=False)
    print(f"사본 저장: 기록 {len(snap['money'])} · 자산 {len(snap['accounts'])} · 공통비용 {len(snap['uri']['costs'])} ({snap['at']})")
