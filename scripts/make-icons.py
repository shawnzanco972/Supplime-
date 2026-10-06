"""Render Supplime's launcher icons, splash screens and notification icon.

Run from the repo root after `npx cap add android`:  python3 scripts/make-icons.py
Needs Pillow. The artwork is the bottle from public/favicon.svg.
"""

from pathlib import Path

from PIL import Image, ImageDraw

RES = Path("android/app/src/main/res")
GREEN = (61, 90, 76, 255)
CREAM = (244, 241, 234, 255)
SS = 4  # supersampling factor


def bottle(draw: ImageDraw.ImageDraw, ox: float, oy: float, unit: float, fg, hole):
    """Draw the 16-unit favicon bottle with its top-left at (ox, oy)."""

    def p(x, y):
        return (ox + x * unit, oy + y * unit)

    def rect(x, y, w, h, r=0.0):
        draw.rounded_rectangle([p(x, y), p(x + w, y + h)], radius=r * unit, fill=fg)

    rect(5, 2, 6, 2, 1)  # cap
    rect(6, 3.5, 4, 2.6)  # neck
    # body: trapezoid with rounded bottom corners
    draw.polygon([p(4, 6), p(12, 6), p(11, 13.2), p(5, 13.2)], fill=fg)
    draw.rounded_rectangle([p(5, 11), p(11, 15)], radius=2 * unit, fill=fg)
    cx, cy = p(8, 11)
    r = 1.25 * unit
    draw.ellipse([cx - r, cy - r, cx + r, cy + r], fill=hole)


def render(size: int, bg, fg, hole, art_frac: float, shape: str = "square", corner: float = 0.0):
    big = size * SS
    img = Image.new("RGBA", (big, big), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if shape == "circle":
        d.ellipse([0, 0, big - 1, big - 1], fill=bg)
    elif bg is not None:
        d.rounded_rectangle([0, 0, big - 1, big - 1], radius=corner * big, fill=bg)
    art = big * art_frac
    unit = art / 16
    # The bottle spans y 2..15 and x 4..12, so centre on (8, 8.5).
    bottle(d, big / 2 - 8 * unit, big / 2 - 8.5 * unit, unit, fg, hole)
    return img.resize((size, size), Image.LANCZOS)


DENSITY = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}

for name, k in DENSITY.items():
    folder = RES / f"mipmap-{name}"
    render(round(48 * k), GREEN, CREAM, GREEN, 0.78, corner=0.22).save(folder / "ic_launcher.png")
    render(round(48 * k), GREEN, CREAM, GREEN, 0.7, shape="circle").save(folder / "ic_launcher_round.png")
    # Adaptive foreground: 108dp canvas, art kept inside the 66dp safe zone.
    render(round(108 * k), None, CREAM, GREEN, 0.5).save(folder / "ic_launcher_foreground.png")

(RES / "values/ic_launcher_background.xml").write_text(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n'
    '    <color name="ic_launcher_background">#3D5A4C</color>\n</resources>\n'
)

# Splash: cream background with the green app tile in the middle.
for path in RES.glob("drawable*/splash.png"):
    w, h = Image.open(path).size
    canvas = Image.new("RGBA", (w, h), CREAM)
    tile = render(round(min(w, h) * 0.28), GREEN, CREAM, GREEN, 0.78, corner=0.22)
    canvas.alpha_composite(tile, ((w - tile.width) // 2, (h - tile.height) // 2))
    canvas.convert("RGB").save(path)

# Status-bar icon: Android wants a white silhouette on transparent.
(RES / "drawable").mkdir(exist_ok=True)
(RES / "drawable/ic_stat_supplime.xml").write_text(
    """<?xml version="1.0" encoding="utf-8"?>
<vector xmlns:android="http://schemas.android.com/apk/res/android"
    android:width="24dp" android:height="24dp"
    android:viewportWidth="16" android:viewportHeight="16">
    <path android:fillColor="#FFFFFFFF"
        android:pathData="M6,2h4a1,1 0,0 1,1 1v0a1,1 0,0 1,-1 1h-4a1,1 0,0 1,-1 -1v0a1,1 0,0 1,1 -1z" />
    <path android:fillColor="#FFFFFFFF" android:pathData="M6,4h4v2h-4z" />
    <path android:fillColor="#FFFFFFFF" android:fillType="evenOdd"
        android:pathData="M4,6h8l-1,7.2A2,2 0,0 1,9 15H7a2,2 0,0 1,-2 -1.8L4,6zM8,9.75a1.25,1.25 0,1 0,0 2.5a1.25,1.25 0,1 0,0 -2.5z" />
</vector>
"""
)
print("icons written")
