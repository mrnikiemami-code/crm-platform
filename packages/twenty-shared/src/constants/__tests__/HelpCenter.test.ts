import {
  findHelpArticle,
  getHelpArticlePath,
  HELP_ARTICLES,
  HELP_CENTER_BASE_PATH,
  normalizeHelpSearchText,
  searchHelpArticles,
} from '@/constants/HelpCenter';

// Behaviour of the local help centre. These are the acceptance rows that can be
// proven as pure logic (A: four real topics, B: direct path, C: Persian search
// normalization, empty and no-result). The remaining rows need the browser and
// the server tool, and are proven there.

describe('help content', () => {
  it('has the four required practical topics', () => {
    expect(HELP_ARTICLES.map((article) => article.slug)).toEqual([
      'create-template',
      'edit-and-save',
      'source-and-variables',
      'preview-and-save-errors',
    ]);
  });

  it('gives every topic real body text, not a placeholder', () => {
    for (const article of HELP_ARTICLES) {
      expect(article.title.length).toBeGreaterThan(0);
      expect(article.summary.length).toBeGreaterThan(20);
      expect(article.paragraphs.length).toBeGreaterThanOrEqual(4);
      // A paragraph that is only a few characters is not usable help.
      for (const paragraph of article.paragraphs) {
        expect(paragraph.length).toBeGreaterThan(40);
      }
    }
  });

  it('uses unique slugs so a path can never resolve to two articles', () => {
    const slugs = HELP_ARTICLES.map((article) => article.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('keeps every help path same-origin and root-absolute', () => {
    expect(HELP_CENTER_BASE_PATH.startsWith('/')).toBe(true);
    expect(HELP_CENTER_BASE_PATH.startsWith('//')).toBe(false);

    for (const article of HELP_ARTICLES) {
      const path = getHelpArticlePath(article.slug);
      expect(path).toBe(`/help/${article.slug}`);
      // No scheme, no host: a link built from this can never leave the app.
      expect(path).not.toMatch(/^[a-z]+:/i);
      expect(path).not.toContain('//');
    }
  });

  it('resolves a known slug and refuses an unknown one', () => {
    expect(findHelpArticle('edit-and-save')?.title).toBe('ویرایش و ذخیره');
    // An unknown slug must be null, so the page can say "not found" instead of
    // silently serving an unrelated article.
    expect(findHelpArticle('does-not-exist')).toBeNull();
    expect(findHelpArticle('')).toBeNull();
  });
});

describe('Persian search normalization', () => {
  it('treats Arabic and Persian letter variants as the same letter', () => {
    expect(normalizeHelpSearchText('علي')).toBe(normalizeHelpSearchText('علی'));
    expect(normalizeHelpSearchText('كيف')).toBe(normalizeHelpSearchText('کیف'));
    expect(normalizeHelpSearchText('آزمون')).toBe(
      normalizeHelpSearchText('ازمون'),
    );
  });

  it('folds Persian and Arabic digits to ASCII', () => {
    expect(normalizeHelpSearchText('۰۱۶۹')).toBe('0169');
    expect(normalizeHelpSearchText('٠١٦٩')).toBe('0169');
  });

  it('collapses the half-space and ordinary whitespace', () => {
    expect(normalizeHelpSearchText('پیش‌نمایش')).toBe('پیش نمایش');
    expect(normalizeHelpSearchText('  پیش   نمایش  ')).toBe('پیش نمایش');
  });

  it('strips diacritics that a reader would not type', () => {
    expect(normalizeHelpSearchText('مُتَن')).toBe('متن');
  });

  it('is case-insensitive for Latin text', () => {
    expect(normalizeHelpSearchText('PREVIEW')).toBe('preview');
  });
});

describe('local search contract', () => {
  it('returns the whole list for an empty query instead of failing', () => {
    expect(searchHelpArticles('')).toHaveLength(HELP_ARTICLES.length);
    expect(searchHelpArticles('   ')).toHaveLength(HELP_ARTICLES.length);
    // Browsing is not an error and not an empty result.
    expect(searchHelpArticles('').every((result) => result.href.startsWith('/help/'))).toBe(true);
  });

  it('returns an empty array — successfully — when nothing matches', () => {
    expect(searchHelpArticles('zzzz-no-such-topic-zzzz')).toEqual([]);
  });

  it('finds an article by a Persian word from its body', () => {
    // «مجموعه» appears only inside an article body, never in a title.
    const results = searchHelpArticles('مجموعه');
    expect(results.length).toBeGreaterThan(0);
    expect(results.map((result) => result.slug)).toContain(
      'source-and-variables',
    );
  });

  it('matches a query whose spelling differs from the content only by ZWNJ', () => {
    // The library writes «پیش‌نمایش» with a half-space; the reader types the same
    // words with an ordinary space (or none at all). Both must match.
    const withSpace = searchHelpArticles('پیش نمایش');
    const withZwnj = searchHelpArticles('پیش‌نمایش');

    expect(withSpace.map((result) => result.slug)).toContain(
      'preview-and-save-errors',
    );
    expect(withZwnj.map((result) => result.slug)).toEqual(
      withSpace.map((result) => result.slug),
    );
  });

  it('find by the Arabic spelling of a Persian word in the content', () => {
    // The library says «پیش‌نمایش»; the query uses an Arabic yeh and a space.
    const results = searchHelpArticles('پيش نمايش');
    expect(results.map((result) => result.slug)).toContain(
      'preview-and-save-errors',
    );
  });

  it('ranks a title match above a body match', () => {
    const results = searchHelpArticles('ویرایش');
    expect(results[0].slug).toBe('edit-and-save');
  });

  it('returns usable excerpts and same-origin links for every hit', () => {
    for (const result of searchHelpArticles('الگو')) {
      expect(result.excerpt.length).toBeGreaterThan(0);
      expect(result.href).toBe(`/help/${result.slug}`);
      expect(result.href).not.toMatch(/^[a-z]+:/i);
    }
  });

  it('never returns HTML, so a caller cannot inject markup from content', () => {
    for (const article of HELP_ARTICLES) {
      expect(article.title).not.toContain('<');
      expect(article.summary).not.toContain('<');
      for (const paragraph of article.paragraphs) {
        expect(paragraph).not.toContain('<');
      }
    }
  });
});
