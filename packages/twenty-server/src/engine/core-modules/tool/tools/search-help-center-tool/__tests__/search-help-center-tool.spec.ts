import { Test } from '@nestjs/testing';

import {
  HELP_ARTICLES,
  HELP_CENTER_BASE_PATH,
  searchHelpArticles,
} from 'twenty-shared/constants';

import { SearchHelpCenterTool } from 'src/engine/core-modules/tool/tools/search-help-center-tool/search-help-center-tool';

describe('SearchHelpCenterTool', () => {
  let tool: SearchHelpCenterTool;
  const fetchSpy = jest.spyOn(global, 'fetch');

  beforeEach(async () => {
    fetchSpy.mockClear();

    const moduleRef = await Test.createTestingModule({
      providers: [SearchHelpCenterTool],
    }).compile();

    tool = moduleRef.get(SearchHelpCenterTool);
  });

  afterAll(() => {
    fetchSpy.mockRestore();
  });

  const context = {} as never;

  it('returns the same catalog the shared module exposes for an empty query', async () => {
    const output = await tool.execute({ query: '' }, context);

    expect(output.success).toBe(true);
    expect(output.result).toEqual(searchHelpArticles(''));
    expect(Array.isArray(output.result) && output.result.length).toBe(
      HELP_ARTICLES.length,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns title/excerpt/href for a Persian query without any HTTP', async () => {
    const output = await tool.execute({ query: 'ط³ط§ط®طھ ط§ظ„ع¯ظˆ' }, context);

    expect(output.success).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();

    const results = output.result as Array<{
      slug: string;
      title: string;
      href: string;
      excerpt: string;
    }>;

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].slug).toBe('create-template');
    expect(results[0].title).toBe('ط³ط§ط®طھ ط§ظ„ع¯ظˆغŒ ظ¾غŒط§ظ…');
    expect(results[0].href).toBe(`${HELP_CENTER_BASE_PATH}/create-template`);
    expect(results[0].href.startsWith('http')).toBe(false);
    expect(typeof results[0].excerpt).toBe('string');
  });

  it('returns a successful empty list for a query with no match', async () => {
    const output = await tool.execute(
      { query: 'ظ…ظˆط¶ظˆط¹غŒ ع©ظ‡ ظˆط¬ظˆط¯ ظ†ط¯ط§ط±ط¯ xyzzy' },
      context,
    );

    expect(output.success).toBe(true);
    expect(output.result).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('folds Arabic/Persian letter variants the same way as the shared search', async () => {
    // Arabic yeh (ظٹ) in آ«ظˆغŒط±ط§غŒط´آ» â€” must match the Persian title after folding.
    const arabicYeQuery = 'ظˆظٹط±ط§ظٹط´';
    const output = await tool.execute({ query: arabicYeQuery }, context);
    const shared = searchHelpArticles(arabicYeQuery);

    expect(output.success).toBe(true);
    expect(output.result).toEqual(shared);
    expect(
      (output.result as Array<{ slug: string }>).some(
        (result) => result.slug === 'edit-and-save',
      ),
    ).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
