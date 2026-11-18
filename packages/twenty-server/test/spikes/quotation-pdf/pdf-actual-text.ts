import { deflateSync } from 'node:zlib';

import { readPdfObjects, type PdfObject } from './pdf-probe';

// Adds `/ActualText` to a PDF produced by @react-pdf/renderer, WITHOUT touching the original
// bytes.
//
// WHY THIS IS NEEDED AT ALL: shaping a Persian word means the writer draws one glyph for
// several characters (Arabic lam-alef is one glyph for `لا`) and, for both Tahoma and
// Vazirmatn, maps a zero-width non-joiner to a space glyph. The visible page is correct; a
// consumer that recovers text from glyph codes reconstructs `کاال` and `پیش فاکتور`. `/ActualText`
// is the PDF-standard way to state the logical string for a run of glyphs, so a conformant
// extractor does not have to infer it.
//
// WHY AN INCREMENTAL UPDATE: the original objects are left byte-for-byte intact. The update
// appends a new content stream and a new definition of the page that points at it, then a new
// xref section chained with `/Prev`. A reader that ignores `/ActualText` renders the same page;
// a reader that reads it gets the exact logical text. Nothing is re-encoded, so the embedded
// font subset, the shaping and every coordinate stay exactly as they were.

// A run is wrapped individually rather than per line: a table row mixes an RTL description with
// an LTR price cell, and one replacement string for the whole line would have to guess the bidi
// order of unrelated cells.
const RTL_CODE_POINT_RANGES: [number, number][] = [
  [0x0600, 0x06ff], // Arabic
  [0x0750, 0x077f], // Arabic Supplement
  [0xfb50, 0xfdff], // Arabic Presentation Forms-A
  [0xfe70, 0xfeff], // Arabic Presentation Forms-B
];

const isRightToLeftCharacter = (codePoint: number): boolean =>
  RTL_CODE_POINT_RANGES.some(
    ([from, to]) => codePoint >= from && codePoint <= to,
  );

export type WrappedRun = {
  // What the glyphs actually say, in visual order.
  visual: string;
  // What a reader should get: the logical string for this run.
  logical: string;
};

// The logical text of one run: expand every glyph's code points in order, then reverse the
// GLYPH order for an RTL run. Reversing per code point would spell `ال` instead of `لا`.
export const toLogicalRunText = (
  codes: number[],
  codeToUnicode: Map<number, string>,
): WrappedRun => {
  const glyphTexts = codes.map((code) => codeToUnicode.get(code) ?? '');
  const visual = glyphTexts.join('');
  const isRightToLeft = [...visual].some((character) =>
    isRightToLeftCharacter(character.codePointAt(0) ?? 0),
  );

  return {
    visual,
    logical: isRightToLeft ? [...glyphTexts].reverse().join('') : visual,
  };
};

// `/ActualText` takes a UTF-16BE string with a byte-order mark, written as a hex string so no
// escaping rule can corrupt a character.
export const toActualTextHexString = (text: string): string => {
  let hex = 'FEFF';

  for (let index = 0; index < text.length; index += 1) {
    hex += text.charCodeAt(index).toString(16).padStart(4, '0').toUpperCase();
  }

  return `<${hex}>`;
};

