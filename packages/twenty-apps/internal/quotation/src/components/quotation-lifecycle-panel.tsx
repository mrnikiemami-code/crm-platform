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

type HostClipboard = (request: { text: string }) => Promise<unknown>;

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
  heldPermissions?: string[];
  actions: LifecycleAction[];
  sentMeansRecordOnly: true;
};

type PanelState =
  | { kind: 'LOADING' }
  | { kind: 'ERROR'; message: string }
  | { kind: 'READY'; lifecycle: LifecycleSnapshot };

const CUSTOMER_LINK_STATUSES = new Set([
  'READY_TO_SEND',
  'SENT',
  'CUSTOMER_ACCEPTED',
  'CUSTOMER_REJECTED',
]);

const SHARE_CHANNELS = [
  { value: 'BALE', label: 'بله' },
  { value: 'WHATSAPP', label: 'واتساپ' },
  { value: 'TELEGRAM', label: 'تلگرام' },
  { value: 'INSTAGRAM', label: 'اینستاگرام' },
  { value: 'EITAA', label: 'ایتا' },
  { value: 'RUBIKA', label: 'روبیکا' },
  { value: 'SOROUSH', label: 'سروش' },
] as const;

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
  channelRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 'var(--t-spacing-2)',
  },
  channelChip: {
    border: '1px solid var(--t-border-color-medium)',
    background: 'var(--t-background-primary)',
    color: 'var(--t-font-color-primary)',
    borderRadius: 'var(--t-border-radius-sm)',
    padding: 'var(--t-spacing-1) var(--t-spacing-2)',
    cursor: 'pointer',
    fontFamily: 'inherit',
    fontSize: 'var(--t-font-size-sm)',
  },
  channelChipSelected: {
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

const readHostCommunicationApi = (): {
  callQuotationRoute: QuotationRouteBridge | null;
  copyToClipboard: HostClipboard | null;
} => {
  const api = (
    globalThis as unknown as {
      frontComponentHostCommunicationApi?: {
        callQuotationRoute?: QuotationRouteBridge;
        copyToClipboard?: HostClipboard;
      };
    }
  ).frontComponentHostCommunicationApi;

  return {
    callQuotationRoute:
      typeof api?.callQuotationRoute === 'function'
        ? api.callQuotationRoute
        : null,
    copyToClipboard:
      typeof api?.copyToClipboard === 'function' ? api.copyToClipboard : null,
  };
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
  const [customerLink, setCustomerLink] = useState<{
    linkId: string;
    viewUrl: string;
    expiresAt: string;
  } | null>(null);
  const [shareChannel, setShareChannel] = useState<string>('BALE');
  const [shareResult, setShareResult] = useState<{
    shareId: string;
    outcome: string;
    channelLabel: string;
    shareText: string;
    linkId: string;
    customerLabel: string;
  } | null>(null);

  const loadLifecycle = useCallback(async () => {
    if (quotationId === null) {
      setState({
        kind: 'ERROR',
        message: 'پیش‌فاکتوری انتخاب نشده است.',
      });
      return;
    }

    const { callQuotationRoute } = readHostCommunicationApi();

    if (callQuotationRoute === null) {
      setState({
        kind: 'ERROR',
        message:
          'پل ارتباطی میزبان در دسترس نیست. صفحه را تازه کنید یا از نسخهٔ به‌روز فرانت استفاده کنید.',
      });
      return;
    }

    setState({ kind: 'LOADING' });

    const response = asRecord(
      await callQuotationRoute({
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

  const issueCustomerLink = async () => {
    if (busyRef.current || quotationId === null) {
      return;
    }

    const { callQuotationRoute, copyToClipboard } = readHostCommunicationApi();

    if (callQuotationRoute === null) {
      return;
    }

    busyRef.current = true;
    setBusy(true);

    try {
      // Session-cookie bridge: the signed-in user is the actor, not the app token.
      const response = asRecord(
        await callQuotationRoute({
          action: 'create-customer-link',
          payload: { quotationId, ttlHours: 168 },
        }),
      );

      if (response?.success !== true) {
        await enqueueSnackbar({
          message:
            typeof response?.message === 'string'
              ? response.message
              : 'صدور لینک مشتری انجام نشد.',
          variant: 'error',
        });
        return;
      }

      const viewUrl =
        typeof response.viewUrl === 'string' ? response.viewUrl : '';
      const linkId =
        typeof response.linkId === 'string' ? response.linkId : '';

      if (viewUrl === '' || linkId === '') {
        await enqueueSnackbar({
          message: 'لینک مشتری ساخته نشد.',
          variant: 'error',
        });
        return;
      }

      setCustomerLink({
        linkId,
        viewUrl,
        expiresAt:
          typeof response.expiresAt === 'string' ? response.expiresAt : '',
      });

      if (copyToClipboard !== null) {
        await copyToClipboard({ text: viewUrl });
      }

      await enqueueSnackbar({
        message:
          typeof response.message === 'string'
            ? response.message
            : 'لینک مشتری صادر شد.',
        variant: 'success',
      });
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

  const shareQuotationOnChannel = async () => {
    if (busyRef.current || quotationId === null) {
      return;
    }

    const { callQuotationRoute, copyToClipboard } = readHostCommunicationApi();

    if (callQuotationRoute === null) {
      return;
    }

    busyRef.current = true;
    setBusy(true);

    try {
      const response = asRecord(
        await callQuotationRoute({
          action: 'share-quotation',
          payload: {
            quotationId,
            channel: shareChannel,
            ttlHours: 168,
          },
        }),
      );

      if (response?.success !== true) {
        await enqueueSnackbar({
          message:
            typeof response?.message === 'string'
              ? response.message
              : 'اشتراک‌گذاری انجام نشد.',
          variant: 'error',
        });
        return;
      }

      const shareText =
        typeof response.shareText === 'string' ? response.shareText : '';
      const viewUrl =
        typeof response.viewUrl === 'string' ? response.viewUrl : '';
      const linkId =
        typeof response.linkId === 'string' ? response.linkId : '';
      const shareId =
        typeof response.shareId === 'string' ? response.shareId : '';
      const outcome =
        typeof response.outcome === 'string' ? response.outcome : '';

      if (shareText === '' || linkId === '' || shareId === '') {
        await enqueueSnackbar({
          message: 'پاسخ اشتراک‌گذاری ناقص بود.',
          variant: 'error',
        });
        return;
      }

      setShareResult({
        shareId,
        outcome,
        channelLabel:
          typeof response.channelLabel === 'string'
            ? response.channelLabel
            : shareChannel,
        shareText,
        linkId,
        customerLabel:
          typeof response.customerLabel === 'string'
            ? response.customerLabel
            : '',
      });

      if (viewUrl !== '') {
        setCustomerLink({
          linkId,
          viewUrl,
          expiresAt: '',
        });
      }

      if (copyToClipboard !== null) {
        await copyToClipboard({ text: shareText });
      }

      await enqueueSnackbar({
        message:
          typeof response.message === 'string'
            ? response.message
            : 'متن اشتراک آماده شد.',
        variant: outcome === 'MANUAL_SHARE' ? 'info' : 'success',
      });
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

  const revokeIssuedCustomerLink = async () => {
    if (busyRef.current || customerLink === null || quotationId === null) {
      return;
    }

    const { callQuotationRoute } = readHostCommunicationApi();

    if (callQuotationRoute === null) {
      return;
    }

    busyRef.current = true;
    setBusy(true);

    try {
      const response = asRecord(
        await callQuotationRoute({
          action: 'revoke-customer-link',
          payload: {
            quotationId,
            linkId: customerLink.linkId,
          },
        }),
      );

      if (response?.success !== true) {
        await enqueueSnackbar({
          message:
            typeof response?.message === 'string'
              ? response.message
              : 'لغو لینک مشتری انجام نشد.',
          variant: 'error',
        });
        return;
      }

      setCustomerLink(null);
      await enqueueSnackbar({
        message:
          typeof response.message === 'string'
            ? response.message
            : 'لینک مشتری لغو شد.',
        variant: 'success',
      });
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

  const runAction = async (action: string, payload: Record<string, unknown>) => {
    if (busyRef.current) {
      return;
    }

    const { callQuotationRoute } = readHostCommunicationApi();

    if (callQuotationRoute === null || quotationId === null) {
      return;
    }

    busyRef.current = true;
    setBusy(true);

    try {
      const response = asRecord(
        await callQuotationRoute({
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
  const canManageCustomerLink =
    Array.isArray(lifecycle.heldPermissions) &&
    lifecycle.heldPermissions.includes('quotation.send');

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

        {CUSTOMER_LINK_STATUSES.has(lifecycle.status) ? (
          <>
            <button
              type="button"
              disabled={busy || !canManageCustomerLink}
              style={{
                ...styles.button,
                ...(busy || !canManageCustomerLink
                  ? styles.buttonDisabled
                  : {}),
              }}
              title={
                canManageCustomerLink
                  ? undefined
                  : 'نیاز به مجوز quotation.send'
              }
              onClick={() => void issueCustomerLink()}
            >
              صدور لینک مشاهده مشتری
            </button>

            <p style={styles.meta}>ارسال پیش‌فاکتور — انتخاب کانال</p>
            <div style={styles.channelRow}>
              {SHARE_CHANNELS.map((channel) => {
                const selected = shareChannel === channel.value;

                return (
                  <button
                    key={channel.value}
                    type="button"
                    disabled={busy || !canManageCustomerLink}
                    style={{
                      ...styles.channelChip,
                      ...(selected ? styles.channelChipSelected : {}),
                      ...(busy || !canManageCustomerLink
                        ? styles.buttonDisabled
                        : {}),
                    }}
                    onClick={() => setShareChannel(channel.value)}
                  >
                    {channel.label}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={busy || !canManageCustomerLink}
              style={{
                ...styles.button,
                ...styles.buttonPrimary,
                ...(busy || !canManageCustomerLink
                  ? styles.buttonDisabled
                  : {}),
              }}
              title={
                canManageCustomerLink
                  ? 'برای کانال‌های بدون اتصال واقعی فقط کپی متن/لینک انجام می‌شود'
                  : 'نیاز به مجوز quotation.send'
              }
              onClick={() => void shareQuotationOnChannel()}
            >
              ارسال پیش‌فاکتور
            </button>
            <p style={styles.notice}>
              پیام‌رسان‌ها هنوز به Provider Registry وصل نیستند؛ نتیجهٔ واقعی
              «اشتراک‌گذاری دستی» ثبت می‌شود و ارسال موفق جعلی نوشته نمی‌شود.
            </p>
          </>
        ) : null}

        {shareResult !== null ? (
          <div style={styles.notice}>
            <p style={styles.meta}>
              نتیجه: {shareResult.outcome === 'MANUAL_SHARE'
                ? 'اشتراک‌گذاری دستی'
                : shareResult.outcome}
              {` — ${shareResult.channelLabel}`}
              {shareResult.customerLabel
                ? ` — مشتری ${shareResult.customerLabel}`
                : ''}
            </p>
            <p style={styles.meta}>
              شناسه اشتراک: {shareResult.shareId} — لینک: {shareResult.linkId}
            </p>
            <pre
              style={{
                ...styles.meta,
                whiteSpace: 'pre-wrap',
                margin: 0,
              }}
            >
              {shareResult.shareText}
            </pre>
          </div>
        ) : null}

        {customerLink !== null ? (
          <>
            <p style={styles.notice}>
              لینک فقط یک‌بار نمایش داده می‌شود. توکن در سامانه ذخیره نمی‌شود.
              {customerLink.expiresAt
                ? ` انقضا: ${customerLink.expiresAt}`
                : ''}
            </p>
            <p style={styles.meta}>{customerLink.viewUrl}</p>
            <button
              type="button"
              disabled={busy}
              style={{
                ...styles.button,
                ...(busy ? styles.buttonDisabled : {}),
              }}
              onClick={() => void revokeIssuedCustomerLink()}
            >
              لغو همین لینک
            </button>
          </>
        ) : null}

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
