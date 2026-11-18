import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';

import { PERSIAN_REQUIRED_CODE_POINTS, resolvePersianFont } from './persian-font';
import { probePdf, type TextRun } from './pdf-probe';
import {
  SPIKE_SAMPLE_INPUT,
  renderPersianProbeText,
  renderQuotationPdfSpike,
} from './render-quotation-pdf';

// CRM-129-S1 feasibility proof, run as a script rather than a jest test on
// purpose: @react-pdf/renderer and its whole dependency tree are ESM-only and the
// twenty-server jest config runs CommonJS. Teaching that shared config to
// transform a twenty-package ESM tree (including the yoga-layout WASM build) to
// prove one document renders is a worse trade than one script run through tsx.
//
// Usage:
//   npx tsx packages/twenty-server/test/spikes/quotation-pdf/verify-quotation-pdf.ts [outputPath]
//
// What it claims, and what it refuses to claim:
//   - rendering is correct: glyphs shaped, line laid out right-to-left, digits not
//     mirrored, no .notdef. Each of those is asserted on an atomic single-run
//     document where the answer cannot be ambiguous.
//   - text extraction is USABLE BUT LOSSY. It is measured, not assumed, and the
//     lossy parts are reported with their cause. Rebuilding a full sentence from
//     the content stream is deliberately NOT asserted: the writer splits a line
//     mid-number, so any whole-sentence reconstruction is a heuristic and would
//     be a test of the heuristic rather than of the renderer.

type Finding = { name: string; detail: string };

const findings: Finding[] = [];

const record = (name: string, detail: string): void => {
  findings.push({ name, detail });
};

// The visual order a reader's eye traverses, left to right. No bidi is applied
// here: this is literally what the page shows.
const visualTextOfRun = (
  run: TextRun,
  codeToUnicode: Map<number, string>,
): string => run.codes.map((code) => codeToUnicode.get(code) ?? '\uFFFD').join('');

const codePointsOf = (text: string): number[] =>
  [...text].map((character) => character.codePointAt(0) ?? 0);

