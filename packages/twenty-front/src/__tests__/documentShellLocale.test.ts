import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The first paint is the static document, so the default language has to be on
// the <html> tag itself — not only applied later by JavaScript.
const readDocumentShell = (): string => {
  const candidates = [
    join(process.cwd(), 'index.html'),
    join(process.cwd(), 'packages', 'twenty-front', 'index.html'),
  ];

  for (const candidate of candidates) {
    try {
      return readFileSync(candidate, 'utf8');
    } catch {
      continue;
    }
  }

  throw new Error(
    `index.html was not found in any of: ${candidates.join(', ')}`,
  );
};

describe('document shell', () => {
  const shell = readDocumentShell();

  it('declares Persian as the document language', () => {
    expect(shell).toMatch(/<html[^>]*\blang="fa-IR"/);
  });

  it('declares right-to-left layout', () => {
    expect(shell).toMatch(/<html[^>]*\bdir="rtl"/);
  });

  it('does not ship an English default any more', () => {
    expect(shell).not.toMatch(/<html[^>]*\blang="en"/);
  });
});
