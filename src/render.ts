/**
 * Dense bitmap-atlas text renderer. Geometry and glyph-blitting logic ported
 * from pxpipe (https://github.com/teamchong/pxpipe, MIT License, Copyright
 * (c) 2026 claude-image-proxy contributors), src/core/render.ts -- trimmed to
 * the single-document rendering path mdpix needs (no chat-transcript role
 * coloring, no Anthropic-request rewriting).
 */

import {
  ATLAS_CELL_W,
  ATLAS_CELL_H,
  ATLAS_ASCENT,
  ATLAS_PIXELS,
  ATLAS_OFFSETS,
  ATLAS_WIDE_FLAGS,
  atlasRank,
  ATLAS_GRAY_CELL_W,
  ATLAS_GRAY_CELL_H,
  ATLAS_GRAY_ASCENT,
  ATLAS_GRAY_PIXELS,
  ATLAS_GRAY_OFFSETS,
  ATLAS_GRAY_WIDE_FLAGS,
  atlasGrayRank,
  JBM10_CELL_W,
  JBM10_CELL_H,
  JBM10_ASCENT,
  JBM10_PIXELS,
  JBM10_OFFSETS,
  JBM10_WIDE_FLAGS,
  jbMono10Rank,
  JBM10_GRAY_CELL_W,
  JBM10_GRAY_CELL_H,
  JBM10_GRAY_ASCENT,
  JBM10_GRAY_PIXELS,
  JBM10_GRAY_OFFSETS,
  JBM10_GRAY_WIDE_FLAGS,
  jbMono10GrayRank,
  JBM12_CELL_W,
  JBM12_CELL_H,
  JBM12_ASCENT,
  JBM12_PIXELS,
  JBM12_OFFSETS,
  JBM12_WIDE_FLAGS,
  jbMono12Rank,
  JBM12_GRAY_CELL_W,
  JBM12_GRAY_CELL_H,
  JBM12_GRAY_ASCENT,
  JBM12_GRAY_PIXELS,
  JBM12_GRAY_OFFSETS,
  JBM12_GRAY_WIDE_FLAGS,
  jbMono12GrayRank,
  JBM14_CELL_W,
  JBM14_CELL_H,
  JBM14_ASCENT,
  JBM14_PIXELS,
  JBM14_OFFSETS,
  JBM14_WIDE_FLAGS,
  jbMono14Rank,
  JBM14_GRAY_CELL_W,
  JBM14_GRAY_CELL_H,
  JBM14_GRAY_ASCENT,
  JBM14_GRAY_PIXELS,
  JBM14_GRAY_OFFSETS,
  JBM14_GRAY_WIDE_FLAGS,
  jbMono14GrayRank,
} from "./atlas/index.js";
import { encodeGrayPng } from "./png.js";

export type RenderFont = "spleen-5x8" | "jetbrains-mono-10" | "jetbrains-mono-12" | "jetbrains-mono-14";
export const DEFAULT_RENDER_FONT: RenderFont = "spleen-5x8";

interface Atlas {
  cellW: number;
  cellH: number;
  ascent: number;
  pixels: Uint8Array;
  offsets: Uint32Array;
  wideFlags: Uint8Array;
  rank: (codepoint: number) => number;
}

interface AtlasSet {
  bit: Atlas;
  gray: Atlas;
}

const DEFAULT_ATLAS: AtlasSet = {
  bit: {
    cellW: ATLAS_CELL_W,
    cellH: ATLAS_CELL_H,
    ascent: ATLAS_ASCENT,
    pixels: ATLAS_PIXELS,
    offsets: ATLAS_OFFSETS,
    wideFlags: ATLAS_WIDE_FLAGS,
    rank: atlasRank,
  },
  gray: {
    cellW: ATLAS_GRAY_CELL_W,
    cellH: ATLAS_GRAY_CELL_H,
    ascent: ATLAS_GRAY_ASCENT,
    pixels: ATLAS_GRAY_PIXELS,
    offsets: ATLAS_GRAY_OFFSETS,
    wideFlags: ATLAS_GRAY_WIDE_FLAGS,
    rank: atlasGrayRank,
  },
};

