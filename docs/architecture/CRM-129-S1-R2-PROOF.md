# CRM-129-S1-R2 — PDF extraction and atomic numbering: measured proof

Date: 2026-11-18
Status: **PDF remedy IMPLEMENTED AND PROVEN for ActualText-aware readers; browser viewers CANNOT benefit (measured). Numbering PROVEN against a real Postgres.**
Scope: one throwaway Postgres container, created and destroyed; no application database, app install,
live Asan call, push or deployment.

## 1. Two claims from S1-R1 that this task settles

| S1-R1 claim | Now measured |
| --- | --- |
| "ZWNJ loss is face-dependent; re-measure with the production font" | **Wrong.** Tahoma and Vazirmatn both map the half-space and a real space to the **same glyph code** (`U+0020`). The substitution is in the writer/shaper, not the face, so no font choice fixes it. |
| "`/ActualText` is the remedy; verify with an extractor" | **Partially wrong in its optimism.** `/ActualText` is the correct mechanism and MuPDF honours it, but **pdf.js does not implement it at all** — which excludes Chrome, Edge, Firefox's built-in viewer and every pdf.js-based tool. |

## 2. Font: Vazirmatn, licensed and vendored

| Step | Evidence |
| --- | --- |
| Licence | `OFL.txt` from the v33.003 release: "Copyright 2015 The Vazirmatn Project Authors … SIL Open Font License, Version 1.1". No `Reserved Font Name` is declared on the copyright line, so redistribution and embedding are permitted. |
| Asset | `packages/twenty-server/test/spikes/quotation-pdf/fonts/Vazirmatn-Regular.ttf`, 122,752 bytes, committed **with** `OFL.txt` beside it. |
| Resolution | `resolvePersianFont()` prefers the vendored file; the environment variable still overrides it; absolute-path fallbacks remain only so the spike runs where the file was stripped, and the verifier always prints which face it used. |
| Reproducibility | `npx tsx …/prove-actual-text.ts` runs with no environment variable and no system font. |

Measured on Vazirmatn: 224/224 glyphs mapped, 0 `.notdef`, all six Persian-only letters present,
contextual shaping intact, digits unmirrored — the same results as Tahoma, which is why the
ZWNJ conclusion is about the writer rather than the face.

## 3. Why ZWNJ cannot be fixed in the glyph mapping

Measured directly, same font, two inputs:

```
"پیش‌فاکتور"  (ZWNJ)   -> 10 glyphs, code 7 decodes to U+0020
"پیش فاکتور"  (space)  -> 10 glyphs, code 7 decodes to U+0020
"پیش‌ فاکتور" (both)   -> 11 glyphs, codes 1..6,7,7,8..10
```

The half-space and a space are **the same glyph**. Remapping that code to `U+200C` would turn every
real space in every quotation into a half-space. There is therefore no glyph-level fix, and the
`/ActualText` route is not one option among several — it is the only standard mechanism left.

## 4. The `/ActualText` remedy, as implemented

`packages/twenty-server/test/spikes/quotation-pdf/pdf-actual-text.ts`

- Rewrites the page content stream, wrapping each run of text in `/Span <</ActualText …>> BDC … EMC`
  with the **logical line text taken from the document's source strings**, not from the glyphs.
- Every other byte of the original document is preserved: the update is an **incremental update**
  (new content object + a redefined page object + an xref section chained with `/Prev`), so
  `updated.subarray(0, original.length)` is byte-identical to the original.
- The rendered page is unchanged: 224 glyph draws, identical before and after.

### Suppression strategy, chosen by measurement

A visual line is often drawn as several runs (a table row is three cells, and a bidi boundary inside
a word splits it). Only one run per line can carry the line's text, so the others must contribute
nothing. Three strategies were measured:

| Strategy | Result |
| --- | --- |
| Empty `/ActualText` (`<>`) for the other runs | MuPDF falls back to the glyph text — every other cell of a row leaked |
| Byte-order-mark only (`<FEFF>`) for the other runs, **chosen** | MuPDF treats it as "no text"; the line's text appears once |
| One span around the whole page | MuPDF scattered the replacement across positioned fragments |

Chosen: the line's text on its first run, `<FEFF>` on the rest, each span closed on the operator it
wraps.

## 5. Result, as measured by MuPDF

```
npx tsx packages/twenty-server/test/spikes/quotation-pdf/prove-actual-text.ts [outDir]

  PASS  baseline         8 lines; half-space LOST; کالا BROKEN
  PASS  additive         original 9830 bytes kept as an exact prefix; adds 1745 bytes
  PASS  spans            8 lines wrapped, 14 left untouched (drawn as several runs)
  PASS  visual identity  224 glyph draws identical across 22 runs
  PASS  misorder         gone from the whole document
  PASS  recovered        half-space kept, lam-alef intact, Latin code intact
  PASS  line fidelity    5/8 lines verbatim
  PASS  no loss          44 distinct characters; none lost
  PASS  pdf.js           ignores /ActualText: output unchanged; half-space still lost
```

