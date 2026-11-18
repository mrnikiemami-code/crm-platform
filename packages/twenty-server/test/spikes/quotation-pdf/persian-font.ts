import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

// The Persian PDF spike needs a font whose glyphs cover Arabic script.
//
// THE PRODUCTION FACE IS VAZIRMATN, vendored beside this file with its licence (`fonts/OFL.txt`,
// SIL Open Font License 1.1, Copyright 2015 The Vazirmatn Project Authors). OFL permits embedding
// and redistribution provided the licence travels with the font and no Reserved Font Name is
// declared — the copyright line carries none. The `.ttf` is committed so the proof is reproducible
// in CI instead of depending on whatever face a machine happens to have.
export type ResolvedFont = {
  path: string;
  bytes: Buffer;
};

// Resolved from the working directory rather than `import.meta.url` because this file is typechecked
// under twenty-server's CommonJS config, where `import.meta` is not allowed. Every command in the
// S1-R2 report is run from the repository root, and the error below says so when it is not.
const SPIKE_DIRECTORY = 'packages/twenty-server/test/spikes/quotation-pdf';

const VENDORED_FONT_PATH = join(process.cwd(), SPIKE_DIRECTORY, 'fonts', 'Vazirmatn-Regular.ttf');

// Fallbacks exist only so the spike still runs on a machine where the vendored file was stripped
// (for example a shallow export). A fallback producing a different rendering is exactly why the
// resolved path is REPORTED by the verifier rather than assumed.
const FALLBACK_FONT_PATHS = [
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

  attemptedPaths.push(VENDORED_FONT_PATH);

  if (existsSync(VENDORED_FONT_PATH)) {
    return { path: VENDORED_FONT_PATH, bytes: readFileSync(VENDORED_FONT_PATH) };
  }

  for (const candidatePath of FALLBACK_FONT_PATHS) {
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
