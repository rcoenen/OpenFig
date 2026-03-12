# Node Structure

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

## guid

Every node has a globally unique identifier: `{ sessionID, localID }`. Typically formatted as `"sessionID:localID"` (e.g., `"1:1559"`).

When creating new nodes, use `sessionID: 1` and increment `localID` beyond the current maximum in the document.

## type

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
| `TEXT` | Text node — see [text.md](text.md) |
| `RECTANGLE` | Rectangle shape |
| `ROUNDED_RECTANGLE` | Basic rectangle — see [shapes.md](shapes.md) |
| `SHAPE_WITH_TEXT` | Shape from "shape" tool — see [shapes.md](shapes.md) |
| `ELLIPSE` | Ellipse shape |
| `VECTOR` | Vector path |
| `LINE` | Line |
| `GROUP` | Group container |
| `FRAME` | Frame / auto-layout container — see [shapes.md](shapes.md) |
| `BOOLEAN_GROUP` | Boolean operation group |
| `POLYGON` | Polygon shape |
| `STAR` | Star shape |
| `VARIABLE_SET` | Design token set — see [colors.md](colors.md) |
| `VARIABLE` | Design token — see [colors.md](colors.md) |

## phase

| Value | Meaning |
|-------|---------|
| `undefined` | Existing unmodified node |
| `'CREATED'` | Newly created node |
| `'REMOVED'` | Deleted node (must remain in array) |

## parentIndex

Encodes the tree structure:

- **guid** — Points to the parent node's GUID
- **position** — Single ASCII character for sibling ordering. Children of the same parent are sorted by this character. Use sequential ASCII starting from `!` (0x21).

## Node Hierarchy (Slides)

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