const TRANSLATE = /^\s*(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+cm\s*$/;
const SHOW_TEXT = /\bT[Jj]\s*$/;
const HEX_STRING = /<([0-9a-fA-F\s]+)>/g;

const codesOfShowTextOperator = (line: string): number[] => {
  const codes: number[] = [];
  let hex = HEX_STRING.exec(line);

  while (hex !== null) {
    const digits = hex[1].replace(/\s+/g, '');

    for (let index = 0; index + 4 <= digits.length; index += 4) {
      codes.push(parseInt(digits.slice(index, index + 4), 16));
    }

    hex = HEX_STRING.exec(line);
  }

  HEX_STRING.lastIndex = 0;

  return codes;
};

export type ActualTextWrapResult = {
  content: string;
  wrappedLineCount: number;
  /** Lines left byte-for-byte untouched because they were drawn as several runs. */
  skippedLineCount: number;
};

// A byte-order-mark-only string for the second and later runs of a line: MuPDF treats it as a
// replacement that renders nothing, which is what is wanted because the line's text was already
// stated by the first run.
//
// An EMPTY string (`<>`) was tried first and is NOT equivalent — MuPDF falls back to the glyph text
// for it, so every other cell of a table row leaked. Measured, not assumed.
const EMPTY_ACTUAL_TEXT_HEX = '<FEFF>';

// Wraps EVERY text-showing operator in its own `/Span`, closing it immediately. A visual line is
// usually drawn as several runs (a table row is three cells, and bidi can split one cell into two),
// and only the first run of a line carries the line's logical text; the rest get an empty
// replacement so the extractor cannot emit the glyph-derived text a second time.
//
// WHY EACH RUN IS CLOSED IMMEDIATELY: a span that stays open across `ET`/`Q`/`q` crosses text objects
// and graphics-state boundaries, and MuPDF then emits both the replacement and the glyph text. One
// balanced span per operator is what both conformant readers accept without duplication.
//
// WHY THE SOURCE AND NOT THE GLYPHS: a glyph cannot carry a character the font never encoded. Both
// Tahoma and Vazirmatn map the zero-width non-joiner to the SAME glyph as a space (measured: code 7
// is `U+0020` for both), so no glyph-level trick can recover `U+200C` — it has to be supplied by the
// layer that knows what it drew.
export const wrapContentStreamWithLineActualText = (
  content: string,
  sourceLines: readonly string[],
): ActualTextWrapResult => {
  const lines = content.split('\n');

  // Pass 1: locate every text run and group runs into visual lines by their accumulated y.
  const stateStack: { x: number; y: number }[] = [];
  let currentX = 0;
  let currentY = 0;
  let currentLineY: number | null = null;
  let lineIndex = -1;
  const groups: { index: number; x: number; lineIndex: number }[] = [];

  lines.forEach((line, index) => {
    const trimmed = line.trim();

    if (trimmed === 'q') {
      stateStack.push({ x: currentX, y: currentY });

      return;
    }

    if (trimmed === 'Q') {
      const restored = stateStack.pop() ?? { x: 0, y: 0 };
      currentX = restored.x;
      currentY = restored.y;

      return;
    }

    const translate = TRANSLATE.exec(trimmed);

    if (translate !== null) {
      currentX += Number(translate[5]);
      currentY += Number(translate[6]);

      return;
    }

    if (!SHOW_TEXT.test(trimmed)) {
      return;
    }

    // Half a point is narrower than any line spacing this document uses, and wide enough that
    // floating-point drift inside one line cannot split it.
    if (currentLineY === null || Math.abs(currentY - currentLineY) > 0.5) {
      lineIndex += 1;
      currentLineY = currentY;
    }

    groups.push({ index, x: currentX, lineIndex });
  });

  if (lineIndex + 1 !== sourceLines.length) {
    throw new Error(
      `the document drew ${lineIndex + 1} visual lines but ${sourceLines.length} source lines were supplied; refusing to attach the wrong text`,
    );
  }

  // Pass 2: every run gets its own span. The line's text goes on the line's FIRST run; every other run
  // of the same line gets a byte-order-mark-only replacement, which MuPDF treats as "this content
  // produces no text".
  //
  // WHY PER-RUN AND NOT ONE SPAN PER LINE: a single span covering a whole line was measured to leak a
  // fragment from the run after the span closed (a trailing digit or letter appeared after the correct
  // text). Closing each span on the operator it wraps keeps the marked content balanced inside one text
  // object, which is what both readers accept without duplication.
  //
  // WHY THE BOM AND NOT AN EMPTY STRING: an EMPTY `/ActualText` makes MuPDF fall back to the glyph text,
  // so every other run of a line leaked. Measured, not assumed.
  const output: string[] = [];
  const groupByIndex = new Map(groups.map((group) => [group.index, group]));
  const seenLines = new Set<number>();
  let suppressedRunCount = 0;

  lines.forEach((line, index) => {
    const group = groupByIndex.get(index);

    if (group === undefined) {
      output.push(line);

      return;
    }

    const isCarrier = !seenLines.has(group.lineIndex);

    if (isCarrier) {
      seenLines.add(group.lineIndex);
    } else {
      suppressedRunCount += 1;
    }

    output.push(
      `/Span <</ActualText ${
        isCarrier ? toActualTextHexString(sourceLines[group.lineIndex] ?? '') : EMPTY_ACTUAL_TEXT_HEX
      }>> BDC`,
    );
    output.push(line);
    output.push('EMC');
  });

  return {
    content: output.join('\n'),
    wrappedLineCount: seenLines.size,
    skippedLineCount: suppressedRunCount,
  };
};

const PDF_HEADER_TRAILER = 'trailer';
const XREF_KEYWORD = '\nxref\n';

// The offset the existing `startxref` points at, which the new trailer must chain to.
const readPreviousXrefOffset = (latin1: string): number => {
  const at = latin1.lastIndexOf('startxref');

  if (at < 0) {
    throw new Error('the document has no startxref; refusing to guess its layout');
  }

  const match = /startxref\s+(\d+)/.exec(latin1.slice(at));

  if (match === null) {
    throw new Error('startxref carries no offset');
  }

  return Number(match[1]);
};

const readTrailerRoot = (latin1: string): string => {
  const at = latin1.lastIndexOf(PDF_HEADER_TRAILER);

  if (at < 0) {
    throw new Error('the document has no trailer');
  }

  const trailer = latin1.slice(at, latin1.indexOf('startxref', at));
  const root = /\/Root\s+(\d+\s+\d+\s+R)/.exec(trailer);

  if (root === null) {
    throw new Error('the trailer names no /Root');
  }

  return root[1];
};

const readTrailerInfo = (latin1: string): string | null => {
  const at = latin1.lastIndexOf(PDF_HEADER_TRAILER);
  const trailer = latin1.slice(at, latin1.indexOf('startxref', at));
  const info = /\/Info\s+(\d+\s+\d+\s+R)/.exec(trailer);

  return info === null ? null : info[1];
};

const readTrailerId = (latin1: string): string | null => {
  const at = latin1.lastIndexOf(PDF_HEADER_TRAILER);
  const trailer = latin1.slice(at, latin1.indexOf('startxref', at));
  const id = /\/ID\s*(\[[^\]]*\])/.exec(trailer);

  return id === null ? null : id[1];
};

