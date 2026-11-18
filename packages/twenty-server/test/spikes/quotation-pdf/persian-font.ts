import { existsSync, readFileSync } from 'node:fs';

// The Persian PDF spike needs a font whose glyphs cover Arabic script. No font
// binary is committed: the architect requires a licensing review before a font
// asset enters the repository, so the spike reads a font that is already
// installed on the machine running it and refuses loudly when none is found.
//
// This is deliberately NOT a production font strategy. S2 must pick and vendor a
// redistributable face (Vazirmatn is OFL-1.1) with the licence file beside it.
export type ResolvedFont = {
  path: string;
  bytes: Buffer;
};

// Ordered by preference: Tahoma and Segoe UI both carry the Arabic block and the
// Persian-specific letters (پ چ ژ گ ک ی). DejaVu Sans is the fallback on Linux
// CI images, Arial the fallback on macOS.
const CANDIDATE_FONT_PATHS = [
  'C:/Windows/Fonts/tahoma.ttf',
  'C:/Windows/Fonts/segoeui.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
];

export const PERSIAN_FONT_PATH_ENV_VARIABLE = 'QUOTATION_PDF_SPIKE_FONT';

export class PersianFontUnavailableError extends Error {
  constructor(readonly attemptedPaths: string[]) {
    super(
      `No Persian-capable font found. Set ${PERSIAN_FONT_PATH_ENV_VARIABLE} to a .ttf file whose glyphs include U+067E. Tried: ${attemptedPaths.join(', ')}`,
    );
    this.name = 'PersianFontUnavailableError';
  }
}

export const resolvePersianFont = (): ResolvedFont => {
  const fromEnvironment = process.env[PERSIAN_FONT_PATH_ENV_VARIABLE];
  const attemptedPaths: string[] = [];

  if (fromEnvironment !== undefined && fromEnvironment !== '') {
    attemptedPaths.push(fromEnvironment);

    if (!existsSync(fromEnvironment)) {
      throw new PersianFontUnavailableError(attemptedPaths);
    }

    return { path: fromEnvironment, bytes: readFileSync(fromEnvironment) };
  }

  for (const candidatePath of CANDIDATE_FONT_PATHS) {
    attemptedPaths.push(candidatePath);

    if (existsSync(candidatePath)) {
      return { path: candidatePath, bytes: readFileSync(candidatePath) };
    }
  }

  throw new PersianFontUnavailableError(attemptedPaths);
};

// A font that renders Persian quotation text must cover the Persian-only letters,
// not just the shared Arabic block: پ (U+067E), چ (U+0686), ژ (U+0698), گ (U+06AF)
// and the Persian yeh ک/ی (U+06A9/U+06CC). A face missing these produces .notdef
// boxes that still look like "some text" in a screenshot, which is why the check
// is by code point instead of by eye.
export const PERSIAN_REQUIRED_CODE_POINTS = [
  0x067e, 0x0686, 0x0698, 0x06af, 0x06a9, 0x06cc,
] as const;
