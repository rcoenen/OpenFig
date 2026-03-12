# Figma `.deck` File Format

Technical specification for the Figma Slides `.deck` binary format, as used by FigmaTK.

## Archive Structure

A `.deck` file is a standard **ZIP archive** (uncompressed / store mode) containing:

| File | Required | Description |
|------|----------|-------------|
| `canvas.fig` | Yes | Binary Figma document (kiwi-schema encoded) |
| `thumbnail.png` | Yes | Deck thumbnail shown in Figma's file browser |
| `meta.json` | Yes | Metadata — file name, version |
| `images/` | No | Image assets, each named by SHA-1 hash (no extension) |

### meta.json

```json
{
  "file_name": "My Presentation",
  "version": "1"
}
```

### images/

Each image file is named by its **40-character lowercase hex SHA-1 hash** with no file extension:

```
images/
  780960f6236bd1305ceeb2590ca395e36e705816
  3edd7b8ee12e0f653393f430503ff8738e4e5dc7
```

Both full-resolution images and their thumbnails (~320px wide PNGs) are stored here, each under their own hash.

---

## canvas.fig Binary Layout

The `canvas.fig` file is a length-prefixed binary format. There is no checksum or integrity field.

### Header

```
Offset  Size     Description
──────  ───────  ──────────────────────────────
0       8 bytes  Prelude — ASCII string identifying the format
8       4 bytes  Version — uint32 little-endian
12      ...      Chunks begin
```

**Known preludes:**

| Prelude | Format |
|---------|--------|
| `fig-kiwi` | Figma Design files (`.fig`) |
| `fig-deck` | Figma Slides files (`.deck`) |
| `fig-jam.` | FigJam files (`.jam`) |

All preludes are exactly 8 bytes (padded if needed). The version field observed in the wild is typically `106`.

### Chunks

After the header, the file contains a sequence of length-prefixed chunks:

```
Offset  Size     Description
──────  ───────  ──────────────────────────────
0       4 bytes  Chunk length N — uint32 little-endian
4       N bytes  Chunk data (compressed)
```

Chunks repeat until end of file. Typically there are 2 chunks, occasionally 3+.

### Chunk 0 — Kiwi Binary Schema

| Property | Value |
|----------|-------|
| Compression | **deflateRaw** (RFC 1951, no zlib/gzip wrapper) |
| Content | Kiwi binary schema definition |
| Purpose | Defines the structure of all message types |

Decode with `decodeBinarySchema()` from the `kiwi-schema` package, then compile with `compileSchema()` to get encode/decode functions.

The schema from the file should always be preserved and re-used — never generate a new one.

### Chunk 1 — Message Data

| Property | Value |
|----------|-------|
| Compression | **zstd** (required for writing; Figma rejects deflateRaw) |
| Magic bytes | `0x28 0xB5 0x2F 0xFD` at offset 0 (zstd frame magic) |
| Content | Kiwi-encoded message |
| Purpose | Contains all document nodes, blobs, and metadata |

When **reading**, auto-detect the compression by checking for zstd magic bytes. Fall back to deflateRaw for older files.

When **writing**, always use zstd compression (level 3). Figma silently rejects files where chunk 1 is deflateRaw-compressed.

### Chunk 2+ — Additional Data

Optional. Pass through as-is during roundtrip — content and compression are opaque.

---

## Message Structure

The decoded message object contains:

```javascript
{
  nodeChanges: [ ... ],  // Array of ALL nodes in the document
  blobs: [ ... ],        // Binary data (paths, masks, geometry)
  // ... other fields defined by the kiwi schema
}
```

### nodeChanges

This is the heart of the document. Every node — from the root DOCUMENT down to individual text runs — lives in this flat array. The tree structure is encoded via `parentIndex` references.

**The array must never be filtered.** To remove a node, set its `phase` to `'REMOVED'`. Nodes removed from the array cause import failures.

### blobs

