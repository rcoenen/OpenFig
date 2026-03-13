# Fonts

## How resvg-wasm Matches Fonts

resvg-wasm is the SVG-to-PNG renderer. It does **not** load system fonts — all
fonts must be provided as buffers at render time via the `fontBuffers` option.

resvg matches SVG `font-family` attributes against the font's **internal name
table** (OpenType nameID 1 = family name). This means:

- The CSS/file name doesn't matter — only the name inside the binary font file
- If nameID 1 says `"Inter Medium"` but your SVG says `font-family="Inter"`,
  resvg **will not match** that font
- Fonts must have the exact family name that the SVG will reference

This is why some fonts need patching (see Darker Grotesque below).

## Built-in Fonts

The rasterizer ships with these fonts, loaded automatically:

| Font | Weights | Source | Notes |
|------|---------|--------|-------|
| Inter | 400, 500, 600, 700 normal + 400, 700 italic | `fonts/inter-v3-*.woff2` | Figma's bundled version (v3.015) |
| Darker Grotesque | 400, 500, 600, 700 | `fonts/darker-grotesque-patched-*.woff2` | Patched nameID 1 |
| Irish Grover | 400 | `@fontsource/irish-grover` | nameID 1 already matches |

## Inter v3 vs v4 — Why It Matters

Figma bundles **Inter v3.015** as a variable font (`Inter.var.woff2`, axes: `wght`
100-900, `slnt` -10 to 0). This is the version used for all "Inter" text in Figma.

`@fontsource/inter` ships **v4.x**, which has redesigned italic glyphs — most
noticeably the lowercase "a" changes from a two-story form to a single-story form.
This is visually obvious in side-by-side comparison and measurably drops SSIM.

### Version detection

The rasterizer checks for Inter v3 static fonts in `lib/rasterizer/fonts/`:

```
inter-v3-400-normal.woff2
inter-v3-500-normal.woff2
inter-v3-600-normal.woff2
inter-v3-700-normal.woff2
inter-v3-400-italic.woff2
inter-v3-700-italic.woff2
inter-v3-meta.json          ← {"version": "Version 3.015;git-7f5c04026"}
```

If all 6 files are present, they're used. The meta file's `version` field is
compared against `KNOWN_FIGMA_INTER_VERSION` — a mismatch emits a stderr warning
but is not a hard error (different Figma versions may bundle slightly different
Inter builds).

If v3 fonts are missing, the rasterizer falls back to `@fontsource/inter` (v4.x)
with a warning to stderr. Rendering still works, but italic glyphs will differ.

### How the v3 fonts were generated

1. **400 Regular, 700 Bold, 400 Italic, 700 Bold Italic** — from the
   [Inter 3.15 release](https://github.com/rsms/inter/releases/tag/v3.15)
   static WOFF2 files. These have nameID 1 = `"Inter"` and work directly.

2. **500 Medium, 600 SemiBold** — The release ZIP has these as `"Inter Medium"`
   and `"Inter Semi Bold"` (nameID 1), which resvg can't match as `font-family="Inter"`.
   These were generated using fontTools `varLib.instancer` from `Inter.var.woff2`:

   ```bash
   pip install fonttools brotli
   fonttools varLib.instancer Inter.var.woff2 wght=500 slnt=0  # → Medium
   fonttools varLib.instancer Inter.var.woff2 wght=600 slnt=0  # → SemiBold
   ```

   After instancing, nameIDs 1/2/4/6 were patched to `"Inter"` and OS/2
   `usWeightClass` set to the correct value (500, 600).

### Version string: nameID 5

The authoritative version signal is OpenType **nameID 5** (version string).
For Figma's bundled Inter: `"Version 3.015;git-7f5c04026"`. This is stored in
`inter-v3-meta.json` and checked at load time.

We use version strings rather than hash-based detection because building a
database of known font hashes doesn't scale — there are too many valid font
builds for any given family.

## Darker Grotesque — Google Fonts Source + Name Patching

**Important**: `@fontsource/darker-grotesque` WOFF2 files have visibly thinner
glyph outlines than the Google Fonts TTF originals, despite the same version
string (`Version 1.000;gftools[0.9.28]`). Figma downloads from Google Fonts,
so we must use those TTFs as the source.

The patched WOFF2 files in `fonts/darker-grotesque-patched-*.woff2` are:

1. **Downloaded from Google Fonts API** as TTF (the authoritative source)
2. **nameID 1 patched** from weight-specific names (e.g. `"Darker Grotesque Medium"`)
   to just `"Darker Grotesque"` so resvg can match `font-family="Darker Grotesque"`
3. **Converted to WOFF2** via fontTools

The `usWeightClass` in the OS/2 table is preserved from the original (400, 500,
600, 700), so resvg selects the correct weight file.

### Why not @fontsource?

@fontsource repackages Google Fonts but may re-encode or subset the font files.
The resulting WOFF2 files can have different glyph outlines from the originals.
For Darker Grotesque, this manifests as noticeably thinner strokes — weight 500
from @fontsource looks like 400 from Google Fonts. Using the Google Fonts TTFs
directly fixed SSIM for slide 7 from 0.72 to 0.99.

## Registering Custom Fonts

For decks that use fonts not bundled with the rasterizer:

```javascript
import { registerFont, registerFontDir } from './deck-rasterizer.mjs';

// Single file
registerFont('/path/to/CustomFont.woff2');
registerFont(fontBuffer);  // Buffer or Uint8Array

// Entire directory (recursive, .ttf/.otf/.woff/.woff2)
registerFontDir('/path/to/fonts/');
```

Fonts can be registered at any time — they take effect on the next render call.

### Using @fontsource packages

```bash
# Install the font package
node lib/rasterizer/download-font.mjs "Family Name" 400 500 600 700

# This prints the registerFont() calls to add to deck-rasterizer.mjs
```

### When fonts don't match

If resvg can't find a font for a `font-family` value, it falls back to the
`defaultFontFamily` (Inter). Text will render in the wrong font but won't crash.
Check the font's internal nameID 1 if matching fails:

```bash
# Inspect a font's name table
python3 -c "
from fontTools.ttLib import TTFont
font = TTFont('font.woff2')
for r in font['name'].names:
    if r.nameID in (1,2,4,5,6):
        print(f'nameID {r.nameID}: {r.toUnicode()}')
"
```
