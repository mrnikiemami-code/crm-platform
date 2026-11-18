import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { applyPersianPdfTextLayerFixes } from './fontkit-zwnj-preservation';
import { collectDrawnCodePoints, probePdf } from './pdf-probe';
import {
  SPIKE_SAMPLE_INPUT,
  quotationSourceStrings,
  renderPersianProbeText,
  renderQuotationPdfSpike,
} from './render-quotation-pdf';
import { extractItems } from './verify-pdf-extraction';

// CRM-129-S1-R3 — generation-time Persian text-layer fixes + real table columns.
//
// Root causes (measured):
//   1. fontkit hideDefaultIgnorables replaces U+200C with SPACE → ToUnicode U+0020.
//   2. pdfkit stores lam-alef as two ToUnicode code points → RTL extractors scramble کالا.
//
// Fixes (generation-time, not output patches):
//   1. Keep the face's zero-width ZWNJ glyph.
//   2. Collapse Arabic ligature ToUnicode to a single presentation-form code point (ﻻ);
//      NFKC restores کالا for search/compare.
//
// Extractor matrix:
//   MuPDF  — ZWNJ kept; ligatures OK after NFKC.
//   pdf.js — deliberately skips Default_Ignorable (isInvisibleFormatMark); ZWNJ lost on
//            copy in the browser. Letters/digits/columns otherwise OK. ActualText also
//            ignored by pdf.js (measured in S1-R2).
//
// Usage:
//   npx tsx packages/twenty-server/test/spikes/quotation-pdf/prove-generation-zwnj.ts [outDir]

type Finding = { name: string; detail: string };

const findings: Finding[] = [];
const record = (name: string, detail: string): void => {
  findings.push({ name, detail });
};

const ZWNJ = '\u200c';
const HALF_SPACED_WORD = `پیش${ZWNJ}فاکتور`;
const LIGATURE_WORD = 'کالا';
const MIXED = `کد${ZWNJ}SKU-4417`;

const MUPDF_HELPER = join(
  process.cwd(),
  'packages/twenty-server/test/spikes/quotation-pdf/extract-with-mupdf.py',
);

type MuPdfLine = { visual: string; logical: string };

const nfkc = (text: string): string => text.normalize('NFKC');

const extractWithMuPdf = (
  pdfPath: string,
): { pageCount: number; lines: MuPdfLine[] } => {
  const output = execFileSync(
    'python',
    ['-W', 'ignore', MUPDF_HELPER, pdfPath],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
  );

  return JSON.parse(output) as { pageCount: number; lines: MuPdfLine[] };
};

const concatMuPdf = (lines: MuPdfLine[]): string =>
  lines.map((line) => line.visual).join('\n');

