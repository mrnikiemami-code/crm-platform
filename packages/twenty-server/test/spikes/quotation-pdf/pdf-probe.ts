import { inflateSync } from 'node:zlib';

// Reads back the PDF this spike just produced. Two questions must be answered
// from the bytes, not from the source that generated them:
//
//  1. Is every character that went in still reachable? react-pdf writes glyph
//     codes into the content stream and a /ToUnicode CMap that maps them back,
//     so a stripped or unmapped character shows up as a code with no entry.
//  2. Did the renderer place the text right-to-left? A pointer to the answer is
//     the x coordinate of each show-text run: for an RTL line the first logical
//     word must sit at the greatest x.
//
// This is spike tooling: it understands only the subset of PDF that
// @react-pdf/renderer emits for a text-only A4 page (Flate streams, one font,
// `cm`/`q`/`Q`/`Tj`/`TJ`). It is not a general PDF parser and must not be used
// outside a test.

export type PdfObject = {
  id: number;
  dictionary: string;
  stream: Buffer | null;
};

export type TextRun = {
  // Horizontal position of the run's origin, including inherited `cm` offsets.
  x: number;
  codes: number[];
};

export type PdfProbeResult = {
  objects: PdfObject[];
  // code -> unicode string, merged from every /ToUnicode CMap in the document.
  codeToUnicode: Map<number, string>;
  runs: TextRun[];
};

const inflateIfNeeded = (dictionary: string, stream: Buffer): Buffer => {
  if (!dictionary.includes('/FlateDecode')) {
    return stream;
  }

  // pdfkit writes the deflate stream as-is; a corrupt stream means the fixture,
  // not the code under test, is wrong, so let the error escape.
  return inflateSync(stream);
};

export const readPdfObjects = (buffer: Buffer): PdfObject[] => {
  const latin1 = buffer.toString('latin1');
  const objectHeader = /(\d+)\s+0\s+obj\b/g;
  const objects: PdfObject[] = [];

  let match: RegExpExecArray | null;

  while ((match = objectHeader.exec(latin1)) !== null) {
    const id = Number(match[1]);
    const bodyEnd = latin1.indexOf('endobj', match.index);

    if (bodyEnd < 0) {
      break;
    }

    const body = latin1.slice(match.index, bodyEnd);
    const streamKeyword = body.indexOf('stream');

    if (streamKeyword < 0) {
      objects.push({ id, dictionary: body, stream: null });
      continue;
    }

    const dictionary = body.slice(0, streamKeyword);
    const dataStart = body.indexOf('\n', streamKeyword) + 1;
    const dataEnd = body.lastIndexOf('endstream');

    objects.push({
      id,
      dictionary,
      stream: inflateIfNeeded(
        dictionary,
        Buffer.from(body.slice(dataStart, dataEnd), 'latin1'),
      ),
    });
  }

  return objects;
};

// Parses `beginbfchar` pairs. react-pdf emits one bfchar block per subset font and no
// bfrange; a bfrange appearing means the writer changed and this probe needs the same
// change.
//
// A destination may hold SEVERAL code points: Arabic lam-alef is one glyph for two
// characters, and the writer emits `<0008><0644 0627>`. Reading only the first group
// silently drops a character and makes the probe report a mapping as missing when it is
// present — which is exactly the false negative this function used to produce.
export const parseToUnicodeCMaps = (
  objects: PdfObject[],
): Map<number, string> => {
  const codeToUnicode = new Map<number, string>();

  for (const object of objects) {
    if (object.stream === null) {
      continue;
    }

    const cmap = object.stream.toString('latin1');

    if (!cmap.includes('beginbfchar')) {
      continue;
    }

    const block = cmap.slice(
      cmap.indexOf('beginbfchar') + 'beginbfchar'.length,
      cmap.indexOf('endbfchar'),
    );
    const pair = /<([0-9a-fA-F]+)>\s*<((?:[0-9a-fA-F]+\s*)*)>/g;

    let match: RegExpExecArray | null;

    while ((match = pair.exec(block)) !== null) {
      const digits = match[2].replace(/\s+/g, '');
      let text = '';

      for (let index = 0; index + 4 <= digits.length; index += 4) {
        text += String.fromCharCode(parseInt(digits.slice(index, index + 4), 16));
      }

      // An empty destination is a real defect in the writer (a glyph with no code
      // point), so it is recorded as the empty string rather than skipped: the caller
      // must be able to tell "mapped to nothing" from "not mapped at all".
      codeToUnicode.set(parseInt(match[1], 16), text);
    }
  }

  return codeToUnicode;
};

