import type { RenderFont } from "./render.js";

/**
 * Per-model page geometry. Values matched to pxpipe's measured settings
 * (https://github.com/teamchong/pxpipe, MIT License) -- same page dimensions,
 * column/row counts, and font per target vision model.
 */
export interface RenderProfile {
  name: string;
  /** Max wrap width in columns (pxpipe: stripCols). */
  cols: number;
  /** Max rendered image height in px (pxpipe: maxHeightPx). */
  maxHeightPx: number;
  /** Bitmap font atlas to render with. */
  font: RenderFont;
  /** Page budget before truncation kicks in. */
  maxImages: number;
}

export const PROFILES: Record<string, RenderProfile> = {
  // Anthropic geometry: dense 312-col strips, 728px height (1568x728 fits both
  // the API's long-edge<=1568 AND ~1.15MP clamp -- WYSIWYG for the vision encoder).
  claude: {
    name: "claude",
    cols: 312,
    maxHeightPx: 728,
    font: "spleen-5x8",
    maxImages: 96,
  },
  // OpenAI GPT default geometry: 84 cols x 1932px strip.
  gpt: {
    name: "gpt",
    cols: 84,
    maxHeightPx: 1932,
    font: "spleen-5x8",
    maxImages: 64,
  },
  // Gemini 3.6 Flash: reuses Anthropic's measured geometry (same 1568x728 canvas).
  gemini: {
    name: "gemini",
    cols: 312,
    maxHeightPx: 728,
    font: "spleen-5x8",
    maxImages: 32,
  },
  // Grok: native 14px JetBrains Mono was the densest clean rung on pxpipe's blind sweep.
  grok: {
    name: "grok",
    cols: 84,
    maxHeightPx: 512,
    font: "jetbrains-mono-14",
    maxImages: 24,
  },
};

export const DEFAULT_PROFILE = "claude";

export function resolveProfile(name?: string): RenderProfile {
  const key = (name ?? DEFAULT_PROFILE).toLowerCase();
  const profile = PROFILES[key];
  if (!profile) {
    const known = Object.keys(PROFILES).join(", ");
    throw new Error(`Unknown render profile "${name}". Known profiles: ${known}`);
  }
  return profile;
}
