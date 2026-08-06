import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { decodeUtf8Strict, looksBinary } from "./binary-detect.js";
import { buildFactsheet, formatFactsheet, type FactsheetEntry } from "./factsheet.js";
import { segmentMarkdown, type Block } from "./markdown.js";
import { renderTextToImages } from "./render.js";
import { resolveProfile } from "./profiles.js";

export { renderTextToImages, renderDensePages, type RenderFont } from "./render.js";
export { buildFactsheet, formatFactsheet } from "./factsheet.js";
export { segmentMarkdown } from "./markdown.js";
export { resolveProfile, PROFILES, DEFAULT_PROFILE, type RenderProfile } from "./profiles.js";

export type TextMode = "auto" | "all" | "none";

export interface RenderMarkdownFileOptions {
  profile?: string;
  outDir: string;
  textMode?: TextMode;
}

export interface RenderMarkdownFileResult {
  pageFiles: string[];
  factsheetFile: string | null;
  manifestFile: string;
  pageCount: number;
  factsheetEntryCount: number;
  truncated: boolean;
}

function selectImageableText(blocks: Block[], textMode: TextMode): string {
  if (textMode === "all") {
    return blocks.map((b) => b.lines.join("\n")).join("\n");
  }
  if (textMode === "none") {
    return "";
  }
  return blocks
    .filter((b) => b.dense || b.kind === "code" || b.kind === "table")
    .map((b) => b.lines.join("\n"))
    .join("\n\n");
}

export async function renderMarkdownFile(
  filePath: string,
  options: RenderMarkdownFileOptions
): Promise<RenderMarkdownFileResult> {
  const raw = readFileSync(filePath);

  if (looksBinary(raw)) {
    throw new Error(
      `Refusing to process "${filePath}": content looks binary, not a text Markdown file.`
    );
  }

  let source: string;
  try {
    source = decodeUtf8Strict(raw);
  } catch {
    throw new Error(`Refusing to process "${filePath}": content is not valid UTF-8.`);
  }

  const profile = resolveProfile(options.profile);
  const textMode: TextMode = options.textMode ?? "auto";

  mkdirSync(options.outDir, { recursive: true });

  const factsheetEntries: FactsheetEntry[] = buildFactsheet(source);
  const factsheetText = formatFactsheet(factsheetEntries);

  let factsheetFile: string | null = null;
  if (factsheetText.length > 0) {
    factsheetFile = join(options.outDir, "factsheet.txt");
    writeFileSync(factsheetFile, factsheetText, "utf-8");
  }

  if (source.trim().length === 0) {
    const manifestFile = join(options.outDir, "manifest.json");
    writeFileSync(
      manifestFile,
      JSON.stringify(
        { source: filePath, profile: profile.name, pageCount: 0, truncated: false, empty: true },
        null,
        2
      ),
      "utf-8"
    );
    return {
      pageFiles: [],
      factsheetFile,
      manifestFile,
      pageCount: 0,
      factsheetEntryCount: factsheetEntries.length,
      truncated: false,
    };
  }

  const blocks = segmentMarkdown(source);
  const imageableText = selectImageableText(blocks, textMode);

  const { pages, truncated, droppedChars, droppedCodepoints } = await renderTextToImages(imageableText, {
    profile: profile.name,
  });

  const pageFiles: string[] = [];
  pages.forEach((buf, idx) => {
    const pageFile = join(options.outDir, `page-${String(idx + 1).padStart(3, "0")}.png`);
    writeFileSync(pageFile, buf);
    pageFiles.push(pageFile);
  });

  const manifestFile = join(options.outDir, "manifest.json");
  writeFileSync(
    manifestFile,
    JSON.stringify(
      {
        source: filePath,
        profile: profile.name,
        pageCount: pages.length,
        truncated,
        factsheetEntryCount: factsheetEntries.length,
        textMode,
        droppedChars,
        droppedCodepoints: Object.fromEntries(
          Array.from(droppedCodepoints.entries()).map(([cp, n]) => [`U+${cp.toString(16).toUpperCase()}`, n])
        ),
      },
      null,
      2
    ),
    "utf-8"
  );

  return {
    pageFiles,
    factsheetFile,
    manifestFile,
    pageCount: pages.length,
    factsheetEntryCount: factsheetEntries.length,
    truncated,
  };
}
