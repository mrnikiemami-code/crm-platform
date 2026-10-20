import { HELP_CENTER_BASE_PATH } from 'twenty-shared/constants';

import { getDocumentationUrl } from '@/support/utils/getDocumentationUrl';

describe('getDocumentationUrl', () => {
  it('always returns the same-origin help centre path', () => {
    expect(getDocumentationUrl()).toBe(HELP_CENTER_BASE_PATH);
    expect(getDocumentationUrl({ locale: 'fa-IR' })).toBe(HELP_CENTER_BASE_PATH);
    expect(
      getDocumentationUrl({
        locale: 'fr-FR',
        path: '/developers/extend/apps/getting-started',
      }),
    ).toBe(HELP_CENTER_BASE_PATH);
  });

  it('never returns an absolute external documentation URL', () => {
    const url = getDocumentationUrl({ locale: 'en', path: '/user-guide' });

    expect(url.startsWith('/')).toBe(true);
    expect(url.startsWith('//')).toBe(false);
    expect(url.includes('docs.twenty.com')).toBe(false);
    expect(url.includes('http')).toBe(false);
  });
});
