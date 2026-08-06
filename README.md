# mdpix

Render any Markdown file into dense PNG image pages plus a text factsheet, for token-efficient LLM context injection -- the same rendering engine as [pxpipe](https://github.com/teamchong/pxpipe) (same 5x8 bitmap glyph atlas, same per-model page geometry and character density), applied to a single `.md` file instead of a live API proxy.

Dense text (code fences, tables) packs more characters per image-token than per text-token on vision-capable models. `mdpix` reflows the token-heavy parts of a Markdown file into a fixed-width bitmap-font grid, rasterizes them as PNG pages, and writes an adjacent factsheet with exact-value strings (hashes, UUIDs, URLs, numeric IDs) that vision models are prone to misreading.

## Install

```bash
npm install -g mdpix
```

## CLI usage

```bash
mdpix <file.md> [--out dir] [--profile claude|gpt|grok] [--text-mode auto|all|none]
```

- `--out` -- output directory (default `mdpix-out`)
- `--profile` -- page dimensions/font metrics tuned per target model (default `claude`)
- `--text-mode`
  - `auto` (default) -- only dense blocks (code fences, tables, long paragraphs) are imaged; short prose stays out of the image pages
  - `all` -- the entire file is imaged
  - `none` -- no images are produced (only the factsheet/manifest)

Output directory contains:
- `page-001.png`, `page-002.png`, ... -- rendered pages
- `factsheet.txt` -- extracted exact-value strings (only written if any were found)
- `manifest.json` -- page count, profile used, truncation flag

## Library usage

```ts
import { renderMarkdownFile } from "mdpix";

const result = await renderMarkdownFile("docs/spec.md", {
  outDir: "out",
  profile: "claude",
  textMode: "auto",
});
```

Lower-level primitives are also exported: `renderTextToImages`, `segmentMarkdown`, `buildFactsheet`.

## Config file

Drop an `mdpix.config.json` in your project root (or an `"mdpix"` field in `package.json`) to set defaults:

```json
{
  "profile": "claude",
  "outDir": "mdpix-out",
  "textMode": "auto"
}
```

CLI flags always override the config file.

## Profiles

Geometry matched to pxpipe's measured settings for each vision model family.

| profile | max page size | cols x rows | font | max images | intended target |
| --- | --- | --- | --- | --- | --- |
| `claude` | 1568x728 | 312x90 | spleen-5x8 | 96 | Claude family (default) |
| `gpt` | 428x1932 | 84x240 | spleen-5x8 | 64 | GPT vision models |
| `gemini` | 1568x728 | 312x90 | spleen-5x8 | 32 | Gemini 3.6 Flash |
| `grok` | 764x512 | 84x63 | jetbrains-mono-14 | 24 | Grok vision models |

Page width shrinks to the widest actual line (up to the max shown above); height grows with content up to the max page height.

## Known limitations

Vision models are not OCR. Byte-exact values (hashes, IDs, secrets, precise numbers) can be misread from a rendered page -- this is why `mdpix` pulls those into a separate text `factsheet.txt` rather than trusting the image alone. Don't rely on image pages for content where a single wrong character matters and no factsheet entry covers it.

The renderer uses a baked 5x8 bitmap glyph atlas (Spleen, with Unifont fallback) covering the full BMP, so CJK, Arabic, emoji, and other non-Latin content render as real glyphs rather than being dropped. Codepoints genuinely absent from the atlas are escaped as `[U+HEX]` text instead of a blank cell, so no character is ever silently lost -- surfaced as `droppedChars`/`droppedCodepoints` in `manifest.json` when it happens.

## License

MIT