const JBM10_ATLAS: AtlasSet = {
  bit: {
    cellW: JBM10_CELL_W,
    cellH: JBM10_CELL_H,
    ascent: JBM10_ASCENT,
    pixels: JBM10_PIXELS,
    offsets: JBM10_OFFSETS,
    wideFlags: JBM10_WIDE_FLAGS,
    rank: jbMono10Rank,
  },
  gray: {
    cellW: JBM10_GRAY_CELL_W,
    cellH: JBM10_GRAY_CELL_H,
    ascent: JBM10_GRAY_ASCENT,
    pixels: JBM10_GRAY_PIXELS,
    offsets: JBM10_GRAY_OFFSETS,
    wideFlags: JBM10_GRAY_WIDE_FLAGS,
    rank: jbMono10GrayRank,
  },
};

const JBM12_ATLAS: AtlasSet = {
  bit: {
    cellW: JBM12_CELL_W,
    cellH: JBM12_CELL_H,
    ascent: JBM12_ASCENT,
    pixels: JBM12_PIXELS,
    offsets: JBM12_OFFSETS,
    wideFlags: JBM12_WIDE_FLAGS,
    rank: jbMono12Rank,
  },
  gray: {
    cellW: JBM12_GRAY_CELL_W,
    cellH: JBM12_GRAY_CELL_H,
    ascent: JBM12_GRAY_ASCENT,
    pixels: JBM12_GRAY_PIXELS,
    offsets: JBM12_GRAY_OFFSETS,
    wideFlags: JBM12_GRAY_WIDE_FLAGS,
    rank: jbMono12GrayRank,
  },
};

const JBM14_ATLAS: AtlasSet = {
  bit: {
    cellW: JBM14_CELL_W,
    cellH: JBM14_CELL_H,
    ascent: JBM14_ASCENT,
    pixels: JBM14_PIXELS,
    offsets: JBM14_OFFSETS,
    wideFlags: JBM14_WIDE_FLAGS,
    rank: jbMono14Rank,
  },
  gray: {
    cellW: JBM14_GRAY_CELL_W,
    cellH: JBM14_GRAY_CELL_H,
    ascent: JBM14_GRAY_ASCENT,
    pixels: JBM14_GRAY_PIXELS,
    offsets: JBM14_GRAY_OFFSETS,
    wideFlags: JBM14_GRAY_WIDE_FLAGS,
    rank: jbMono14GrayRank,
  },
};

function atlasSet(font: RenderFont | undefined): AtlasSet {
  if (font === "jetbrains-mono-10") return JBM10_ATLAS;
  if (font === "jetbrains-mono-12") return JBM12_ATLAS;
  if (font === "jetbrains-mono-14") return JBM14_ATLAS;
  return DEFAULT_ATLAS;
}

function bitGlyph(codepoint: number, font: RenderFont | undefined): { atlas: Atlas; rank: number } | null {
  const selected = atlasSet(font).bit;
  const rank = selected.rank(codepoint);
  if (rank >= 0) return { atlas: selected, rank };
  if (selected !== DEFAULT_ATLAS.bit) {
    const fallbackRank = DEFAULT_ATLAS.bit.rank(codepoint);
    if (fallbackRank >= 0) return { atlas: DEFAULT_ATLAS.bit, rank: fallbackRank };
  }
  return null;
}

/** Page-height ceiling. Matches pxpipe's measured Anthropic geometry: the API downscales
 *  any image to fit BOTH long-edge <=1568 AND ~1.15 MP, then bills the exact 28-px patch
 *  count. 1568x728 fits both bounds -> WYSIWYG for the vision encoder. */
export const MAX_HEIGHT_PX = 728;
/** Char budget for dense content. 312 cols x 90 rows = 28080 chars fills the 1568x728 page. */
export const DENSE_CONTENT_CHARS_PER_IMAGE = 28080;
export const DENSE_CONTENT_COLS = 312;
/** Bare 5x8 cell (no padding) -- matches pxpipe's production default. */
export const DENSE_RENDER_STYLE: RenderStyle = { cellWBonus: 0, cellHBonus: 0, aa: true };
const DEFAULT_COLS = DENSE_CONTENT_COLS;
export const PAD_X = 4;
export const PAD_Y = 4;

