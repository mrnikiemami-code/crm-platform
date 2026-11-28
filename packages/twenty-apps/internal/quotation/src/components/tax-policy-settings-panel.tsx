import { useCallback, useEffect, useRef, useState } from 'react';
import { enqueueSnackbar } from 'twenty-sdk/front-component';

import { SettingsShell } from 'src/components/financial-settings/settings-shell';
import { TaxLedger } from 'src/components/financial-settings/tax-ledger';
import { callTaxPoliciesNestAction } from 'src/components/quotation-api';
import { QuotationCurrencySettingsSection } from 'src/components/quotation-currency-settings-section';
import { QuotationUnitSettingsSection } from 'src/components/quotation-unit-settings-section';
import { RoundingRuleSettingsSection } from 'src/components/rounding-rule-settings-section';
import { runDestructiveConfirm } from 'src/components/shared/run-destructive-confirm';
import { SettingsDialog } from 'src/components/shared/settings-dialog';
import { toPersianDigits } from 'src/domain/money/display-format';
import {
  formatBasisPointsAsPercent,
  parsePercentToBasisPoints,
} from 'src/domain/money/tax-policy';
import { toPersianUiMessage } from 'src/domain/quotation/ui-message';

// OpenDesign DE-035: register + context rail. Domain contracts unchanged.

type TaxPolicyRow = {
  recordId: string;
  code: string;
  name: string;
  ratePercent: string;
  dutyRatePercent: string;
  totalRatePercent: string;
  accountingCode: string;
  isActive: boolean;
  isDefault: boolean;
  isExempt: boolean;
  quotationCount: number;
};

type EditorState = {
  recordId: string | null;
  name: string;
  ratePercentText: string;
  dutyPercentText: string;
  accountingCodeText: string;
  isActive: boolean;
};

const readRows = (data: Record<string, unknown>): TaxPolicyRow[] => {
  const policies = Array.isArray(data.policies) ? data.policies : [];

  return policies.flatMap((candidate) => {
    if (candidate === null || typeof candidate !== 'object') {
      return [];
    }

    const row = candidate as Record<string, unknown>;
    const recordId = typeof row.recordId === 'string' ? row.recordId : '';

    if (recordId === '') {
      return [];
    }

    return [
      {
        recordId,
        code: typeof row.code === 'string' ? row.code : '',
        name: typeof row.name === 'string' ? row.name : '',
        ratePercent:
          typeof row.ratePercent === 'string'
            ? row.ratePercent
            : String(row.rateBasisPoints ?? ''),
        dutyRatePercent:
          typeof row.dutyRatePercent === 'string' ? row.dutyRatePercent : '0',
        totalRatePercent:
          typeof row.totalRatePercent === 'string'
            ? row.totalRatePercent
            : typeof row.ratePercent === 'string'
              ? row.ratePercent
              : '',
        accountingCode:
          typeof row.accountingCode === 'string' ? row.accountingCode : '',
        isActive: row.isActive !== false,
        isDefault: row.isDefault === true,
        isExempt: row.isExempt === true,
        quotationCount:
          typeof row.quotationCount === 'number' ? row.quotationCount : 0,
      },
    ];
  });
};

const emptyEditor = (): EditorState => ({
  recordId: null,
  name: '',
  ratePercentText: '',
  dutyPercentText: '0',
  accountingCodeText: '',
  isActive: true,
});

const editorFor = (row: TaxPolicyRow): EditorState => ({
  recordId: row.recordId,
  name: row.name,
  ratePercentText: row.ratePercent,
  dutyPercentText: row.dutyRatePercent,
  accountingCodeText: row.accountingCode,
  isActive: row.isActive,
});

const sumPercentText = (taxText: string, dutyText: string): string => {
  const tax = parsePercentToBasisPoints(taxText);
  const duty =
    dutyText.trim() === ''
      ? { ok: true as const, value: BigInt(0) }
      : parsePercentToBasisPoints(dutyText);

  if (!tax.ok || !duty.ok) {
    return '—';
  }

  const total = tax.value + duty.value;

  if (total === BigInt(0)) {
    return 'معاف';
  }

  return `${toPersianDigits(formatBasisPointsAsPercent(total))}٪`;
};

