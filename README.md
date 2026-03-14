# OpenFig

<img src="assets/logo.webp" alt="OpenFig" width="200" />

Open tools for Figma files.

Parse, inspect, and render Figma design files without the Figma application.

OpenFig is an open-source implementation of the Figma file format that allows developers to inspect, parse, and render Figma design files without using the Figma application or API.

## Figma File Formats

Each Figma product has its own native file format. Active development — status may change:

| Product | Extension | Status |
|---------|-----------|--------|
| Figma Slides | `.deck` | ✅ |
| Figma Design | `.fig` | 🔶 read-only |
| Figma Jam (whiteboard) | `.jam` | ❌ not yet |
| Figma Buzz | `.buzz` | ❌ not yet |
| Figma Sites | `.site` | ❌ not yet |
| Figma Make | `.make` | ❌ not yet |

## Why native `.deck`?

Figma Slides lets you download presentations as `.deck` files and re-upload them. This is the **native** round-trip format. Exporting to `.pptx` is lossy — vectors get rasterized, fonts fall back to system defaults, layout breaks. By staying in `.deck`, you preserve everything exactly as Figma renders it.

OpenFig makes this round-trip programmable. Download a `.deck`, modify it, re-upload. Everything stays native.

Plug in Claude Cowork or any coding agent and you have an AI that can read and edit Figma presentations end-to-end — without ever opening the Figma UI.

## Use Cases

- **AI agent for presentations** — let an LLM rewrite copy, insert images, and produce a ready-to-upload `.deck`
- **Batch-produce branded decks** — start from a template, feed in data per client/project, get pixel-perfect slides out
- **Inspect and audit** — understand the internal structure of any `.deck` file
- **Automate** text and image placement across dozens of slides in seconds

## Install

```bash
npm install -g openfig
```

Node 18+. No build step. Pure ESM.

## Quick Start

```bash
openfig inspect my-presentation.deck        # node hierarchy
openfig list-text my-presentation.deck      # all text + images per slide
openfig list-overrides my-presentation.deck # editable fields per symbol
```

> Full CLI reference: [docs/cli.md](docs/cli.md)

## Claude Cowork / MCP Integration

OpenFig supports two Claude Cowork install paths:

- GitHub-backed personal plugin install, which preserves Claude Cowork's repo update-check behavior
- Local `.mcpb` bundle install, which matches Anthropic's current desktop-extension packaging model

### Option 1 — Install from GitHub in Claude Cowork

If you want Claude Cowork to keep checking the repo for updates, install `openfig` from GitHub/personal plugins inside Claude Cowork.

That path uses the checked-in [plugin.json](.claude-plugin/plugin.json) and [marketplace.json](.claude-plugin/marketplace.json) metadata.

### Option 2 — Install the local MCPB bundle

Build the extension bundle:

```bash
npm install
npm run pack
```

This creates `dist/openfig.mcpb`. Install that bundle from Claude Desktop/Cowork's Extensions UI.

Install in Claude Cowork:

1. Open Claude Cowork or Claude Desktop.
2. Go to `Settings`.
3. Open `Extensions`.
4. Choose the local install/add option.
5. Select `dist/openfig.mcpb`.

Use this path when you want a local extension artifact. Unlike the GitHub-backed personal plugin path, local `.mcpb` installs do not poll the repo for updates automatically.

The MCP server covers four high-level workflows:

- create a new deck from scratch
- author a reusable Slides template
- instantiate a new deck from a template
- inspect or edit an existing deck

> MCP tool reference: [docs/mcp.md](docs/mcp.md)

## Template Workflows

OpenFig supports two related template states:

- Draft templates: `SLIDE_ROW -> SLIDE -> ...`
- Published templates: `SLIDE_ROW -> MODULE -> SLIDE -> ...`

Reusable template authoring is built around explicit layout and slot naming, then a publish-like wrapping step before later instantiation.

> Template workflow guide: [docs/template-workflows.md](docs/template-workflows.md)

## Programmatic API

```javascript
import { Deck } from 'openfig';

const deck = await Deck.open('template.deck');
const slide = deck.slides[0];
slide.addText('Hello world', { style: 'Title' });
await deck.save('output.deck');
```

| Docs | |
|------|---|
| MCP / Claude workflows | [docs/mcp.md](docs/mcp.md) |
| High-level API | [docs/api-spec.md](docs/api-spec.md) |
| Low-level FigDeck API | [docs/library.md](docs/library.md) |
| Template workflows | [docs/template-workflows.md](docs/template-workflows.md) |
| File format internals | [docs/format/](docs/format/) |

## License

MIT

## Disclaimer

Figma is a trademark of Figma, Inc.

OpenFig is an independent open-source project and is not affiliated with, endorsed by, or sponsored by Figma, Inc.
