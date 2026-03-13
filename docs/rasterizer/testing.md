# Testing

## SSIM Quality Testing

Render quality is measured using **SSIM** (Structural Similarity Index), a
perceptual similarity metric. Scores range 0-1 where 1 = identical.

### How it works

1. Render a slide to PNG at 1920x1080
2. Load the reference PNG (exported from Figma at 2x, 4000x2250)
3. Downscale reference to 1920x1080 via sharp
4. Compute SSIM between rendered and reference (both as raw RGBA buffers)
5. Assert score meets the per-slide threshold

### Reference Decks

| Deck | Slides | Purpose |
|------|--------|---------|
| `decks/reference/oil-machinations.deck` | 7 | Complex real-world deck: mixed fonts, shapes, images, SHAPE_WITH_TEXT |
| `decks/reference/just-fonts.deck` | 1 | Font rendering: Inter Bold, Regular, Italic, Bold Italic, Underline + Irish Grover |

Reference PNGs live alongside the deck in a same-named directory:

```
decks/reference/oil-machinations/
  page-1.png   ← Figma export, 4000x2250 (2x)
  page-2.png
  ...
decks/reference/just-fonts/
  page-1.png
```

### SSIM Thresholds

Thresholds are set just below current scores as **regression guards**. They're
raised as rendering improves — never lowered.

```
oil-machinations:
  slide 1: 0.98  ← was 0.84 before Google Fonts Darker Grotesque fix
  slide 2: 0.83  ← lowest; unresolved elements
  slide 3: 0.96
  slide 4: 0.95
  slide 5: 0.96
  slide 6: 0.88  ← card text overflows; label pill colors wrong
  slide 7: 0.98  ← was 0.72 before Google Fonts Darker Grotesque fix

just-fonts:
  slide 1: 0.99  ← near-perfect with Inter v3 + derivedTextData.decorations
```

### Running Tests

```bash
npm test                    # all tests
npx vitest run render.test  # just the SSIM tests
```

Rendered PNGs are saved to `/tmp/figmatk-test-slide-N.png` for manual inspection.

## HTML Comparison Reports

For visual side-by-side comparison:

```bash
# Oil machinations (default)
node lib/rasterizer/render-report.mjs

# Just fonts
node lib/rasterizer/render-report.mjs \
  decks/reference/just-fonts.deck \
  decks/reference/just-fonts \
  /tmp/figmatk-render-report-just-fonts.html

# Custom deck
node lib/rasterizer/render-report.mjs path/to.deck path/to/refs/ /tmp/report.html
```

Reports show reference and rendered images side-by-side with SSIM score per slide.
Open in browser: `file:///tmp/figmatk-render-report.html`

## Adding a New Reference Deck

1. Create or obtain the deck in Figma
2. Export each page as PNG at 2x (4000x2250) from Figma
3. Save the `.deck` file to `decks/reference/`
4. Save the PNGs to `decks/reference/<deck-name>/page-N.png`
5. Add a test case in `render.test.mjs` with conservative initial thresholds
6. Run tests, note actual SSIM scores, adjust thresholds upward

## Known Limitations Affecting SSIM

- **VECTOR nodes** — rendered as placeholders (magenta dashed rect)
- **INSTANCE nodes** — symbol resolution not yet implemented
- **Color variables** — unresolved; SHAPE_WITH_TEXT nodes on variable-colored
  backgrounds show wrong fill
- **Text overflow** — text that overflows its bounding box in Figma is clipped;
  the rasterizer doesn't clip text to its box
- **STAR, POLYGON** — rendered as placeholders
