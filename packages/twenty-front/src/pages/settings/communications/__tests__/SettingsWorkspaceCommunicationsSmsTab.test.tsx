import { gql } from '@apollo/client';
import { i18n } from '@lingui/core';
import { I18nProvider } from '@lingui/react';
import { render, screen, waitFor } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { SOURCE_LOCALE } from 'twenty-shared/translations';
import { UpdateOneApplicationVariableDocument } from '~/generated-metadata/graphql';
import { SettingsWorkspaceCommunicationsSmsTab } from '~/pages/settings/communications/SettingsWorkspaceCommunicationsSmsTab';
import { getJestMetadataAndApolloMocksWrapper } from '~/testing/jest/getJestMetadataAndApolloMocksWrapper';

// The real tab renders its fields from this query; declaring it here (same
// operation name and variables) lets MockedProvider match it.
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

const FAKE_SECRET = 'fake-secret-value-xyz-123';

// An EMPTY stored secret: the case that used to fall through to the
// stored-value branch.
const EMPTY_SECRET_VARIABLES = [
  { key: 'KAVENEGAR_API_KEY', value: '', isSecret: true },
  { key: 'KAVENEGAR_ENDPOINT', value: '', isSecret: false },
  { key: 'KAVENEGAR_SENDER', value: '', isSecret: false },
  { key: 'RAZPAYAMAK_API_KEY', value: '', isSecret: true },
  { key: 'RAZPAYAMAK_USERNAME', value: '', isSecret: false },
  { key: 'RAZPAYAMAK_SENDER', value: '', isSecret: false },
  { key: 'RAZPAYAMAK_BACKUP_SENDER_ONE', value: '', isSecret: false },
  { key: 'RAZPAYAMAK_BACKUP_SENDER_TWO', value: '', isSecret: false },
  { key: 'COMMUNICATION_PROVIDER', value: 'kavenegar', isSecret: false },
];

describe('SMS settings tab — secret input connection (real form)', () => {
  beforeEach(() => {
    i18n.activate(SOURCE_LOCALE);
  });

  it('keeps a typed multi-character secret in the input and sends the FULL value to the mutation', async () => {
    const user = userEvent.setup();
    const mutationSpy = jest.fn();

    const Wrapper = getJestMetadataAndApolloMocksWrapper({
      apolloMocks: [
        {
          request: {
            query: FIND_COMMUNICATION_APP_FOR_SMS_SETTINGS,
            variables: {
              universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
            },
          },
          result: {
            data: {
              findOneApplication: {
                id: APPLICATION_ID,
                applicationVariables: EMPTY_SECRET_VARIABLES,
              },
            },
          },
        },
        {
          request: {
            query: UpdateOneApplicationVariableDocument,
            variables: {
              key: 'KAVENEGAR_API_KEY',
              value: FAKE_SECRET,
              applicationId: APPLICATION_ID,
            },
          },
          result: () => {
            mutationSpy('KAVENEGAR_API_KEY', FAKE_SECRET);
            return { data: { updateOneApplicationVariable: true } };
          },
        },
        {
          // The read-back after a successful save.
          request: {
            query: FIND_COMMUNICATION_APP_FOR_SMS_SETTINGS,
            variables: {
              universalIdentifier: APPLICATION_UNIVERSAL_IDENTIFIER,
            },
          },
          result: {
            data: {
              findOneApplication: {
                id: APPLICATION_ID,
                applicationVariables: EMPTY_SECRET_VARIABLES.map((variable) =>
                  variable.key === 'KAVENEGAR_API_KEY'
                    ? { ...variable, value: 'f********' }
                    : variable,
                ),
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

    // The Kavenegar API key is the first password input on the page.
    const passwordInputs = await waitFor(() => {
      const inputs = document.querySelectorAll('input[type="password"]');

      expect(inputs.length).toBeGreaterThan(0);

      return inputs;
    });

    const kavenegarApiKeyInput = passwordInputs[0] as HTMLInputElement;

    await user.type(kavenegarApiKeyInput, FAKE_SECRET);

    // The input holds exactly what was typed — not a stored or masked value.
    expect(kavenegarApiKeyInput.value).toBe(FAKE_SECRET);

    // The first Save button belongs to the Kavenegar section.
    const saveButtons = screen.getAllByRole('button', { name: /save|ذخیره/i });

    await user.click(saveButtons[0]);

    await waitFor(() => {
      expect(mutationSpy).toHaveBeenCalledWith(
        'KAVENEGAR_API_KEY',
        FAKE_SECRET,
      );
    });
  });
});
