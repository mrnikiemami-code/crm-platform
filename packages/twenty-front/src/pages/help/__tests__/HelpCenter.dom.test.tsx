import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { HELP_ARTICLES } from 'twenty-shared/constants';

import { HelpArticleRoute } from '~/pages/help/HelpArticleRoute';
import { HelpIndexPage } from '~/pages/help/HelpIndexPage';

jest.mock('@/ui/utilities/page-title/components/PageTitle', () => ({
  PageTitle: () => null,
}));

// BI-01 review R4: DOM/navigation evidence for the help centre, not source
// attributes. These render the real pages through a router.
const renderHelpRoute = (initialEntry: string) =>
  render(
    <I18nProvider i18n={i18n}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/help" element={<HelpIndexPage />} />
          <Route path="/help/:helpArticleSlug" element={<HelpArticleRoute />} />
        </Routes>
      </MemoryRouter>
    </I18nProvider>,
  );

const getSlugLinks = () =>
  Array.from(document.querySelectorAll('[data-help-slug]')).filter(
    (element) => element.tagName === 'A',
  );

describe('help centre DOM', () => {
  it('renders every shipped topic from the local catalogue', () => {
    renderHelpRoute('/help');

    expect(document.querySelector('[data-help-page="index"]')).not.toBeNull();
    expect(getSlugLinks()).toHaveLength(HELP_ARTICLES.length);
    expect(screen.getByText(HELP_ARTICLES[0].title)).toBeTruthy();
  });

  it('keeps every rendered link same-origin', () => {
    renderHelpRoute('/help');

    const links = Array.from(document.querySelectorAll('a'));

    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.getAttribute('href')?.startsWith('/help')).toBe(true);
    }
    expect(document.body.innerHTML).not.toMatch(/https?:\/\//);
  });

  it('filters locally when the user types in the search box', () => {
    renderHelpRoute('/help');

    const target = HELP_ARTICLES[0];
    const searchBox = screen.getByRole('searchbox');

    fireEvent.change(searchBox, { target: { value: target.title } });

    const slugs = getSlugLinks().map((link) =>
      link.getAttribute('data-help-slug'),
    );

    expect(slugs).toContain(target.slug);
    expect(document.querySelector('[data-help-empty]')).toBeNull();

    fireEvent.change(searchBox, {
      target: { value: 'zzzz-no-such-help-topic' },
    });

    expect(document.querySelector('[data-help-empty]')).not.toBeNull();
    expect(getSlugLinks()).toHaveLength(0);
  });

  it('navigates from the index card into the article route', () => {
    const target = HELP_ARTICLES[1];

    const { unmount: unmountIndex } = renderHelpRoute('/help');

    const card = document.querySelector(
      `[data-help-slug="${target.slug}"]`,
    ) as HTMLAnchorElement;

    expect(card).not.toBeNull();
    expect(card.getAttribute('href')).toBe(`/help/${target.slug}`);

    unmountIndex();

    // The card is a plain document navigation; loading that URL directly is the
    // same code path as a click followed by the browser's request.
    const { unmount } = render(
      <I18nProvider i18n={i18n}>
        <MemoryRouter initialEntries={[`/help/${target.slug}`]}>
          <Routes>
            <Route path="/help/:helpArticleSlug" element={<HelpArticleRoute />} />
          </Routes>
        </MemoryRouter>
      </I18nProvider>,
    );

    expect(
      document.querySelector('[data-help-page="article"]'),
    ).not.toBeNull();
    expect(screen.getByText(target.title)).toBeTruthy();
    expect(document.body.textContent).toContain(target.paragraphs[0]);

    unmount();
  });

  it('renders the internal not-found page for an unknown slug', () => {
    renderHelpRoute('/help/no-such-article');

    expect(
      document.querySelector('[data-help-page="not-found"]'),
    ).not.toBeNull();
    expect(
      document.querySelector('[data-help-back]')?.getAttribute('href'),
    ).toBe('/help');
    expect(document.body.innerHTML).not.toMatch(/https?:\/\//);
  });

  it('serves a deep link on first load (refresh/direct visit)', () => {
    const target = HELP_ARTICLES[2];

    renderHelpRoute(`/help/${target.slug}`);

    expect(
      document.querySelector('[data-help-page="article"]'),
    ).not.toBeNull();
    expect(screen.getByText(target.title)).toBeTruthy();
  });
});
