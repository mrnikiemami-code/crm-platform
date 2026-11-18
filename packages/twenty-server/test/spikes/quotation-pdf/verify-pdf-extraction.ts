import { readFileSync, writeFileSync } from 'node:fs';

import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

// Verifies the `/ActualText` remedy with an INDEPENDENT consumer.
//
// pdf.js is the extractor every browser PDF viewer uses, and it is not code we wrote, so its
// output is evidence rather than a restatement of our own logic. This script is ESM-only and
// runs through tsx for the same reason the renderer does.
//
// Usage:
//   npx tsx packages/twenty-server/test/spikes/quotation-pdf/verify-pdf-extraction.ts <pdfPath>

export type ExtractedItem = {
  text: string;
  direction: string;
  x: number;
  y: number;
};

export const extractItems = async (
  pdfPath: string,
): Promise<ExtractedItem[]> => {
  const data = new Uint8Array(readFileSync(pdfPath));
  const document = await getDocument({
    data,
    useSystemFonts: false,
    isEvalSupported: false,
  }).promise;

  const items: ExtractedItem[] = [];

  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const content = await page.getTextContent();

    for (const item of content.items) {
      if (!('str' in item) || item.str.trim() === '') {
        continue;
      }

      items.push({
        text: item.str,
        direction: item.dir,
        x: item.transform[4] as number,
        y: item.transform[5] as number,
      });
    }
  }

  return items;
};

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export const toPersianDigits = (input: string): string =>
  input.replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)] ?? digit);

// Multiset of characters, so "nothing was lost" can be asserted independently of order. This is
// the assertion that used to fail: lam-alef collapsed and its second character vanished from a
// per-glyph reconstruction.
export const characterCounts = (text: string): Map<string, number> => {
  const counts = new Map<string, number>();

  for (const character of text) {
    // The zero-width non-joiner is invisible but meaningful, so it is counted, not stripped.
    counts.set(character, (counts.get(character) ?? 0) + 1);
  }

  return counts;
};

const main = async (): Promise<void> => {
  const pdfPath = process.argv[2];

  if (pdfPath === undefined || pdfPath === '') {
    throw new Error('pass the PDF path');
  }

  const items = await extractItems(pdfPath);
  const outputPath = process.argv[3];

  if (outputPath !== undefined && outputPath !== '') {
    writeFileSync(outputPath, JSON.stringify(items, null, 2), 'utf8');
  }

  for (const item of items) {
    console.log(
      `${item.direction.padEnd(3)} x=${String(Math.round(item.x)).padStart(4)} y=${String(
        Math.round(item.y),
      ).padStart(4)}  ${JSON.stringify(item.text)}`,
    );
  }

  console.log('\n--- concatenated in extraction order ---');
  console.log(JSON.stringify(items.map((item) => item.text).join('')));
};

if (process.argv[1]?.includes('verify-pdf-extraction')) {
  main().catch((error: unknown) => {
    console.error('FAILED:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
