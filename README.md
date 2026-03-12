# figmatk

Swiss-army knife CLI for Figma `.deck` and `.fig` files. Parse, inspect, modify, and rebuild Figma Slides decks programmatically.

## Install

```bash
npm install
```

## Commands

| Command | Description |
|---------|-------------|
| `inspect` | Show document structure (node hierarchy tree) |
| `list-text` | List all text content in the deck |
| `list-overrides` | List editable override keys per symbol |
| `update-text` | Apply text overrides to a slide instance |
| `insert-image` | Apply image fill override with auto-thumbnail |
| `clone-slide` | Duplicate a template slide with new content |
| `remove-slide` | Mark slides as REMOVED |
| `roundtrip` | Decode and re-encode (pipeline validation) |

## Usage

```bash
# Inspect a deck's structure
node cli.mjs inspect presentation.deck --depth 5

# List all text content
node cli.mjs list-text presentation.deck

# List editable override keys for a symbol
node cli.mjs list-overrides presentation.deck --symbol "Cover"

# Update text on a slide
node cli.mjs update-text input.deck -o output.deck \
  --slide 1:2000 \
  --set "57:48=New Title" \
  --set "57:49=New Subtitle"

# Insert an image override
node cli.mjs insert-image input.deck -o output.deck \
  --slide 1:2006 \
  --key 75:126 \
  --image screenshot.png

# Clone a slide with content
node cli.mjs clone-slide input.deck -o output.deck \
  --template 1:1559 \
  --name "New Slide" \
  --set "57:48=Title" \
  --set-image "75:126=photo.png"

# Remove a slide
node cli.mjs remove-slide input.deck -o output.deck --slide 1:1769

# Roundtrip validation
node cli.mjs roundtrip input.deck -o output.deck
```

## Figma .deck Format

A `.deck` file is a ZIP archive containing:
- `canvas.fig` — Binary Figma document (kiwi-schema encoded)
- `thumbnail.png` — Deck thumbnail
- `meta.json` — Deck metadata
- `images/` — Image assets (named by SHA-1 hash)

The `canvas.fig` binary has:
- Prelude: `"fig-deck"` (or `"fig-kiwi"` for regular .fig files)
- Version: uint32 little-endian
- Chunks: length-prefixed binary blobs
  - Chunk 0: Kiwi schema (deflateRaw compressed)
  - Chunk 1: Message data (zstd compressed — Figma rejects deflateRaw here)

## Hard-Won Rules

These rules were discovered through extensive reverse engineering:

- **Chunk 1 must be zstd compressed** — Figma silently rejects deflateRaw
- **Image overrides require `styleIdForFill`** with sentinel GUID `{ sessionID: 0xFFFFFFFF, localID: 0xFFFFFFFF }` — without this, Figma silently ignores fillPaints overrides
- **Image overrides need `imageThumbnail`** with a real thumbnail PNG hash (~320px wide) stored in `images/`
- **Blank text fields must use `' '` (space)** — empty string `''` crashes Figma
- **Node removal: set `phase: 'REMOVED'`** — never filter nodes from the nodeChanges array
- **`thumbHash` must be `new Uint8Array(0)`** — not `{}` (kiwi-schema requires typed arrays)
- **Delete `derivedTextData`** when modifying text directly on nodes (not needed for overrides)
- **`JSON.parse(JSON.stringify())` corrupts `Uint8Array`** — use the provided `deepClone()` utility

## Architecture

```
figmatk/
  cli.mjs                    # CLI dispatcher (no framework deps)
  lib/
    fig-deck.mjs             # Core FigDeck class (parse/encode/save)
    deep-clone.mjs           # Uint8Array-safe deep clone
    node-helpers.mjs         # nid(), ov(), nestedOv(), removeNode()
    image-helpers.mjs        # hexToHash(), hashToHex(), imageOv()
  commands/
    inspect.mjs              # Tree view of document structure
    list-text.mjs            # All text + image content per slide
    list-overrides.mjs       # Editable override keys per symbol
    update-text.mjs          # Set text overrides on a slide
    insert-image.mjs         # Image fill override with auto-thumbnail
    clone-slide.mjs          # Duplicate a slide with content
    remove-slide.mjs         # Mark slides REMOVED
    roundtrip.mjs            # Decode/re-encode validation
```

## Using as a Library

```javascript
import { FigDeck } from './lib/fig-deck.mjs';
import { ov, nestedOv } from './lib/node-helpers.mjs';
import { imageOv } from './lib/image-helpers.mjs';

const deck = await FigDeck.fromDeckFile('template.deck');

// Inspect
console.log(deck.getActiveSlides().length, 'slides');
deck.walkTree('0:0', (node, depth) => {
  console.log('  '.repeat(depth) + node.type + ' ' + node.name);
});

// Modify and save
await deck.saveDeck('output.deck');
```

## License

MIT
