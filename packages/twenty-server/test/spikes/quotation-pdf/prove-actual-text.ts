import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { addActualText, isOriginalPrefixIntact } from './pdf-actual-text';
import { resolvePersianFont } from './persian-font';
import { probePdf } from './pdf-probe';
import {
  SPIKE_SAMPLE_INPUT,
  quotationSourceLines,
  renderQuotationPdfSpike,
} from './render-quotation-pdf';
import { extractItems } from './verify-pdf-extraction';

// CRM-129-S1-R2 feasibility proof for the `/ActualText` remedy (decision D2).
//
// WHO IS THE WITNESS, AND WHY NOT pdf.js: `/ActualText` is honoured by MuPDF and Acrobat and NOT by
// pdf.js, which implements neither `/ActualText` nor `/Artifact` (measured: zero occurrences of
// either in its build, and two behavioural experiments in the S1-R2 report). pdf.js therefore cannot
// witness this claim, and pretending it could would produce a green test that says nothing about the
// mechanism. MuPDF is used as the independent extractor, and pdf.js is measured separately so the
// limitation is reported rather than hidden.
//
// Usage:
//   npx tsx packages/twenty-server/test/spikes/quotation-pdf/prove-actual-text.ts [outDir]

type Finding = { name: string; detail: string };

type MuPdfLine = { visual: string; logical: string };

const findings: Finding[] = [];
const record = (name: string, detail: string): void => {
  findings.push({ name, detail });
};

const ZWNJ = '\u200c';
const HALF_SPACED_WORD = `پیش${ZWNJ}فاکتور`;
const LIGATURE_WORD = 'کالا';
const MISORDERED_LIGATURE = 'کاال';

// Resolved from the working directory because this file is typechecked under twenty-server's
// CommonJS config, where `import.meta` is not allowed. The report's commands run from the repository
// root, and a wrong working directory fails loudly with the path it tried.
const MUPDF_HELPER = join(
  process.cwd(),
  'packages/twenty-server/test/spikes/quotation-pdf/extract-with-mupdf.py',
);

// The polarity matters: MuPDF reverses a pure RTL line, so the reading is `logical` when that
// reversal IS what was written. A Latin-only line (`SKU-4417`) or an already-logical mixed line has
// no matching reversal, so the visual form is kept — reversing it would corrupt it.
const readingsOf = (
  lines: MuPdfLine[],
  sourceLines: readonly string[],
): string[] =>
  lines.map((line) =>
    sourceLines.includes(line.logical) ? line.logical : line.visual,
  );

const extractWithMuPdf = (
  pdfPath: string,
): { pageCount: number; lines: MuPdfLine[] } => {
  const output = execFileSync(
    'python',
    ['-W', 'ignore', MUPDF_HELPER, pdfPath],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 },
  );

  const parsed = JSON.parse(output) as { pageCount: number; lines: MuPdfLine[] };

  return { pageCount: parsed.pageCount, lines: parsed.lines };
};

const characterCounts = (text: string): Map<string, number> => {
  const counts = new Map<string, number>();

  for (const character of text) {
    counts.set(character, (counts.get(character) ?? 0) + 1);
  }

  return counts;
};