const main = async (): Promise<void> => {
  const font = resolvePersianFont();

  record('font', `${font.path} (${font.bytes.length} bytes)`);

  const pdf = await renderQuotationPdfSpike(SPIKE_SAMPLE_INPUT);

  // Written first so the page can be opened even if an assertion below fails.
  const outputPath = process.argv[2];

  if (outputPath !== undefined && outputPath !== '') {
    writeFileSync(outputPath, pdf);
    record('artifact', outputPath);
  }

  const probe = probePdf(pdf);

  assert.equal(pdf.subarray(0, 5).toString('latin1'), '%PDF-');
  assert.ok(pdf.length > 4000, `PDF too small: ${pdf.length} bytes`);
  record('document', `${pdf.length} bytes, ${probe.objects.length} objects`);

  // 1. An embedded subset face, not one of the writer's built-in fonts. A built-in
  //    font cannot encode Persian at all, so this is the precondition for the rest.
  const fontObjects = probe.objects.filter((object) =>
    object.dictionary.includes('/Type /Font'),
  );

  assert.ok(fontObjects.length > 0, 'no font object in the PDF');
  assert.ok(
    fontObjects.some((object) => object.dictionary.includes('/BaseFont /')),
    'no embedded BaseFont found',
  );
  record('embedded font', `${fontObjects.length} font object(s) with BaseFont`);

  // 2. Glyph integrity: no .notdef, and every Persian-only letter has a glyph.
  //    Code 0 is the writer's notdef slot; a letter without a glyph renders as an
  //    empty box that still looks like text in a screenshot.
  const usedCodes = probe.runs.flatMap((run) => run.codes);
  const distinctUsedCodes = new Set(usedCodes);

  assert.ok(usedCodes.length > 20, `too few glyphs drawn: ${usedCodes.length}`);
  assert.equal(distinctUsedCodes.has(0), false, '.notdef glyph was drawn');

  // Font coverage is a property of the FACE, so it is proved on a document that
  // contains every Persian-only letter instead of hoping the sample happens to
  // exercise them all.
  const persianOnlyLetters = PERSIAN_REQUIRED_CODE_POINTS.map((codePoint) =>
    String.fromCodePoint(codePoint),
  ).join('');
  const lettersPdf = await renderPersianProbeText(persianOnlyLetters);
  const lettersProbe = probePdf(lettersPdf);
  const letterCodes = lettersProbe.runs.flatMap((run) => run.codes);
  const mappedLetterCodePoints = new Set(
    letterCodes
      .map((code) => lettersProbe.codeToUnicode.get(code)?.codePointAt(0))
      .filter((codePoint): codePoint is number => codePoint !== undefined),
  );
  const missingRequiredLetters = PERSIAN_REQUIRED_CODE_POINTS.filter(
    (codePoint) => !mappedLetterCodePoints.has(codePoint),
  );

  assert.deepEqual(
    missingRequiredLetters,
    [],
    `Persian-only letters absent: ${missingRequiredLetters.join(',')}`,
  );
  assert.equal(
    new Set(letterCodes).has(0),
    false,
    '.notdef drawn for an Arabic-script letter',
  );
  record(
    'font coverage',
    `all ${PERSIAN_REQUIRED_CODE_POINTS.length} Persian-only letters render (${persianOnlyLetters})`,
  );
  record(
    'glyph integrity',
    `${usedCodes.length} draws in the sample document, 0 .notdef`,
  );

  // 3. Nothing silently stripped: every character of the source text is either
  //    drawn, or is a zero-width joiner the writer drops by design (reported
  //    below as a limitation rather than asserted away).
  const sourceText = [
    SPIKE_SAMPLE_INPUT.title,
    SPIKE_SAMPLE_INPUT.number,
    SPIKE_SAMPLE_INPUT.customerName,
    SPIKE_SAMPLE_INPUT.sku,
    SPIKE_SAMPLE_INPUT.total,
    ...SPIKE_SAMPLE_INPUT.lines.flatMap((line) => [
      line.description,
      line.quantity,
      line.unitPrice,
    ]),
  ].join('');

  const ZERO_WIDTH_NON_JOINER = 0x200c;
  const expectedCodePoints = codePointsOf(sourceText).filter(
    (codePoint) => codePoint !== ZERO_WIDTH_NON_JOINER,
  );
  const drawnCodePoints = usedCodes.map(
    (code) => probe.codeToUnicode.get(code)?.codePointAt(0) ?? -1,
  );

  const countByCodePoint = (codePoints: number[]): Map<number, number> => {
    const counts = new Map<number, number>();

    for (const codePoint of codePoints) {
      counts.set(codePoint, (counts.get(codePoint) ?? 0) + 1);
    }

    return counts;
  };

  const expectedCounts = countByCodePoint(expectedCodePoints);
  const drawnCounts = countByCodePoint(drawnCodePoints);
  const underDrawn: number[] = [];

  for (const [codePoint, expectedCount] of expectedCounts) {
    const drawnCount = drawnCounts.get(codePoint) ?? 0;

    if (drawnCount < expectedCount) {
      underDrawn.push(codePoint);
    }
  }

  assert.deepEqual(
    underDrawn,
    [],
    `characters drawn fewer times than written: ${underDrawn
      .map((codePoint) => `U+${codePoint.toString(16).padStart(4, '0')}`)
      .join(',')}`,
  );
  record(
    'no stripping',
    `${expectedCounts.size} distinct characters, every one drawn at least as often as written`,
  );

  // 4. Extraction fidelity, measured rather than assumed. Some positional glyph
  //    forms are drawn but omitted from the /ToUnicode CMap, so an extracted
  //    document loses those letters. This is a real limitation of the current
  //    writer (documented in the S1 report), not something to hide with a wide
  //    tolerance: the ceiling is pinned so a regression makes it worse visibly.
  const unmappedDraws = usedCodes.filter(
    (code) => probe.codeToUnicode.get(code) === undefined,
  );
  const distinctUnmappedCodes = new Set(unmappedDraws);

  // Pinned, not tolerated: exactly one positional form is currently unlisted. A
  // second one means the writer regressed or a new letter joined the document, and
  // either way the extraction loss stops being a footnote.
  assert.ok(
    distinctUnmappedCodes.size <= 1,
    `${distinctUnmappedCodes.size} distinct glyph forms have no ToUnicode entry`,
  );
  record(
    'extraction fidelity',
    `${(usedCodes.length - unmappedDraws.length)}/${usedCodes.length} draws extractable (${(((usedCodes.length - unmappedDraws.length) / usedCodes.length) * 100).toFixed(1)}%), ${distinctUnmappedCodes.size} unlisted glyph form`,
  );

  // 5. RTL layout, stated where it cannot be ambiguous: on a one-word document the
  //    page must show the logical word reversed, character for character.
  const singleWordPdf = await renderPersianProbeText('کتاب');
  const singleWordProbe = probePdf(singleWordPdf);

  assert.equal(singleWordProbe.runs.length, 1, 'one word must be one run');

  const visualWord = visualTextOfRun(
    singleWordProbe.runs[0],
    singleWordProbe.codeToUnicode,
  );

  assert.equal(
    visualWord,
    [...'کتاب'].reverse().join(''),
    'a right-to-left word must be painted in reverse of its logical order',
  );
  record('rtl layout', `'کتاب' painted as '${visualWord}'`);

  // 6. Digits are NOT mirrored. This is the failure a naive string reversal
  //    produces, and it is the one that silently changes an amount. On a number
  //    document the page must show the digits exactly as written.
  const numberSource = '۱۴۰۳-۰۰۰۱۲۳';
  const numberPdf = await renderPersianProbeText(numberSource);
  const numberProbe = probePdf(numberPdf);
  const visualNumber = visualTextOfRun(
    numberProbe.runs[0],
    numberProbe.codeToUnicode,
  );

  assert.equal(
    visualNumber,
    numberSource,
    'a number must be painted in its own left-to-right order, not reversed',
  );
  record('digits', `'${numberSource}' painted unmirrored`);

  // 7. Contextual shaping: four identical code points must not stay four identical
  //    glyphs. A non-joining renderer would emit one glyph id four times.
  const behPdf = await renderPersianProbeText('بببب');
  const behProbe = probePdf(behPdf);
  const behCodes = behProbe.runs.flatMap((run) => run.codes);
  const behGlyphs = behCodes.filter(
    (code) => behProbe.codeToUnicode.get(code) === '\u0628',
  );
  const positionalForms = new Set(behGlyphs).size;

  assert.equal(behCodes.length, 4, `expected 4 glyphs, got ${behCodes.length}`);
  assert.ok(
    positionalForms >= 3,
    `only ${positionalForms} positional forms for 4 identical letters`,
  );
  record('shaping', `'بببب' -> ${positionalForms} positional forms`);

  console.log('\nCRM-129-S1 — Persian quotation PDF feasibility\n');

  for (const finding of findings) {
    console.log(`  PASS  ${finding.name.padEnd(20)} ${finding.detail}`);
  }

  console.log('\nAll assertions passed.\n');
  console.log(
    'Known limitation (measured, not a failure): the writer omits a few\n' +
      'positional glyph forms from /ToUnicode, so extracted text can drop a\n' +
      'letter (e.g. the medial lam in کالا). Rendering is unaffected.\n',
  );
};

main().catch((error: unknown) => {
  console.error('\nFAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
