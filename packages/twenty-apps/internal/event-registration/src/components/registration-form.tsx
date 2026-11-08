import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import {
  closeSidePanel,
  enqueueSnackbar,
  useObjectNameSingular,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';

import {
  PREPARE_ROUTE,
  SAVE_ROUTE,
  callAppRoute,
} from 'src/components/registration-api';

// One form, two entry points. The host opens this component from the record
// page of a lead AND from the record page of a sales interaction; the component
// itself asks the server which lead the selected record resolves to, so the same
// code path serves both and neither object name is hardcoded here.
//
// The sandbox ships no UI kit, so the markup below is plain elements with inline
// styles. Nothing is rendered until the server has answered, which is what keeps
// the "already registered" case from ever showing a create button.

type PrepareState =
  | { kind: 'LOADING' }
  | {
      kind: 'READY';
      leadId: string;
      leadName: string | null;
      personId: string;
      eventId: string;
    }
  | { kind: 'ALREADY_REGISTERED'; registrationId: string }
  | { kind: 'UNAVAILABLE'; message: string };

const STATUS_OPTIONS = [
  { value: 'PYSHTHBTNM', label: 'پیش‌ثبت‌نام' },
  { value: 'THBTNM_QTAAY', label: 'ثبت‌نام قطعی' },
] as const;

const PROBLEM_MESSAGES: Record<string, string> = {
  SOURCE_NOT_FOUND: 'این رکورد پیدا نشد یا از نوع پشتیبانی‌شده نیست.',
  NO_LEAD_FOR_INTERACTION: 'این پیگیری به هیچ سرنخی وصل نیست.',
  NO_PERSON_ON_LEAD: 'سرنخ مرتبط، شخص ندارد. اول شخص را به سرنخ وصل کنید.',
  NO_EVENT_ON_LEAD: 'سرنخ به هیچ همایشی وصل نیست.',
  STATUS_NOT_OFFERED: 'وضعیت انتخاب‌شده مجاز نیست.',
  AMOUNT_NOT_A_NUMBER: 'مبلغ وارد‌شده عدد معتبر نیست.',
  AMOUNT_NEGATIVE: 'مبلغ نمی‌تواند منفی باشد.',
};

const readString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

export const RegistrationForm = () => {
  const selectedRecordIds = useSelectedRecordIds();
  const objectNameSingular = useObjectNameSingular();

  const [prepare, setPrepare] = useState<PrepareState>({ kind: 'LOADING' });
  const [registrationStatus, setRegistrationStatus] = useState<string>(
    STATUS_OPTIONS[0].value,
  );
  const [agreedAmount, setAgreedAmount] = useState<string>('');
  const [paidAmount, setPaidAmount] = useState<string>('0');
  const [submitting, setSubmitting] = useState(false);

  // A synchronous guard: two clicks cannot both reach the server, and no second
  // registration is attempted while the first is still open.
  const inFlight = useRef(false);

  const sourceRecordId = selectedRecordIds.length === 1 ? selectedRecordIds[0] : null;

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      if (sourceRecordId === null || objectNameSingular === null) {
        setPrepare({
          kind: 'UNAVAILABLE',
          message: 'دقیقاً یک رکورد را انتخاب کنید.',
        });

        return;
      }

      try {
        const response = await callAppRoute(PREPARE_ROUTE, {
          sourceObjectNameSingular: objectNameSingular,
          sourceRecordId,
        });

        if (cancelled) {
          return;
        }

        if (response.data.success !== true) {
          const reason = readString(response.data.reason);

          setPrepare({
            kind: 'UNAVAILABLE',
            message:
              PROBLEM_MESSAGES[reason] ??
              'اطلاعات این رکورد خوانده نشد. دوباره تلاش کنید.',
          });

          return;
        }

        const existing = response.data.existingRegistration as
          | Record<string, unknown>
          | null
          | undefined;
        const existingId =
          existing !== null && existing !== undefined
            ? readString(existing.id)
            : '';

        if (existingId.length > 0) {
          setPrepare({ kind: 'ALREADY_REGISTERED', registrationId: existingId });

          return;
        }

        setPrepare({
          kind: 'READY',
          leadId: readString(response.data.leadId),
          leadName: readString(response.data.leadName) || null,
          personId: readString(response.data.personId),
          eventId: readString(response.data.eventId),
        });
      } catch {
        if (!cancelled) {
          setPrepare({
            kind: 'UNAVAILABLE',
            message: 'ارتباط با سرور برقرار نشد.',
          });
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [objectNameSingular, sourceRecordId]);

  const handleSubmit = useCallback(async () => {
    if (prepare.kind !== 'READY' || sourceRecordId === null) {
      return;
    }

    if (inFlight.current) {
      return;
    }

    inFlight.current = true;
    setSubmitting(true);

    try {
      const response = await callAppRoute(SAVE_ROUTE, {
        sourceObjectNameSingular: objectNameSingular,
        sourceRecordId,
        registrationStatus,
        agreedAmountToman:
          agreedAmount.trim().length === 0 ? null : Number(agreedAmount),
        paidAmountToman:
          paidAmount.trim().length === 0 ? null : Number(paidAmount),
      });

      const outcome = response.data.outcome as
        | Record<string, unknown>
        | null
        | undefined;
      const kind = readString(outcome?.kind);

      if (kind === 'CREATED') {
        const paymentId = readString(outcome?.paymentId);

        enqueueSnackbar({
          message:
            paymentId.length > 0
              ? 'ثبت‌نام و پرداخت ثبت شد.'
              : 'ثبت‌نام بدون پرداخت ثبت شد.',
          variant: 'success',
        });
        closeSidePanel();

        return;
      }

      if (kind === 'ALREADY_REGISTERED') {
        enqueueSnackbar({
          message: 'برای این سرنخ قبلاً ثبت‌نام ثبت شده است.',
          variant: 'info',
        });
        setPrepare({
          kind: 'ALREADY_REGISTERED',
          registrationId: readString(outcome?.registrationId),
        });

        return;
      }

      if (kind === 'REGISTERED_BUT_PAYMENT_FAILED') {
        // Truthful partial result: the registration IS saved. The form says so
        // and does not invite a retry that would duplicate it.
        enqueueSnackbar({
          message:
            'ثبت‌نام ذخیره شد، ولی پرداخت ثبت نشد. پرداخت را جداگانه وارد کنید.',
          variant: 'warning',
        });
        setPrepare({
          kind: 'ALREADY_REGISTERED',
          registrationId: readString(outcome?.registrationId),
        });

        return;
      }

      if (kind === 'REJECTED') {
        enqueueSnackbar({
          message:
            PROBLEM_MESSAGES[readString(outcome?.reason)] ??
            'اطلاعات کامل نیست.',
          variant: 'error',
        });

        return;
      }

      enqueueSnackbar({
        message:
          readString(outcome?.message) || 'ذخیره نشد. دوباره تلاش کنید.',
        variant: 'error',
      });
    } catch {
      enqueueSnackbar({
        message: 'ارتباط با سرور قطع شد. وضعیت ذخیره نامشخص است.',
        variant: 'error',
      });
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }, [
    agreedAmount,
    objectNameSingular,
    paidAmount,
    prepare.kind,
    registrationStatus,
    sourceRecordId,
  ]);

  if (prepare.kind === 'LOADING') {
    return <p style={styles.muted}>در حال خواندن اطلاعات…</p>;
  }

  if (prepare.kind === 'UNAVAILABLE') {
    return <p style={styles.error}>{prepare.message}</p>;
  }

  if (prepare.kind === 'ALREADY_REGISTERED') {
    return (
      <div style={styles.panel}>
        <p style={styles.title}>قبلاً ثبت‌نام شده است</p>
        <p style={styles.muted}>
          برای این سرنخ یک ثبت‌نام موجود است و ثبت‌نام تکراری ساخته نمی‌شود.
        </p>
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      <p style={styles.title}>ثبت‌نام همایش</p>

      <dl style={styles.facts}>
        <dt style={styles.term}>شخص</dt>
        <dd style={styles.value}>{prepare.leadName ?? '—'}</dd>
        <dt style={styles.term}>سرنخ</dt>
        <dd style={styles.value}>{prepare.leadId}</dd>
        <dt style={styles.term}>همایش</dt>
        <dd style={styles.value}>{prepare.eventId}</dd>
      </dl>

      <label style={styles.label} htmlFor="registration-status">
        وضعیت
      </label>
      <select
        id="registration-status"
        value={registrationStatus}
        onChange={(event) => setRegistrationStatus(event.target.value)}
        disabled={submitting}
        style={styles.input}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <label style={styles.label} htmlFor="registration-agreed">
        مبلغ توافق‌شده (تومان)
      </label>
      <input
        id="registration-agreed"
        type="number"
        inputMode="numeric"
        min={0}
        value={agreedAmount}
        onChange={(event) => setAgreedAmount(event.target.value)}
        disabled={submitting}
        style={styles.input}
      />

      <label style={styles.label} htmlFor="registration-paid">
        مبلغ پرداخت‌شده (تومان)
      </label>
      <input
        id="registration-paid"
        type="number"
        inputMode="numeric"
        min={0}
        value={paidAmount}
        onChange={(event) => setPaidAmount(event.target.value)}
        disabled={submitting}
        style={styles.input}
      />
      <p style={styles.hint}>
        اگر پرداختی دریافت نشده، مبلغ را صفر بگذارید تا رکورد پرداخت ساخته نشود.
      </p>

      <button
        type="button"
        onClick={() => {
          void handleSubmit();
        }}
        disabled={submitting}
        style={submitting ? styles.buttonDisabled : styles.button}
      >
        {submitting ? 'در حال ذخیره…' : 'ذخیره ثبت‌نام'}
      </button>
    </div>
  );
};

// Amounts arrive as strings from the inputs and are converted at the call site;
// a malformed value becomes NaN there so the server rejects it instead of
// treating the money as zero.

const styles: Record<string, CSSProperties> = {
  panel: { display: 'flex', flexDirection: 'column', gap: 8, padding: 16 },
  title: { fontSize: 14, fontWeight: 600, margin: 0 },
  muted: { color: '#666', fontSize: 13, margin: 0, padding: 16 },
  error: { color: '#b3261e', fontSize: 13, margin: 0, padding: 16 },
  facts: {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr',
    gap: 4,
    margin: 0,
    fontSize: 12,
  },
  term: { color: '#666', margin: 0 },
  value: { margin: 0, fontFamily: 'monospace', direction: 'ltr' },
  label: { fontSize: 12, color: '#444', marginTop: 8 },
  input: { padding: 6, fontSize: 13, borderRadius: 4, border: '1px solid #ccc' },
  hint: { fontSize: 11, color: '#888', margin: 0 },
  button: {
    marginTop: 12,
    padding: '8px 12px',
    fontSize: 13,
    borderRadius: 4,
    border: 'none',
    background: '#31363f',
    color: '#fff',
    cursor: 'pointer',
  },
  buttonDisabled: {
    marginTop: 12,
    padding: '8px 12px',
    fontSize: 13,
    borderRadius: 4,
    border: 'none',
    background: '#aaa',
    color: '#fff',
    cursor: 'default',
  },
};
