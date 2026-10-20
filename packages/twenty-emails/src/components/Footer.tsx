import { type I18n } from '@lingui/core';
import { Column, Container, Row } from 'react-email';
import { Link } from 'src/components/Link';
import { ShadowText } from 'src/components/ShadowText';
import { HELP_CENTER_BASE_PATH } from 'twenty-shared/constants';

const footerContainerStyle = {
  marginTop: '12px',
};

type FooterProps = {
  i18n: I18n;
  /**
   * Published, validated origin of this installation's UI (`FRONTEND_URL`, else
   * `SERVER_URL`). Every production email caller passes it, because a mail
   * client has no CRM origin to resolve a relative `/help` against.
   *
   * When it is missing or invalid, the Help links are OMITTED entirely: an
   * email is never rendered with a relative, `null/help` or non-HTTP link.
   */
  serverUrl?: string;
};

/**
 * Absolute in-app Help URL, or `null` when no usable origin is available.
 *
 * Only `http:`/`https:` origins are accepted; anything else (missing, relative,
 * `javascript:`, credentials in the URL, garbage) yields `null` so the caller
 * can drop the link instead of shipping something broken.
 */
export const buildAbsoluteHelpUrl = (
  serverUrl?: string | null,
): string | null => {
  if (typeof serverUrl !== 'string') {
    return null;
  }

  const trimmed = serverUrl.trim();

  if (trimmed.length === 0) {
    return null;
  }

  let parsed: URL;

  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  if (parsed.username.length > 0 || parsed.password.length > 0) {
    return null;
  }

  if (parsed.hostname.length === 0) {
    return null;
  }

  return `${parsed.origin}${HELP_CENTER_BASE_PATH}`;
};

export const Footer = ({ i18n, serverUrl }: FooterProps) => {
  const helpUrl = buildAbsoluteHelpUrl(serverUrl);

  return (
    <Container style={footerContainerStyle}>
      <Row>
        <Column>
          <ShadowText>
            <Link
              href="https://twenty.com/"
              value={i18n._('Website')}
              aria-label={i18n._("Visit Twenty's website")}
            />
          </ShadowText>
        </Column>
        <Column>
          <ShadowText>
            <Link
              href="https://github.com/twentyhq/twenty"
              value={i18n._('Github')}
              aria-label={i18n._("Visit Twenty's GitHub repository")}
            />
          </ShadowText>
        </Column>
        {helpUrl !== null && (
          <>
            <Column>
              <ShadowText>
                <Link
                  href={helpUrl}
                  value={i18n._('User guide')}
                  aria-label={i18n._('Read the in-app user guide')}
                />
              </ShadowText>
            </Column>
            <Column>
              <ShadowText>
                <Link
                  href={helpUrl}
                  value={i18n._('Developers')}
                  aria-label={i18n._('Open the in-app help centre')}
                />
              </ShadowText>
            </Column>
          </>
        )}
      </Row>
      <ShadowText>
        <>
          {i18n._('Twenty.com, Public Benefit Corporation')}
          <br />
          {i18n._('San Francisco / Paris')}
        </>
      </ShadowText>
    </Container>
  );
};