const displayPolicyName = (name: string): string => toPersianDigits(name);

const FALLBACK_ERROR = 'ذخیرهٔ تنظیمات مالیات انجام نشد؛ دوباره تلاش کنید.';

const UNSAVED_EDITOR_MESSAGE =
  'تغییرات ذخیره‌نشده دارید؛ ابتدا ذخیره یا انصراف کنید.';

const sameEditor = (left: EditorState, right: EditorState): boolean =>
  left.recordId === right.recordId &&
  left.name === right.name &&
  left.ratePercentText === right.ratePercentText &&
  left.dutyPercentText === right.dutyPercentText &&
  left.accountingCodeText === right.accountingCodeText &&
  left.isActive === right.isActive;

const rateFieldIssue = (text: string): string | null => {
  const parsed = parsePercentToBasisPoints(text);

  return parsed.ok ? null : parsed.refusal.detail;
};

const dutyFieldIssue = (text: string): string | null => {
  if (text.trim() === '') {
    return null;
  }

  const parsed = parsePercentToBasisPoints(text);

  return parsed.ok ? null : parsed.refusal.detail;
};

const combinedIssue = (taxText: string, dutyText: string): string | null => {
  const tax = parsePercentToBasisPoints(taxText);
  const duty =
    dutyText.trim() === ''
      ? { ok: true as const, value: BigInt(0) }
      : parsePercentToBasisPoints(dutyText);

  if (!tax.ok || !duty.ok) {
    return null;
  }

  return tax.value + duty.value > BigInt(10000)
    ? 'جمع مالیات و عوارض از ۱۰۰٪ بیشتر نمی‌شود'
    : null;
};

const canDeleteRow = (row: TaxPolicyRow): boolean =>
  !row.isDefault && row.quotationCount === 0;

const usageLine = (row: TaxPolicyRow): string => {
  if (row.isDefault) {
    return 'پیش‌فرض — حذف یا غیرفعال نمی‌شود';
  }

  if (row.quotationCount === 0) {
    return 'بدون سند وابسته';
  }

  return `${toPersianDigits(String(row.quotationCount))} سند وابسته`;
};

type SettingsTab = 'tax' | 'currencies' | 'units' | 'rounding';
type TaxFilterId = 'all' | 'active' | 'default';

