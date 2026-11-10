# /// script
# requires-python = ">=3.11"
# dependencies = ["pillow>=10"]
# ///
"""SNS でシェアしたときの横長カード画像 (images/og-image.jpg, 1200x630) を作る。

使い方 (macOS。日本語の表示にヒラギノ角ゴシックを使う):
  uv run scripts/build_og_image.py
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
BACKGROUND = ROOT / "images/travel/bolivia-1.webp"  # ウユニ塩湖の鏡張り
ICON = ROOT / "images/icon-circle.jpg"
OUT = ROOT / "images/og-image.jpg"
FONT = "/System/Library/Fonts/ヒラギノ角ゴシック W6.ttc"
FONT_LIGHT = "/System/Library/Fonts/ヒラギノ角ゴシック W3.ttc"
W, H = 1200, 630
BG = (11, 15, 23)
TEXT = (230, 235, 245)
SUB = (154, 166, 191)
ACCENT = (56, 225, 196)


def cover(image, width, height):
    scale = max(width / image.width, height / image.height)
    image = image.resize((round(image.width * scale), round(image.height * scale)), Image.LANCZOS)
    left = (image.width - width) // 2
    top = (image.height - height) // 2
    return image.crop((left, top, left + width, top + height))


def main():
    card = cover(Image.open(BACKGROUND).convert("RGB"), W, H)
    # 左側を背景色で覆い、文字を読みやすくする(右へ行くほど写真が見える)
    shade = Image.new("L", (W, 1))
    for x in range(W):
        shade.putpixel((x, 0), round(235 - 150 * min(1, x / (W * 0.9))))
    card = Image.composite(Image.new("RGB", (W, H), BG), card, shade.resize((W, H)))

    size = 240
    icon = Image.open(ICON).convert("RGB").resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size * 4, size * 4))
    ImageDraw.Draw(mask).ellipse((0, 0, size * 4, size * 4), fill=255)
    mask = mask.resize((size, size), Image.LANCZOS)
    x, y = 96, (H - size) // 2
    ring = Image.new("L", (W, H))
    ImageDraw.Draw(ring).ellipse((x - 6, y - 6, x + size + 6, y + size + 6), fill=255)
    card.paste(Image.new("RGB", (W, H), ACCENT), (0, 0), ring.filter(ImageFilter.GaussianBlur(1)))
    card.paste(icon, (x, y), mask)

    draw = ImageDraw.Draw(card)
    tx = x + size + 64
    draw.text((tx, 170), "Data Engineer", font=ImageFont.truetype(FONT, 30), fill=ACCENT)
    draw.text((tx, 215), "電電", font=ImageFont.truetype(FONT, 120), fill=TEXT)
    draw.text((tx, 370), "Kaggle Competitions Master", font=ImageFont.truetype(FONT_LIGHT, 32), fill=TEXT)
    draw.text((tx, 420), "seven320.github.io", font=ImageFont.truetype(FONT_LIGHT, 28), fill=SUB)

    card.save(OUT, quality=85, optimize=True, progressive=True)
    print(f"wrote {OUT} ({OUT.stat().st_size // 1024}KB)")


if __name__ == "__main__":
    main()
