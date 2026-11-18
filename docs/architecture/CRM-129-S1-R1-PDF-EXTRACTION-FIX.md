# CRM-129-S1-R1 — Persian PDF text extraction: measured cause and remedy design

Date: 2026-11-18
Status: **MEASURED / REMEDY DESIGNED / NOT YET IMPLEMENTED**
Scope: the PDF spike at `packages/twenty-server/test/spikes/quotation-pdf/`. No production code,
no database, no deployment touched by this document.

## 1. Why this document exists

The S1 report claimed the Persian PDF had **203 of 206 glyphs extractable (98.5%)**, with one
"unlisted glyph form" and "a few positional glyph forms omitted from `/ToUnicode`". The
architect rejected that as insufficient (decision D2).

**That claim was wrong, and the error was in the probe, not in the PDF.** S1-R1 fixes the probe
and re-measures. Correcting a published number is more important than keeping it.

## 2. The measured truth

| Claim | S1 report | Measured in S1-R1 |
| --- | --- | --- |
| Glyphs with no `/ToUnicode` entry | 3 of 206 | **0 of 206** |
| Glyphs with an EMPTY `/ToUnicode` entry | not measured | **0 of 206** |
| Characters lost from the text layer | "a letter (medial lam)" | **none** |
| Cause | "writer omits positional forms" | **ligature ordering + ZWNJ substitution** |

Verification command (runs today, no database, no network):

```
npx tsx packages/twenty-server/test/spikes/quotation-pdf/verify-quotation-pdf.ts [outputPath]
```

Current output:

```
PASS  glyph integrity       206 draws in the sample document, 0 .notdef
PASS  mapping completeness  206/206 draws mapped, 0 missing, 0 empty
PASS  ligature order        'کالا' = 3 glyphs for 4 characters; one glyph carries 2 code points
PASS  zwnj                  converted to a space by this face — copy/search loses the half-space
```

## 3. Root cause, with the mechanism in the source

Three facts, each read from code rather than inferred.

**3.1 The writer takes each glyph's code points straight from the font.**

`node_modules/@react-pdf/pdfkit/lib/pdfkit.js`, `encode()`:

```js
const gid = this.subset.includeGlyph(glyph.id);
if (this.unicode[gid] == null) {
  this.unicode[gid] = glyph.codePoints;
}
```

`toUnicodeCmap()` then writes one `bfchar` entry per glyph:

```js
for (let value of codePoints) { ... encoded.push(toHex(value)); }
entries.push('<' + toHex(index) + '>' + '<' + encoded.join(' ') + '>');
```

A glyph with an empty `codePoints` array therefore produces `<0008><>` — a mapping to nothing.
That is the mechanism the S1 report blamed. **It does not occur for this font**: every glyph
fontkit returns carries at least one code point.

**3.2 Arabic lam-alef is one glyph for two characters.**

Measured directly with fontkit against the spike's font:

```
layout("کالا")  chars=4  glyphs=3  emptyMappings=0  multiPointGlyphs=1
  [0] gid=815  codePoints=[1705]        // ک
  [1] gid=910  codePoints=[1575]        // ا
  [2] gid=1019 codePoints=[1604, 1575]  // لا  <- two code points, one glyph
```

`pdfkit` writes this correctly as `<....><0644 0627>`. So the **PDF's text layer is right**. What
breaks is reconstruction: a consumer that advances one character per glyph builds `ک` `ا` `لا`
and reads four characters where the glyph count is three, so any positional inference — including
this probe's own per-code-point reversal — produces `کاال`.

**3.3 The S1 probe truncated multi-code-point entries.**

The old parser in `pdf-probe.ts` was:

```js
const pair = /<([0-9a-fA-F]+)>\s*<([0-9a-fA-F]+)>/g;   // second group: ONE code point
```

For `<0008><0644 0627>` it captured `0644` and discarded `0627`, and for an entry whose
destination held a space it could fail to match at all — which is exactly how a present mapping
was reported as absent. The parser now reads every group in the destination and records an empty
destination as `''` so "mapped to nothing" stays distinguishable from "not mapped".

**3.4 ZWNJ is replaced by a space, by the face, not by the writer.**

```
layout("پیش‌فاکتور")  chars=10  glyphs=10  emptyMappings=0  codepointsSpelledOut="پیش فاکتور"
```

Ten glyphs for ten characters: nothing is dropped. But the code point recovered for the ZWNJ
glyph is `U+0020`, because the font's cmap maps that glyph to a space. So a copied quotation
reads `پیش فاکتور`. **This is face-dependent** and must be re-measured with the production font.

## 4. What the remedy must actually fix

| # | Defect | Consequence | Severity |
| --- | --- | --- | --- |
| P1 | One glyph carries several code points | Extractors that assume one glyph = one character misorder text | High — affects every word containing لا |
| P2 | ZWNJ becomes a space | Copy/search loses the half-space; `پیش‌فاکتور` cannot be found by its correct spelling | Medium |
| P3 | No per-character bidi information in the text layer | Mixed-direction lines (a Latin SKU inside Persian) need heuristics | Low — the visual layout is correct |

