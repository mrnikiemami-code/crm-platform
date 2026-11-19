import {
  type CSSProperties,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  enqueueSnackbar,
  useSelectedRecordIds,
} from 'twenty-sdk/front-component';

type QuotationRouteBridge = (request: {
  action: string;
  payload?: Record<string, unknown>;
}) => Promise<unknown>;

type LifecycleAction = {
  toStatus: string;
  label: string;
  requiredPermission: string;
  enabled: boolean;
};

type LifecycleSnapshot = {
  quotationId: string;
  status: string;
  version: number;
  name: string | null;
  quotationNumber: string | null;
  contentEditable: boolean;
  contentLocked: boolean;
  isTerminal: boolean;
  actions: LifecycleAction[];
  sentMeansRecordOnly: true;
};

type PanelState =
  | { kind: 'LOADING' }
  | { kind: 'ERROR'; message: string }
  | { kind: 'READY'; lifecycle: LifecycleSnapshot };

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'پیش‌نویس',
  PENDING_INTERNAL_APPROVAL: 'در انتظار تأیید',
  READY_TO_SEND: 'آماده ارسال',
  SENT: 'ارسال ثبت‌شده',
  CUSTOMER_ACCEPTED: 'مورد قبول مشتری',
  CUSTOMER_REJECTED: 'رد شده توسط مشتری',
  EXPIRED: 'منقضی',
  CANCELLED: 'لغو شده',
  CONVERTED: 'تبدیل‌شده',
};

const styles: Record<string, CSSProperties> = {
  root: {
    direction: 'rtl',
    fontFamily: 'var(--t-font-family)',
    color: 'var(--t-font-color-primary)',
    padding: 'var(--t-spacing-4)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--t-spacing-3)',
    height: '100%',
    boxSizing: 'border-box',
  },
  title: {
    margin: 0,
    fontSize: 'var(--t-font-size-md)',
    fontWeight: 'var(--t-font-weight-semi-bold)',
  },
  meta: {
    margin: 0,
    fontSize: 'var(--t-font-size-sm)',
    color: 'var(--t-font-color-secondary)',
  },
  notice: {
    margin: 0,
    fontSize: 'var(--t-font-size-sm)',
    color: 'var(--t-font-color-secondary)',
    background: 'var(--t-background-secondary)',
    padding: 'var(--t-spacing-3)',
    borderRadius: 'var(--t-border-radius-sm)',
  },
  actions: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--t-spacing-2)',
  },
  button: {
    border: '1px solid var(--t-border-color-medium)',
    background: 'var(--t-background-primary)',
    color: 'var(--t-font-color-primary)',
    borderRadius: 'var(--t-border-radius-sm)',
    padding: 'var(--t-spacing-2) var(--t-spacing-3)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 'var(--t-font-size-sm)',
    textAlign: 'right',
  },
  buttonDisabled: {
    opacity: 0.45,
    cursor: 'not-allowed',
  },
  buttonPrimary: {
    background: 'var(--t-color-blue)',
    color: 'var(--t-font-color-inverted)',
    borderColor: 'var(--t-color-blue)',
  },
  error: {
    color: 'var(--t-color-red)',
    fontSize: 'var(--t-font-size-sm)',
    margin: 0,
  },
};

const readQuotationBridge = (): QuotationRouteBridge | null => {
  const api = (
    globalThis as unknown as {
      frontComponentHostCommunicationApi?: {
        callQuotationRoute?: QuotationRouteBridge;
      };
    }
  ).frontComponentHostCommunicationApi;

  return typeof api?.callQuotationRoute === 'function'
    ? api.callQuotationRoute
    : null;
};

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

