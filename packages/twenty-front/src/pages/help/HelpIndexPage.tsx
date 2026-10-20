import { useMemo, useState } from 'react';

import { PageTitle } from '@/ui/utilities/page-title/components/PageTitle';
import { Trans, useLingui } from '@lingui/react/macro';
import {
  HELP_ARTICLES,
  HELP_CENTER_BASE_PATH,
  searchHelpArticles,
} from 'twenty-shared/constants';

import {
  StyledHelpCard,
  StyledHelpCardLink,
  StyledHelpContainer,
  StyledHelpExcerpt,
  StyledHelpHeader,
  StyledHelpList,
  StyledHelpMuted,
  StyledHelpSearchInput,
  StyledHelpSearchRow,
  StyledHelpSubtitle,
  StyledHelpTitle,
} from '~/pages/help/components/HelpStyles';

/**
 * The help index: every topic, plus a local search box.
 *
 * The content and the search come from `twenty-shared/constants/HelpCenter` —
 * the same module the server-side `search_help_center` tool reads. Nothing here
 * performs a network request, so the page works with the network unavailable and
 * cannot send a query anywhere.
 *
 * Navigation is a plain anchor with a full page load. That is deliberate: the
 * requirement is that a help URL survives a direct visit and a refresh, and a
 * document navigation proves it by construction rather than relying on a router
 * transition that a hard reload would never exercise.
 */
export const HelpIndexPage = () => {
  const { t } = useLingui();
  const [query, setQuery] = useState('');

  const results = useMemo(() => searchHelpArticles(query), [query]);

  const isSearching = query.trim().length > 0;

  return (
    <StyledHelpContainer data-help-page="index">
      <PageTitle title={t`راهنمای برنامه`} />

      <StyledHelpHeader>
        <StyledHelpTitle>
          <Trans>راهنمای برنامه</Trans>
        </StyledHelpTitle>
        <StyledHelpSubtitle>
          <Trans>
            راهنمای کار با الگوهای پیامک. این راهنما بخشی از همین برنامه است و
            بدون اینترنت هم کار می‌کند.
          </Trans>
        </StyledHelpSubtitle>
      </StyledHelpHeader>

      <StyledHelpSearchRow>
        <StyledHelpSearchInput
          type="search"
          aria-label={t`جست‌وجو در راهنما`}
          placeholder={t`جست‌وجو در راهنما…`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          dir="rtl"
        />
        <StyledHelpMuted data-help-result-count={results.length}>
          {isSearching
            ? t`${results.length} نتیجه برای «${query}»`
            : t`${HELP_ARTICLES.length} موضوع`}
        </StyledHelpMuted>
      </StyledHelpSearchRow>

      {results.length === 0 ? (
        // An empty SEARCH is reported as such; it is never an error, and it never
        // falls back to a remote search.
        <StyledHelpMuted data-help-empty="true">
          <Trans>
            موضوعی با این عبارت پیدا نشد. عبارت دیگری را امتحان کنید یا فهرست
            کامل موضوع‌ها را ببینید.
          </Trans>
        </StyledHelpMuted>
      ) : (
        <StyledHelpList>
          {results.map((result) => (
            <StyledHelpCard key={result.slug}>
              <StyledHelpCardLink
                href={result.href}
                data-help-slug={result.slug}
              >
                {result.title}
              </StyledHelpCardLink>
              <StyledHelpExcerpt>{result.excerpt}</StyledHelpExcerpt>
            </StyledHelpCard>
          ))}
        </StyledHelpList>
      )}

      <StyledHelpMuted>
        <a href={`${HELP_CENTER_BASE_PATH}`} data-help-home>
          <Trans>بازگشت به فهرست راهنما</Trans>
        </a>
      </StyledHelpMuted>
    </StyledHelpContainer>
  );
};