Array of `{ bytes: Uint8Array }` objects. Referenced by index from node fields like `fillGeometry[].commandsBlob`.

---

## Node Structure

Every node in `nodeChanges` has this shape:

```javascript
{
  guid: { sessionID: number, localID: number },
  type: "SLIDE",           // Node type string
  name: "Slide Name",      // Human-readable label
  phase: "CREATED",        // Lifecycle state (optional)
  parentIndex: {
    guid: { sessionID, localID },  // Parent node's GUID
    position: "!"                   // Sibling sort order
  },
  // ... type-specific fields
}
```

### guid

Every node has a globally unique identifier: `{ sessionID, localID }`. Typically formatted as `"sessionID:localID"` (e.g., `"1:1559"`).

When creating new nodes, use `sessionID: 1` and increment `localID` beyond the current maximum in the document.

### type

Known node types:

| Type | Description |
|------|-------------|
| `DOCUMENT` | Root node (always `0:0`) |
| `CANVAS` | Page / canvas |
| `SLIDE_GRID` | Container for all slides |
| `SLIDE_ROW` | Row container within the grid |
| `SLIDE` | Individual slide |
| `INSTANCE` | Component instance (the main content container on a slide) |
| `SYMBOL` | Component definition (master) |
| `COMPONENT_SET` | Set of component variants |
| `TEXT` | Text node |
| `RECTANGLE` | Rectangle shape |
| `ROUNDED_RECTANGLE` | Basic rectangle drawn with the rectangle tool; also used for image placeholders |
| `SHAPE_WITH_TEXT` | Shape drawn with the "shape" tool in Slides — complex internal structure (see below) |
| `ELLIPSE` | Ellipse shape |
| `VECTOR` | Vector path |
| `LINE` | Line |
| `GROUP` | Group container |
| `FRAME` | Frame / auto-layout container |
| `BOOLEAN_GROUP` | Boolean operation group |
| `POLYGON` | Polygon shape |
| `STAR` | Star shape |
| `VARIABLE_SET` | Design token set |
| `VARIABLE` | Design token |

### phase

| Value | Meaning |
|-------|---------|
| `undefined` | Existing unmodified node |
| `'CREATED'` | Newly created node |
| `'REMOVED'` | Deleted node (must remain in array) |

### parentIndex

Encodes the tree structure:

- **guid** — Points to the parent node's GUID
- **position** — Single ASCII character for sibling ordering. Children of the same parent are sorted by this character. Use sequential ASCII starting from `!` (0x21).

### Node Hierarchy (Slides)

```
DOCUMENT (0:0)
  └─ CANVAS "Page 1" (0:1)
       └─ SLIDE_GRID "Presentation" (0:3)
            └─ SLIDE_ROW "Row" (1:1563)
                 ├─ SLIDE "1" (1:1559)
                 │    └─ INSTANCE (1:1564) ← component instance with overrides
                 ├─ SLIDE "2" (1:1570)
                 │    └─ INSTANCE (1:1572)
                 └─ ...
```

Each SLIDE has exactly one INSTANCE child. The INSTANCE references a SYMBOL (component master) and carries `symbolOverrides` for customization.

---

## Symbol Overrides

Component instances customize their content through `symbolData.symbolOverrides` — an array of override objects. Each override targets a specific node inside the symbol by its `overrideKey` (not its `guid`).

### overrideKey vs guid

Every overrideable node inside a SYMBOL has an `overrideKey` field — a `{ sessionID, localID }` object that is **different from the node's guid**. When writing overrides on an INSTANCE, the `guidPath.guids` array must reference `overrideKey` values, not `guid` values.

### Text Override

```javascript
{
  guidPath: {
    guids: [{ sessionID: 57, localID: 48 }]  // overrideKey of target TEXT node
  },
  textData: {
    characters: "New text content"
  }
}
```

Rules:
- Only include `characters` in `textData` — never include a `lines` array (wrong entry count crashes Figma)
- Never use empty string `''` — use `' '` (space) for blank fields. Empty string crashes Figma.

