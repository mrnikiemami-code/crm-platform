import { useParams } from 'react-router-dom';

import { HelpArticlePage } from '~/pages/help/HelpArticlePage';

/**
 * Bridge from the router param to the article page.
 *
 * Kept tiny so the page itself stays a pure slug→content render and can be
 * exercised without a router in unit tests.
 */
export const HelpArticleRoute = () => {
  const { helpArticleSlug } = useParams<{ helpArticleSlug: string }>();

  return <HelpArticlePage slug={helpArticleSlug ?? ''} />;
};
