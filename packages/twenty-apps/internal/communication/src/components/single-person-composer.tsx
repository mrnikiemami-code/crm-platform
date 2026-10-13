import { useEffect, useRef, useState } from 'react';
import {
  closeSidePanel,
  enqueueSnackbar,
  unmountFrontComponent,
  useLocale,
  useTranslate,
} from 'twenty-sdk/front-component';

import {
  callAppRoute,
  composerStyles as styles,
  formatDigitsForLocale,
  getTextDirection,
  phoneValueStyle,
} from 'src/components/composer-shared';
import {
  createPhoneOptionsConnection,
  isPhoneSelectionReady,
  type PhoneOptionsConnection,
  type PhoneOptionsLoadState,
} from 'src/components/phone-options-load-state';
import { submitPersonCommunication } from 'src/components/submit-person-communication';
import { resolveSubmitOutcomePresentation } from 'src/components/submit-outcome-variant';
import {
  doesBodyEditDetach,
  NO_TEMPLATE_ID,
  resolveTemplateChoice,
  templateOptionLabel,
  type TemplateOption,
} from 'src/components/template-selection';

// Channels the composer offers. Mirrors the implemented channels only; future
// channels become selectable when their provider ships.
const SUPPORTED_CHANNELS = ['SMS'] as const;

type TemplatesState =
  | { kind: 'LOADING' }
  | { kind: 'READY'; templates: TemplateOption[] }
  | { kind: 'EMPTY' }
  | { kind: 'ERROR' };

const toTemplateOption = (value: unknown): TemplateOption | null => {
  if (value === null || typeof value !== 'object') {
    return null;
  }

  const record = value as Record<string, unknown>;

  if (typeof record.id !== 'string' || record.id.length === 0) {
    return null;
  }

  return {
    id: record.id,
    title: typeof record.title === 'string' ? record.title : '',
    body: typeof record.body === 'string' ? record.body : '',
    channel: typeof record.channel === 'string' ? record.channel : 'SMS',
  };
};

const resolveTemplatesState = (response: {
  ok: boolean;
  data: unknown;
}): TemplatesState => {
  if (
    !response.ok ||
    response.data === null ||
    typeof response.data !== 'object'
  ) {
    return { kind: 'ERROR' };
  }

  const payload = response.data as Record<string, unknown>;

  if (payload.success !== true || !Array.isArray(payload.templates)) {
    return { kind: 'ERROR' };
  }

  const templates = payload.templates
    .map(toTemplateOption)
    .filter((template): template is TemplateOption => template !== null);

  // A genuinely empty list is EMPTY (honest), a malformed one is ERROR.
  if (payload.templates.length > 0 && templates.length === 0) {
    return { kind: 'ERROR' };
  }

  return templates.length === 0
    ? { kind: 'EMPTY' }
    : { kind: 'READY', templates };
};