export const DEFAULT_CELL_W_BONUS = 0;
export const DEFAULT_CELL_H_BONUS = 0;
export const CELL_W = ATLAS_CELL_W + DEFAULT_CELL_W_BONUS;
export const CELL_H = ATLAS_CELL_H + DEFAULT_CELL_H_BONUS;

export const LINES_PER_IMAGE = Math.max(1, Math.floor((MAX_HEIGHT_PX - 2 * PAD_Y) / CELL_H));

/** Real char capacity of one page at a given column width. Always pass the cols
 *  the renderer will actually use -- DENSE_CONTENT_CHARS_PER_IMAGE is only correct
 *  at DENSE_CONTENT_COLS. */
export function maxCharsPerImage(cols: number): number {
  return Math.min(Math.max(1, cols) * LINES_PER_IMAGE, DENSE_CONTENT_CHARS_PER_IMAGE);
}

export interface RenderedImage {
  png: Uint8Array;
  width: number;
  height: number;
  /** Input codepoints rendered (wide chars count as 1, not 2). */
  charsRendered: number;
  /** Codepoints absent from atlas, rendered as blank cells. */
  droppedChars: number;
  /** Per-codepoint drop histogram. Empty when droppedChars === 0. */
  droppedCodepoints: Map<number, number>;
}

export interface RenderStyle {
  /** Rasterized font atlas. Default spleen-5x8; alternates fall back to spleen-5x8 for missing glyphs. */
  font?: RenderFont;
  /** Extra blank rows above the glyph. */
  cellHBonus?: number;
  /** Extra blank columns beside the glyph. Negative overlaps glyphs. */
  cellWBonus?: number;
  /** Use the AA grayscale companion atlas. mdpix's vendored gray atlas is ASCII-identical
   *  to the bit atlas (Spleen is native-bitmap at 8px) -- kept for API parity with pxpipe. */
  aa?: boolean;
}

function renderCellWidth(style: RenderStyle = {}): number {
  const atlas = atlasSet(style.font).bit;
  return Math.max(1, atlas.cellW + Math.floor(style.cellWBonus ?? DEFAULT_CELL_W_BONUS));
}

function renderCellHeight(style: RenderStyle = {}): number {
  const atlas = atlasSet(style.font).bit;
  return atlas.cellH + Math.max(0, Math.floor(style.cellHBonus ?? DEFAULT_CELL_H_BONUS));
}

// --- column-aware wrapping -------------------------------------------------

function cellsFor(codepoint: number, font: RenderFont = DEFAULT_RENDER_FONT): number {
  const glyph = bitGlyph(codepoint, font);
  if (!glyph) return 1;
  return glyph.atlas.wideFlags[glyph.rank] === 1 ? 2 : 1;
}

const TAB_WIDTH = 4;

function trimLineEnd(line: string): string {
  let end = line.length;
  while (end > 0) {
    const c = line.charCodeAt(end - 1);
    if (c !== 32 && c !== 9) break;
    end -= 1;
  }
  return end === line.length ? line : line.slice(0, end);
}

/** Strip trailing whitespace per line and collapse 4+ consecutive newlines to 3.
 *  Normalizes \r\n and bare \r to \n first so CR never reaches the atlas as a
 *  stray "missing glyph" codepoint. */
export function minifyForRender(text: string): string {
  return text
    .replace(/\r\n|\r/g, "\n")
    .split("\n")
    .map(trimLineEnd)
    .join("\n")
    .replace(/\n{4,}/g, "\n\n\n");
}

export const GLYPH_ESCAPE_OPEN = "[U+";
export const GLYPH_ESCAPE_CLOSE = "]";

