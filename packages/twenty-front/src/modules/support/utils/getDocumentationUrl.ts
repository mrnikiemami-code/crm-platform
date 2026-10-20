import { HELP_CENTER_BASE_PATH } from 'twenty-shared/constants';
import { type DocumentationPath } from 'twenty-shared/constants';

/**
 * Product help URL builder.
 *
 * Every call returns a same-origin path into the built-in help centre. Locale and
 * legacy documentation path arguments are accepted so existing call sites keep
 * compiling, but they are deliberately ignored: unsupported languages and
 * unknown topics fall back to the help index rather than any external site.
 *
 * Never returns an absolute `https://…` URL. Callers that previously opened
 * `docs.twenty.com` now stay inside the app.
 */
export const getDocumentationUrl = ({
  locale: _locale,
  path: _path,
}: {
  locale?: string | null;
  path?: DocumentationPath | string;
} = {}): string => {
  void _locale;
  void _path;

  return HELP_CENTER_BASE_PATH;
};
