"""Build the Arbiter logo masters into logo/final/. Run: python3 logo/build.py

Symbol: a circle split down the middle. Left half: four stripes (requests). Right half: the gate, with one dot (the grant).
Wordmark: "arbiter" in Manrope Bold (SIL OFL), converted to outlines here so no font is needed downstream.
"""
import math, os
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "final")
FONT = os.path.expanduser("~/Library/Fonts/Manrope-Bold.ttf")
INK = "#14161A"


def symbol_paths(n=4, gap=12, band_gap=22, dot_r=20, R=104, C=128):
    """Path data for the split circle on a 256 canvas."""
    xr, xs = C - gap / 2, C + gap / 2
    edge = math.sqrt(R * R - (gap / 2) ** 2)
    xl = lambda y: C - math.sqrt(max(R * R - (y - C) ** 2, 0))
    h = (2 * R - (n - 1) * band_gap) / n
    bands = []
    for i in range(n):
        y1 = max(C - R + i * (h + band_gap), C - edge + .01)
        y2 = min(y1 + h if i else C - R + h, C + edge - .01)
        bands.append(f"M{xr} {y1:.2f} H{xl(y1):.2f} A{R} {R} 0 0 0 {xl(y2):.2f} {y2:.2f} H{xr} Z")
    dx = C + 52
    gate = (f"M{xs} {C - edge:.2f} A{R} {R} 0 0 1 {xs} {C + edge:.2f} Z "
            f"M{dx + dot_r} {C} A{dot_r} {dot_r} 0 1 0 {dx - dot_r} {C} A{dot_r} {dot_r} 0 1 0 {dx + dot_r} {C} Z")
    return " ".join(bands), gate


def symbol_group(fill=INK, **kw):
    bands, gate = symbol_paths(**kw)
    return f'<path fill="{fill}" d="{bands}"/><path fill="{fill}" fill-rule="evenodd" d="{gate}"/>'


def wordmark(text="arbiter", tracking=20):
    """Outlined text; returns (path data in font units flipped to y-down with baseline at 0, width, x-height, ascender)."""
    f = TTFont(FONT)
    gs, cmap, hmtx = f.getGlyphSet(), f.getBestCmap(), f["hmtx"]
    x, parts = 0, []
    for ch in text:
        g = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        gs[g].draw(TransformPen(pen, (1, 0, 0, -1, x, 0)))
        parts.append(pen.getCommands())
        x += hmtx[g][0] + tracking
    x -= tracking
    os2 = f["OS/2"]
    return " ".join(parts), x, os2.sxHeight, os2.sCapHeight


def svg(w, h, body, title="Arbiter"):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" role="img">'
            f'<title>{title}</title>{body}</svg>\n')


def build():
    os.makedirs(OUT, exist_ok=True)
    write = lambda name, s: open(os.path.join(OUT, name), "w").write(s)

    write("arbiter-symbol.svg", svg(256, 256, symbol_group()))
    # Small-size cut (<= 24 px): three bolder stripes, wider gaps, bigger dot.
    write("arbiter-symbol-small.svg", svg(256, 256, symbol_group(n=3, gap=18, band_gap=28, dot_r=24)))

    d, ww, xh, cap = wordmark()
    # Wordmark: x-height drawn at 0.38 x symbol height in the lockup.
    s = 0.38 * 256 / xh
    asc = cap * s  # b and t rise roughly to cap height
    pad = 8
    write("arbiter-wordmark.svg", svg(ww * s + 2 * pad, asc + 2 * pad,
          f'<path fill="{INK}" transform="translate({pad} {asc + pad:.1f}) scale({s:.4f})" d="{d}"/>'))

    # Horizontal: x-height centred on the circle's centre line; gap = 0.3 x symbol.
    gap = 0.3 * 256
    base = 128 + xh * s / 2
    W = 256 + gap + ww * s
    write("arbiter-horizontal.svg", svg(W, 256, symbol_group() +
          f'<path fill="{INK}" transform="translate({256 + gap:.1f} {base:.1f}) scale({s:.4f})" d="{d}"/>'))

    # Stacked: wordmark 1.4 x symbol width, centred under the symbol.
    s2 = 1.4 * 256 / ww
    W2 = max(256, ww * s2)
    top = 256 + 0.2 * 256
    H2 = top + cap * s2 + 8
    write("arbiter-stacked.svg", svg(W2, H2,
          f'<g transform="translate({(W2 - 256) / 2:.1f} 0)">{symbol_group()}</g>'
          f'<path fill="{INK}" transform="translate({(W2 - ww * s2) / 2:.1f} {top + cap * s2:.1f}) scale({s2:.4f})" d="{d}"/>'))


if __name__ == "__main__":
    build()
    print("wrote", sorted(os.listdir(OUT)))
