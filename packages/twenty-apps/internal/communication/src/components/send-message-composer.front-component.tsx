import { useEffect, useRef, useState } from 'react';
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
  createPhoneOptionsConnection,
  isPhoneSelectionReady,
  type PhoneOptionsConnection,
  type PhoneOptionsLoadState,
} from 'src/components/phone-options-load-state';
import { submitPersonCommunication } from 'src/components/submit-person-communication';
import { resolveSubmitOutcomePresentation } from 'src/components/submit-outcome-variant';
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

// The sandbox ships no UI kit, so the form is plain HTML styled to match the
// host Twenty surface: same border/radius/typography and a single primary
// action. Kept as data so RTL only has to flip alignment, not layout.
const styles = {
  container: {
    padding: 16,
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 16,
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: 13,
    color: '#333',
  },
  heading: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: '#111',
  },
  hint: {
    margin: 0,
    fontSize: 12,
    color: '#666',
  },
  field: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: '#555',
  },
  control: {
    width: '100%',
    boxSizing: 'border-box' as const,
    padding: '8px 10px',
    fontSize: 13,
    fontFamily: 'inherit',
    color: '#111',
    background: '#fff',
    border: '1px solid #d6d6d6',
    borderRadius: 4,
    outlineColor: '#333',
  },
  controlDisabled: {
    background: '#f6f6f6',
    color: '#888',
  },
  error: {
    margin: 0,
    padding: '8px 10px',
    fontSize: 12,
    color: '#b42318',
    background: '#fef3f2',
    border: '1px solid #fecdca',
    borderRadius: 4,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
  },
  primaryButton: {
    padding: '8px 14px',
    fontSize: 13,
    fontFamily: 'inherit',
    fontWeight: 500,
    color: '#fff',
    background: '#333',
    border: '1px solid #333',
    borderRadius: 4,
    cursor: 'pointer',
  },
  primaryButtonDisabled: {
    background: '#bdbdbd',
    borderColor: '#bdbdbd',
    cursor: 'default',
  },
  secondaryButton: {
    padding: '8px 14px',
    fontSize: 13,
    fontFamily: 'inherit',
    color: '#333',
    background: '#fff',
    border: '1px solid #d6d6d6',
    borderRadius: 4,
    cursor: 'pointer',
  },
};

// Numbers are a technical identifier: keep them left-to-right even inside an
// RTL form, matching how the CRM renders phone values elsewhere.
const phoneValueStyle = {
  direction: 'ltr' as const,
  unicodeBidi: 'plaintext' as const,
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

  // One connection for the component's lifetime: its request-id counter is
  // shared across every load, so a newer request (or a cleanup invalidation)
  // silences an older one. Recreating it per call would give each request its
  // own counter and defeat the guard.
  const phonesConnectionRef = useRef<PhoneOptionsConnection | null>(null);

  if (phonesConnectionRef.current === null) {
    phonesConnectionRef.current = createPhoneOptionsConnection({
      transport: (personId) => {
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
  }

  useEffect(() => {
    const connection = phonesConnectionRef.current;

    connection?.start(personId);

    // Cleanup runs on unmount and before the next effect when `personId`
    // changes, so a response for the previous Person can never publish state.
    return () => {
      connection?.invalidate();
    };
  }, [personId]);

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
      // One shared mapping decides success/error/warning, so the shipped
      // severity and the tested severity cannot drift.
      const presentation = resolveSubmitOutcomePresentation(outcomeResult);

      if (presentation.variant === 'success') {
        const successMessage =
          outcomeResult.kind === 'DELIVERED'
            ? t('Message delivered.')
            : t('Message sent.');

        setOutcome(successMessage);
        await enqueueSnackbar({
          message: successMessage,
          variant: 'success',
        });
      } else {
        // The provider's own reason is shown verbatim; only the app's own
        // fallback wording is translated, so a real backend reason is never
        // replaced by a translated generic.
        const message = t(presentation.message);

        setError(message);
        await enqueueSnackbar({ message, variant: presentation.variant });
      }
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    unmountFrontComponent();
    closeSidePanel();
  };

  const containerStyle = { ...styles.container, direction };

  if (outcome !== null) {
    return (
      <div style={containerStyle}>
        <p style={styles.heading}>{outcome}</p>
        <div style={styles.actions}>
          <button type="button" style={styles.secondaryButton} onClick={handleClose}>
            {t('Close')}
          </button>
        </div>
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

  const phoneControlStyle = {
    ...styles.control,
    ...(isPhoneSelectDisabled ? styles.controlDisabled : {}),
    ...phoneValueStyle,
  };

  return (
    <div style={containerStyle}>
      <div style={styles.field}>
        <p style={styles.heading}>{t('Send SMS')}</p>
        <p style={styles.hint}>{t('Sends an SMS to the selected number.')}</p>
      </div>

      <label style={styles.field}>
        <span style={styles.label}>{t('Channel')}</span>
        <select
          value={channel}
          onChange={(event) => setChannel(event.target.value)}
          style={styles.control}
        >
          {SUPPORTED_CHANNELS.map((supportedChannel) => (
            <option key={supportedChannel} value={supportedChannel}>
              {supportedChannel}
            </option>
          ))}
        </select>
      </label>

      <label style={styles.field}>
        <span style={styles.label}>{t('Phone number')}</span>
        <select
          value={selectedPhone}
          onChange={(event) => setSelectedPhone(event.target.value)}
          disabled={isPhoneSelectDisabled}
          style={phoneControlStyle}
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

      <label style={styles.field}>
        <span style={styles.label}>{t('Message')}</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={5}
          style={{ ...styles.control, resize: 'vertical' }}
        />
      </label>

      {error !== null && <p style={styles.error}>{error}</p>}

      <div style={styles.actions}>
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={handleClose}
          disabled={sending}
        >
          {t('Cancel')}
        </button>
        <button
          type="button"
          style={{
            ...styles.primaryButton,
            ...(canSubmit ? {} : styles.primaryButtonDisabled),
          }}
          onClick={handleSubmit}
          disabled={!canSubmit}
        >
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