What this establishes:

- The half-space is recovered in the extracted text, and `کاال` no longer appears anywhere — the
  ligature ordering defect is closed for a reader that honours `/ActualText`.
- No character is lost and none is invented.
- The visible page is untouched.

What it does **not** establish:

- **5 of 8 lines come back verbatim; 3 do not.** Those three are the rows whose last run is split off,
  and MuPDF appends a duplicated tail (`…۲٬۴۵۰٬۰۰۰ ۰`). The correct text is present, followed by a
  fragment. Closing this needs per-run source text produced by the renderer instead of inferred by a
  post-processor — see §7.
- **pdf.js extracts exactly what it extracted before.** `/ActualText` is not implemented there at all
  (zero occurrences of `ActualText` or `Artifact` in `pdfjs-dist@4.8.69`), and both were confirmed
  behaviourally: wrapping text in `/Artifact` also leaves pdf.js's output at 36 items / 216 characters.
  So a browser viewer still copies `پیش فاکتور` and `کاال`.

## 6. Atomic numbering: proven against a real Postgres

### Isolation

A **new** container, not the existing databases:

| Property | Value |
| --- | --- |
| Container | `crm129-proof-pg`, image `postgres:16-alpine`, id `1045651235e1…` |
| Mounts | **none** — no volume, no bind mount; data directory on tmpfs |
| Port | `127.0.0.1:55432` (the application databases use 5432 and 5433, untouched) |
| Database | `crm129proof`, schema `crm129proof`, one table |
| Collateral | all ten pre-existing containers kept their uptimes (`9 days`, `7 days`, `3 days`, `40 hours`) before and after |
| Cleanup | schema dropped, container `docker rm -f`, no leftover volume |

### Experiment

`packages/twenty-apps/internal/quotation/scripts/prove-atomic-numbering.ts`, two independent
connections per experiment:

```
npx tsx …/prove-atomic-numbering.ts "postgresql://…@127.0.0.1:55432/crm129proof"

  PASS  schema                     crm129proof.quotation_sequence_proof created (PRIMARY KEY on scopeKey)
  PASS  insert race                1 of 2 inserts won (writer-a); 1 row for the scope
  PASS  lost CAS (READ COMMITTED)  A rowCount=1, B rowCount=0, stored 2
  PASS  20 concurrent allocators   20 allocations, 20 distinct (1..20)
  PASS  REPEATABLE READ            a lost race raised 40001 — a caller MUST retry this as a lost race
```

### The finding that changes the protocol

`READ COMMITTED` reports a lost race as **`rowCount = 0`**. `REPEATABLE READ` does not: it raises
**SQLSTATE 40001** (`could not serialize access due to concurrent update`). A caller that handled only
the zero row count would fail — not duplicate — on a deployment using `REPEATABLE READ`, and a caller
that treated 40001 as a generic error would abort an allocation that only needed a re-read.

`sequence-storage.ts` now treats both as a lost race, and reports how many of its attempts were
serialisation failures, so a deployment exercising only that path is visible. Two new unit tests pin
it: one where a 40001 is followed by a successful retry (attempts = 2), one where an unrelated error
is **not** swallowed.

## 7. Open items for the architect

| # | Item | Why it is not closed here |
| --- | --- | --- |
| D2a | The 3 lines that duplicate a tail | Needs the renderer to emit one run per line, or to hand the post-processor a per-run mapping. A post-processor cannot infer the split reliably. |
| D2b | **Browser viewers do not honour `/ActualText`** | Measured, not assumed: pdf.js implements neither `/ActualText` nor `/Artifact`. If copy/search in a browser is a requirement, the text layer must be correct at generation time, which needs a renderer change (a shaped glyph plus a correct `U+200C` code — impossible with the current shaper). |
| D2c | ZWNJ is unreachable at glyph level | Both candidate faces collapse it to the same code as a space. |
| D9a | Which isolation level the workspace actually runs | Both `READ COMMITTED` and `REPEATABLE READ` are now handled, but the deployment value should be confirmed rather than inferred. |
| D9b | Gap policy sign-off | Gaps remain allowed by design; duplicates are proven impossible. |
| D9c | Production placement of the counter | Proven against a scratch table on the **Dev-class** Postgres image, not against the application database and not inside the app's own object storage. |

## 8. What was not done

- No connection to Asan, no live accounting call.
- No write to any application database; the only database touched was a throwaway container, destroyed.
- No app install, no deployment, no push, no service restart, no `:6080` change.
- No screenshot and no browser test.