### Nested Text Override

For text inside a nested instance (e.g., a quote component inside a grid component):

```javascript
{
  guidPath: {
    guids: [
      { sessionID: 97, localID: 134 },  // overrideKey of the nested INSTANCE
      { sessionID: 97, localID: 117 }   // overrideKey of the TEXT inside it
    ]
  },
  textData: {
    characters: "Nested text content"
  }
}
```

### Image Override

Overriding an image fill on a ROUNDED_RECTANGLE placeholder:

```javascript
{
  styleIdForFill: {
    guid: {
      sessionID: 4294967295,  // 0xFFFFFFFF — sentinel value, REQUIRED
      localID: 4294967295     // 0xFFFFFFFF — sentinel value, REQUIRED
    }
  },
  guidPath: {
    guids: [{ sessionID: 75, localID: 126 }]  // overrideKey of image placeholder
  },
  fillPaints: [{
    type: 'IMAGE',
    opacity: 1,
    visible: true,
    blendMode: 'NORMAL',
    transform: {
      m00: 1, m01: 0, m02: 0,   // 2D affine transform (identity = no transform)
      m10: 0, m11: 1, m12: 0
    },
    image: {
      hash: Uint8Array(20),       // SHA-1 hash of full image (20 bytes)
      name: "hex-sha1-string"     // 40-char hex representation
    },
    imageThumbnail: {
      hash: Uint8Array(20),       // SHA-1 hash of thumbnail (~320px PNG)
      name: "hex-sha1-string"
    },
    animationFrame: 0,
    imageScaleMode: 'FILL',       // FILL, FIT, CROP, TILE
    imageShouldColorManage: false,
    rotation: 0,
    scale: 0.5,
    originalImageWidth: 1011,     // Pixel dimensions of original image
    originalImageHeight: 621,
    thumbHash: new Uint8Array(0), // MUST be Uint8Array, not {}
    altText: ''
  }]
}
```

**Critical requirements:**

1. **`styleIdForFill`** — The sentinel GUID `0xFFFFFFFF:0xFFFFFFFF` tells Figma to detach the fill from any library style and use the override instead. Without this, Figma silently ignores the entire `fillPaints` override.

2. **`imageThumbnail`** — Must reference a real PNG file (~320px wide) stored in the `images/` directory. Without a valid thumbnail, the image doesn't render.

3. **`thumbHash`** — Must be `new Uint8Array(0)`. Using a plain object `{}` causes a kiwi-schema encoding error.

4. **Image files** — Both the full image and thumbnail must exist in the `images/` directory, named by their SHA-1 hash (no extension).

---

## Cloning Slides

To duplicate a slide from a template:

1. **Deep-clone** the SLIDE node and its INSTANCE child (use `Uint8Array`-safe cloning, not `JSON.parse/stringify`)
2. Assign **new unique GUIDs** (increment beyond `maxLocalID()`)
3. Set `phase: 'CREATED'` on both
4. Set **parentIndex** — SLIDE parent is the SLIDE_ROW, INSTANCE parent is the new SLIDE
5. Set **symbolData** on the instance with the target SYMBOL's ID and fresh `symbolOverrides`
6. **Delete cached fields:**
   - `derivedSymbolData`
   - `derivedSymbolDataLayoutVersion`
   - `slideThumbnailHash`
   - `editInfo`
   - `prototypeInteractions`
7. Set slide **transform** (x position = slide_index × 2160 for standard spacing)
8. Push both nodes to `nodeChanges`

---

## Cached Fields

Figma pre-computes certain layout data and stores it on nodes. These caches must be invalidated when modifying nodes:

| Field | When to delete |
|-------|---------------|
| `derivedTextData` | When modifying `textData.characters` directly on a TEXT node |
| `derivedSymbolData` | When cloning an INSTANCE to create a new slide |
| `derivedSymbolDataLayoutVersion` | When cloning an INSTANCE |
| `slideThumbnailHash` | When cloning a SLIDE |
| `editInfo` | When cloning any node |

