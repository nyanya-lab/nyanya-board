# 냐냐 보드 서버 데이터 읽기·고치기 (Claude용, 이 컴퓨터에서만)
# 비밀번호는 저장소 맨 위 dev-local.json {"boardPw": "..."} 에서 꺼냄 (.gitignore로 막아 둠, 절대 올리지 않기)
# 공통(우리) 저장소 비밀번호는 보드 settings.uriPw 에서 꺼냄.
#   python tools/db.py get board money            → 냐냐 보드 nyanya/{해시}/money
#   python tools/db.py get uri settings/cats      → 공통 저장소 uri/{해시}/settings/cats
#   python tools/db.py patch board money body.json  (put도 같음)
# 출력은 JSON (해시·비밀번호는 안 찍음)
import hashlib, json, os, sys, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BOARD = "https://nyanya-board-default-rtdb.asia-southeast1.firebasedatabase.app/nyanya/"
URI = "https://uri-board-default-rtdb.asia-southeast1.firebasedatabase.app/uri/"

def sha(s): return hashlib.sha256(s.encode("utf-8")).hexdigest()

def req(url, method="GET", body=None):
    data = None if body is None else json.dumps(body, ensure_ascii=False).encode("utf-8")
    r = urllib.request.Request(url, data=data, method=method, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(r) as res: return json.loads(res.read().decode("utf-8"))

def base(store):
    pw = json.load(open(os.path.join(ROOT, "dev-local.json"), encoding="utf-8"))["boardPw"]
    b = BOARD + sha("nyanya-board:" + pw)
    if store == "board": return b
    upw = req(b + "/settings/uriPw.json")
    if not upw: sys.exit("공통 비밀번호가 보드 settings.uriPw에 없어요")
    return URI + sha("uri-board:" + upw)

def url(store, path): return base(store) + "/" + path.strip("/") + ".json"

if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    cmd, store, path = sys.argv[1], sys.argv[2], sys.argv[3]
    if cmd == "get": out = req(url(store, path))
    else: out = req(url(store, path), cmd.upper(), json.load(open(sys.argv[4], encoding="utf-8")))
    print(json.dumps(out, ensure_ascii=False))
