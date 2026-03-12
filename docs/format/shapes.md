# Shape Nodes

## ROUNDED_RECTANGLE ✅

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

**Validated facts:**
- Position: `transform.m02` = x, `transform.m12` = y ✅
- Size: `size.x` = width, `size.y` = height ✅
- `fillGeometry` is NOT required — Figma recomputes it on import ✅
- Fill opacity: set `opacity` on the `fillPaints` entry (0–1) ✅
- Corner radius: set `cornerRadius` + all four `rectangle*CornerRadius` fields ✅
- Z-order: nodes later in `nodeChanges` render on top ✅
- `strokeWeight: 0` removes stroke entirely ✅
- Setting `cornerRadius` = half of width/height produces a **circle** ✅
- Shapes can extend beyond slide bounds — Figma clips at the slide edge ✅
- Also used for image placeholder overrides (see [overrides.md](overrides.md))

**Slide dimensions:** 1920×1080 (stored on SLIDE node `size` field). SLIDE_GRID is 2400×1560.

---

## FRAME (auto-layout container) ✅

Used to group and auto-lay-out child nodes (e.g., title + body text).

```javascript
{
  guid: { sessionID: 0, localID: 45 },
  type: 'FRAME',
  phase: 'CREATED',
  name: 'Frame 2',
  parentIndex: { guid: slideGuid, position: '!' },
  visible: true,
  opacity: 1,
  size: { x: 1200, y: 189 },
  transform: { m00: 1, m01: 0, m02: 128, m10: 0, m11: 1, m12: 446 },
  stackMode: 'VERTICAL',              // 'VERTICAL' | 'HORIZONTAL'
  stackSpacing: 24,                    // gap between children (px)
  verticalConstraint: 'CENTER',        // positioning constraint on slide
  frameMaskDisabled: true,
}
```

Validated: vertical auto-layout with spacing, TEXT children positioned correctly ✅

---

## SHAPE_WITH_TEXT

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