const findPageObject = (objects: PdfObject[]): PdfObject => {
  const page = objects.find((object) => /\/Type\s*\/Page[^s]/.test(object.dictionary));

  if (page === undefined) {
    throw new Error('no /Type /Page object found');
  }

  return page;
};

const findContentObjectId = (page: PdfObject): number => {
  const single = /\/Contents\s+(\d+)\s+\d+\s+R/.exec(page.dictionary);

  if (single !== null) {
    return Number(single[1]);
  }

  const array = /\/Contents\s*\[\s*(\d+)\s+\d+\s+R/.exec(page.dictionary);

  if (array !== null) {
    return Number(array[1]);
  }

  throw new Error('could not find the page content stream reference');
};

const buildStreamObject = (id: number, content: Buffer): Buffer => {
  const compressed = deflateSync(content);
  const header = `${id} 0 obj\n<< /Length ${compressed.length} /Filter /FlateDecode >>\nstream\n`;

  return Buffer.concat([
    Buffer.from(header, 'latin1'),
    compressed,
    Buffer.from('\nendstream\nendobj\n', 'latin1'),
  ]);
};

const formatXrefEntry = (offset: number): string =>
  `${offset.toString().padStart(10, '0')} 00000 n \n`;

export type ActualTextUpdateResult = {
  buffer: Buffer;
  wrappedLineCount: number;
  /** Runs whose line had already been given its text, so this run contributes nothing. */
  skippedLineCount: number;
  newContentObjectId: number;
  pageObjectId: number;
};

// Applies the `/ActualText` remedy: the line-level replacement strings, through the generic
// incremental-update machinery.
export const addActualText = (
  original: Buffer,
  sourceLines: readonly string[],
): ActualTextUpdateResult => {
  let wrappedLineCount = 0;
  let skippedLineCount = 0;

  const { buffer, pageObjectId, newContentObjectId } = rewriteContentStream(
    original,
    (content) => {
      const wrapped = wrapContentStreamWithLineActualText(content, sourceLines);
      wrappedLineCount = wrapped.wrappedLineCount;
      skippedLineCount = wrapped.skippedLineCount;

      return wrapped.content;
    },
  );

  return {
    buffer,
    wrappedLineCount,
    skippedLineCount,
    pageObjectId,
    newContentObjectId,
  };
};
export const rewriteContentStream = (
  original: Buffer,
  transform: (content: string) => string,
): { buffer: Buffer; pageObjectId: number; newContentObjectId: number } => {
  const latin1 = original.toString('latin1');
  const objects = readPdfObjects(original);
  const page = findPageObject(objects);
  const contentObjectId = findContentObjectId(page);
  const contentObject = objects.find((object) => object.id === contentObjectId);

  if (contentObject?.stream === null || contentObject?.stream === undefined) {
    throw new Error('the page content stream could not be decoded');
  }

  const rewritten = transform(contentObject.stream.toString('latin1'));

  const maxObjectId = objects.reduce(
    (highest, object) => Math.max(highest, object.id),
    0,
  );
  const newContentObjectId = maxObjectId + 1;

  // The page is redefined only to point at the new content stream; every other entry of its
  // dictionary is copied verbatim.
  const pageDictionary = page.dictionary
    .slice(page.dictionary.indexOf('<<') + 2, page.dictionary.lastIndexOf('>>'))
    .replace(/\/Contents\s+(\[[^\]]*\]|\d+\s+\d+\s+R)/, `/Contents ${newContentObjectId} 0 R`)
    .replace(/\s+/g, ' ')
    .trim();

  const parts: Buffer[] = [original];
  let cursor = original.length;
  const offsets = new Map<number, number>();

  const append = (buffer: Buffer): void => {
    parts.push(buffer);
    cursor += buffer.length;
  };

  // Two redefinitions, written in ascending object order so the xref subsections stay simple.
  const definitions: { id: number; buffer: Buffer }[] = [
    {
      id: page.id,
      buffer: Buffer.from(`${page.id} 0 obj\n<< ${pageDictionary} >>\nendobj\n`, 'latin1'),
    },
    {
      id: newContentObjectId,
      buffer: buildStreamObject(
        newContentObjectId,
        Buffer.from(rewritten, 'latin1'),
      ),
    },
  ].sort((left, right) => left.id - right.id);

  for (const definition of definitions) {
    offsets.set(definition.id, cursor);
    append(definition.buffer);
  }

  const xrefOffset = cursor;
  let xref = 'xref\n';

  for (const definition of definitions) {
    xref += `${definition.id} 1\n${formatXrefEntry(offsets.get(definition.id) ?? 0)}`;
  }

  const previousXref = readPreviousXrefOffset(latin1);
  const root = readTrailerRoot(latin1);
  const info = readTrailerInfo(latin1);
  const id = readTrailerId(latin1);

  xref += 'trailer\n<<\n';
  xref += `/Size ${newContentObjectId + 1}\n`;
  xref += `/Root ${root}\n`;

  if (info !== null) {
    xref += `/Info ${info}\n`;
  }

  if (id !== null) {
    xref += `/ID ${id}\n`;
  }

  // /Prev is what makes this ADDITIVE: the reader follows the chain and sees both the original
  // and the replaced definitions.
  xref += `/Prev ${previousXref}\n>>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  append(Buffer.from(xref, 'latin1'));

  return {
    buffer: Buffer.concat(parts),
    newContentObjectId,
    pageObjectId: page.id,
  };
};

// Sanity check that the incremental update did not disturb the original prefix. Used by the test
// to prove the change is additive rather than a re-serialisation.
export const isOriginalPrefixIntact = (
  original: Buffer,
  updated: Buffer,
): boolean =>
  updated.length > original.length &&
  updated.subarray(0, original.length).equals(original);

export { XREF_KEYWORD as XREF_MARKER };