function isEscapeExempt(cp: number): boolean {
  if (cp < 0x20) return true;
  if (cp >= 0x7f && cp <= 0x9f) return true;
  if (cp >= 0x0300 && cp <= 0x036f) return true;
  if (cp === 0x200b || cp === 0x200c || cp === 0x200d || cp === 0x2060 || cp === 0xfeff) return true;
  if (cp >= 0xfe00 && cp <= 0xfe0f) return true;
  if (cp >= 0xe0100 && cp <= 0xe01ef) return true;
  return false;
}

/** Replace atlas-missing codepoints with `[U+HEX]` so non-Latin content stays legible
 *  instead of rendering as a blank cell. */
export function escapeMissingGlyphs(line: string, font: RenderFont = DEFAULT_RENDER_FONT): string {
  let out: string | null = null;
  let i = 0;
  for (const ch of line) {
    const cp = ch.codePointAt(0)!;
    if (!bitGlyph(cp, font) && !isEscapeExempt(cp)) {
      if (out === null) out = line.slice(0, i);
      out += GLYPH_ESCAPE_OPEN + cp.toString(16).toUpperCase() + GLYPH_ESCAPE_CLOSE;
    } else if (out !== null) {
      out += ch;
    }
    i += ch.length;
  }
  return out ?? line;
}

const TAB_MARKER = ">";

/** Expand \t to a visible marker + padding to the next tab stop. */
export function expandTabsInLine(line: string, font: RenderFont = DEFAULT_RENDER_FONT): string {
  if (line.indexOf("\t") < 0) return line;
  let out = "";
  let col = 0;
  for (const ch of line) {
    if (ch === "\t") {
      const span = TAB_WIDTH - (col % TAB_WIDTH);
      out += TAB_MARKER;
      if (span > 1) out += " ".repeat(span - 1);
      col += span;
    } else {
      out += ch;
      col += cellsFor(ch.codePointAt(0)!, font);
    }
  }
  return out;
}

export function measureLineCols(line: string, font: RenderFont = DEFAULT_RENDER_FONT): number {
  let w = 0;
  for (const ch of line) w += cellsFor(ch.codePointAt(0)!, font);
  return w;
}

/** Widest line's display width in cols, capped at maxCols. Lets a renderer size a
 *  narrow canvas to short-line content instead of padding every page to full width. */
export function measureContentCols(text: string, maxCols: number, font: RenderFont = DEFAULT_RENDER_FONT): number {
  const cap = Math.max(1, maxCols | 0);
  let widest = 1;
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === "\n") {
      const w = measureLineCols(escapeMissingGlyphs(expandTabsInLine(text.slice(start, i), font), font), font);
      if (w > widest) widest = w;
      if (widest >= cap) return cap;
      start = i + 1;
    }
  }
  return Math.min(cap, widest);
}

export function wrapLines(text: string, cols: number, font: RenderFont = DEFAULT_RENDER_FONT): string[] {
  const out: string[] = [];
  const minified = minifyForRender(text);
  for (const rawWithTabs of minified.split("\n")) {
    const raw = escapeMissingGlyphs(expandTabsInLine(rawWithTabs, font), font);
    if (raw.length === 0) {
      out.push("");
      continue;
    }
    let cur = "";
    let curCols = 0;
    for (const ch of raw) {
      const cp = ch.codePointAt(0)!;
      const w = cellsFor(cp, font);
      if (curCols + w > cols) {
        out.push(cur);
        cur = ch;
        curCols = w;
      } else {
        cur += ch;
        curCols += w;
      }
    }
    if (cur.length > 0) out.push(cur);
  }
  return out;
}

function splitWrappedLinesIntoPages(lines: string[], maxLines: number, maxChars: number): string[][] {
  const pages: string[][] = [];
  let cur: string[] = [];
  let curChars = 0;
  const lineLimit = Math.max(1, maxLines | 0);
  const charLimit = Math.max(1, maxChars | 0);

  for (const line of lines) {
    const lineChars = line.length + (cur.length > 0 ? 1 : 0);
    if (cur.length > 0 && (cur.length >= lineLimit || curChars + lineChars > charLimit)) {
      pages.push(cur);
      cur = [];
      curChars = 0;
    }
    cur.push(line);
    curChars += line.length + (cur.length > 1 ? 1 : 0);
  }
  if (cur.length > 0) pages.push(cur);
  return pages.length > 0 ? pages : [[]];
}

