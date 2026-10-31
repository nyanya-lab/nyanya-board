# 💰 가계부 아이콘 만들기: 보드 얼굴(docs/icon-512.png)의 분홍 배경을 금색으로 + 오른쪽 아래 ₩ 동전 → docs/money/coin-*.png (보드 아이콘과 구분되게)
#   python tools/make_coin_icon.py
import os
from PIL import Image, ImageChops, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
S = 1024   # 크게 그리고 줄임
RIM, GOLD = (150, 98, 10), (246, 190, 45)
PINK, KEY = (254, 202, 190), (255, 0, 255)

base = Image.open(os.path.join(ROOT, "docs", "icon-512.png")).convert("RGBA").resize((S, S), Image.LANCZOS)

# 분홍 배경만 금색으로: 가장자리에서 이어진 분홍 칸만 칠함 (얼굴·옷은 그대로)
im = base.convert("RGB")
for x, y in ((S // 2, 8), (40, S // 2 - 200), (S - 40, S // 2 - 200), (170, 170), (S - 170, 170), (60, S // 2)):
    if sum(abs(a - b) for a, b in zip(im.getpixel((x, y)), PINK)) < 40:
        ImageDraw.floodfill(im, (x, y), KEY, thresh=38)
icon = im.convert("RGBA")
px = icon.load()
# 머리카락 사이에 갇힌 분홍도: 얼굴·손·옷이 없는 곳에서만 (아래 좌표는 512 기준)
def outer(x, y):
    x, y = x / 2, y / 2
    return y < 100 or (x < 112 and y < 385) or x > 425 or (x > 392 and y < 180) or (x < 170 and y < 280)
for y in range(S):
    for x in range(S):
        c = px[x, y][:3]
        if c != KEY and outer(x, y) and sum(abs(a - b) for a, b in zip(c, PINK)) < 70:
            px[x, y] = KEY + (255,)
for y in range(S):
    for x in range(S):
        if px[x, y][:3] == KEY:
            t = (x + y) / (2 * S)
            px[x, y] = (round(255 - 20 * t), round(214 - 44 * t), round(92 - 50 * t), 255)

# 동그랗게 자르기
m = Image.new("L", (S * 2, S * 2), 0)
ImageDraw.Draw(m).ellipse((0, 0, S * 2 - 1, S * 2 - 1), fill=255)
icon.putalpha(m.resize((S, S), Image.LANCZOS))

# 오른쪽 아래 ₩ 동전
r = 150
bx, by = S - r - 26, S - r - 26
d = ImageDraw.Draw(icon)
d.ellipse((bx - r - 12, by - r - 12, bx + r + 12, by + r + 12), fill=(255, 255, 255, 255))
d.ellipse((bx - r, by - r, bx + r, by + r), fill=RIM)
d.ellipse((bx - r + 14, by - r + 14, bx + r - 14, by + r - 14), fill=GOLD)
d.text((bx, by - 6), "₩", font=ImageFont.truetype("C:/Windows/Fonts/malgunbd.ttf", 190), fill=(120, 76, 6), anchor="mm")

out = os.path.join(ROOT, "docs", "money")
for name, size in (("coin-96.png", 96), ("coin-192.png", 192), ("coin-512.png", 512)):
    icon.resize((size, size), Image.LANCZOS).save(os.path.join(out, name))
# 아이폰 홈 화면용: 투명하면 검게 나와서 흰 바탕
bg = Image.new("RGBA", (S, S), (255, 255, 255, 255))
bg.alpha_composite(icon)
bg.convert("RGB").resize((180, 180), Image.LANCZOS).save(os.path.join(out, "coin-touch.png"))
print("ok")
