/**
 * render — Rasterize each slide in a .deck file to PNG.
 *
 * Usage:
 *   figmatk render <file.deck> -o <output-dir> [--scale 0.5] [--fonts <dir>]
 *
 * Options:
 *   -o <dir>        Output directory (default: ./render-out)
 *   --scale <n>     Zoom factor: 1 = 1920×1080, 0.5 = 960×540 (default: 1)
 *   --fonts <dir>   Extra font directory to load (can repeat)
 */

import { mkdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';
import { FigDeck } from '../lib/fig-deck.mjs';
import { renderDeck, registerFontDir } from '../lib/rasterizer/deck-rasterizer.mjs';

export async function run(args, flags) {
  const file = args[0];
  if (!file) {
    console.error('Usage: render <file.deck> -o <output-dir> [--scale 0.5] [--fonts <dir>]');
    process.exit(1);
  }

  const outDir = resolve(flags.o ?? flags.output ?? './render-out');
  const scale = parseFloat(flags.scale ?? '1');

  // Load extra font directories
  const fontDirs = [].concat(flags.fonts ?? []);
  for (const d of fontDirs) registerFontDir(resolve(d));

  const deck = await FigDeck.fromDeckFile(file);
  mkdirSync(outDir, { recursive: true });

  const slides = await renderDeck(deck, { scale });

  for (const { index, slideId, png } of slides) {
    const outFile = join(outDir, `slide-${String(index + 1).padStart(3, '0')}.png`);
    writeFileSync(outFile, png);
    console.log(`  slide ${index + 1}  →  ${outFile}`);
  }

  console.log(`\nRendered ${slides.length} slide(s) to ${outDir}`);
}