const main = async (): Promise<void> => {
  const font = resolvePersianFont();
  record('font', `${font.path.split(/[\\/]/).pop() ?? font.path} (${font.bytes.length} bytes)`);

  const outDir = process.argv[2] ?? mkdtempSync(join(tmpdir(), 'crm129r2-'));
  const sourceLines = quotationSourceLines(SPIKE_SAMPLE_INPUT);
  const sourceText = sourceLines.join('');
  const plainPath = join(outDir, 'quotation-plain.pdf');
  const wrappedPath = join(outDir, 'quotation-actualtext.pdf');

  const plain = await renderQuotationPdfSpike(SPIKE_SAMPLE_INPUT);
  writeFileSync(plainPath, plain);

  // ---------------------------------------------------------------------------------------
  // 1. Baseline with the independent extractor: the defect the remedy answers.
  // ---------------------------------------------------------------------------------------
  const plainExtraction = extractWithMuPdf(plainPath);
  const plainText = readingsOf(plainExtraction.lines, sourceLines).join('\n');

  assert.equal(plainExtraction.pageCount, 1, 'the fixture is a single page');
  assert.ok(plainExtraction.lines.length > 0, 'MuPDF extracted nothing from the fixture');

  const baselineKeepsZwnj = plainText.includes(ZWNJ);
  const baselineKeepsLigature = plainText.includes(LIGATURE_WORD);

  record(
    'baseline',
    `${plainExtraction.lines.length} lines; half-space ${baselineKeepsZwnj ? 'kept' : 'LOST'}; ${LIGATURE_WORD} ${baselineKeepsLigature ? 'intact' : 'BROKEN'}`,
  );

  assert.equal(
    baselineKeepsZwnj,
    false,
    'the plain document already preserved the half-space, so the remedy answers no defect',
  );

  // ---------------------------------------------------------------------------------------
  // 2. Apply the remedy; prove it is additive and glyph-identical.
  // ---------------------------------------------------------------------------------------
  const update = addActualText(plain, sourceLines);
  writeFileSync(wrappedPath, update.buffer);

  assert.equal(
    isOriginalPrefixIntact(plain, update.buffer),
    true,
    'the update rewrote the original document instead of appending to it',
  );
  record(
    'additive',
    `original ${plain.length} bytes kept as an exact prefix; adds ${update.buffer.length - plain.length} bytes`,
  );
  record(
    'spans',
    `${update.wrappedLineCount} lines wrapped, ${update.skippedLineCount} left untouched (drawn as several runs)`,
  );

  const originalProbe = probePdf(plain);
  const wrappedProbe = probePdf(update.buffer);

  assert.deepEqual(
    wrappedProbe.runs.flatMap((run) => run.codes),
    originalProbe.runs.flatMap((run) => run.codes),
    'the remedy changed which glyphs are drawn',
  );
  record(
    'visual identity',
    `${originalProbe.runs.flatMap((run) => run.codes).length} glyph draws identical across ${originalProbe.runs.length} runs`,
  );

  // ---------------------------------------------------------------------------------------
  // 3. The independent, ActualText-aware extractor.
  // ---------------------------------------------------------------------------------------
  const wrappedExtraction = extractWithMuPdf(wrappedPath);
  const wrappedReadings = readingsOf(wrappedExtraction.lines, sourceLines);
  const wrappedText = wrappedReadings.join('\n');

  assert.equal(wrappedExtraction.pageCount, 1, 'the update changed the page count');
  assert.ok(wrappedText.includes(ZWNJ), 'the half-space is still missing after the remedy');
  assert.ok(
    wrappedText.includes(HALF_SPACED_WORD),
    'the exact half-spaced word was not recovered',
  );
  assert.ok(wrappedText.includes(LIGATURE_WORD), 'the lam-alef word was not recovered');

  // NOT asserted as absent. Lines the renderer drew as several runs are left untouched on purpose,
  // so they keep the misordered reconstruction; that is the measured gap this pass does not close,
  // and asserting the defect away would be exactly the kind of green test this task rejects.
  const misorderedStillPresent = wrappedText.includes(MISORDERED_LIGATURE);

  record(
    'misorder',
    misorderedStillPresent
      ? 'still present on lines left untouched (multi-run) — open gap'
      : 'gone from the whole document',
  );

  // The Latin code is checked at document level, not per line: react-pdf draws it as its own run and
  // the exact run it lands on is a layout detail, while LOSING the characters would be a defect — and
  // the character-level check below is what catches that.
  assert.ok(wrappedText.includes('SKU'), 'the Latin code was not preserved');
  record('recovered', 'half-space kept, lam-alef intact, Latin code intact');

  // How many source lines come back verbatim. Reported as a number rather than asserted at 100%,
  // because one line exposes a real limitation: react-pdf splits that row into bidi runs and MuPDF
  // appends a fragment of the split word after the replacement.
  const matchedLines = sourceLines.filter((sourceLine) =>
    wrappedReadings.includes(sourceLine),
  );

  record(
    'line fidelity',
    `${matchedLines.length}/${sourceLines.length} lines verbatim`,
  );

  const unmatched = sourceLines.filter(
    (sourceLine) => !wrappedReadings.includes(sourceLine),
  );

  // Reported as a number, not asserted at 100%: two lines expose a real limitation of this pass.
  // react-pdf splits those lines into bidi runs (`کابل` becomes `ک` + `بل`, and the Latin code is its
  // own run), and MuPDF then places the replacement beside a leaked fragment instead of in place of
  // the whole line. The remedy is correct for a pure-RTL line and incomplete for a bidi-split one;
  // that distinction is the point of measuring rather than asserting.
  assert.equal(
    unmatched.length < sourceLines.length,
    true,
    'not a single line round-tripped, so the remedy did nothing',
  );

  // ---------------------------------------------------------------------------------------
  // 4. No character LOST. Duplication is reported separately; losing a character is the failure
  //    the remedy exists to prevent, so that is what is asserted.
  // ---------------------------------------------------------------------------------------
  const expectedCounts = characterCounts(sourceText);
  const actualCounts = characterCounts(wrappedText);
  const lost: string[] = [];

  for (const [character, expected] of expectedCounts) {
    const actual = actualCounts.get(character) ?? 0;

    if (actual < expected) {
      lost.push(
        `U+${(character.codePointAt(0) ?? 0).toString(16)} x${expected - actual}`,
      );
    }
  }

  // The ONLY character allowed to go missing is the half-space, and only on a line the renderer drew
  // as several runs (which this pass leaves untouched on purpose). Every other character must survive:
  // a lost letter or digit is a defect, a half-space on an unwrapped line is the known scope boundary.
  const lostOtherThanHalfSpace = lost.filter(
    (entry) => !entry.startsWith('U+200c'),
  );

  assert.deepEqual(
    lostOtherThanHalfSpace,
    [],
    `characters lost from the text layer: ${lostOtherThanHalfSpace.join(', ')}`,
  );
  assert.ok(
    lost.length <= 1,
    `more than the single known half-space was lost: ${lost.join(', ')}`,
  );
  record(
    'no loss',
    `${expectedCounts.size} distinct characters; ${
      lost.length === 0 ? 'none lost' : `only the half-space on an unwrapped line (${lost.join(', ')})`
    }`,
  );

  // ---------------------------------------------------------------------------------------
  // 5. pdf.js: measured, so the limitation is a fact rather than a suspicion.
  // ---------------------------------------------------------------------------------------
  const pdfJsPlain = (await extractItems(plainPath)).map((item) => item.text).join('');
  const pdfJsWrapped = (await extractItems(wrappedPath)).map((item) => item.text).join('');

  record(
    'pdf.js',
    `ignores /ActualText: ${pdfJsPlain === pdfJsWrapped ? 'output unchanged' : 'output changed'}; half-space ${pdfJsWrapped.includes(ZWNJ) ? 'kept' : 'still lost'}`,
  );
  assert.equal(
    pdfJsPlain,
    pdfJsWrapped,
    'pdf.js output changed, so it does honour /ActualText after all',
  );

  console.log('\nCRM-129-S1-R2 — /ActualText remedy for Persian extraction\n');

  for (const finding of findings) {
    console.log(`  PASS  ${finding.name.padEnd(16)} ${finding.detail}`);
  }

  if (unmatched.length > 0) {
    console.log(
      `\nKnown limitation (measured): ${unmatched.length} line(s) did not round-trip, both due to a\nbidi-split run:`,
    );

    for (const line of unmatched) {
      console.log(`  ${JSON.stringify(line)}`);
    }
  }

  console.log(`\nArtifacts in ${outDir}\n`);
  console.log('All assertions passed.\n');
};

main().catch((error: unknown) => {
  console.error('\nFAILED:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
