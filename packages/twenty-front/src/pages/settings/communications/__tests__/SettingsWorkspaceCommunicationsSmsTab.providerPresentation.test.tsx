import { gql } from '@apollo/client';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, waitFor } from '@testing-library/react';
import { SOURCE_LOCALE } from 'twenty-shared/translations';
import { messages as faMessages } from '~/locales/generated/fa-IR';
import { SettingsWorkspaceCommunicationsSmsTab } from '~/pages/settings/communications/SettingsWorkspaceCommunicationsSmsTab';
import { getJestMetadataAndApolloMocksWrapper } from '~/testing/jest/getJestMetadataAndApolloMocksWrapper';

const FIND_COMMUNICATION_APP_FOR_SMS_SETTINGS = gql`
  query FindCommunicationAppForSmsSettings($universalIdentifier: UUID!) {
    findOneApplication(universalIdentifier: $universalIdentifier) {
      id
      applicationVariables {
        key
        value
        isSecret
      }
    }
  }
`;

const APPLICATION_UNIVERSAL_IDENTIFIER = '768bca20-0b81-4d33-a624-0a894a193ffd';
const APPLICATION_ID = '20202020-0000-4000-8000-000000000001';

const buildVariables = (provider: string, extras: Record<string, string> = {}) => [
  { key: 'COMMUNICATION_PROVIDER', value: provider, isSecret: false },
  { key: 'KAVENEGAR_API_KEY', value: '', isSecret: true },
  { key: 'KAVENEGAR_ENDPOINT', value: '', isSecret: false },
  { key: 'KAVENEGAR_SENDER', value: '', isSecret: false },
  { key: 'RAZPAYAMAK_API_KEY', value: '', isSecret: true },
  { key: 'RAZPAYAMAK_USERNAME', value: '', isSecret: false },
  { key: 'RAZPAYAMAK_SENDER', value: '', isSecret: false },
  ...Object.entries(extras).map(([key, value]) => ({ key, value, isSecret: false })),
];

const renderTab = (variables: { key: string; value: string; isSecret: boolean }[]) => {
  const Wrapper = getJestMetadataAndApolloMocksWrapper({
    apolloMocks: [
      {
        request: {
          query: FIND_COMMUNICATION_APP_FOR_SMS_SETTINGS,
          variables: { universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER },
        },
        result: {
          data: {
            findOneApplication: {
              id: APPLICATION_ID,
              applicationVariables: variables,
            },
          },
        },
      },
    ],
  });

  render(
    <I18nProvider i18n={i18n}>
      <Wrapper>
        <SettingsWorkspaceCommunicationsSmsTab />
      </Wrapper>
    </I18nProvider>,
  );
};

describe('SMS settings tab — provider presentation (W16-R1-UX)', () => {
  beforeAll(() => {
    i18n.load({ 'fa-IR': faMessages });
  });

  beforeEach(() => {
    i18n.activate('fa-IR');
  });

  afterEach(() => {
    i18n.activate(SOURCE_LOCALE);
  });

  it('B: shows the Persian provider radio labels', async () => {
    renderTab(buildVariables('razpayamak'));

    await waitFor(() => {
      expect(screen.getAllByText('رازپیامک').length).toBeGreaterThan(0);
      expect(screen.getAllByText('کاوه‌نگار').length).toBeGreaterThan(0);
    });
  });

  it('C: renders only the RazPayamak card when razpayamak is saved', async () => {
    renderTab(buildVariables('razpayamak'));

    // The RazPayamak-specific field is present...
    await waitFor(() => {
      expect(screen.getByText('شماره فرستنده')).toBeInTheDocument();
    });

    // ...and the Kavenegar-only field is NOT rendered anywhere in the DOM.
    expect(screen.queryByText('نشانی API')).not.toBeInTheDocument();
  });

  it('D: renders only the Kavenegar card when kavenegar is saved', async () => {
    renderTab(buildVariables('kavenegar'));

    await waitFor(() => {
      expect(screen.getByText('نشانی API')).toBeInTheDocument();
    });

    // The RazPayamak-only field and its test-send panel are absent.
    expect(screen.queryByText('شماره فرستنده')).not.toBeInTheDocument();
    expect(screen.queryByText('ارسال پیامک آزمایشی')).not.toBeInTheDocument();
  });

  it('does not render a RazPayamak endpoint field', async () => {
    renderTab(buildVariables('razpayamak'));

    await waitFor(() => {
      expect(screen.getByText('شماره فرستنده')).toBeInTheDocument();
    });

    expect(screen.queryByText('نقطه پایانی ارسال')).not.toBeInTheDocument();
    expect(screen.queryByText('Send endpoint')).not.toBeInTheDocument();
  });
});
