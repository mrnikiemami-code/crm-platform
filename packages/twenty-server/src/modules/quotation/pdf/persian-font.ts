import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type ResolvedFont = {
  path: string;
  bytes: Buffer;
};

// Prefer the module-local copy (ships with dist for Dev/docker), then the spike
// path when running from the repo root. CommonJS cannot use import.meta.url.
const MODULE_LOCAL_FONT_PATH = join(__dirname, 'fonts', 'Vazirmatn-Regular.ttf');

const SPIKE_FONT_PATH = join(
  process.cwd(),
  'packages/twenty-server/test/spikes/quotation-pdf/fonts/Vazirmatn-Regular.ttf',
);

const FALLBACK_FONT_PATHS = [
  'C:/Windows/Fonts/tahoma.ttf',
  'C:/Windows/Fonts/segoeui.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
  '/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf',
  '/System/Library/Fonts/Supplemental/Arial.ttf',
];

export const PERSIAN_FONT_PATH_ENV_VARIABLE = 'QUOTATION_PDF_FONT';

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

  for (const candidatePath of [
    MODULE_LOCAL_FONT_PATH,
    SPIKE_FONT_PATH,
    ...FALLBACK_FONT_PATHS,
  ]) {
    attemptedPaths.push(candidatePath);

    if (existsSync(candidatePath)) {
      return { path: candidatePath, bytes: readFileSync(candidatePath) };
    }
  }

  throw new PersianFontUnavailableError(attemptedPaths);
};

export const PERSIAN_REQUIRED_CODE_POINTS = [
  0x067e, 0x0686, 0x0698, 0x06af, 0x06a9, 0x06cc,
] as const;
