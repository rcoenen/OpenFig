# Architecture: Multi-Product Support

figmatk mirrors Figma's product family. Each product has its own file format but
they share a common binary codec and rendering pipeline.

## Figma Product Family

| # | Product | File Format | Status |
|---|---------|-------------|--------|
| 1 | **Figma Design** | `.fig` | Future (in scope, not yet) |
| 2 | **Figma Slides** | `.deck` | Current focus |
| 3 | **FigJam** | `.jam` | Maybe future |
| 4 | Buzz | unknown | Out of scope |
| 5 | Site | unknown | Out of scope |
| 6 | Make | unknown | Out of scope |

All products share the same kiwi binary schema under the hood. A `.deck` is a
ZIP containing a `canvas.fig` + metadata. A `.fig` is the raw binary. FigJam
uses the `fig-jam.` prelude. The codec already parses all three.

## Layer Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User / AI Consumer                    │
├──────────────────┬──────────────────┬───────────────────┤
│   Figma Slides   │  Figma Design    │  FigJam (maybe)   │
│   lib/slides/    │  lib/design/     │  lib/figjam/      │
│   .deck files    │  .fig files      │  .jam files       │
│                  │                  │                   │
│   Deck           │  File            │  Board            │
│   Slide          │  Page            │  (tbd)            │
│   Symbol         │  Component       │                   │
│   TextNode       │  TextNode        │                   │
│   ImageNode      │  ImageNode       │                   │
├──────────────────┴──────────────────┴───────────────────┤
│                   Shared Rasterizer                      │
│                   lib/rasterizer/                        │
│                                                         │
│   SVGRenderer    (node tree → SVG string)               │
│   PNGRenderer    (SVG → PNG via resvg-wasm)             │
│   FontResolver   (Google Fonts, system, custom)         │
├─────────────────────────────────────────────────────────┤
│                   Shared Core (Codec)                    │
│                   lib/core/                              │
│                                                         │
│   FigmaCodec     (kiwi schema, zstd, binary I/O)       │
│   NodeTree       (node map, children map, traversal)    │
│   NodeHelpers    (GUIDs, nid, parseId, positionChar)    │
│   ImageHelpers   (SHA-1, thumbnails, data URIs)         │
│   DeepClone      (typed-array-aware cloning)            │
│   BlobDecoder    (commandsBlob, vectorNetworkBlob)      │
└─────────────────────────────────────────────────────────┘
```

## What's shared vs product-specific

### Shared (works for any Figma product)

Everything below the product layer is format-agnostic:

- **Binary codec**: kiwi schema parsing, zstd compression, chunk I/O
- **Node tree**: `nodeChanges` array, parent/child maps, GUID lookups
- **Rendering**: SVG builder (all node types), PNG rasterizer, font resolution
- **Node types**: FRAME, GROUP, VECTOR, TEXT, ROUNDED_RECTANGLE, ELLIPSE,
  LINE, SHAPE_WITH_TEXT, BOOLEAN_OPERATION, SECTION — all shared
- **Helpers**: node manipulation, image hashing, deep cloning
- **Blob decoding**: fillGeometry, strokeGeometry, vectorNetworkBlob

### Slides-specific (.deck)

- ZIP archive handling (canvas.fig + meta.json + thumbnail.png + images/)
- Node types: SLIDE, SLIDE_ROW, SLIDE_GRID
- INSTANCE/SYMBOL override resolution (template-based slide system)
- `Deck`, `Slide`, `Symbol` high-level API classes
- Slide management: clone, remove, reorder
- MCP server tools (render-slide, inspect, update-text, etc.)

### Design-specific (.fig) — future

- Raw `.fig` binary I/O (no ZIP wrapper — or possibly ZIP with different structure)
- Node types: PAGE (top-level container, like SLIDE but for design)
- Component/variant system (similar to SYMBOL but with properties)
- `File`, `Page`, `Component` high-level API classes
- Auto-layout and constraints (shared with Slides FRAMEs, but more central)

## Current vs Target Structure

### Current

```
lib/
  fig-deck.mjs          ← codec + ZIP + slides mixed together
  api.mjs               ← Slides-only (Deck, Slide, Symbol)
  node-helpers.mjs       ← shared
  image-helpers.mjs      ← shared
  deep-clone.mjs         ← shared
  template-deck.mjs      ← Slides-only
  rasterizer/            ← shared (already clean)
```

### Target (when .fig support is added)

```
lib/
  core/
    figma-codec.mjs      ← binary codec (kiwi, zstd, chunks)
    node-tree.mjs         ← node map, children, traversal
    node-helpers.mjs      ← GUIDs, nid, parseId
    image-helpers.mjs     ← SHA-1, thumbnails
    deep-clone.mjs        ← typed-array cloning
    blob-decoder.mjs      ← commandsBlob, VNB decoding
  slides/
    deck.mjs              ← Deck class (ZIP handling + slides API)
    slide.mjs             ← Slide class
    symbol.mjs            ← Symbol/template resolution
    template.mjs          ← slide cloning, layout building
  design/
    file.mjs              ← File class (raw .fig I/O)
    page.mjs              ← Page class
    component.mjs         ← Component/variant handling
  rasterizer/             ← unchanged (already shared)
    svg-builder.mjs
    deck-rasterizer.mjs   ← rename to png-renderer.mjs
    font-resolver.mjs
    render-report-lib.mjs
```

## Naming Conventions

| Concept | Current Name | Target Name | Why |
|---------|-------------|-------------|-----|
| Binary codec class | `FigDeck` | `FigmaCodec` | Not deck-specific |
| ZIP loader | `fromDeckFile()` | stays (on Deck class) | Correctly scoped |
| Raw loader | `fromFigFile()` | moves to `FigmaCodec.fromFile()` | Shared entry point |
| PNG renderer file | `deck-rasterizer.mjs` | `png-renderer.mjs` | Not deck-specific |
| Slide getter | `getSlides()` | stays (on Deck class) | Correctly scoped |
| Page getter | n/a | `getPages()` (on File class) | Design-specific |

## Migration Path

This refactor is NOT needed now. When `.fig` support is added:

1. **Extract `lib/core/`** from `fig-deck.mjs` — pull out the binary codec,
   node tree, and blob decoder into standalone modules
2. **Move slides code** to `lib/slides/` — Deck, Slide, Symbol, template
3. **Create `lib/design/`** — File, Page, Component classes using the shared core
4. **Rename `FigDeck`** → `FigmaCodec` (or keep `FigDeck` as a Slides-specific
   subclass that adds ZIP handling)
5. **Update exports** in package.json — `figmatk/slides`, `figmatk/design`,
   `figmatk/core`

The rasterizer needs zero changes — it already works on any node tree.

## Package Exports (future)

```javascript
// Slides (current primary use case)
import { Deck, Slide } from 'figmatk/slides';

// Design (future)
import { File, Page } from 'figmatk/design';

// Shared rendering
import { SVGRenderer, PNGRenderer } from 'figmatk/rasterizer';

// Low-level codec (for advanced use)
import { FigmaCodec } from 'figmatk/core';
```