const main = async (): Promise<void> => {
  applyPersianPdfTextLayerFixes();

  const outDir = process.argv[2] ?? mkdtempSync(join(tmpdir(), 'crm129r3-'));
  const quotationPath = join(outDir, 'quotation-generation.pdf');

  // ---------------------------------------------------------------------------------------
  // 1. Atomic ToUnicode probes
  // ---------------------------------------------------------------------------------------
  const zwnjPdf = await renderPersianProbeText(HALF_SPACED_WORD);
  writeFileSync(join(outDir, 'zwnj-probe.pdf'), zwnjPdf);
  const zwnjDrawn = collectDrawnCodePoints(
    probePdf(zwnjPdf).runs,
    probePdf(zwnjPdf).codeToUnicode,
  );

  assert.ok(zwnjDrawn.includes(0x200c), 'ToUnicode missing U+200C');
  assert.equal(
    zwnjDrawn.filter((codePoint) => codePoint === 0x20).length,
    0,
    'ZWNJ still emitted as SPACE in ToUnicode',
  );
  record('tounicode-zwnj', 'U+200C present, no spurious U+0020');

  const ligaturePdf = await renderPersianProbeText(LIGATURE_WORD);
  writeFileSync(join(outDir, 'ligature-probe.pdf'), ligaturePdf);
  const ligaturePath = join(outDir, 'ligature-probe.pdf');
  const ligatureJs = (await extractItems(ligaturePath)).map((i) => i.text).join('');
  const ligatureMu = concatMuPdf(extractWithMuPdf(ligaturePath).lines);

  assert.equal(
    nfkc(ligatureJs),
    LIGATURE_WORD,
    `pdf.js ligature NFKC: ${JSON.stringify(ligatureJs)}`,
  );
  assert.equal(
    nfkc(ligatureMu),
    LIGATURE_WORD,
    `MuPDF ligature NFKC: ${JSON.stringify(ligatureMu)}`,
  );
  record(
    'ligature',
    `pdf.js=${JSON.stringify(ligatureJs)} MuPDF=${JSON.stringify(ligatureMu)} → NFKC ${LIGATURE_WORD}`,
  );

  const digitsSource = '۱۴۰۳-۰۰۰۱۲۳';
  const digitsPath = join(outDir, 'digits-probe.pdf');
  writeFileSync(digitsPath, await renderPersianProbeText(digitsSource));
  const digitsJs = (await extractItems(digitsPath)).map((i) => i.text).join('');
  assert.ok(
    digitsJs.includes(digitsSource),
    `digits lost in pdf.js: ${JSON.stringify(digitsJs)}`,
  );
  record('digits', `pdf.js recovered ${digitsSource}`);

  const mixedPath = join(outDir, 'mixed-probe.pdf');
  writeFileSync(mixedPath, await renderPersianProbeText(MIXED));
  const mixedJs = (await extractItems(mixedPath)).map((i) => i.text).join('');
  assert.ok(mixedJs.includes('SKU'), `Latin SKU lost: ${JSON.stringify(mixedJs)}`);
  assert.ok(mixedJs.includes('کد'), `Persian side lost: ${JSON.stringify(mixedJs)}`);
  record('mixed', `pdf.js: ${JSON.stringify(mixedJs)}`);

  // ---------------------------------------------------------------------------------------
  // 2. Full quotation document
  // ---------------------------------------------------------------------------------------
  const quotationPdf = await renderQuotationPdfSpike(SPIKE_SAMPLE_INPUT);
  writeFileSync(quotationPath, quotationPdf);
  record('artifact', `${quotationPath} (${quotationPdf.length} bytes)`);

  const probe = probePdf(quotationPdf);
  assert.ok(
    probe.runs.length >= 12,
    `expected independent cell runs, got ${probe.runs.length}`,
  );
  record('table-runs', `${probe.runs.length} independent content runs (real columns)`);

  const mupdf = extractWithMuPdf(quotationPath);
  const mupdfText = concatMuPdf(mupdf.lines);
  const pdfJsItems = await extractItems(quotationPath);
  const pdfJsText = pdfJsItems.map((item) => item.text).join('\n');

  assert.ok(mupdfText.includes(ZWNJ), 'MuPDF lost ZWNJ on the quotation');
  assert.ok(
    mupdfText.includes(HALF_SPACED_WORD) ||
      nfkc(mupdfText).includes(HALF_SPACED_WORD),
    `MuPDF missing half-spaced word: ${JSON.stringify(mupdf.lines)}`,
  );
  record('mupdf-zwnj', 'half-space present in MuPDF extraction');

  const pdfJsKeepsZwnj = pdfJsText.includes(ZWNJ);
  record(
    'pdfjs-zwnj',
    pdfJsKeepsZwnj
      ? 'half-space present (browser improved)'
      : 'STRIPPED — pdf.js skips isInvisibleFormatMark (U+200C); browser copy limitation',
  );
  // pdf.js stripping is measured, not asserted: a future pdf.js that keeps ZWNJ is fine.

  assert.ok(
    nfkc(mupdfText).includes(LIGATURE_WORD) || nfkc(pdfJsText).includes(LIGATURE_WORD),
    `ligature word missing after NFKC`,
  );
  record(
    'ligature-doc',
    `NFKC finds ${LIGATURE_WORD} in MuPDF=${nfkc(mupdfText).includes(LIGATURE_WORD)} pdf.js=${nfkc(pdfJsText).includes(LIGATURE_WORD)}`,
  );

  // Character multiset: bidi-split runs (SKU, prices, some descriptions) rarely round-trip as
  // one contiguous extractor string, so substring equality would test layout accidents.
  const required = quotationSourceStrings(SPIKE_SAMPLE_INPUT);
  const expectedChars = required.join('');
  // ZWNJ only from MuPDF; other characters from either extractor.
  const recoveredChars = `${mupdfText}${nfkc(pdfJsText)}`;
  const countChars = (text: string): Map<string, number> => {
    const counts = new Map<string, number>();

    for (const character of text) {
      counts.set(character, (counts.get(character) ?? 0) + 1);
    }

    return counts;
  };
  const expectedCounts = countChars(expectedChars);
  const recoveredCounts = countChars(recoveredChars);
  const shortChars: string[] = [];

  for (const [character, expected] of expectedCounts) {
    if ((recoveredCounts.get(character) ?? 0) < expected) {
      shortChars.push(
        `U+${(character.codePointAt(0) ?? 0).toString(16)}×${expected - (recoveredCounts.get(character) ?? 0)}`,
      );
    }
  }

  assert.deepEqual(shortChars, [], `characters under-recovered: ${shortChars.join(', ')}`);
  record(
    'source-coverage',
    `${expectedCounts.size} distinct source characters, all present across MuPDF+pdf.js`,
  );

  // Half-spaced title/footer must be contiguous in MuPDF (the ZWNJ witness).
  assert.ok(
    mupdfText.includes(HALF_SPACED_WORD),
    'MuPDF must recover the contiguous half-spaced word',
  );

  const firstLine = SPIKE_SAMPLE_INPUT.lines[0];
  const glued = `${firstLine.description}  ${firstLine.quantity}  ${firstLine.unitPrice}`;
  assert.equal(
    pdfJsItems.some((item) => item.text === glued),
    false,
    'table cells were space-joined into one text item',
  );
  // Quantity and price are LTR islands — each is its own Text cell / extraction item.
  assert.ok(
    pdfJsItems.some((item) => item.text === firstLine.quantity),
    'quantity column not an independent text item',
  );
  assert.ok(
    pdfJsItems.some((item) => item.text === firstLine.unitPrice),
    'price column not an independent text item',
  );
  assert.ok(
    pdfJsItems.some((item) => item.text === 'تعداد'),
    'quantity header cell missing',
  );
  assert.ok(
    pdfJsItems.some((item) => item.text === 'مبلغ'),
    'price header cell missing',
  );
  record(
    'columns',
    'header/quantity/price cells extract independently (not space-joined rows)',
  );

  console.log('\nCRM-129-S1-R3 — generation-time Persian PDF text layer\n');

  for (const finding of findings) {
    console.log(`  PASS  ${finding.name.padEnd(20)} ${finding.detail}`);
  }

  console.log(`\nArtifacts in ${outDir}`);
  console.log(
    '\nVERDICT: PARTIAL — generation ToUnicode correct (ZWNJ + ligature presentation forms);\n' +
      'MuPDF extracts half-space; pdf.js (browser) strips U+200C by design.\n',
  );
};

main().catch((error: unknown) => {
  console.error('\nFAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