Note: `derivedTextData` does **not** need to be deleted when using `symbolOverrides` on an INSTANCE — it only matters for direct text node edits.

---

## Encoding Pipeline

To produce a valid `canvas.fig`:

```
1. Encode message     →  compiledSchema.encodeMessage(message)
2. Compress schema    →  deflateRaw(encodeBinarySchema(schema))
3. Compress message   →  zstd.compress(encodedMessage, level=3)
4. Assemble binary:
   [8B prelude][4B version][4B schema_len][schema][4B msg_len][msg][optional chunks...]
5. Pack into ZIP with thumbnail.png, meta.json, images/
```

---

## Shape Nodes

### ROUNDED_RECTANGLE

The simplest freestanding shape — produced by the rectangle tool. Fill and stroke
live **directly on the node**, not in any sub-structure.

```javascript
{
  guid: { sessionID: 1, localID: 85 },
  type: 'ROUNDED_RECTANGLE',
  phase: 'CREATED',
  name: 'Rectangle 1',
  parentIndex: { guid: slideGuid, position: '#' },
  visible: true,
  opacity: 1,
  size: { x: 300, y: 300 },
  transform: { m00: 1, m01: 0, m02: 740, m10: 0, m11: 1, m12: 100 },  // m02=x, m12=y
  strokeWeight: 1,
  strokeAlign: 'INSIDE',   // 'INSIDE' | 'OUTSIDE' | 'CENTER'
  strokeJoin: 'MITER',
  fillPaints: [{
    type: 'SOLID',
    color: { r: 0.878, g: 0.243, b: 0.102, a: 1 },  // normalized 0-1 floats
    opacity: 1,
    visible: true,
    blendMode: 'NORMAL',
    // colorVar is optional — omit when using raw RGB
  }],
  fillGeometry: [{ windingRule: 'NONZERO', commandsBlob: 17, styleID: 0 }],  // cached, may be omittable
  // editInfo: omit when creating new nodes
}
```

**Key facts (validated):**
- Position: `transform.m02` = x, `transform.m12` = y ✅
- Size: `size.x` = width, `size.y` = height ✅
- `fillGeometry` is NOT required — Figma recomputes it on import ✅
- Fill opacity: set `opacity` on the `fillPaints` entry (0–1) ✅
- Corner radius: set `cornerRadius` + all four `rectangle*CornerRadius` fields ✅
- Z-order: nodes later in `nodeChanges` render on top ✅
- `strokeWeight: 0` removes stroke entirely ✅
- Setting `cornerRadius` = half of width/height produces a **circle** ✅
- Shapes can extend beyond slide bounds — Figma clips at the slide edge ✅
- Also used for image placeholder overrides (see Symbol Overrides section)

**Slide dimensions:** 1920×1080 (stored on SLIDE node `size` field). SLIDE_GRID is 2400×1560.

### SHAPE_WITH_TEXT

Produced by the "shape" tool in Figma Slides. Much more complex — fill lives inside
`nodeGenerationData.overrides`, not directly on the node. Uses internal sub-nodes
with `sessionID: 40000000`.

**Prefer `ROUNDED_RECTANGLE` for programmatic shape creation.**

```javascript
{
  type: 'SHAPE_WITH_TEXT',
  shapeWithTextType: 'SQUARE',  // 'SQUARE' | 'RECTANGLE' | others TBD
  size: { x: 600, y: 600 },
  transform: { m00: 1, m01: 0, m02: 100, m10: 0, m11: 1, m12: 100 },
  nodeGenerationData: {
    overrides: [{
      guidPath: { guids: [{ sessionID: 40000000, localID: 0 }] },
      styleIdForFill: { guid: { sessionID: 0xFFFFFFFF, localID: 0xFFFFFFFF } },
      fillPaints: [{ type: 'SOLID', color: {...}, ... }],
      // ... many more fields
    }]
  },
  derivedImmutableFrameData: { ... }  // cached geometry
}
```