/** Blit a 1-bit glyph at pixel (x, y). Returns cells advanced (1 or 2), or 0 if absent
 *  from atlas -- caller must still advance 1 cell to keep wrap math stable. */
function blitGlyph(fb: Uint8Array, fbW: number, x: number, y: number, codepoint: number, font: RenderFont): number {
  const glyph = bitGlyph(codepoint, font);
  if (!glyph) return 0;
  const { atlas, rank } = glyph;
  const wide = atlas.wideFlags[rank] === 1;
  const srcW = wide ? 2 * atlas.cellW : atlas.cellW;
  const srcOff = atlas.offsets[rank]!;
  const yOffset = atlasSet(font).bit.ascent - atlas.ascent;
  for (let gy = 0; gy < atlas.cellH; gy++) {
    const dstRow = (y + yOffset + gy) * fbW + x;
    const bitRowStart = srcOff + gy * srcW;
    for (let gx = 0; gx < srcW; gx++) {
      const bitIdx = bitRowStart + gx;
      const byte = atlas.pixels[bitIdx >>> 3]!;
      const bit = (byte >>> (7 - (bitIdx & 7))) & 1;
      if (bit) fb[dstRow + gx] = 255;
    }
  }
  return wide ? 2 : 1;
}

/** Render text to a single PNG (<= maxHeightPx tall). Wide glyphs occupy 2 consecutive cells. */
export async function renderChunkToPng(
  text: string,
  cols: number = DEFAULT_COLS,
  style: RenderStyle = {},
  maxHeightPx: number = MAX_HEIGHT_PX
): Promise<RenderedImage> {
  const cellH = renderCellHeight(style);
  const cellW = renderCellWidth(style);
  const lines = wrapLines(text, cols, style.font);

  const maxLines = Math.max(1, Math.floor((maxHeightPx - 2 * PAD_Y) / cellH));
  const fitLines = lines.slice(0, maxLines);

  let charsRendered: number;
  if (fitLines.length === lines.length) {
    let n = 0;
    for (const _ of text) n++;
    charsRendered = n;
  } else {
    let n = 0;
    for (let i = 0; i < fitLines.length; i++) {
      for (const _ of fitLines[i]!) n++;
    }
    n += Math.max(0, fitLines.length - 1);
    charsRendered = n;
  }

  const atlasW = atlasSet(style.font).bit.cellW;
  const width = 2 * PAD_X + cols * cellW + Math.max(0, atlasW - cellW);
  const height = 2 * PAD_Y + fitLines.length * cellH;

  const fb = new Uint8Array(width * height);

  let droppedChars = 0;
  const droppedCodepoints = new Map<number, number>();
  for (let row = 0; row < fitLines.length; row++) {
    const line = fitLines[row]!;
    const baseY = PAD_Y + row * cellH;
    let col = 0;
    for (const ch of line) {
      if (col >= cols) break;
      const codepoint = ch.codePointAt(0)!;
      const baseX = PAD_X + col * cellW;
      const advance = blitGlyph(fb, width, baseX, baseY, codepoint, style.font ?? DEFAULT_RENDER_FONT);
      if (advance === 0) {
        droppedChars++;
        droppedCodepoints.set(codepoint, (droppedCodepoints.get(codepoint) ?? 0) + 1);
        col += 1;
      } else {
        col += advance;
      }
    }
  }

  // Invert to black-on-white (production convention).
  for (let i = 0; i < fb.length; i++) fb[i] = 255 - fb[i]!;

  const png = await encodeGrayPng(fb, width, height);
  return { png, width, height, charsRendered, droppedChars, droppedCodepoints };
}

