/**
 * deck-rasterizer.mjs — Render FigDeck slides to PNG via WASM (resvg).
 *
 * WASM is initialized once per process. Fonts are loaded at init time and
 * can be hot-plugged via registerFont() before or after initialization.
 *
 * Usage:
 *   import { renderDeck, registerFont } from './deck-rasterizer.mjs';
 *   await registerFont('/path/to/CustomFont.ttf');
 *   const pngs = await renderDeck(deck);  // Map<slideIndex, Uint8Array>
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { slideToSvg } from './svg-builder.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WASM_PATH = join(__dirname, '../../node_modules/@resvg/resvg-wasm/index_bg.wasm');

// ── Font registry ─────────────────────────────────────────────────────────────

const fontBuffers = [
  readFileSync(join(__dirname, 'fonts/Inter-Regular.ttf')),
  readFileSync(join(__dirname, 'fonts/Inter-Variable.ttf')),
];

/**
 * Register an additional font for rendering.
 * Can be called at any time — takes effect on the next render call.
 * @param {string|Buffer|Uint8Array} source  File path or raw buffer.
 */
export function registerFont(source) {
  const buf = typeof source === 'string'
    ? readFileSync(source)
    : Buffer.isBuffer(source) ? source : Buffer.from(source);
  fontBuffers.push(buf);
}

/**
 * Register all fonts in a directory (recursively scans .ttf/.otf/.woff/.woff2).
 * Call this before rendering if slides use custom fonts.
 * @param {string} dir  Directory path to scan.
 */
export function registerFontDir(dir) {
  const scan = (d) => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) { scan(full); continue; }
      if (/\.(ttf|otf|woff2?)$/i.test(entry)) registerFont(full);
    }
  };
  scan(dir);
}

// ── WASM init (lazy, once) ────────────────────────────────────────────────────

let wasmReady = false;
let wasmInitPromise = null;

async function ensureWasm() {
  if (wasmReady) return;
  if (!wasmInitPromise) {
    wasmInitPromise = initWasm(readFileSync(WASM_PATH)).then(() => {
      wasmReady = true;
    });
  }
  await wasmInitPromise;
}

// ── Core render ───────────────────────────────────────────────────────────────

const SLIDE_W = 1920;
const SLIDE_H = 1080;

const DEFAULT_OPTS = {
  scale: 1,          // 1 = 1920×1080, 0.5 = 960×540 — capped at 1
  background: '#ffffff',
};

/**
 * Resolve scale from opts. Accepts:
 *   scale (float)   — direct multiplier, capped at 1
 *   width (px)      — fit to width, preserving aspect ratio
 *   height (px)     — fit to height, preserving aspect ratio
 * Never upscales beyond native 1920×1080.
 */
function resolveScale(opts) {
  if (opts.width)  return opts.width  / SLIDE_W;
  if (opts.height) return opts.height / SLIDE_H;
  return opts.scale ?? 1;
}

/**
 * Render a single SVG string to PNG.
 * @param {string} svg
 * @param {object} opts
 * @returns {Promise<Uint8Array>} PNG bytes
 */
export async function svgToPng(svg, opts = {}) {
  await ensureWasm();
  const { background } = { ...DEFAULT_OPTS, ...opts };
  const scale = resolveScale(opts);

  const resvg = new Resvg(svg, {
    background,
    fitTo: scale !== 1 ? { mode: 'zoom', value: scale } : { mode: 'original' },
    font: {
      fontBuffers: fontBuffers.map(b => new Uint8Array(b)),
      loadSystemFonts: false,
      sansSerifFamily: 'Inter',
      defaultFontFamily: 'Inter',
    },
  });

  const rendered = resvg.render();
  const png = rendered.asPng();
  rendered.free();
  resvg.free();
  return png;
}

/**
 * Render all active slides in a deck to PNG.
 * @param {import('../fig-deck.mjs').FigDeck} deck
 * @param {object} opts
 * @param {number} [opts.scale=1]  Zoom factor (e.g. 0.5 for thumbnails)
 * @returns {Promise<Array<{index: number, slideId: string, png: Uint8Array}>>}
 */
export async function renderDeck(deck, opts = {}) {
  const slides = deck.getActiveSlides();
  const results = [];
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const svg = slideToSvg(deck, slide);
    const png = await svgToPng(svg, opts);
    results.push({ index: i, slideId: slide.guid
      ? `${slide.guid.sessionID}:${slide.guid.localID}`
      : String(i), png });
  }
  return results;
}
