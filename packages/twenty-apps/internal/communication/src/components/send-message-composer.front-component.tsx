import { useCallback, useEffect, useState } from 'react';
import { defineFrontComponent } from 'twenty-sdk/define';
import {
  closeSidePanel,
  enqueueSnackbar,
  unmountFrontComponent,
  useRecordId,
  useTranslate,
} from 'twenty-sdk/front-component';

import { SEND_MESSAGE_COMPOSER_FRONT_COMPONENT_UNIVERSAL_IDENTIFIER } from 'src/constants/universal-identifiers';

// Channels the composer offers. Mirrors the implemented channels only; future
// channels become selectable when their provider ships.
const SUPPORTED_CHANNELS = ['SMS'] as const;

type PhoneOption = {
  id: string;
  value: string;
  isPrimary: boolean;
};

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
  const personId = useRecordId();

  const [channel, setChannel] = useState<string>(SUPPORTED_CHANNELS[0]);
  const [phones, setPhones] = useState<PhoneOption[]>([]);
  const [selectedPhone, setSelectedPhone] = useState('');
  const [loadingPhones, setLoadingPhones] = useState(true);
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadPhones = useCallback(async () => {
    if (!personId) {
      setLoadingPhones(false);
      setError(t("No person is selected."));

      return;
    }

    setLoadingPhones(true);

    try {
      const { data } = await callAppRoute('/communication/person-phones', 'POST', {
        personId,
      });

      if (data.success !== true) {
        setError(typeof data.error === 'string' ? data.error : t("Unable to load phone numbers."));

        return;
      }

      const fetched: PhoneOption[] = data.phones ?? [];

      setPhones(fetched);

      if (fetched.length > 0) {
        setSelectedPhone(fetched[0].value);
      }
    } catch {
      setError(t("Unable to load phone numbers."));
    } finally {
      setLoadingPhones(false);
    }
  }, [personId, t]);

  useEffect(() => {
    loadPhones();
  }, [loadPhones]);

  const trimmedBody = body.trim();
  const canSubmit =
    !sending &&
    !loadingPhones &&
    personId !== null &&
    selectedPhone.length > 0 &&
    trimmedBody.length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || personId === null) {
      return;
    }

    // Guards against duplicate submission while the request is in flight.
    setSending(true);
    setError(null);

    try {
      const { data } = await callAppRoute('/communication/send', 'POST', {
        personId,
        channel,
        recipient: selectedPhone,
        body: trimmedBody,
      });

      if (data.success !== true) {
        const failureMessage =
          typeof data.error === 'string'
            ? data.error
            : t("The message could not be sent.");

        setError(failureMessage);
        await enqueueSnackbar({ message: failureMessage, variant: 'error' });

        return;
      }

      // Only ever reports the truthful provider outcome.
      setOutcome(
        data.status === 'DELIVERED' ? t("Message delivered.") : t("Message sent."),
      );
      await enqueueSnackbar({
        message:
          data.status === 'DELIVERED' ? t("Message delivered.") : t("Message sent."),
        variant: 'success',
      });
    } catch {
      setError(t("The message could not be sent."));
    } finally {
      setSending(false);
    }
  };

  const handleClose = () => {
    unmountFrontComponent();
    closeSidePanel();
  };

  if (outcome !== null) {
    return (
      <div style={{ padding: 16, fontFamily: 'Inter, system-ui, sans-serif' }}>
        <p style={{ margin: '0 0 12px' }}>{outcome}</p>
        <button type="button" onClick={handleClose}>
          {t("Close")}
        </button>
      </div>
    );
  }

  return (
    <div
      style={{
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>{t("Channel")}</span>
        <select value={channel} onChange={(event) => setChannel(event.target.value)}>
          {SUPPORTED_CHANNELS.map((supportedChannel) => (
            <option key={supportedChannel} value={supportedChannel}>
              {supportedChannel}
            </option>
          ))}
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>{t("Phone number")}</span>
        <select
          value={selectedPhone}
          onChange={(event) => setSelectedPhone(event.target.value)}
          disabled={loadingPhones || phones.length === 0}
        >
          {phones.length === 0 ? (
            <option value="">{t("No phone number")}</option>
          ) : (
            phones.map((phone) => (
              <option key={phone.id} value={phone.value}>
                {phone.value}
              </option>
            ))
          )}
        </select>
      </label>

      <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <span>{t("Message")}</span>
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={5}
        />
      </label>

      {error !== null && <p style={{ color: '#e05252', margin: 0 }}>{error}</p>}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <button type="button" onClick={handleClose} disabled={sending}>
          {t("Cancel")}
        </button>
        <button type="button" onClick={handleSubmit} disabled={!canSubmit}>
          {sending ? t("Sending...") : t("Send")}
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