/** Split text into N PNGs each <= maxHeightPx tall, respecting per-image char budget. */
export async function renderTextToPngsWithCharLimit(
  text: string,
  cols: number = DEFAULT_COLS,
  maxCharsPerImg: number = DENSE_CONTENT_CHARS_PER_IMAGE,
  style: RenderStyle = {},
  maxHeightPx: number = MAX_HEIGHT_PX
): Promise<RenderedImage[]> {
  const cellH = renderCellHeight(style);
  const lines = wrapLines(text, cols, style.font);
  const hardLinesPerImg = Math.max(1, Math.floor((maxHeightPx - 2 * PAD_Y) / cellH));
  const linesPerImg = Math.min(hardLinesPerImg, Math.max(1, Math.floor(maxCharsPerImg / cols)));

  const images: RenderedImage[] = [];
  for (const page of splitWrappedLinesIntoPages(lines, linesPerImg, maxCharsPerImg)) {
    const chunk = page.join("\n");
    images.push(await renderChunkToPng(chunk, cols, style, maxHeightPx));
  }
  return images;
}

export interface RenderDensePagesOptions {
  /** Wrap-width cap in cols. Default DENSE_CONTENT_COLS (312). */
  readonly cols?: number;
  /** Shrink the canvas to the widest actual line (default true). */
  readonly shrink?: boolean;
  /** Max source chars per page. Default DENSE_CONTENT_CHARS_PER_IMAGE. */
  readonly maxCharsPerImage?: number;
  /** Render style. Default DENSE_RENDER_STYLE. */
  readonly style?: RenderStyle;
  /** Max page height in px. Default MAX_HEIGHT_PX. */
  readonly maxHeightPx?: number;
}

/** The single dense-page rendering decision: measure the content width, then render
 *  the minimum number of pages that fit it. */
export async function renderDensePages(text: string, opts: RenderDensePagesOptions = {}): Promise<RenderedImage[]> {
  const maxCols = Math.max(1, (opts.cols ?? DENSE_CONTENT_COLS) | 0);
  const style = opts.style ?? DENSE_RENDER_STYLE;
  const cols = opts.shrink === false ? maxCols : measureContentCols(text, maxCols, style.font);
  const maxChars = opts.maxCharsPerImage ?? DENSE_CONTENT_CHARS_PER_IMAGE;
  const maxHeightPx = opts.maxHeightPx ?? MAX_HEIGHT_PX;
  return renderTextToPngsWithCharLimit(text, cols, maxChars, style, maxHeightPx);
}

export interface RenderOptions {
  profile?: string;
}

export interface RenderResult {
  pages: Buffer[];
  columns: number;
  rows: number;
  truncated: boolean;
  droppedChars: number;
  droppedCodepoints: Map<number, number>;
}

/** mdpix's public rendering entry point: render `text` at the named profile's geometry,
 *  filling the minimum number of pages, truncated at the profile's maxImages budget. */
export async function renderTextToImages(text: string, opts: RenderOptions = {}): Promise<RenderResult> {
  const { resolveProfile } = await import("./profiles.js");
  const profile = resolveProfile(opts.profile);

  if (text.length === 0) {
    return { pages: [], columns: profile.cols, rows: LINES_PER_IMAGE, truncated: false, droppedChars: 0, droppedCodepoints: new Map() };
  }

  const images = await renderDensePages(text, {
    cols: profile.cols,
    maxHeightPx: profile.maxHeightPx,
    style: { font: profile.font, aa: true },
  });

  const truncated = images.length > profile.maxImages;
  const kept = truncated ? images.slice(0, profile.maxImages) : images;

  let droppedChars = 0;
  const droppedCodepoints = new Map<number, number>();
  for (const img of kept) {
    droppedChars += img.droppedChars;
    for (const [cp, n] of img.droppedCodepoints) {
      droppedCodepoints.set(cp, (droppedCodepoints.get(cp) ?? 0) + n);
    }
  }

  return {
    pages: kept.map((img) => Buffer.from(img.png)),
    columns: profile.cols,
    rows: Math.max(1, Math.floor((profile.maxHeightPx - 2 * PAD_Y) / CELL_H)),
    truncated,
    droppedChars,
    droppedCodepoints,
  };
}