---

## Color Variables (Light Slides theme)

Figma Slides ships a built-in `VARIABLE_SET "Light slides"` in every deck.
These variables are referenced by `colorVar.value.alias.guid` in `fillPaints`.

When creating shapes with raw RGB, `colorVar` can be **omitted entirely**.
When binding to a theme color, reference the variable by GUID.

Variable GUIDs are consistent within a deck (always `sessionID: 1`).

| Name | GUID | Hex | r | g | b |
|------|------|-----|---|---|---|
| Pale Purple | 1:11 | #7F699B | 0.498 | 0.412 | 0.608 |
| Violet | 1:12 | #3D38F5 | 0.239 | 0.220 | 0.961 |
| Pale Blue | 1:13 | #667799 | 0.400 | 0.467 | 0.600 |
| Blue | 1:14 | #0C8CE9 | 0.047 | 0.549 | 0.914 |
| Pale Teal | 1:15 | #518394 | 0.318 | 0.514 | 0.580 |
| Teal | 1:16 | #0887A0 | 0.031 | 0.529 | 0.627 |
| Pale Green | 1:17 | #678E79 | 0.404 | 0.557 | 0.475 |
| Green | 1:18 | #198F51 | 0.098 | 0.561 | 0.318 |
| Pale Yellow | 1:19 | #AD7F00 | 0.678 | 0.498 | 0.000 |
| Pale Persimmon | 1:20 | #D4693B | 0.831 | 0.412 | 0.231 |
| Persimmon | 1:21 | #F65009 | 0.965 | 0.314 | 0.035 |
| Red | 1:22 | #E03E1A | 0.878 | 0.243 | 0.102 |
| Pale Pink | 1:23 | #AB5998 | 0.671 | 0.349 | 0.596 |
| Pale Red | 1:24 | #D4583B | 0.831 | 0.345 | 0.231 |
| Pink | 1:25 | #F316B0 | 0.953 | 0.086 | 0.690 |
| Grey | 1:26 | #CFCFCF | 0.813 | 0.813 | 0.813 |
| White | 1:27 | #FFFFFF | 1.000 | 1.000 | 1.000 |
| Color 3 | 1:28 | #000000 | 0.000 | 0.000 | 0.000 |
| Orange | 1:29 | #DE7D02 | 0.871 | 0.490 | 0.008 |
| Pale Violet | 1:30 | #6A699B | 0.416 | 0.412 | 0.608 |
| Yellow | 1:31 | #F3C11B | 0.953 | 0.757 | 0.106 |
| Purple | 1:32 | #8A38F5 | 0.541 | 0.220 | 0.961 |
| Black | 1:33 | #000000 | 0.000 | 0.000 | 0.000 |

> Note: `Color 3` and `Black` both resolve to `#000000`.
> GUIDs above are from the "Light slides" variable set and are consistent across decks
> that use this theme. A second duplicate set exists at higher localIDs (1:48–1:81) —
> these appear to be a copy; the first set (1:11–1:33) is the canonical one.

---

## Known Invariants

Violating any of these produces silent failures or crashes on import:

| Do | Don't |
|----|-------|
| Set `phase: 'REMOVED'` | Filter nodes from `nodeChanges` |
| Use `' '` for blank text | Use `''` empty string |
| Use zstd for chunk 1 | Use deflateRaw for chunk 1 |
| Include `styleIdForFill` sentinel on image overrides | Omit it (silent ignore) |
| Include `imageThumbnail` with real hash | Omit it (image won't render) |
| Use `new Uint8Array(0)` for `thumbHash` | Use `{}` (schema error) |
| Delete `derivedTextData` on direct text edits | Leave stale cache |
| Deep-clone with typed array support | Use `JSON.parse(JSON.stringify())` |
| Preserve original kiwi schema | Generate a new one |
| Keep all chunks (pass through chunk 2+) | Drop unknown chunks |
