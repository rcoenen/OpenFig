# Text Nodes & Typography

## TEXT Node ✅

A freestanding text node on the slide. Typically placed inside a FRAME for auto-layout.

```javascript
{
  guid: { sessionID: 0, localID: 46 },
  type: 'TEXT',
  phase: 'CREATED',
  name: 'H1',
  parentIndex: { guid: frameGuid, position: '!' },
  visible: true,
  opacity: 1,
  size: { x: 1200, y: 115 },
  transform: { m00: 1, m01: 0, m02: 0, m10: 0, m11: 1, m12: 0 },
  textData: { characters: 'Slide Deck Title' },
  fontName: { family: 'Inter', style: 'Bold', postscript: '' },
  fontSize: 96,
  lineHeight: { value: 1.2, units: 'RAW' },
  letterSpacing: { value: -2, units: 'PERCENT' },
  textAutoResize: 'HEIGHT',           // width fixed, height hugs content
  textAlignHorizontal: 'LEFT',        // 'LEFT' | 'CENTER' | 'RIGHT'
  textAlignVertical: 'TOP',           // 'TOP' | 'CENTER' | 'BOTTOM'
  styleIdForText: { guid: { sessionID: 0, localID: 50 } },  // references named text style
  fillPaints: [{
    type: 'SOLID',
    color: { r: 0, g: 0, b: 0, a: 1 },
    opacity: 1,
    visible: true,
    blendMode: 'NORMAL',
    colorVar: { ... }  // optional — references a color variable
  }],
  strokeWeight: 0,
  strokeAlign: 'OUTSIDE',
  strokeJoin: 'MITER',
  // derivedTextData: { ... }  // cached glyph layout — Figma recomputes, safe to omit
}
```

**Key facts:**
- `textData.characters` holds the text content
- `textAutoResize: 'HEIGHT'` = width fixed, height hugs content (most common)
- `styleIdForText` references one of the 8 named text styles (see below)
- `derivedTextData` is cached glyph layout — safe to omit on creation
- Text nodes are typically children of a FRAME, not direct children of the SLIDE

---

## Text Styles (Light Slides theme)

Every deck includes 8 named text styles from the "Light slides" theme. Each style
exists as two TEXT nodes in the library canvas:

- A **preview node** (characters `"Rag 123"`, `isPublishable: false`, `locked: true`, `visible: false`)
- A **token node** (characters `"Ag"`, `isPublishable: true`, has `sortPosition`)

These styles are referenced by `styleIdForText` on TEXT nodes.

| Style | Font | Size | Line Height | Letter Spacing | Weight |
|-------|------|------|-------------|----------------|--------|
| Title | Inter | 96 | 120 (1.2 RAW) | -2% | Bold (700) |
| Header 1 | Inter | 60 | 120 (1.2 RAW) | -2.2% | Bold (700) |
| Header 2 | Inter | 48 | 120 (1.2 RAW) | -2% | Bold (700) |
| Header 3 | Inter | 36 | 132 (1.32 RAW) | -2% | Bold (700) |
| Body 1 | Inter | 36 | 140 (1.4 RAW) | -1% | Regular (400) |
| Body 2 | Inter | 30 | 136 (1.36 RAW) | -1% | Regular (400) |
| Body 3 | Inter | 24 | 134 (1.34 RAW) | -0.5% | Regular (400) |
| Note | Inter | 20 | 140 (1.4 RAW) | 0% | Regular (400) |

Style definition nodes use `textAutoResize: 'WIDTH_AND_HEIGHT'`, but slide text
boxes typically use `textAutoResize: 'HEIGHT'` (fixed width, hug height).

---

## Custom Fonts (detached style)

When a text style is detached in Figma (via "Detach style"), `styleIdForText` becomes
the sentinel `0xFFFFFFFF:0xFFFFFFFF` and all typography fields become explicit on
the node.

```javascript
{
  styleIdForText: { guid: { sessionID: 4294967295, localID: 4294967295 } },  // detached
  fontName: { family: 'Times New Roman', style: 'Bold', postscript: 'TimesNewRomanPS-BoldMT' },
  fontSize: 36,
  lineHeight: { value: 1.32, units: 'RAW' },
  letterSpacing: { value: -2, units: 'PERCENT' },
  textTracking: -0.02,
  // ... all other text fields explicit
}
```

**Key facts:**
- No font embedding — Figma resolves fonts by name at runtime
- `fontName.family` = display name (e.g. `"Times New Roman"`)
- `fontName.style` = weight/style variant (e.g. `"Bold"`, `"Regular"`, `"Italic"`)
- `fontName.postscript` = PostScript name (e.g. `"TimesNewRomanPS-BoldMT"`) — can be `""` for Inter
- `textTracking` = `letterSpacing` percentage as decimal (e.g. `-2%` → `-0.02`)
- Detaching = sentinel `styleIdForText` + all fields become explicit on node

---

## Validated

- Freestanding TEXT node on slide with named style ✅
- Custom font (detached style) with fontName fields ✅
- Fill color on text ✅
- Horizontal alignment (LEFT, CENTER, RIGHT) ✅
- TEXT inside FRAME auto-layout container ✅
- `derivedTextData` can be omitted — Figma recomputes ✅

## Unknown / Not Yet Investigated

- Per-run formatting (bold + italic in same text box) — may require `styleOverrideTable`
- Paragraph-level spacing and indentation
- Text decoration (underline, strikethrough)
- Text lists (bulleted, numbered)