export const TaxPolicySettingsPanel = () => {
  const [activeTab, setActiveTab] = useState<SettingsTab>('tax');
  const [taxFilter, setTaxFilter] = useState<TaxFilterId>('all');
  const [rows, setRows] = useState<TaxPolicyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [editorNotice, setEditorNotice] = useState<{
    kind: 'instruction' | 'failure';
    message: string;
  } | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);
  const [rowIssue, setRowIssue] = useState<{
    recordId: string;
    kind: 'notice' | 'error';
    message: string;
  } | null>(null);
  const [deletingRecordId, setDeletingRecordId] = useState<string | null>(null);
  const [editorBaseline, setEditorBaseline] = useState<EditorState | null>(
    null,
  );
  const deleteLatchRef = useRef(false);

  const updateEditor = useCallback((next: EditorState | null) => {
    setEditor(next);
    setEditorNotice(null);
    setNameError(null);
  }, []);

  const closeEditor = () => {
    updateEditor(null);
    setEditorBaseline(null);
  };

  const openEditor = (next: EditorState | null) => {
    if (next === null) {
      closeEditor();

      return;
    }

    if (
      editor !== null &&
      editorBaseline !== null &&
      !sameEditor(editor, editorBaseline)
    ) {
      setRowIssue({
        recordId: next.recordId ?? '',
        kind: 'notice',
        message: UNSAVED_EDITOR_MESSAGE,
      });

      return;
    }

    setRowIssue(null);
    setEditorBaseline(next);
    updateEditor(next);
  };

  const editorIsDirty =
    editor !== null &&
    editorBaseline !== null &&
    !sameEditor(editor, editorBaseline);

  const applyResponse = useCallback(
    (
      data: Record<string, unknown>,
      fallbackMessage: string,
      newDefaultRecordId?: string,
    ): string | null => {
      if (data.success !== true) {
        return toPersianUiMessage(data.message, FALLBACK_ERROR);
      }

      const nextRows = readRows(data);

      setRows(
        newDefaultRecordId === undefined
          ? nextRows
          : nextRows.map((nextRow) => ({
              ...nextRow,
              isDefault: nextRow.recordId === newDefaultRecordId,
            })),
      );
      setError(null);
      const successMessage = toPersianUiMessage(data.message, fallbackMessage);

      if (successMessage.trim() !== '') {
        void enqueueSnackbar({
          message: successMessage,
          variant: 'success',
          dedupeKey: `tax-success:${successMessage}`,
        });
      }

      return null;
    },
    [],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await callTaxPoliciesNestAction({
        action: 'list',
      });

      if (response.data.success !== true) {
        setError(toPersianUiMessage(response.data.message, FALLBACK_ERROR));
        return;
      }

      setRows(readRows(response.data));
    } catch (loadFailure) {
      console.error('tax-policy-settings: load failed', loadFailure);
      setError('فهرست سیاست‌های مالیات خوانده نشد؛ دوباره تلاش کنید.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const runAction = async (
    body: Record<string, unknown>,
    fallbackMessage: string,
    newDefaultRecordId?: string,
  ): Promise<string | null> => {
    setBusy(true);

    try {
      const response = await callTaxPoliciesNestAction(body);

      return applyResponse(
        response.data,
        fallbackMessage,
        newDefaultRecordId,
      );
    } catch (actionFailure) {
      console.error('tax-policy-settings: action failed', actionFailure);

      return 'ارتباط با سرور برقرار نشد';
    } finally {
      setBusy(false);
    }
  };

  const rateDisplayIssue =
    editor === null || editor.ratePercentText.trim() === ''
      ? null
      : rateFieldIssue(editor.ratePercentText);
  const dutyDisplayIssue =
    editor === null || editor.dutyPercentText.trim() === ''
      ? null
      : dutyFieldIssue(editor.dutyPercentText);
  const combinedFieldIssue =
    editor === null
      ? null
      : combinedIssue(editor.ratePercentText, editor.dutyPercentText);

  const onSave = async () => {
    if (editor === null) {
      return;
    }

    if (editor.name.trim() === '') {
      setNameError('نام سیاست مالیات را وارد کنید');
      setEditorNotice(null);

      return;
    }

    setNameError(null);

    const issue =
      rateFieldIssue(editor.ratePercentText) ??
      dutyFieldIssue(editor.dutyPercentText) ??
      combinedIssue(editor.ratePercentText, editor.dutyPercentText);

    if (issue !== null) {
      const alreadyPainted =
        rateDisplayIssue === issue ||
        dutyDisplayIssue === issue ||
        combinedFieldIssue === issue;

      if (!alreadyPainted) {
        setEditorNotice({ kind: 'failure', message: issue });
      }

      return;
    }

    const failure = await runAction(
      {
        action: 'save',
        recordId: editor.recordId,
        name: editor.name,
        ratePercentText: editor.ratePercentText,
        dutyRatePercentText: editor.dutyPercentText,
        accountingCodeText: editor.accountingCodeText,
        isActive: editor.isActive,
      },
      'سیاست مالیات ذخیره شد',
    );

    if (failure === null) {
      closeEditor();

      return;
    }

    setEditorNotice({ kind: 'failure', message: failure });
  };

  const onSetDefault = async (row: TaxPolicyRow) => {
    setRowIssue(null);

    const failure = await runAction(
      { action: 'set-default', recordId: row.recordId },
      'سیاست پیش‌فرض تغییر کرد',
      row.recordId,
    );

    if (failure !== null) {
      setRowIssue({ recordId: row.recordId, kind: 'error', message: failure });
    }
  };

  const onDeactivate = async (row: TaxPolicyRow) => {
    setRowIssue(null);

    const failure = await runAction(
      { action: 'deactivate', recordId: row.recordId },
      'سیاست مالیات غیرفعال شد',
    );

    if (failure !== null) {
      setRowIssue({ recordId: row.recordId, kind: 'error', message: failure });
    }
  };

  const onActivate = async (row: TaxPolicyRow) => {
    setRowIssue(null);

    const failure = await runAction(
      {
        action: 'save',
        recordId: row.recordId,
        name: row.name,
        ratePercentText: row.ratePercent,
        dutyRatePercentText: row.dutyRatePercent,
        accountingCodeText: row.accountingCode,
        isActive: true,
      },
      'سیاست مالیات فعال شد',
    );

    if (failure !== null) {
      setRowIssue({ recordId: row.recordId, kind: 'error', message: failure });
    }
  };

  const requestDelete = async (row: TaxPolicyRow) => {
    setRowIssue(null);

    if (!canDeleteRow(row)) {
      const reason = row.isDefault
        ? 'سیاست پیش‌فرض را نمی‌توان حذف کرد'
        : 'این سیاست در سند استفاده شده و حذف نمی‌شود';
      void enqueueSnackbar({
        message: reason,
        variant: 'warning',
        dedupeKey: `tax-delete-blocked:${row.recordId}`,
      });

      return;
    }

    if (deleteLatchRef.current || deletingRecordId !== null) {
      return;
    }

    deleteLatchRef.current = true;
    setDeletingRecordId(row.recordId);
    const nameText = displayPolicyName(row.name);

    try {
      await runDestructiveConfirm(
        {
          title: 'حذف سیاست مالیات',
          subtitle: `آیا سیاست «${nameText}» حذف شود؟ این عملیات قابل بازگشت نیست.`,
          confirmButtonText: 'حذف سیاست',
        },
        async () => {
          const failure = await runAction(
            { action: 'delete', recordId: row.recordId },
            'سیاست مالیات حذف شد',
          );

          if (failure !== null) {
            setRowIssue({
              recordId: row.recordId,
              kind: 'error',
              message: failure,
            });
            void enqueueSnackbar({
              message: failure,
              variant: 'error',
              dedupeKey: `tax-delete-error:${row.recordId}`,
            });

            return;
          }

          if (editor?.recordId === row.recordId) {
            closeEditor();
          }
        },
      );
    } finally {
      deleteLatchRef.current = false;
      setDeletingRecordId(null);
    }
  };

  const onBootstrap = async () => {
    const failure = await runAction(
      { action: 'bootstrap' },
      'سیاست پایه آماده شد',
    );

    if (failure !== null) {
      setError(failure);
    }
  };

  const editingRow =
    editor?.recordId === null
      ? null
      : (rows.find((row) => row.recordId === editor?.recordId) ?? null);

  const activeCount = rows.filter((row) => row.isActive).length;
  const defaultCount = rows.filter((row) => row.isDefault).length;
  const filteredRows =
    taxFilter === 'active'
      ? rows.filter((row) => row.isActive)
      : taxFilter === 'default'
        ? rows.filter((row) => row.isDefault)
        : rows;

  const ledgerRows = filteredRows.map((row) => ({
    id: row.recordId,
    code: row.code,
    name: displayPolicyName(row.name),
    ratePercent: row.ratePercent,
    dutyRatePercent: row.dutyRatePercent,
    accountingCode:
      row.accountingCode.trim() === '' ? '—' : row.accountingCode,
    isActive: row.isActive,
    isDefault: row.isDefault,
    quotationCount: row.quotationCount,
  }));

  const findRow = (id: string) => rows.find((row) => row.recordId === id);

  const shellTabs = [
    {
      id: 'tax',
      label: 'مالیات و عوارض',
      count: rows.length,
    },
    {
      id: 'currencies',
      label: 'ارزها',
      count: 1,
    },
    {
      id: 'units',
      label: 'واحدهای اندازه‌گیری',
      count: 0,
    },
    {
      id: 'rounding',
      label: 'قواعد رُند کردن',
      count: 0,
    },
  ];

  const taxStats = [
    {
      label: 'کل',
      value: toPersianDigits(String(rows.length)),
    },
    {
      label: 'فعال',
      value: toPersianDigits(String(activeCount)),
    },
    {
      label: 'پیش‌فرض',
      value: toPersianDigits(String(defaultCount)),
    },
    {
      label: 'نمایش',
      value: toPersianDigits(String(filteredRows.length)),
    },
  ];

  return (
    <div className="tax-root" dir="rtl">
      <style>{PANEL_CSS}</style>
      <SettingsShell
        title="پیش‌نیازهای حسابداری"
        subtitle="سیاست مالیات، ارز، واحد و قواعد رُند"
        tabs={shellTabs}
        activeTabId={activeTab}
        onTabChange={(id) => setActiveTab(id as SettingsTab)}
        railLabel={
          activeTab === 'tax'
            ? 'نمای مالیات'
            : activeTab === 'currencies'
              ? 'نمای ارز'
              : activeTab === 'units'
                ? 'نمای واحد'
                : 'نمای رُند'
        }
        stats={
          activeTab === 'tax'
            ? taxStats
            : [
                {
                  label: 'ارز',
                  value: 'ریال',
                },
                {
                  label: 'وضعیت',
                  value: 'فعال',
                },
              ]
        }
        primaryAction={
          activeTab === 'tax' && error === null && !loading
            ? {
                label:
                  rows.length === 0 ? 'ساخت سیاست پایهٔ ۹٪' : 'سیاست جدید',
                onClick: () => {
                  if (rows.length === 0) {
                    void onBootstrap();
                  } else {
                    openEditor(emptyEditor());
                  }
                },
              }
            : undefined
        }
        secondaryAction={
          activeTab === 'tax'
            ? {
                label: 'بازخوانی',
                onClick: () => {
                  void load();
                },
                busy: loading || busy,
              }
            : undefined
        }
        filters={
          activeTab === 'tax'
            ? {
                options: [
                  {
                    id: 'all',
                    label: 'همه',
                    count: rows.length,
                  },
                  {
                    id: 'active',
                    label: 'فعال',
                    count: activeCount,
                  },
                  {
                    id: 'default',
                    label: 'پیش‌فرض',
                    count: defaultCount,
                  },
                ],
                value: taxFilter,
                onChange: (id) => setTaxFilter(id as TaxFilterId),
              }
            : undefined
        }
        helpNote={
          activeTab === 'tax' ? (
            <>
              <strong>حذف:</strong> سیاست پیش‌فرض یا استفاده‌شده در سند حذف
              نمی‌شود. کد حسابداری استفاده‌شده در پیش‌فاکتور قابل تغییر نیست.
            </>
          ) : activeTab === 'currencies' ? (
            <>
              فعلاً فقط ریال ایران فعال است. کد حسابداری ارز را می‌توانید از همین
              صفحه ویرایش کنید.
            </>
          ) : activeTab === 'units' ? (
            <>
              کد حسابداری واحد اختیاری است و پس از استفاده در کالا قفل می‌شود.
              هیچ واحد پیش‌فرضی حدس زده نمی‌شود.
            </>
          ) : (
            <>
              گام رُند باید عدد صحیح مثبت ریال باشد. قاعده پیش‌فرض یا استفاده‌شده
              در سند حذف نمی‌شود.
            </>
          )
        }
      >
        {activeTab === 'tax' ? (
          <>
            {rowIssue === null ? null : (
              <p
                role={rowIssue.kind === 'notice' ? 'status' : 'alert'}
                className={
                  rowIssue.kind === 'notice'
                    ? 'tax-row-notice'
                    : 'tax-row-error'
                }
                style={{ marginBottom: 12 }}
              >
                {rowIssue.message}
              </p>
            )}
            <TaxLedger
              rows={ledgerRows}
              loading={loading}
              error={error}
              emptyTitle="هنوز سیاست مالیات و عوارضی ثبت نشده است."
              emptyBody="برای شروع سریع، سیاست پایه ۹٪ بسازید یا سیاست جدید تعریف کنید."
              onRetry={() => {
                void load();
              }}
              onCreate={() => openEditor(emptyEditor())}
              onEdit={(id) => {
                const row = findRow(id);
                if (row) {
                  openEditor(editorFor(row));
                }
              }}
              onMakeDefault={(id) => {
                const row = findRow(id);
                if (row) {
                  void onSetDefault(row);
                }
              }}
              onToggleActive={(id) => {
                const row = findRow(id);
                if (!row) {
                  return;
                }
                if (row.isActive) {
                  void onDeactivate(row);
                } else {
                  void onActivate(row);
                }
              }}
              onDelete={(id) => {
                const row = findRow(id);
                if (row) {
                  void requestDelete(row);
                }
              }}
            />
          </>
        ) : null}
        {activeTab === 'currencies' ? (
          <QuotationCurrencySettingsSection alwaysOpen />
        ) : null}
        {activeTab === 'units' ? (
          <QuotationUnitSettingsSection alwaysOpen />
        ) : null}
        {activeTab === 'rounding' ? (
          <RoundingRuleSettingsSection alwaysOpen />
        ) : null}
      </SettingsShell>

      {editor === null ? null : (
        <SettingsDialog
          title={editor.recordId === null ? 'سیاست جدید' : 'ویرایش سیاست'}
          busy={busy}
          size="lg"
          onClose={() => closeEditor()}
          footer={
            <>
              <button
                type="button"
                className="tax-btn tax-btn-primary"
                disabled={busy}
                onClick={() => void onSave()}
              >
                {busy ? 'در حال ذخیره…' : 'ذخیره'}
              </button>
              <button
                type="button"
                className="tax-btn"
                disabled={busy}
                onClick={() => closeEditor()}
              >
                انصراف
              </button>
            </>
          }
        >
          <div
            className={
              nameError === null ? 'tax-field' : 'tax-field is-invalid'
            }
          >
            <label htmlFor="tax-policy-name">نام سیاست</label>
            <input
              id="tax-policy-name"
              value={editor.name}
              aria-invalid={nameError !== null}
              aria-describedby={
                nameError === null ? undefined : 'tax-policy-name-error'
              }
              placeholder="مثلاً مالیات بر ارزش افزوده"
              onChange={(event) => {
                setNameError(null);
                updateEditor({ ...editor, name: event.target.value });
              }}
            />
            {nameError === null ? null : (
              <span
                id="tax-policy-name-error"
                role="alert"
                className="tax-field-error"
              >
                {nameError}
              </span>
            )}
          </div>

          <div className="tax-split-2">
            <div
              className={
                rateDisplayIssue === null
                  ? 'tax-field'
                  : 'tax-field is-invalid'
              }
            >
              <label htmlFor="tax-policy-rate">مالیات ٪</label>
              <input
                id="tax-policy-rate"
                value={editor.ratePercentText}
                inputMode="decimal"
                dir="ltr"
                aria-invalid={rateDisplayIssue !== null}
                placeholder="۹"
                onChange={(event) =>
                  updateEditor({
                    ...editor,
                    ratePercentText: event.target.value,
                  })
                }
              />
              {rateDisplayIssue === null ? null : (
                <span role="alert" className="tax-field-error">
                  {rateDisplayIssue}
                </span>
              )}
            </div>
            <div
              className={
                dutyDisplayIssue === null
                  ? 'tax-field'
                  : 'tax-field is-invalid'
              }
            >
              <label htmlFor="tax-policy-duty">عوارض ٪</label>
              <input
                id="tax-policy-duty"
                value={editor.dutyPercentText}
                inputMode="decimal"
                dir="ltr"
                aria-invalid={dutyDisplayIssue !== null}
                placeholder="۰"
                onChange={(event) =>
                  updateEditor({
                    ...editor,
                    dutyPercentText: event.target.value,
                  })
                }
              />
              {dutyDisplayIssue === null ? null : (
                <span role="alert" className="tax-field-error">
                  {dutyDisplayIssue}
                </span>
              )}
            </div>
          </div>

          <p className="tax-hint">هر دو نرخ صفر یعنی معاف از مالیات.</p>

          <div className="tax-field">
            <label htmlFor="tax-policy-accounting-code">
              کد حسابداری (اختیاری)
            </label>
            <input
              id="tax-policy-accounting-code"
              value={editor.accountingCodeText}
              dir="ltr"
              placeholder="اختیاری"
              maxLength={64}
              disabled={(editingRow?.quotationCount ?? 0) > 0}
              onChange={(event) =>
                updateEditor({
                  ...editor,
                  accountingCodeText: event.target.value,
                })
              }
            />
            {(editingRow?.quotationCount ?? 0) > 0 ? (
              <p className="tax-hint">
                این کد قبلاً در پیش‌فاکتور استفاده شده و قابل تغییر نیست.
              </p>
            ) : null}
          </div>

          <div className="tax-computed" aria-live="polite">
            <span>نرخ کل</span>
            <strong>
              {sumPercentText(editor.ratePercentText, editor.dutyPercentText)}
            </strong>
          </div>

          {editorIsDirty ? (
            <p role="status" className="tax-unsaved">
              ذخیره‌نشده
            </p>
          ) : null}

          {combinedFieldIssue === null ? null : (
            <p role="alert" className="tax-field-error">
              {combinedFieldIssue}
            </p>
          )}
          {editorNotice === null ? null : (
            <p
              role={editorNotice.kind === 'instruction' ? 'status' : 'alert'}
              className={
                editorNotice.kind === 'instruction'
                  ? 'tax-row-notice'
                  : 'tax-field-error'
              }
            >
              {editorNotice.message}
            </p>
          )}
          {editingRow === null ? null : (
            <p className="tax-hint">{usageLine(editingRow)}</p>
          )}
        </SettingsDialog>
      )}
    </div>
  );
};