P1 is not a bug in the writer: the PDF is conformant. It is a **robustness** gap for the
consumers that read the document (search, copy, an accountant's PDF viewer, a future
full-text index).

## 5. Remedy, in three layers

### Layer 1 — Correct the measurement (DONE in S1-R1)

The probe now expands every code point of every entry, reverses at glyph granularity (never per
code point), and reports mapping completeness and ZWNJ separately. Implemented in
`pdf-probe.ts` (`parseToUnicodeCMaps`, `readLogicalTextRightToLeft`, `collectDrawnCodePoints`) and
asserted in `verify-quotation-pdf.ts`.

This layer fixes **our ability to state the truth**. It does not fix a customer's PDF viewer.

### Layer 2 — Emit `/ActualText` spans (DESIGNED, the actual remedy)

PDF has a standard mechanism for exactly this problem: marked content with an `/ActualText`
replacement string. A conformant extractor (Acrobat, pdf.js, MuPDF) prefers `/ActualText` over
the font's `/ToUnicode`, so the logical string is recovered verbatim regardless of shaping or
ligatures.

```pdf
/Span <</ActualText (\376\377\000\632...UTF-16BE logical run...)>>
BDC
<glyph codes for that run> Tj
EMC
```

Algorithm, applied to the produced buffer:

1. Parse the single page content stream (already possible: `readPdfObjects`).
2. Walk it, tracking `BT`/`ET` and the current text-showing operator, grouping consecutive
   `Tj`/`TJ` operations that belong to one logical line.
3. For each group, reconstruct the logical string from `/ToUnicode` (expanding multi-code-point
   entries, reversing at glyph granularity for RTL runs).
4. Wrap the group in `/Span <</ActualText ...>> BDC ... EMC`, inserting the UTF-16BE string.
5. Re-emit the content stream as a **new object** and append an incremental update (a second
   `xref` section plus trailer) so the original objects are untouched. This is what makes the
   change additive: a consumer that ignores `/ActualText` sees exactly the same page.

Why this and not the alternatives:

| Alternative | Verdict |
| --- | --- |
| Disable the ligature with font features | **Impossible.** `-liga`, `-clig` and `-rlig` were all measured; lam-alef still collapses, because it is a mandatory joining-script substitution, not a discretionary ligature. |
| Draw an invisible 1:1 text layer under the visible one | Needs PDF text rendering mode 3, which `@react-pdf/renderer` does not expose; it also doubles the page size. |
| Change the font to one whose positional forms are in cmap | Impossible in principle: positional forms are reached through GSUB, never through the Unicode cmap. |
| Patch `@react-pdf/pdfkit`'s `toUnicodeCmap` | The mapping is already correct; there is nothing to patch. |

Layer 2 is **designed but not implemented**: it is a content-stream rewrite with a spec-defined
structure, and it warrants its own task with its own tests rather than being slipped into a
contract-correction pass.

### Layer 3 — Production font and ZWNJ (OPEN, needs the font decision)

D1 selected Vazirmatn (OFL). P2 must be re-measured with it: whether the ZWNJ glyph carries
`U+200C` or a space is a property of that face's cmap, not of the writer. If Vazirmatn maps it to
a space too, Layer 2's `/ActualText` fixes it regardless, because the logical string is supplied
from the revision snapshot rather than recovered from glyphs.

## 6. Acceptance criteria for the remedy task

| # | Test | Pass condition |
| --- | --- | --- |
| T1 | Extract the sample quotation with pdf.js | Recovered text equals the source string, **including ZWNJ**, for every line |
| T2 | Extract a line containing `کالا` | Contains `کالا`; does not contain `کاال` |
| T3 | Extract a mixed-direction line (`کد کالا SKU-4417`) | Latin run intact and in order |
| T4 | Page rendered without `/ActualText` support | Byte-identical visible page: the remedy is additive |
| T5 | Original document still opens after the incremental update | `%PDF-` header intact, object count grew by exactly the added objects, no orphaned xref |
| T6 | Multi-page document | Every page wrapped; no `/ActualText` span crossing a page boundary |
| T7 | Regression guard | `0` glyphs with missing or empty `/ToUnicode`, asserted as today |

T1–T3 prove the fix; T4–T6 prove it is safe; T7 keeps the S1-R1 honesty fix from regressing.

## 7. What is NOT claimed

- That the current PDF is unreadable by a person. It is not: the visible page is shaped
  correctly, which the geometric assertions (rightmost run, unmirrored digits) support.
- That `/ActualText` is implemented. It is designed, with the algorithm and tests above.
- That ZWNJ will survive with the production font. It depends on the face and is re-measured
  under Layer 3.
- That any of this was verified with a screenshot. The verifier reads bytes; a visual check is a
  separate, human step.