// The single-person form: exactly the W5 vertical slice, extracted so the
// top-level composer can choose between it and the bulk form without changing
// any single-send behavior.
export const SinglePersonComposer = ({ personId }: { personId: string | null }) => {
  const { t } = useTranslate();
  const locale = useLocale();

  const direction = getTextDirection(locale);

  const [channel, setChannel] = useState<string>(SUPPORTED_CHANNELS[0]);
  const [phonesState, setPhonesState] = useState<PhoneOptionsLoadState>({
    kind: 'LOADING',
  });
  const [selectedPhone, setSelectedPhone] = useState('');
  const [body, setBody] = useState('');
  const [templatesState, setTemplatesState] = useState<TemplatesState>({
    kind: 'LOADING',
  });
  const [selectedTemplateId, setSelectedTemplateId] = useState(NO_TEMPLATE_ID);
  // The EXACT text the current template inserted, or `null` once the draft is
  // detached (edited, or never attached). «بدون الگو» may clear the body only
  // while this is non-null.
  const [attachedTemplateBody, setAttachedTemplateBody] = useState<
    string | null
  >(null);
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The severity of the last outcome, so the in-form message uses the SAME
  // classification as the toast: a definite failure is an error, an uncertain
  // result is a warning.
  const [errorVariant, setErrorVariant] = useState<'error' | 'warning'>('error');

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
      transport: (selectedPersonId) => {
        if (!selectedPersonId) {
          throw new Error('No person is selected.');
        }

        return callAppRoute('/communication/person-phones', 'POST', {
          personId: selectedPersonId,
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

  // Templates are loaded once for the picker. A failure is a distinct state:
  // the user can still type a custom message, so the composer never blocks on
  // the template list.
  useEffect(() => {
    let cancelled = false;

    const loadTemplates = async () => {
      try {
        const response = await callAppRoute(
          '/communication/message-templates',
          'POST',
        );

        if (!cancelled) {
          setTemplatesState(resolveTemplatesState(response));
        }
      } catch {
        if (!cancelled) {
          setTemplatesState({ kind: 'ERROR' });
        }
      }
    };

    void loadTemplates();

    return () => {
      cancelled = true;
    };
  }, []);

  const templates =
    templatesState.kind === 'READY' ? templatesState.templates : [];

  const handleSelectTemplate = (templateId: string) => {
    const outcome = resolveTemplateChoice({
      templateId,
      templates,
      attachedBody: attachedTemplateBody,
    });

    if (outcome.kind === 'INSERT') {
      setBody(outcome.body);
      setAttachedTemplateBody(outcome.body);
      setSelectedTemplateId(templateId);
    } else if (outcome.kind === 'CLEAR') {
      setBody('');
      setAttachedTemplateBody(null);
      setSelectedTemplateId(NO_TEMPLATE_ID);
    } else {
      setSelectedTemplateId(templateId);
    }

    // A template change invalidates any previous outcome/error.
    setOutcome(null);
    setError(null);
  };

  const handleBodyChange = (nextBody: string) => {
    setBody(nextBody);

    // Manually editing a template's body detaches the draft from the template.
    // The SAVED template is never touched.
    if (doesBodyEditDetach({ attachedBody: attachedTemplateBody, body: nextBody })) {
      setAttachedTemplateBody(null);
      setSelectedTemplateId(NO_TEMPLATE_ID);
    }
  };

  const templatesPlaceholder =
    templatesState.kind === 'LOADING'
      ? t('Loading templates…')
      : templatesState.kind === 'ERROR'
        ? t('Unable to load templates.')
        : t('No templates available');

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
        // replaced by a translated generic. The SAME severity drives the
        // in-form message and the toast.
        const message = t(presentation.message);

        setErrorVariant(presentation.variant);
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

  // The template picker locks only while a template list is loading (there is
  // nothing to choose yet). It is NOT locked while sending, because sending is
  // guarded by the in-flight ref and the body is only read at submit time.
  const isLockedForTemplate = templatesState.kind === 'LOADING';

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
        <span style={styles.label}>{t('Select a template')}</span>
        <select
          value={selectedTemplateId}
          onChange={(event) => handleSelectTemplate(event.target.value)}
          disabled={templatesState.kind === 'LOADING' || isLockedForTemplate}
          style={styles.control}
        >
          <option value={NO_TEMPLATE_ID}>
            {templates.length === 0 ? templatesPlaceholder : t('No template')}
          </option>
          {templates.map((template) => (
            <option key={template.id} value={template.id}>
              {templateOptionLabel(template)}
            </option>
          ))}
        </select>
        <p style={styles.muted}>
          {t(
            'Selecting a template fills the message. You can edit it before sending.',
          )}
        </p>
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
                {formatDigitsForLocale(phone.value, locale)}
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
          onChange={(event) => handleBodyChange(event.target.value)}
          rows={5}
          style={{ ...styles.control, resize: 'vertical' }}
        />
      </label>

      {error !== null && (
        <p style={errorVariant === 'warning' ? styles.warning : styles.error}>
          {error}
        </p>
      )}

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
