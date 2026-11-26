# Arbiter: Logo Guidelines

## 1. The logo
- **Idea:** a circle split in two. Four stripes on the left are the requests. The solid half on the right is the gate, and its one dot is the grant: many sessions ask, one heavy command runs.
- **Versions:** horizontal (primary) · stacked · symbol only · wordmark only.
- **Files:** `final/*.svg` are the masters, and `final/*.png` are ready-made rasters. `final/web/` holds the favicon, app and PWA icons. Paste `final/web/head-snippet.html` into the page `<head>`.
- **Rebuild:** `python3 logo/build.py` regenerates the masters from code. It needs `fonttools` and Manrope Bold.

## 2. Clear space
Leave a clear zone around the logo **twice the dot's diameter** wide on every side. That is about one third of the symbol's height. The zone scales with the logo.

## 3. Minimum size
| Version | Screen | Print |
|---|---|---|
| Horizontal | 96 px wide | 25 mm wide |
| Stacked | 48 px wide | 15 mm wide |
| Symbol | 16 px | 5 mm |

At **24 px and below**, use `arbiter-symbol-small.svg` (3 stripes, wider gaps, bigger dot). The web icons already use it.

## 4. Colour
| Name | HEX | RGB | CMYK | Pantone (nearest, check a swatch book) |
|---|---|---|---|---|
| Ink | #14161A | 20 22 26 | 0 0 0 100 | Black 6 C |
| Grant Green | #0FA36B | 15 163 107 | 91 0 34 36 | 340 C |
| White | #FFFFFF | 255 255 255 | 0 0 0 0 | — |

**Approved pairs:** ink on white (default) · white on Grant Green (app icon, avatars) · white on ink (dark mode, terminal) · Grant Green on white (one-colour accent).
White on Grant Green has a contrast ratio of about 3.2:1. That is fine for the logo and large display text, but too low for body text.

## 5. Typography
- Wordmark: **Manrope Bold**, converted to outlines. Never retype the wordmark.
- Supporting type: Manrope for headings and the system UI stack for body text. Code samples use a monospace font such as Fira Code.
- Licence: Manrope and Fira Code are under the SIL Open Font License, which allows logo use.

## 6. Don'ts
- Don't change the number of stripes in the full-size logo, or move the dot.
- Don't add a second colour inside the symbol.
- Don't stretch, rotate or outline the logo, and don't add shadows or gradients.
- Don't change the spacing or size ratio between the symbol and the wordmark.
- Don't place the logo on a busy image without a solid tile behind it.

## 7. Open items
- Run a trademark search (databases plus a reverse image search) before public use.
- For large white-on-dark uses (signage, merch), draw the reversed version slightly thinner. White shapes look heavier on dark backgrounds.
