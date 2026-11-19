import * as fontkit from 'fontkit';

import { EmbeddedFont } from '@react-pdf/pdfkit';

import { resolvePersianFont } from 'src/modules/quotation/pdf/persian-font';

// Generation-time text-layer fixes for @react-pdf/renderer + fontkit + pdfkit.
//
// 1) ZWNJ: fontkit.LayoutEngine.hideDefaultIgnorables replaces U+200C with the SPACE
//    glyph after shaping (xAdvance forced to 0). Visual OK; ToUnicode becomes U+0020.
//    Vazirmatn owns a real zero-width ZWNJ glyph — keep it so the CMap stays U+200C.
//
// 2) Arabic lam-alef ligatures: fontkit/pdfkit store ToUnicode as two code points (لا).
//    MuPDF and pdf.js then reverse at CHARACTER granularity for RTL, turning کالا into
//    کاال. Mapping the same glyph to a single Arabic Presentation Forms code point (ﻻ)
//    keeps one-to-one glyph↔character extraction while the drawn outline is unchanged.

type GlyphLike = {
  id: number;
  codePoints: number[];
  advanceWidth: number;
};

type PositionLike = {
  xAdvance: number;
  yAdvance: number;
};

type LayoutEngineLike = {
  hideDefaultIgnorables: (
    glyphs: GlyphLike[],
    positions: PositionLike[],
  ) => void;
  font: {
    glyphForCodePoint: (codePoint: number) => GlyphLike;
  };
  isDefaultIgnorable: (codePoint: number) => boolean;
};

type EmbeddedFontLike = {
  unicode: number[][];
  widths: number[];
  scale: number;
  subset: { includeGlyph: (glyphId: number) => number };
  layout: (
    text: string,
    features?: unknown,
  ) => {
    glyphs: GlyphLike[];
    positions: PositionLike[];
  };
  encode: (text: string, features?: unknown) => [string[], PositionLike[]];
  encodeGlyphs: (glyphs: GlyphLike[]) => string[];
};

let applied = false;

const SEMANTIC_JOINERS = new Set([0x200c, 0x200d]);

const ARABIC_LIGATURE_TO_PRESENTATION = new Map<string, number>([
  [[0x0644, 0x0627].join(','), 0xfefb],
  [[0x0644, 0x0622].join(','), 0xfef5],
  [[0x0644, 0x0623].join(','), 0xfef7],
  [[0x0644, 0x0625].join(','), 0xfef9],
]);

const collapseLigatureCodePoints = (codePoints: number[]): number[] => {
  if (codePoints.length < 2) {
    return codePoints;
  }

  const presentation = ARABIC_LIGATURE_TO_PRESENTATION.get(codePoints.join(','));

  return presentation === undefined ? codePoints : [presentation];
};

const findLayoutEnginePrototype = (): LayoutEngineLike => {
  const font = fontkit.openSync(resolvePersianFont().path);
  const engine = (font as unknown as { _layoutEngine: LayoutEngineLike })
    ._layoutEngine;

  if (
    engine === undefined ||
    typeof engine.hideDefaultIgnorables !== 'function' ||
    typeof engine.isDefaultIgnorable !== 'function'
  ) {
    throw new Error(
      'fontkit LayoutEngine not found on Font; cannot preserve ZWNJ',
    );
  }

  return Object.getPrototypeOf(engine) as LayoutEngineLike;
};

const patchHideDefaultIgnorables = (): void => {
  const prototype = findLayoutEnginePrototype();

  prototype.hideDefaultIgnorables = function hideDefaultIgnorablesPreservingJoiners(
    this: LayoutEngineLike,
    glyphs,
    positions,
  ) {
    const space = this.font.glyphForCodePoint(0x20);

    for (let index = 0; index < glyphs.length; index += 1) {
      const codePoint = glyphs[index].codePoints[0];

      if (!this.isDefaultIgnorable(codePoint)) {
        continue;
      }

      if (SEMANTIC_JOINERS.has(codePoint)) {
        const current = glyphs[index];

        if (current.id !== space.id && current.advanceWidth === 0) {
          positions[index].xAdvance = 0;
          positions[index].yAdvance = 0;
          continue;
        }
      }

      glyphs[index] = space;
      positions[index].xAdvance = 0;
      positions[index].yAdvance = 0;
    }
  };
};

const assignUnicode = (
  embedded: EmbeddedFontLike,
  subsetGid: number,
  glyph: GlyphLike,
): void => {
  if (embedded.widths[subsetGid] == null) {
    embedded.widths[subsetGid] = glyph.advanceWidth * embedded.scale;
  }

  if (embedded.unicode[subsetGid] == null) {
    embedded.unicode[subsetGid] = collapseLigatureCodePoints(glyph.codePoints);
  }
};

const patchEmbeddedFontToUnicode = (): void => {
  const prototype = EmbeddedFont.prototype as unknown as EmbeddedFontLike;

  prototype.encode = function encodeWithCollapsedLigatures(
    this: EmbeddedFontLike,
    text: string,
    features?: unknown,
  ) {
    const { glyphs, positions } = this.layout(text, features);
    const res: string[] = [];

    for (let index = 0; index < glyphs.length; index += 1) {
      const glyph = glyphs[index];
      const subsetGid = this.subset.includeGlyph(glyph.id);

      res.push(`0000${subsetGid.toString(16)}`.slice(-4));
      assignUnicode(this, subsetGid, glyph);
    }

    return [res, positions];
  };

  prototype.encodeGlyphs = function encodeGlyphsWithCollapsedLigatures(
    this: EmbeddedFontLike,
    glyphs: GlyphLike[],
  ) {
    const res: string[] = [];

    for (let index = 0; index < glyphs.length; index += 1) {
      const glyph = glyphs[index];
      const subsetGid = this.subset.includeGlyph(glyph.id);

      res.push(`0000${subsetGid.toString(16)}`.slice(-4));
      assignUnicode(this, subsetGid, glyph);
    }

    return res;
  };
};

export const applyPersianPdfTextLayerFixes = (): void => {
  if (applied) {
    return;
  }

  patchHideDefaultIgnorables();
  patchEmbeddedFontToUnicode();
  applied = true;
};

export const applyFontkitZwnjPreservation = (): void => {
  applyPersianPdfTextLayerFixes();
};

export const isFontkitZwnjPreservationApplied = (): boolean => applied;