const TRANSLATE_OPERATOR = /^\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+cm\s*$/;
const SHOW_TEXT_OPERATOR = /\[(.*?)\]\s*TJ|<([0-9a-fA-F\s]+)>\s*Tj/g;
const HEX_STRING = /<([0-9a-fA-F\s]+)>/g;

// Walks the content stream, keeping a stack of accumulated x translations so each
// show-text run can be attributed to a position on the page. Only horizontal
// translation is tracked: the document under test uses `cm` for positioning and
// nothing that would rotate or shear the text matrix.
export const extractTextRuns = (content: string): TextRun[] => {
  const runs: TextRun[] = [];
  const translationStack: number[] = [];
  let currentX = 0;

  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();

    if (line === 'q') {
      translationStack.push(currentX);
      continue;
    }

    if (line === 'Q') {
      currentX = translationStack.pop() ?? 0;
      continue;
    }

    if (line === 'BT' || line === 'ET') {
      continue;
    }

    const translate = TRANSLATE_OPERATOR.exec(line);

    if (translate !== null) {
      currentX += Number(translate[5]);
      continue;
    }

    let show = SHOW_TEXT_OPERATOR.exec(line);

    while (show !== null) {
      const codes: number[] = [];
      const hexStrings = show[1] ?? show[2] ?? '';
      let hex = HEX_STRING.exec(hexStrings);

      while (hex !== null) {
        const digits = hex[1].replace(/\s+/g, '');

        for (let index = 0; index + 4 <= digits.length; index += 4) {
          codes.push(parseInt(digits.slice(index, index + 4), 16));
        }

        hex = HEX_STRING.exec(hexStrings);
      }

      if (codes.length > 0) {
        runs.push({ x: currentX, codes });
      }

      HEX_STRING.lastIndex = 0;
      show = SHOW_TEXT_OPERATOR.exec(line);
    }

    SHOW_TEXT_OPERATOR.lastIndex = 0;
  }

  return runs;
};

export const probePdf = (buffer: Buffer): PdfProbeResult => {
  const objects = readPdfObjects(buffer);
  const contentObject = objects.find(
    (object) =>
      object.stream !== null &&
      object.stream.toString('latin1').includes('BT') &&
      object.stream.toString('latin1').includes('TJ'),
  );

  if (contentObject?.stream === undefined || contentObject.stream === null) {
    throw new Error('No page content stream found in the produced PDF.');
  }

  return {
    objects,
    codeToUnicode: parseToUnicodeCMaps(objects),
    runs: extractTextRuns(contentObject.stream.toString('latin1')),
  };
};

// Rebuilds the reading order a person sees. react-pdf writes each RTL run in VISUAL
// order (leftmost glyph first), so the GLYPH sequence is reversed to recover logical
// order, and runs are visited from the rightmost to the leftmost because that is the
// order an RTL reader consumes them.
//
// Reversal happens per GLYPH, never per code point. Arabic lam-alef is one glyph for
// two characters; reversing its two code points as well would spell «ال» instead of
// «لا», which is the mirror-image mistake this comment exists to prevent.
//
// Runs are fully RTL here: the probe is only used on an all-Persian document, and a
// mixed-direction line would need the per-glyph bidi levels the writer does not expose.
// This is therefore a probe helper, not a general PDF text extractor.
export const readLogicalTextRightToLeft = (
  runs: TextRun[],
  codeToUnicode: Map<number, string>,
): string => {
  const decodeGlyphReversed = (codes: number[]): string =>
    [...codes]
      .reverse()
      .map((code) => codeToUnicode.get(code) ?? '')
      .join('');

  return [...runs]
    .sort((left, right) => right.x - left.x)
    .map((run) => decodeGlyphReversed(run.codes))
    .join('');
};

// Total character multiset of everything painted, independent of order. This is the
// order-insensitive companion to the reading-order helper: it proves "no character was
// lost", which is exactly what a multi-code-point glyph makes ambiguous if you only look
// at a reconstructed sentence.
export const collectDrawnCodePoints = (
  runs: TextRun[],
  codeToUnicode: Map<number, string>,
): number[] =>
  runs
    .flatMap((run) => run.codes)
    .flatMap((code) => [...(codeToUnicode.get(code) ?? '')])
    .map((character) => character.codePointAt(0) ?? 0);
