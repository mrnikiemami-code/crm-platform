# CRM-129-S1-R3 — Persian PDF generation-time correction

**Base SHA:** `2d024c81845980d1fdcc3b490eddd0d31617ac9e`  
**Mode:** PDF_RENDERER_CORRECTION_ONLY  
**Verdict:** **PARTIAL**

## Root cause (measured)

`fontkit` `LayoutEngine.hideDefaultIgnorables` runs **after** shaping and replaces every Unicode Default_Ignorable — including **U+200C ZWNJ** — with the font’s **SPACE** glyph (`gid` of U+0020), forcing `xAdvance = 0`.

- Visual result: correct (zero advance).
- `glyph.codePoints` become `[0x20]`.
- `@react-pdf/pdfkit` writes those code points into **ToUnicode** → extractors read a real space → `پیش‌فاکتور` becomes `پیش فاکتور`.

This is **not** a Vazirmatn cmap bug: `glyphForCodePoint(0x200C)` returns a dedicated zero-width glyph (`gid=322`). The substitution is unconditional in fontkit and matches HarfBuzz’s “hide ignorables” rendering trick, but pdfkit then loses the original code point.

Secondary issue: lam-alef ligatures store ToUnicode as two code points (`لا`). MuPDF/pdf.js reverse RTL at **character** granularity → `کالا` → `کاال`.

## Generation-time fix (no final-output patch)

File: `packages/twenty-server/test/spikes/quotation-pdf/fontkit-zwnj-preservation.ts`

1. **ZWNJ:** patch `hideDefaultIgnorables` so ZWNJ/ZWJ keep the face’s zero-width glyph when present → ToUnicode emits U+200C.
2. **Ligatures:** patch `@react-pdf/pdfkit` `EmbeddedFont.encode` / `encodeGlyphs` so lam-alef ToUnicode is a single presentation form (U+FEFB `ﻻ`). Drawn outline unchanged; **NFKC** restores `کالا`.

Applied from `registerQuotationSpikeFont()` before any layout.

## Real table columns

`quotation-pdf-document.ts` restored independent `View`/`Text` cells (`flexDirection: 'row-reverse'`) for description / quantity / price. Extractors see separate items (21 content runs), not one space-joined row string.

## Extractor matrix

| Check | ToUnicode (generation) | MuPDF | pdf.js (browser) |
|--------|------------------------|-------|------------------|
| ZWNJ half-space | ✓ U+200C | ✓ kept | ✗ stripped (`isInvisibleFormatMark` in pdf.worker) |
| Ligature `کالا` | ✓ U+FEFB | ✓ `کاﻻ` → NFKC `کالا` | ✓ same |
| Persian digits | ✓ | ✓ | ✓ |
| Mixed FA/EN | ✓ | ✓ | ✓ (bidi may split runs) |
| Real columns | ✓ | ✓ | ✓ independent qty/price items |

**pdf.js evidence:** `legacy/build/pdf.worker.mjs` ~36875 — `if (category.isInvisibleFormatMark) continue;` — Default_Ignorable (including U+200C) never enters the text layer. `/ActualText` is also ignored (S1-R2). **Cannot be fixed at generation time** without replacing the browser extractor or using a non-ignorable substitute (semantically wrong for joining).

## Commands run

```bash
npx tsx packages/twenty-server/test/spikes/quotation-pdf/verify-quotation-pdf.ts
npx tsx packages/twenty-server/test/spikes/quotation-pdf/prove-generation-zwnj.ts
npx tsx packages/twenty-server/test/spikes/quotation-pdf/prove-actual-text.ts
npx vitest run --root packages/twenty-apps/internal/quotation
```

## Alternatives (architect decision — engine switch not done)

| Option | Pros | Cons |
|--------|------|------|
| **A. Keep `@react-pdf` + these patches (current)** | Zero new deps; MuPDF/Acrobat copy OK; columns real | Browser (pdf.js) copy drops ZWNJ |
| **B. Chromium print-to-PDF** | Browser-parity text layer | Heavy; new runtime; against current spike goal |
| **C. `pdf-lib` / custom pdfkit fork with HarfBuzz** | Full control of CMap | New stack; still subject to pdf.js ignorable strip |
| **D. Ship PDF + side-channel (HTML/plain)** for copy | Browser UX | Product change |

**Recommendation:** Accept **PARTIAL** for S1: generation ToUnicode is correct; document that **browser copy of ZWNJ is a pdf.js limitation**. For product S2, either (A) accept MuPDF/Acrobat as the archival extractor and show a note in UI, or escalate engine choice (B/C) if browser copy of half-space is a hard requirement.

## Scope / non-goals respected

PDF spike only. No accounting contracts, DB, Asan, install, push, deploy, or worker restart.

## STOP_FOR_ARCHITECT

Need decision: accept PARTIAL (pdf.js ZWNJ strip) for product, or approve an alternate PDF engine / delivery path for browser-correct half-space copy.
