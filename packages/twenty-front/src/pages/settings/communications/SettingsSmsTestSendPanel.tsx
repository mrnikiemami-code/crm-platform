import { styled } from '@linaria/react';
import { useLingui } from '@lingui/react/macro';
import { useRef, useState } from 'react';
import { Section } from 'twenty-ui/components';
import { Info } from 'twenty-ui/primitives/feedback';
import { Button } from 'twenty-ui/primitives/input';
import { themeCssVariables } from 'twenty-ui/theme-constants';
import { TextInput } from '@/ui/input/components/TextInput';
import { REACT_APP_SERVER_BASE_URL } from '~/config';
import {
  type SettingsTestSmsOutcome,
  type SettingsTestSmsTransport,
  isSettingsTestSmsSendable,
  runSettingsTestSms,
} from '~/pages/settings/communications/utils/communicationSmsTestSend';

const StyledContainer = styled.div`
  background: ${themeCssVariables.background.primary};
  border: 1px solid ${themeCssVariables.border.color.medium};
  border-radius: ${themeCssVariables.border.radius.md};
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[3]};
  padding: ${themeCssVariables.spacing[3]};
`;

const StyledField = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${themeCssVariables.spacing[1]};
`;

const StyledLabel = styled.span`
  color: ${themeCssVariables.font.color.light};
  font-size: 11px;
  font-weight: ${themeCssVariables.font.weight.semiBold};
`;

const StyledStatus = styled.span`
  color: ${themeCssVariables.font.color.tertiary};
  font-size: ${themeCssVariables.font.size.xs};
`;

const StyledLtrTextInput = styled(TextInput)`
  direction: ltr;
`;

// The host transport: the app route base is `/s`, and the session cookie
// authenticates the call (the front already uses `credentials: 'include'`).
// The raw response body is never surfaced; only the parsed JSON is returned.
const defaultTransport: SettingsTestSmsTransport = async (
  request,
  options,
) => {
  const response = await fetch(
    `${REACT_APP_SERVER_BASE_URL}/s/communication/settings-test-sms`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(request),
      ...(options.signal === undefined ? {} : { signal: options.signal }),
    },
  );

  const text = await response.text();
  const data = text.length > 0 ? JSON.parse(text) : {};

  return { ok: response.ok, status: response.status, data };
};

type SettingsSmsTestSendPanelProps = {
  /** Whether the provider's saved configuration is present. */
  isConfigured: boolean;
  /** Optional transport override for tests. */
  transport?: SettingsTestSmsTransport;
};

export const SettingsSmsTestSendPanel = ({
  isConfigured,
  transport,
}: SettingsSmsTestSendPanelProps) => {
  const { t } = useLingui();

  const [recipient, setRecipient] = useState('');
  const [body, setBody] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [outcome, setOutcome] = useState<SettingsTestSmsOutcome | null>(null);

  // Synchronous in-flight guard: flips in the same tick the click is handled,
  // so a fast double click cannot fire two requests.
  // oxlint-disable-next-line twenty/no-state-useref
  const isSendingRef = useRef(false);

  const canSend =
    isConfigured && isSettingsTestSmsSendable({ recipient, body, isSending });

  const handleSend = async () => {
    if (isSendingRef.current) {
      return;
    }

    setIsSending(true);
    setOutcome(null);

    const result = await runSettingsTestSms(
      { recipient, body },
      { transport: transport ?? defaultTransport, isSendingRef },
    );

    // A dropped duplicate is not a result: leave the UI untouched.
    if (result.kind === 'DUPLICATE_IGNORED') {
      return;
    }

    setIsSending(false);
    setOutcome(result);
  };

  const renderOutcome = (result: SettingsTestSmsOutcome) => {
    switch (result.kind) {
      case 'SENT':
        return (
          <>
            <Info
              accent="blue"
              text={t`RazPayamak accepted the request.`}
            />
            {result.providerMessageId !== undefined && (
              <StyledStatus>
                {t`Provider message ID:`} {result.providerMessageId}
              </StyledStatus>
            )}
            <StyledStatus>
              {t`Acceptance does not prove delivery to the phone.`}
            </StyledStatus>
          </>
        );
      case 'PROVIDER_FAILED':
        return (
          <>
            <Info accent="danger" text={t`RazPayamak rejected the message.`} />
            {result.providerCode !== undefined && (
              <StyledStatus>
                {t`Provider code:`} {result.providerCode}
              </StyledStatus>
            )}
            {result.providerDetail !== undefined && (
              <StyledStatus>{result.providerDetail}</StyledStatus>
            )}
          </>
        );
      case 'NOT_PERMITTED':
        return (
          <Info
            accent="danger"
            text={t`You do not have permission to send a test SMS.`}
          />
        );
      case 'INVALID':
        return (
          <Info
            accent="danger"
            text={
              result.failureCode === 'EMPTY_MESSAGE'
                ? t`Message text is required.`
                : t`A valid recipient mobile number is required.`
            }
          />
        );
      case 'OUTCOME_UNKNOWN':
        return (
          <Info
            accent="danger"
            text={t`The message may or may not have been sent. Check the provider panel before retrying.`}
          />
        );
      case 'DUPLICATE_IGNORED':
        return null;
    }
  };

  return (
    <StyledContainer>
      <Section.Root>
        <Section.Header
          title={t`Send a test SMS`}
          description={t`Sends a real, chargeable SMS through the selected provider.`}
        />
      </Section.Root>

      {!isConfigured && (
        <Info
          accent="danger"
          text={t`Save the provider's configuration before sending a test SMS.`}
        />
      )}

      <StyledField>
        <StyledLabel>{t`Test recipient mobile number`}</StyledLabel>
        <StyledLtrTextInput
          value={recipient}
          onChange={setRecipient}
          placeholder="09120000000"
          fullWidth
          autoComplete="off"
        />
      </StyledField>

      <StyledField>
        <StyledLabel>{t`Test message text`}</StyledLabel>
        <TextInput
          value={body}
          onChange={setBody}
          placeholder={t`Test message`}
          fullWidth
          autoComplete="off"
        />
      </StyledField>

      <div>
        <Button
          variant="solid"
          color="accent"
          size="sm"
          onClick={() => {
            void handleSend();
          }}
          disabled={!canSend}
          loading={isSending}
        >
          {t`Send test SMS`}
        </Button>
      </div>

      {outcome !== null && renderOutcome(outcome)}
    </StyledContainer>
  );
};
