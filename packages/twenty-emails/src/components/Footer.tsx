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
   * Published origin of this installation (SERVER_URL / front origin).
   * When set, Help links become absolute same-origin URLs. When omitted
   * (preview fixtures without an origin), a root-relative `/help` path is used
   * so the link never points at docs.twenty.com.
   */
  serverUrl?: string;
};

const buildHelpUrl = (serverUrl?: string): string => {
  if (!serverUrl || serverUrl.trim().length === 0) {
    return HELP_CENTER_BASE_PATH;
  }

  try {
    const origin = new URL(serverUrl).origin;

    return `${origin}${HELP_CENTER_BASE_PATH}`;
  } catch {
    return HELP_CENTER_BASE_PATH;
  }
};

export const Footer = ({ i18n, serverUrl }: FooterProps) => {
  const helpUrl = buildHelpUrl(serverUrl);

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