export const QuotationLifecyclePanel = () => {
  const selectedIds = useSelectedRecordIds();
  const quotationId = selectedIds[0] ?? null;
  const [state, setState] = useState<PanelState>({ kind: 'LOADING' });
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);

  const loadLifecycle = useCallback(async () => {
    if (quotationId === null) {
      setState({
        kind: 'ERROR',
        message: 'پیش‌فاکتوری انتخاب نشده است.',
      });
      return;
    }

    const bridge = readQuotationBridge();

    if (bridge === null) {
      setState({
        kind: 'ERROR',
        message:
          'پل ارتباطی میزبان در دسترس نیست. صفحه را تازه کنید یا از نسخهٔ به‌روز فرانت استفاده کنید.',
      });
      return;
    }

    setState({ kind: 'LOADING' });

    const response = asRecord(
      await bridge({
        action: 'get-lifecycle',
        payload: { quotationId },
      }),
    );

    if (response?.success !== true) {
      setState({
        kind: 'ERROR',
        message:
          typeof response?.message === 'string'
            ? response.message
            : 'بارگذاری وضعیت پیش‌فاکتور ناموفق بود.',
      });
      return;
    }

    const lifecycle = asRecord(response.lifecycle);

    if (lifecycle === null) {
      setState({
        kind: 'ERROR',
        message: 'پاسخ وضعیت نامعتبر است.',
      });
      return;
    }

    setState({
      kind: 'READY',
      lifecycle: lifecycle as unknown as LifecycleSnapshot,
    });
  }, [quotationId]);

  useEffect(() => {
    void loadLifecycle();
  }, [loadLifecycle]);

  const runAction = async (action: string, payload: Record<string, unknown>) => {
    if (busyRef.current) {
      return;
    }

    const bridge = readQuotationBridge();

    if (bridge === null || quotationId === null) {
      return;
    }

    busyRef.current = true;
    setBusy(true);

    try {
      const response = asRecord(
        await bridge({
          action,
          payload: { quotationId, ...payload },
        }),
      );

      if (response?.success !== true) {
        await enqueueSnackbar({
          message:
            typeof response?.message === 'string'
              ? response.message
              : 'عملیات انجام نشد.',
          variant: 'error',
        });
        return;
      }

      if (action === 'generate-pdf') {
        // Host bridge performs the real browser download; worker only confirms.
        await enqueueSnackbar({
          message:
            typeof response.message === 'string'
              ? response.message
              : 'PDF دانلود شد.',
          variant: 'success',
        });
        return;
      }

      await enqueueSnackbar({
        message:
          typeof response.message === 'string'
            ? response.message
            : 'وضعیت به‌روز شد.',
        variant: 'success',
      });
      await loadLifecycle();
    } catch {
      await enqueueSnackbar({
        message: 'ارتباط با سرور برقرار نشد.',
        variant: 'error',
      });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (state.kind === 'LOADING') {
    return (
      <div style={styles.root} dir="rtl">
        <p style={styles.meta}>در حال بارگذاری…</p>
      </div>
    );
  }

  if (state.kind === 'ERROR') {
    return (
      <div style={styles.root} dir="rtl">
        <p style={styles.error}>{state.message}</p>
        <button type="button" style={styles.button} onClick={() => void loadLifecycle()}>
          تلاش دوباره
        </button>
      </div>
    );
  }

  const { lifecycle } = state;
  const statusLabel = STATUS_LABELS[lifecycle.status] ?? lifecycle.status;

  return (
    <div style={styles.root} dir="rtl">
      <h2 style={styles.title}>گردش وضعیت</h2>
      <p style={styles.meta}>
        وضعیت: {statusLabel}
        {lifecycle.quotationNumber
          ? ` — شماره ${lifecycle.quotationNumber}`
          : ''}
        {` — نسخه ${lifecycle.version}`}
      </p>

      {lifecycle.contentLocked ? (
        <p style={styles.notice}>
          محتوای پیش‌فاکتور قفل است. ویرایش ردیف‌ها و فیلدهای محتوا ممکن نیست؛ فقط
          عملیات مجاز وضعیت در دسترس است.
        </p>
      ) : (
        <p style={styles.notice}>
          ذخیره و ویرایش پیش‌نویس از زبانهٔ «فیلدها» یا فرم ایجاد انجام می‌شود.
        </p>
      )}

      {lifecycle.status === 'SENT' ||
      lifecycle.status === 'READY_TO_SEND' ? (
        <p style={styles.notice}>
          «ثبت ارسال» فقط ثبت داخلی است و به معنی ارسال واقعی از کانال پیامک/ایمیل
          نیست. تصمیم مشتری در این مرحله داخلی ثبت می‌شود.
        </p>
      ) : null}

      <div style={styles.actions}>
        {lifecycle.actions.map((action) => {
          const disabled = busy || !action.enabled;

          return (
            <button
              key={action.toStatus}
              type="button"
              disabled={disabled}
              style={{
                ...styles.button,
                ...(action.toStatus === 'READY_TO_SEND' ||
                action.toStatus === 'SENT'
                  ? styles.buttonPrimary
                  : {}),
                ...(disabled ? styles.buttonDisabled : {}),
              }}
              title={
                action.enabled
                  ? undefined
                  : `نیاز به مجوز ${action.requiredPermission}`
              }
              onClick={() =>
                void runAction('transition', {
                  toStatus: action.toStatus,
                  version: lifecycle.version,
                })
              }
            >
              {action.label}
            </button>
          );
        })}

        <button
          type="button"
          disabled={busy}
          style={{
            ...styles.button,
            ...(busy ? styles.buttonDisabled : {}),
          }}
          onClick={() => void runAction('generate-pdf', {})}
        >
          دانلود PDF فارسی
        </button>

        <button
          type="button"
          disabled={busy}
          style={styles.button}
          onClick={() => void loadLifecycle()}
        >
          تازه کردن وضعیت
        </button>
      </div>
    </div>
  );
};
