import { PageTitle } from '@/ui/utilities/page-title/components/PageTitle';
import { Trans, useLingui } from '@lingui/react/macro';
import { HELP_CENTER_BASE_PATH } from 'twenty-shared/constants';
import { findHelpArticle } from 'twenty-shared/constants';

import {
  StyledHelpBackRow,
  StyledHelpContainer,
  StyledHelpHeader,
  StyledHelpMuted,
  StyledHelpParagraph,
  StyledHelpSubtitle,
  StyledHelpTitle,
} from '~/pages/help/components/HelpStyles';

/**
 * One help article, resolved from the URL.
 *
 * The slug is matched against the local content only. An unknown slug renders an
 * INTERNAL "not found" page with a way back — it never redirects to an external
 * site and never substitutes an unrelated article, because either would leave the
 * reader believing they had reached the topic they asked for.
 *
 * Body text is rendered as individual text nodes. It is never passed to
 * `dangerouslySetInnerHTML`, so content (or a future edit to it) cannot inject
 * markup.
 */
export const HelpArticlePage = ({ slug }: { slug: string }) => {
  const { t } = useLingui();
  const article = findHelpArticle(slug);

  if (article === null) {
    return (
      <StyledHelpContainer data-help-page="not-found">
        <PageTitle title={t`موضوع پیدا نشد`} />

        <StyledHelpHeader>
          <StyledHelpTitle>
            <Trans>این موضوع در راهنما پیدا نشد</Trans>
          </StyledHelpTitle>
          <StyledHelpSubtitle>
            <Trans>
              نشانی‌ای که باز کردید با هیچ‌کدام از موضوع‌های راهنما هم‌خوان
              نیست. از فهرست موضوع‌ها یکی را انتخاب کنید.
            </Trans>
          </StyledHelpSubtitle>
        </StyledHelpHeader>

        <StyledHelpBackRow>
          <a href={HELP_CENTER_BASE_PATH} data-help-back>
            <Trans>بازگشت به فهرست راهنما</Trans>
          </a>
        </StyledHelpBackRow>

        <StyledHelpMuted data-help-slug={slug} />
      </StyledHelpContainer>
    );
  }

  return (
    <StyledHelpContainer data-help-page="article" data-help-slug={article.slug}>
      <PageTitle title={t`${article.title} — راهنمای برنامه`} />

      <StyledHelpHeader>
        <StyledHelpTitle>{article.title}</StyledHelpTitle>
        <StyledHelpSubtitle>{article.summary}</StyledHelpSubtitle>
      </StyledHelpHeader>

      <div>
        {article.paragraphs.map((paragraph, index) => (
          <StyledHelpParagraph key={`${article.slug}-${index}`}>
            {paragraph}
          </StyledHelpParagraph>
        ))}
      </div>

      <StyledHelpBackRow>
        <a href={HELP_CENTER_BASE_PATH} data-help-back>
          <Trans>بازگشت به فهرست راهنما</Trans>
        </a>
      </StyledHelpBackRow>
    </StyledHelpContainer>
  );
};