const PANEL_CSS = `
.tax-root {
  width: 100%;
  min-width: 0;
  min-height: 0;
  height: 100%;
  font-family: inherit;
  color: var(--t-color-gray12);
}
.tax-split-2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.tax-field { display: flex; flex-direction: column; gap: 6px; }
.tax-field label {
  font-size: 12px;
  font-weight: 600;
  color: var(--t-color-gray11);
}
.tax-field input {
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--t-color-gray6);
  border-radius: 8px;
  background: var(--t-color-gray1);
  color: var(--t-color-gray12);
  font: inherit;
}
.tax-field.is-invalid input {
  border-color: var(--t-color-red7);
}
.tax-field input:focus-visible {
  outline: 2px solid var(--t-color-blue9);
  outline-offset: 1px;
}
.tax-field input:disabled {
  background: var(--t-color-gray3);
  color: var(--t-color-gray11);
}
.tax-hint {
  margin: 0;
  font-size: 12.5px;
  color: var(--t-color-gray11);
  line-height: 1.6;
}
.tax-computed {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--t-color-gray2);
  border: 1px solid var(--t-color-gray4);
  font-size: 13px;
}
.tax-computed strong {
  font-size: 18px;
  font-variant-numeric: tabular-nums;
}
.tax-unsaved {
  margin: 0;
  font-size: 12.5px;
  color: var(--t-color-orange11);
}
.tax-field-error, .tax-row-error {
  margin: 0;
  font-size: 12.5px;
  color: var(--t-color-red11);
}
.tax-row-notice {
  margin: 0;
  font-size: 12.5px;
  color: var(--t-color-orange11);
}
.tax-btn {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  min-height: 36px;
  height: 36px;
  padding: 0 14px;
  border-radius: 6px;
  border: 1px solid var(--t-color-gray6);
  background: var(--t-color-gray1);
  color: var(--t-color-gray12);
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}
.tax-btn:hover:not(:disabled) { background: var(--t-color-gray3); }
.tax-btn:focus-visible {
  outline: 2px solid var(--t-color-blue9);
  outline-offset: 2px;
}
.tax-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.tax-btn-primary {
  background: var(--t-color-blue9);
  border-color: var(--t-color-blue9);
  color: var(--t-color-gray1);
}
.tax-btn-primary:hover:not(:disabled) {
  background: var(--t-color-blue10);
}
@media (max-width: 720px) {
  .tax-split-2 { grid-template-columns: 1fr; }
  .tax-field input { height: 44px; }
  .tax-btn { min-height: 44px; height: 44px; }
}
`;

