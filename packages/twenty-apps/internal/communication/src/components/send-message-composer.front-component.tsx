import { useCallback, useEffect, useRef, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  closeSidePanel,
  enqueueSnackbar,
  unmountFrontComponent,
  useLocale,
  useRecordId,
  useTranslate,
} from 'twenty-sdk/front-component';

import {
  createPhoneOptionsLoader,
  isPhoneSelectionReady,
  type PhoneOptionsLoadState,
} from 'src/components/phone-options-load-state';
import { submitPersonCommunication } from 'src/components/submit-person-communication';
import { SEND_MESSAGE_COMPOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Channels the composer offers. Mirrors the implemented channels only; future
// channels become selectable when their provider ships.
const SUPPORTED_CHANNELS = ['SMS'] as const;

// RTL languages, by ISO 639-1 subtag. Kept local because the app bundle cannot
// depend on `twenty-shared`; mirrors the platform's own list.
const RIGHT_TO_LEFT_LANGUAGES = ['ar', 'dv', 'fa', 'he', 'ps', 'sd', 'ug', 'ur', 'yi'];

const getTextDirection = (locale: string): 'rtl' | 'ltr' =>
  RIGHT_TO_LEFT_LANGUAGES.includes(locale.split('-')[0]) ? 'rtl' : 'ltr';

const callAppRoute = async (
  path: string,
  method: 'GET' | 'POST',
  body?: Record<string, unknown>,
) => {
  const apiBaseUrl = process.env.TWENTY_API_URL;
  const token =
    process.env.TWENTY_APP_ACCESS_TOKEN ?? process.env.TWENTY_API_KEY;

  if (!apiBaseUrl || !token) {
    throw new Error('API configuration missing');
  }

  const response = await fetch(`${apiBaseUrl}/s${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const text = await response.text();
  const parsed = text.length > 0 ? JSON.parse(text) : {};

  return { ok: response.ok, status: response.status, data: parsed };
};

const SendMessageComposer = () => {
  const { t } = useTranslate();
  const locale = useLocale();
  const personId = useRecordId();

  const direction = getTextDirection(locale);

  const [channel, setChannel] = useState<string>(SUPPORTED_CHANNELS[0]);
  const [phonesState, setPhonesState] = useState<PhoneOptionsLoadState>({
    kind: 'LOADING',
  });
  const [selectedPhone, setSelectedPhone] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Synchronous in-flight guard. React state updates are not visible to a
  // second click in the same tick, so two rapid clicks could otherwise fire
  // two requests. The ref flips immediately; `sending` still drives the
  // visual pending state.
  const isSubmittingRef = useRef(false);

  const loadPhones = useCallback(async () => {
    // A monotonic request id guarantees a slow earlier response cannot
    // overwrite a newer one; the loader drops stale results and stale failures
    // entirely, and always resets the selected number to match its state.
    const loader = createPhoneOptionsLoader({
      transport: async () => {
        if (!personId) {
          throw new Error('No person is selected.');
        }

        return callAppRoute('/communication/person-phones', 'POST', {
          personId,
        });
      },
      onState: (state, selected) => {
        setPhonesState(state);
        setSelectedPhone(selected);
      },
    });

    await loader.load();
  }, [personId]);

  useEffect(() => {
    loadPhones();
  }, [loadPhones]);

  const trimmedBody = body.trim();
  const canSubmit =
    !sending &&
    personId !== null &&
    isPhoneSelectionReady(phonesState) &&
    selectedPhone.length > 0 &&
    trimmedBody.length > 0;

  const handleSubmit = async () => {
    // The guard check runs synchronously, before any await, so a second
    // immediate submission is rejected in the same tick. It is owned by the
    // shared submission helper so the shipped behavior is exactly what the
    // focused tests exercise.
    if (!canSubmit || personId === null) {
      return;
    }

    // A duplicate is dropped before any UI state changes, so it cannot clear
    // the pending state of the request that is still in flight.
    if (isSubmittingRef.current) {
      return;
    }

    setSending(true);
    setError(null);

    const outcomeResult = await submitPersonCommunication(
      {
        personId,
        channel,
        recipient: selectedPhone,
        body: trimmedBody,
      },
      {
        isSubmittingRef,
        transport: async (request) => {
          const response = await callAppRoute(
            '/communication/send',
            'POST',
            request,
          );

          return response;
        },
      },
    );

    // A duplicate is not a result: render nothing and leave the pending state
    // of the in-flight request untouched.
    if (outcomeResult.kind === 'DUPLICATE_IGNORED') {
      return;
    }

    try {
      switch (outcomeResult.kind) {
        case 'SENT':
        case 'DELIVERED': {
          const successMessage =
            outcomeResult.kind === 'DELIVERED'
              ? t('Message delivered.')
              : t('Message sent.');

          setOutcome(successMessage);
          await enqueueSnackbar({
            message: successMessage,
            variant: 'success',
          });

          break;
        }
        case 'PROVIDER_FAILED':
        case 'INVALID_INPUT': {
          setError(outcomeResult.message);
          await enqueueSnackbar({
            message: outcomeResult.message,
            variant: 'error',
          });

          break;
        }
        default: {
          // The message was sent (or may have been), but the result is not a
          // plain failure. A warning tells the user not to retry blindly.
          setError(outcomeResult.message);
          await enqueueSnackbar({
            message: outcomeResult.message,
            variant: 'warning',
          });

          break;
        }
      }
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    unmountFrontComponent();
    closeSidePanel();
  };

  const containerStyle = {
    padding: 16,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 12,
    fontFamily: 'Inter, system-ui, sans-serif',
    direction,
    textAlign: 'start' as const,
  };

  // Numbers are a technical identifier: keep them left-to-right even inside an
  // RTL form, matching how the CRM renders phone values elsewhere.
  const phoneValueStyle = {
    direction: 'ltr' as const,
    unicodeBidi: 'plaintext' as const,
  };

  if (outcome !== null) {
    return (
      <div style={containerStyle}>
        <p style={{ margin: '0 0 12px' }}>{outcome}</p>
        <button type="button" onClick={handleClose}>
          {t('Close')}
        </button>
      </div>
    );
  }

  const isPhoneSelectDisabled =
    phonesState.kind !== 'READY' || phonesState.phones.length === 0;

  const phonePlaceholder =
    phonesState.kind === 'LOADING'
      ? t('Loading phone numbers…')
      : phonesState.kind === 'ERROR'
        ? t('Unable to load phone numbers.')
        : t('No phone number is recorded for this person.');

  return (
    <div style={containerStyle}>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>{t('Channel')}</span>
        <select value={channel} onChange={(event) => setChannel(event.target.value)}>
          {SUPPORTED_CHANNELS.map((supportedChannel) => (
            <option key={supportedChannel} value={supportedChannel}>
              {supportedChannel}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>{t('Phone number')}</span>
        <select
          value={selectedPhone}
          onChange={(event) => setSelectedPhone(event.target.value)}
          disabled={isPhoneSelectDisabled}
          style={phoneValueStyle}
        >
          {phonesState.kind === 'READY' ? (
            phonesState.phones.map((phone) => (
              <option key={phone.id} value={phone.value}>
                {phone.value}
              </option>
            ))
          ) : (
            <option value="">{phonePlaceholder}</option>
          )}
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>{t('Message')}</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={5}
        />
      </label>

      {error !== null && <p style={{ color: '#e05252', margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" onClick={handleClose} disabled={sending}>
          {t('Cancel')}
        </button>
        <button type="button" onClick={handleSubmit} disabled={!canSubmit}>
          {sending ? t('Sending...') : t('Send')}
        </button>
      </div>
    </div>
  );
};

export default defineFrontComponent({
  universalIdentifier: SEND_MESSAGE_COMPOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER,
  name: 'send-message-composer',
  description: 'Composer to send an outbound message to a person.',
  component: SendMessageComposer,
});
