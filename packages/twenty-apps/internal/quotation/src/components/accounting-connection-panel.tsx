import { useCallback, useEffect, useState } from 'react';
import { enqueueSnackbar, useSelectedRecordIds } from 'twenty-sdk/front-component';

import {
  callAccountingConnectionNestAction,
  ACCOUNTING_OUTBOUND_ROUTE,
  callAppRoute,
} from 'src/components/quotation-api';
import {
  type DocumentPreview,
  type OperationRow,
  type PanelData,
  ConnectionStatus,
  DocumentPreviewPanel,
  OperationTable,
  VERIFICATION_LABELS,
  asRecord,
  readRows,
  readString,
  sharedStyles as styles,
} from 'src/components/accounting/accounting-shared';
import { parseAccountingNestPanel } from 'src/components/accounting/accounting-nest-response';
import { findValidWorkspaceDefaultConnection } from 'src/domain/accounting/resolve-destination';
import { toPersianUiMessage } from 'src/domain/quotation/ui-message';

// The accounting tab of ONE quotation. It answers "can this document travel, and what is
// in the way" — never "which vendor and address does the workspace use". Those belong to
// the standalone settings page, and duplicating that form here would let two surfaces
// disagree about the same destination.
//
// Destination resolution matches settings: only the workspace default (`isDefault` +
// active). Temporary settings selection and row order are never consulted here.
//
// Dispatch itself stays off in this slice: the preview is shown, the send button is not
// offered, and the reason is written on the panel rather than hidden.
export const AccountingConnectionPanel = () => {
  const selectedIds = useSelectedRecordIds();
  const quotationId = selectedIds[0] ?? null;
  const [data, setData] = useState<PanelData | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [readiness, setReadiness] = useState<{
    kind: string;
    detail: string;
  } | null>(null);
  const [documentPreview, setDocumentPreview] =
    useState<DocumentPreview | null>(null);
  const [operations, setOperations] = useState<OperationRow[]>([]);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const connection =
    data === null
      ? null
      : findValidWorkspaceDefaultConnection(data.connections);
  const activeConnectionId = connection?.id ?? null;

  const loadPanel = useCallback(async () => {
    setLoadError(null);

    try {
      const response = await callAccountingConnectionNestAction({
        action: 'list',
      });

      if (!response.ok || response.data.success !== true) {
        setLoadError(
          toPersianUiMessage(
            readString(response.data.message),
            'بارگذاری اتصال حسابداری انجام نشد.',
          ),
        );
        return;
      }

      setData(parseAccountingNestPanel(response.data));
    } catch {
      setLoadError('ارتباط با سرور برقرار نشد.');
    }
  }, []);

  useEffect(() => {
    void loadPanel();
  }, [loadPanel]);

  const checkReadiness = async () => {
    if (busy || activeConnectionId === null || quotationId === null) {
      return;
    }

    setBusy(true);
    setDocumentPreview(null);

    try {
      const response = await callAppRoute(ACCOUNTING_OUTBOUND_ROUTE, {
        action: 'preview-quotation-export',
        connectionId: activeConnectionId,
        quotationId,
      });

      if (!response.ok || response.data.success !== true) {
        await enqueueSnackbar({
          message: toPersianUiMessage(
            readString(response.data.message),
            'بررسی آماده‌بودن سند انجام نشد.',
          ),
          variant: 'error',
        });
        return;
      }

      const previewRecord = asRecord(response.data.preview);
      const decision = asRecord(previewRecord?.decision);

      if (decision === null) {
        setReadiness({
          kind: 'INVALID_RESPONSE',
          detail: 'پاسخ سرور خوانا نبود؛ دوباره تلاش کنید.',
        });
        return;
      }

      const previewDocument = asRecord(previewRecord?.documentPreview);

      setDocumentPreview(
        previewDocument !== null && Array.isArray(previewDocument.checks)
          ? (previewDocument as unknown as DocumentPreview)
          : null,
      );

      setReadiness({
        kind: readString(decision.kind),
        detail: readString(decision.detail) || readString(decision.code),
      });
    } catch {
      await enqueueSnackbar({
        message: 'ارتباط با سرور برقرار نشد.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  const loadHistory = async () => {
    if (busy || activeConnectionId === null || quotationId === null) {
      return;
    }

    setBusy(true);

    try {
      const response = await callAppRoute(ACCOUNTING_OUTBOUND_ROUTE, {
        action: 'operations',
        connectionId: activeConnectionId,
        quotationId,
      });

      if (response.ok && response.data.success === true) {
        setOperations(
          readRows(response.data.operations).map(
            (node) => node as unknown as OperationRow,
          ),
        );
        setHistoryLoaded(true);
      }
    } catch {
      await enqueueSnackbar({
        message: 'ارتباط با سرور برقرار نشد.',
        variant: 'error',
      });
    } finally {
      setBusy(false);
    }
  };

  if (loadError !== null) {
    return (
      <div style={styles.root} dir="rtl">
        <p style={styles.error}>{loadError}</p>
        <button type="button" style={styles.button} onClick={() => void loadPanel()}>
          تلاش دوباره
        </button>
      </div>
    );
  }

  if (data === null) {
    return (
      <div style={styles.root} dir="rtl">
        <p style={styles.meta}>در حال بارگذاری اطلاعات حسابداری…</p>
      </div>
    );
  }

  return (
    <div style={styles.root} dir="rtl">
      <h2 style={styles.title}>حسابداری این پیش‌فاکتور</h2>
      <p style={styles.meta}>
        اتصال مقصد، آماده‌بودن این سند و تاریخچهٔ عملیات آن. تنظیم نرم‌افزار،
        آدرس سرویس و واحد پول در صفحهٔ «تنظیمات حسابداری» سایدبار انجام می‌شود.
      </p>

      <div style={styles.section}>
        <p style={styles.subtitle}>مقصد پیش‌فرض حسابداری فضای کاری</p>
        {connection === null ? (
          <p style={styles.warning}>
            نیازمند انتخاب مقصد پیش‌فرض: هنوز هیچ اتصال فعالی به‌عنوان پیش‌فرض فضای
            کاری ثبت نشده است. از صفحهٔ «تنظیمات حسابداری» یک اتصال را «تنظیم به‌عنوان
            پیش‌فرض» کنید. ترتیب ردیف‌ها یا انتخاب موقت در مرورگر مقصد را تعیین نمی‌کند.
          </p>
        ) : (
          <>
            <p style={styles.meta}>
              {connection.name} — {connection.adapterId} — پیش‌فرض فضای کاری —{' '}
              {VERIFICATION_LABELS[connection.verificationState] ??
                connection.verificationState}
            </p>
            <p style={styles.meta}>
              آدرس سرویس: {connection.settings.baseUrl || 'تنظیم نشده'} — واحد
              پول:{' '}
              {connection.settings.moneyUnit === 'UNCONFIRMED'
                ? 'تأییدنشده (انتقال مالی مسدود)'
                : connection.settings.moneyUnit}
            </p>
            <ConnectionStatus connection={connection} />
            <p style={styles.meta}>
              قابلیت‌ها:{' '}
              {(connection.capabilityRows ?? [])
                .map((row) => `${row.label}: ${row.value}`)
                .join(' — ') || 'هنوز توسط آداپتور اعلام نشده است'}
            </p>
          </>
        )}
      </div>

      <div style={styles.section}>
        <p style={styles.subtitle}>آماده‌بودن برای انتقال و پیش‌نمایش سند</p>
        <p style={styles.meta}>
          بررسی، هیچ رکوردی نمی‌سازد و هیچ درخواست نوشتنی به مقصد نمی‌فرستد.
        </p>

        {quotationId === null ? (
          <p style={styles.meta}>
            این بخش روی صفحهٔ یک پیش‌فاکتور نمایش داده می‌شود.
          </p>
        ) : (
          <>
            <button
              type="button"
              style={{ ...styles.button, ...(busy ? styles.buttonDisabled : {}) }}
              disabled={busy || activeConnectionId === null}
              onClick={() => void checkReadiness()}
            >
              بررسی آماده‌بودن این سند
            </button>

            {readiness !== null ? (
              <p
                style={
                  readiness.kind === 'READY' ? styles.notice : styles.warning
                }
              >
                {readiness.kind === 'READY'
                  ? 'این سند برای انتقال آماده است.'
                  : 'این سند در حال حاضر قابل انتقال نیست.'}
                {readiness.detail ? ` — ${readiness.detail}` : ''}
                {` — وضعیت: ${readiness.kind}`}
              </p>
            ) : null}

            {documentPreview !== null ? (
              <DocumentPreviewPanel preview={documentPreview} />
            ) : null}

            <button
              type="button"
              disabled
              style={{ ...styles.button, ...styles.buttonDisabled }}
              title="ارسال سند مالی در این نسخه غیرفعال است"
            >
              ثبت در حسابداری (غیرفعال)
            </button>
            <p style={styles.notice}>
              اجرای واقعی انتقال سند در این نسخه غیرفعال است؛ فقط پیش‌نمایش و
              خطاهای نگاشت نمایش داده می‌شوند.
            </p>
          </>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.row}>
          <p style={{ ...styles.subtitle, flex: 1 }}>
            تاریخچهٔ عملیات همین سند
          </p>
          <button
            type="button"
            style={{ ...styles.button, ...(busy ? styles.buttonDisabled : {}) }}
            disabled={busy || activeConnectionId === null || quotationId === null}
            onClick={() => void loadHistory()}
          >
            بارگذاری تاریخچه
          </button>
        </div>
        {historyLoaded ? (
          <OperationTable operations={operations} />
        ) : (
          <p style={styles.meta}>
            برای دیدن عملیات ثبت‌شدهٔ همین پیش‌فاکتور، تاریخچه را بارگذاری کنید.
          </p>
        )}
      </div>
    </div>
  );
};
