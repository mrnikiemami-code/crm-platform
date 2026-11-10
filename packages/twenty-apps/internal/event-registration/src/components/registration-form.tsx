import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import {
  closeSidePanel,
  enqueueSnackbar,
  useObjectNameSingular,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';

import {
  formatAmountForDisplay,
  parseAmountToNumber,
} from 'src/components/money-amount';
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
// Layout targets the side panel (400–450px) and stays usable narrower: every
// block is full width with `minWidth: 0`, so long Persian names wrap instead of
// forcing a horizontal scrollbar. Nothing here decides what a registration
// means — the plan and service layers do — and the preview-only source switch
// lives in the harness, not in this file.

type PrepareState =
  | { kind: 'LOADING' }
  | {
      kind: 'READY';
      leadId: string;
      leadName: string | null;
      personId: string;
      personName: string | null;
      eventId: string;
      eventName: string | null;
      performedByName: string | null;
    }
  | { kind: 'ALREADY_REGISTERED'; registrationId: string }
  | { kind: 'UNAVAILABLE'; message: string };

// API values are fixed; only the labels are Persian.
const STATUS_OPTIONS = [
  {
    value: 'PYSHTHBTNM',
    label: 'پیش‌ثبت‌نام',
    hint: 'ثبت‌نام در مرحله اولیه',
  },
  {
    value: 'THBTNM_QTAAY',
    label: 'ثبت‌نام قطعی',
    hint: 'ثبت‌نام نهایی‌شده',
  },
] as const;

const PROBLEM_MESSAGES: Record<string, string> = {
  SOURCE_NOT_FOUND: 'این رکورد پیدا نشد یا از نوع پشتیبانی‌شده نیست.',
  NO_LEAD_FOR_INTERACTION: 'این پیگیری به هیچ سرنخی وصل نیست.',
  NO_PERSON_ON_LEAD: 'سرنخ مرتبط، شخص ندارد. اول شخص را به سرنخ وصل کنید.',
  NO_EVENT_ON_LEAD: 'سرنخ به هیچ همایشی وصل نیست.',
  STATUS_NOT_OFFERED: 'وضعیت انتخاب‌شده مجاز نیست.',
  AMOUNT_NOT_A_NUMBER: 'مبلغ وارد‌شده عدد معتبر نیست.',
  AMOUNT_NEGATIVE: 'مبلغ نمی‌تواند منفی باشد.',
  OPERATOR_CONTEXT_MISSING:
    'هویت کاربر تأیید نشد، بنابراین ثبت‌نام انجام نشد. دوباره وارد شوید.',
  OPERATOR_MISMATCH:
    'هویت کاربر با این درخواست هم‌خوان نیست، بنابراین ثبت‌نام انجام نشد.',
};

const readString = (value: unknown): string =>
  typeof value === 'string' ? value : '';

const SummaryRow = ({
  label,
  value,
  emphasis = false,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) => (
  <div style={styles.summaryRow}>
    <span style={styles.summaryLabel}>{label}</span>
    <span style={emphasis ? styles.summaryValueStrong : styles.summaryValue}>
      {value}
    </span>
  </div>
);

const AmountField = ({
  id,
  label,
  hint,
  value,
  disabled,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
}) => (
  <div style={styles.field}>
    <label style={styles.label} htmlFor={id}>
      {label}
    </label>
    <input
      id={id}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      // Digits are neutral; keeping the field LTR while aligning to the start
      // is what stops the grouped value from reordering around the separator.
      dir="ltr"
      style={
        disabled ? { ...styles.amountInput, ...styles.inputDisabled } : styles.amountInput
      }
      value={value}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
    />
    {hint !== undefined && <p style={styles.hint}>{hint}</p>}
  </div>
);

export const RegistrationForm = () => {
  const selectedRecordIds = useSelectedRecordIds();
  const objectNameSingular = useObjectNameSingular();

  const [prepare, setPrepare] = useState<PrepareState>({ kind: 'LOADING' });
  const [registrationStatus, setRegistrationStatus] = useState<string>(
    STATUS_OPTIONS[0].value,
  );
  // The state holds what the user SEES (grouped); the payload is parsed from it.
  const [agreedAmountText, setAgreedAmountText] = useState<string>('');
  const [paidAmountText, setPaidAmountText] = useState<string>('0');
  const [submitting, setSubmitting] = useState(false);

  // A synchronous guard: two clicks cannot both reach the server, and no second
  // registration is attempted while the first is still open.
  const inFlight = useRef(false);

  const sourceRecordId =
    selectedRecordIds.length === 1 ? selectedRecordIds[0] : null;

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
          personName: readString(response.data.personName) || null,
          eventId: readString(response.data.eventId),
          eventName: readString(response.data.eventName) || null,
          performedByName: readString(response.data.performedByName) || null,
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
        // The contract is unchanged: a plain integer, or null when not given.
        agreedAmountToman: parseAmountToNumber(agreedAmountText),
        paidAmountToman: parseAmountToNumber(paidAmountText),
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
    agreedAmountText,
    objectNameSingular,
    paidAmountText,
    prepare.kind,
    registrationStatus,
    sourceRecordId,
  ]);

  if (prepare.kind === 'LOADING') {
    return (
      <div dir="rtl" lang="fa" style={styles.shell}>
        <div style={styles.stateCard}>
          <span style={styles.stateTitle}>در حال خواندن اطلاعات…</span>
          <span style={styles.stateBody}>
            اطلاعات مشتری و همایش از رکورد انتخاب‌شده خوانده می‌شود.
          </span>
        </div>
      </div>
    );
  }

  if (prepare.kind === 'UNAVAILABLE') {
    return (
      <div dir="rtl" lang="fa" style={styles.shell}>
        <div style={{ ...styles.stateCard, ...styles.stateCardError }}>
          <span style={styles.stateTitle}>امکان ثبت‌نام نیست</span>
          <span style={styles.stateBody}>{prepare.message}</span>
        </div>
      </div>
    );
  }

  if (prepare.kind === 'ALREADY_REGISTERED') {
    return (
      <div dir="rtl" lang="fa" style={styles.shell}>
        <div style={{ ...styles.stateCard, ...styles.stateCardInfo }}>
          <span style={styles.stateTitle}>قبلاً ثبت‌نام شده است</span>
          <span style={styles.stateBody}>
            برای این سرنخ یک ثبت‌نام موجود است؛ ثبت‌نام تکراری ساخته نمی‌شود.
          </span>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" lang="fa" style={styles.shell}>
      <header style={styles.header}>
        <h2 style={styles.heading}>ثبت‌نام همایش</h2>
        <p style={styles.subheading}>
          اطلاعات مشتری به‌صورت خودکار از رکورد انتخاب‌شده پر شده است.
        </p>
      </header>

      <section style={styles.summaryCard} aria-label="خلاصه مشتری">
        <SummaryRow
          label="مشتری"
          value={prepare.personName ?? prepare.personId}
          emphasis
        />
        <SummaryRow label="همایش" value={prepare.eventName ?? prepare.eventId} />
        {prepare.performedByName !== null && (
          <SummaryRow label="کارشناس تماس" value={prepare.performedByName} />
        )}
      </section>

      <div style={styles.field}>
        <span style={styles.label} id="registration-status-label">
          وضعیت ثبت‌نام
        </span>
        <div
          role="radiogroup"
          aria-labelledby="registration-status-label"
          style={styles.segmented}
        >
          {STATUS_OPTIONS.map((option) => {
            const isActive = registrationStatus === option.value;

            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={isActive}
                disabled={submitting}
                onClick={() => setRegistrationStatus(option.value)}
                style={isActive ? styles.segmentActive : styles.segment}
              >
                <span style={isActive ? styles.segmentLabelActive : styles.segmentLabel}>
                  {option.label}
                </span>
                <span style={isActive ? styles.segmentHintActive : styles.segmentHint}>
                  {option.hint}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <AmountField
        id="registration-agreed"
        label="مبلغ توافق‌شده (تومان)"
        value={agreedAmountText}
        disabled={submitting}
        onChange={(next) => setAgreedAmountText(formatAmountForDisplay(next))}
      />

      <AmountField
        id="registration-paid"
        label="مبلغ پرداخت‌شده (تومان)"
        hint="اگر پرداختی دریافت نشده، مبلغ را صفر بگذارید تا رکورد پرداخت ساخته نشود."
        value={paidAmountText}
        disabled={submitting}
        onChange={(next) => setPaidAmountText(formatAmountForDisplay(next))}
      />

      {/*
        `data-registration-save` is the handle the PREVIEW harness uses to disable
        this control. It is an attribute, not a behaviour: the real form keeps
        its normal enabled state and its normal submit path.
      */}
      <button
        type="button"
        data-registration-save="true"
        onClick={() => {
          void handleSubmit();
        }}
        disabled={submitting}
        style={submitting ? styles.submitDisabled : styles.submit}
      >
        {submitting ? 'در حال ذخیره…' : 'ذخیره ثبت‌نام'}
      </button>
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  shell: {
    boxSizing: 'border-box',
    color: '#1f2937',
    direction: 'rtl',
    display: 'flex',
    flexDirection: 'column',
    fontFamily: 'inherit',
    gap: 16,
    maxWidth: 460,
    padding: 16,
    width: '100%',
  },
  header: { display: 'flex', flexDirection: 'column', gap: 4 },
  heading: { fontSize: 15, fontWeight: 700, margin: 0 },
  subheading: {
    color: '#6b7280',
    fontSize: 11.5,
    lineHeight: 1.7,
    margin: 0,
  },
  summaryCard: {
    background: '#f7f7f8',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    padding: 12,
  },
  summaryRow: {
    display: 'grid',
    gap: 6,
    gridTemplateColumns: '72px minmax(0, 1fr)',
    alignItems: 'start',
  },
  summaryLabel: { color: '#6b7280', fontSize: 11.5, lineHeight: 1.7 },
  summaryValue: {
    fontSize: 13,
    lineHeight: 1.6,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  summaryValueStrong: {
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.6,
    minWidth: 0,
    overflowWrap: 'anywhere',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  label: { color: '#374151', fontSize: 11.5, fontWeight: 600 },
  segmented: {
    border: '1px solid #d1d5db',
    borderRadius: 8,
    display: 'flex',
    overflow: 'hidden',
  },
  segment: {
    background: '#fff',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
    padding: '9px 8px',
    textAlign: 'center',
  },
  segmentActive: {
    background: '#31363f',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    gap: 2,
    minWidth: 0,
    padding: '9px 8px',
    textAlign: 'center',
  },
  segmentLabel: { color: '#1f2937', fontSize: 12.5, fontWeight: 600 },
  segmentLabelActive: { color: '#fff', fontSize: 12.5, fontWeight: 600 },
  segmentHint: { color: '#9ca3af', fontSize: 10.5 },
  segmentHintActive: { color: '#d1d5db', fontSize: 10.5 },
  amountInput: {
    background: '#fff',
    border: '1px solid #d1d5db',
    borderRadius: 8,
    boxSizing: 'border-box',
    fontSize: 14,
    fontVariantNumeric: 'tabular-nums',
    padding: '10px 12px',
    textAlign: 'right',
    width: '100%',
  },
  inputDisabled: { background: '#f3f4f6', color: '#9ca3af' },
  hint: {
    color: '#6b7280',
    fontSize: 10.5,
    lineHeight: 1.7,
    margin: 0,
  },
  submit: {
    background: '#31363f',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13.5,
    fontWeight: 600,
    marginTop: 4,
    padding: '12px 16px',
    width: '100%',
  },
  submitDisabled: {
    background: '#9ca3af',
    border: 'none',
    borderRadius: 8,
    color: '#fff',
    cursor: 'default',
    fontSize: 13.5,
    fontWeight: 600,
    marginTop: 4,
    padding: '12px 16px',
    width: '100%',
  },
  stateCard: {
    background: '#f7f7f8',
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    padding: 12,
  },
  stateCardError: { background: '#fef2f2', borderColor: '#fecaca' },
  stateCardInfo: { background: '#eff6ff', borderColor: '#bfdbfe' },
  stateTitle: { fontSize: 13, fontWeight: 600 },
  stateBody: { color: '#4b5563', fontSize: 11.5, lineHeight: 1.8 },
};
