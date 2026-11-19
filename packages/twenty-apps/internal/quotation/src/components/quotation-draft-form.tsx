import { type CSSProperties, useMemo, useState } from 'react';
import {
  closeSidePanel,
  enqueueSnackbar,
  useFrontComponentExecutionContext,
} from 'twenty-sdk/front-component';

import {
  CatalogItemCombobox,
  type CatalogComboboxSelection,
} from 'src/components/catalog-item-combobox';
import {
  SAVE_DRAFT_ROUTE,
  callAppRoute,
} from 'src/components/quotation-api';
import { type CatalogItemKind } from 'src/domain/catalog/catalog-item';
import { type MoneyUnit } from 'src/domain/money/currency';
import {
  DEFAULT_TAX_POLICY_ID,
  resolveTaxPolicy,
} from 'src/domain/money/tax-policy';
import {
  type DraftDiscountInput,
  type DraftLineInput,
} from 'src/domain/quotation/draft-quotation';
import { buildDraftQuotationPreview } from 'src/domain/quotation/draft-preview';

type DiscountKind = 'NONE' | 'RATE' | 'AMOUNT';

type LineDraft = {
  clientLineId: string;
  catalogItemId: string | null;
  kind: CatalogItemKind;
  name: string;
  sku: string | null;
  description: string | null;
  unit: string;
  quantityText: string;
  unitPriceText: string;
  discountKind: DiscountKind;
  discountPercentText: string;
  discountAmountText: string;
  priceWarning: string | null;
};

const newLine = (): LineDraft => ({
  clientLineId: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  catalogItemId: null,
  kind: 'PRODUCT',
  name: '',
  sku: null,
  description: null,
  unit: 'عدد',
  quantityText: '۱',
  unitPriceText: '',
  discountKind: 'NONE',
  discountPercentText: '',
  discountAmountText: '',
  priceWarning: null,
});

const PROBLEM_FALLBACK = 'لطفاً ورودی‌ها را بررسی کنید.';

const TAX_LABEL = (() => {
  const policy = resolveTaxPolicy(DEFAULT_TAX_POLICY_ID);

  return policy.ok ? policy.value.label : 'مالیات';
})();

const selectObjectNameSingular = (
  context: { objectNameSingular?: string | null } | null | undefined,
): string => context?.objectNameSingular ?? '';

const selectSelectedRecordIds = (
  context: { selectedRecordIds?: string[] | null } | null | undefined,
): string[] => context?.selectedRecordIds ?? [];

const toDiscountInput = (
  kind: DiscountKind,
  percentText: string,
  amountText: string,
): DraftDiscountInput => {
  if (kind === 'RATE') {
    return percentText.trim() === ''
      ? { kind: 'NONE' }
      : { kind: 'RATE', percentText };
  }

  if (kind === 'AMOUNT') {
    return amountText.trim() === ''
      ? { kind: 'NONE' }
      : { kind: 'AMOUNT', text: amountText };
  }

  return { kind: 'NONE' };
};

const toDraftLineInput = (
  line: LineDraft,
  moneyUnit: MoneyUnit,
): DraftLineInput => ({
  clientLineId: line.clientLineId,
  catalogItemId: line.catalogItemId,
  kind: line.kind,
  name: line.name,
  description: line.description,
  unit: line.unit,
  quantityText: line.quantityText,
  unitPriceText: line.unitPriceText,
  moneyUnit,
  discount: toDiscountInput(
    line.discountKind,
    line.discountPercentText,
    line.discountAmountText,
  ),
});

export const QuotationDraftForm = () => {
  const sourceObject = useFrontComponentExecutionContext(
    selectObjectNameSingular,
  );
  const selectedRecordIds = useFrontComponentExecutionContext(
    selectSelectedRecordIds,
  );
  const sourceRecordId = selectedRecordIds[0] ?? '';

  const initialCustomerType =
    sourceObject === 'person'
      ? ('PERSON' as const)
      : sourceObject === 'company'
        ? ('COMPANY' as const)
        : ('COMPANY' as const);

  const [name, setName] = useState('پیش‌فاکتور جدید');
  const [paymentTerms, setPaymentTerms] = useState('۳۰ روز');
  const [moneyUnit, setMoneyUnit] = useState<MoneyUnit>('TOMAN');
  const [customerType, setCustomerType] = useState<'PERSON' | 'COMPANY'>(
    initialCustomerType,
  );
  const [documentDiscountKind, setDocumentDiscountKind] =
    useState<DiscountKind>('NONE');
  const [documentDiscountPercentText, setDocumentDiscountPercentText] =
    useState('');
  const [documentDiscountAmountText, setDocumentDiscountAmountText] =
    useState('');
  const [lines, setLines] = useState<LineDraft[]>([newLine()]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const preview = useMemo(() => {
    const draftLines = lines.map((line) => toDraftLineInput(line, moneyUnit));

    return buildDraftQuotationPreview({
      quotationId: null,
      status: 'DRAFT',
      customerType,
      personId: customerType === 'PERSON' ? sourceRecordId || null : null,
      companyId: customerType === 'COMPANY' ? sourceRecordId || null : null,
      name,
      paymentTerms,
      taxPolicy: DEFAULT_TAX_POLICY_ID,
      documentDiscount: toDiscountInput(
        documentDiscountKind,
        documentDiscountPercentText,
        documentDiscountAmountText,
      ),
      displayMoneyUnit: moneyUnit,
      lines: draftLines,
    });
  }, [
    lines,
    moneyUnit,
    customerType,
    sourceRecordId,
    name,
    paymentTerms,
    documentDiscountKind,
    documentDiscountPercentText,
    documentDiscountAmountText,
  ]);

  const summaryPlan =
    preview.partialPlan && preview.partialPlan.ok
      ? preview.partialPlan.value
      : null;
  const summaryRefusal =
    preview.partialPlan && !preview.partialPlan.ok
      ? preview.partialPlan.refusal.detail
      : null;

  const updateLine = (clientLineId: string, patch: Partial<LineDraft>) => {
    setLines((current) =>
      current.map((line) =>
        line.clientLineId === clientLineId ? { ...line, ...patch } : line,
      ),
    );
  };

  const applyCatalogSelection = (
    clientLineId: string,
    selection: CatalogComboboxSelection,
  ) => {
    updateLine(clientLineId, {
      catalogItemId: selection.catalogItemId,
      kind: selection.kind,
      name: selection.name,
      sku: selection.sku,
      description: selection.description,
      unit: selection.unit,
      unitPriceText: selection.unitPriceText,
      priceWarning: selection.priceAvailable ? null : selection.priceMessage,
    });
  };

  const onSave = async () => {
    if (!preview.canSave || !preview.fullPlan.ok) {
      setError(
        preview.fullPlan.ok
          ? PROBLEM_FALLBACK
          : preview.fullPlan.refusal.detail || PROBLEM_FALLBACK,
      );
      return;
    }

    setError(null);
    setSaving(true);

    try {
      const response = await callAppRoute(SAVE_DRAFT_ROUTE, {
        status: 'DRAFT',
        customerType,
        personId: customerType === 'PERSON' ? sourceRecordId || null : null,
        companyId: customerType === 'COMPANY' ? sourceRecordId || null : null,
        name,
        paymentTerms,
        taxPolicy: DEFAULT_TAX_POLICY_ID,
        displayMoneyUnit: moneyUnit,
        documentDiscountKind,
        documentDiscountPercentText,
        documentDiscountAmountText,
        lines: lines.map((line) => ({
          clientLineId: line.clientLineId,
          catalogItemId: line.catalogItemId,
          kind: line.kind,
          name: line.name,
          description: line.description,
          unit: line.unit,
          quantityText: line.quantityText,
          unitPriceText: line.unitPriceText,
          moneyUnit,
          discountKind: line.discountKind,
          discountPercentText: line.discountPercentText,
          discountAmountText: line.discountAmountText,
        })),
      });

      if (!response.ok || response.data.success === false) {
        setError(
          typeof response.data.message === 'string'
            ? response.data.message
            : PROBLEM_FALLBACK,
        );
        return;
      }

      enqueueSnackbar({
        message:
          typeof response.data.message === 'string'
            ? response.data.message
            : 'پیش‌نویس ذخیره شد',
        variant: 'success',
      });
      closeSidePanel();
    } catch {
      setError('ارتباط با سرور برقرار نشد');
    } finally {
      setSaving(false);
    }
  };

  const customerHint =
    sourceRecordId === ''
      ? 'مشتری از رکورد انتخاب‌شده در CRM گرفته می‌شود؛ از فرمان ایجاد روی شخص یا شرکت استفاده کنید.'
      : customerType === 'PERSON'
        ? 'مشتری: شخص انتخاب‌شده'
        : 'مشتری: شرکت انتخاب‌شده';

  return (
    <div style={styles.root} dir="rtl">
      <div style={styles.scrollBody}>
        <header style={styles.header}>
          <h2 style={styles.title}>پیش‌فاکتور جدید</h2>
          <p style={styles.hint}>
            کالا و خدمت را از کاتالوگ انتخاب کنید. قیمت واحد به‌صورت snapshot در
            همین پیش‌فاکتور ذخیره می‌شود و تغییر بعدی کاتالوگ آن را عوض نمی‌کند.
            مبلغ نهایی به ریال صحیح گرد می‌شود.
          </p>
        </header>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>مشخصات</h3>
          <label style={styles.label}>
            عنوان
            <input
              style={styles.input}
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <p style={styles.meta}>{customerHint}</p>
          <div style={styles.row}>
            <label style={styles.label}>
              نوع مشتری
              <select
                style={styles.input}
                value={customerType}
                onChange={(event) =>
                  setCustomerType(event.target.value as 'PERSON' | 'COMPANY')
                }
              >
                <option value="PERSON">شخص</option>
                <option value="COMPANY">شرکت</option>
              </select>
            </label>
            <label style={styles.label}>
              واحد نمایش مبالغ
              <select
                style={styles.input}
                value={moneyUnit}
                onChange={(event) =>
                  setMoneyUnit(event.target.value as MoneyUnit)
                }
              >
                <option value="TOMAN">تومان</option>
                <option value="IRR">ریال</option>
              </select>
            </label>
          </div>
          <label style={styles.label}>
            شرایط پرداخت
            <input
              style={styles.input}
              value={paymentTerms}
              onChange={(event) => setPaymentTerms(event.target.value)}
            />
          </label>
        </section>

        <section style={styles.section}>
          <div style={styles.sectionHeader}>
            <h3 style={styles.sectionTitle}>ردیف‌های کالا و خدمت</h3>
            <button
              type="button"
              style={styles.secondaryButton}
              onClick={() => setLines((current) => [...current, newLine()])}
            >
              افزودن ردیف
            </button>
          </div>

          {lines.map((line, index) => {
            const linePreview = preview.linePreviews[index];

            return (
              <div key={line.clientLineId} style={styles.lineCard}>
                <div style={styles.lineHeader}>
                  <strong>ردیف {index + 1}</strong>
                  {line.sku ? (
                    <span style={styles.badge}>کد {line.sku}</span>
                  ) : null}
                </div>

                <label style={styles.label}>
                  کالا / خدمت
                  <CatalogItemCombobox
                    moneyUnit={moneyUnit}
                    selectedLabel={line.name}
                    onSelect={(selection) =>
                      applyCatalogSelection(line.clientLineId, selection)
                    }
                  />
                </label>

                {line.catalogItemId ? (
                  <p style={styles.meta}>
                    از کاتالوگ ·{' '}
                    {line.kind === 'SERVICE' ? 'خدمت' : 'کالا'} · واحد{' '}
                    {line.unit}
                  </p>
                ) : null}

                {line.priceWarning ? (
                  <p style={styles.warning}>{line.priceWarning}</p>
                ) : null}

                <div style={styles.row}>
                  <label style={styles.label}>
                    مقدار (تا ۶ رقم اعشار)
                    <input
                      style={styles.input}
                      value={line.quantityText}
                      onChange={(event) =>
                        updateLine(line.clientLineId, {
                          quantityText: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label style={styles.label}>
                    قیمت واحد ({moneyUnit === 'TOMAN' ? 'تومان' : 'ریال'})
                    <input
                      style={styles.input}
                      value={line.unitPriceText}
                      onChange={(event) =>
                        updateLine(line.clientLineId, {
                          unitPriceText: event.target.value,
                          priceWarning: null,
                        })
                      }
                    />
                  </label>
                </div>

                <div style={styles.row}>
                  <label style={styles.label}>
                    تخفیف ردیف
                    <select
                      style={styles.input}
                      value={line.discountKind}
                      onChange={(event) =>
                        updateLine(line.clientLineId, {
                          discountKind: event.target.value as DiscountKind,
                        })
                      }
                    >
                      <option value="NONE">بدون تخفیف</option>
                      <option value="RATE">درصدی</option>
                      <option value="AMOUNT">مبلغ ثابت</option>
                    </select>
                  </label>
                  {line.discountKind === 'RATE' ? (
                    <label style={styles.label}>
                      درصد تخفیف
                      <input
                        style={styles.input}
                        value={line.discountPercentText}
                        onChange={(event) =>
                          updateLine(line.clientLineId, {
                            discountPercentText: event.target.value,
                          })
                        }
                      />
                    </label>
                  ) : null}
                  {line.discountKind === 'AMOUNT' ? (
                    <label style={styles.label}>
                      مبلغ تخفیف
                      <input
                        style={styles.input}
                        value={line.discountAmountText}
                        onChange={(event) =>
                          updateLine(line.clientLineId, {
                            discountAmountText: event.target.value,
                          })
                        }
                      />
                    </label>
                  ) : null}
                </div>

                {linePreview && !linePreview.ok ? (
                  <p style={styles.lineError}>{linePreview.detail}</p>
                ) : null}

                {lines.length > 1 ? (
                  <button
                    type="button"
                    style={styles.linkButton}
                    onClick={() =>
                      setLines((current) =>
                        current.filter(
                          (entry) => entry.clientLineId !== line.clientLineId,
                        ),
                      )
                    }
                  >
                    حذف ردیف
                  </button>
                ) : null}
              </div>
            );
          })}
        </section>

        <section style={styles.section}>
          <h3 style={styles.sectionTitle}>تخفیف کل سند</h3>
          <div style={styles.row}>
            <label style={styles.label}>
              نوع
              <select
                style={styles.input}
                value={documentDiscountKind}
                onChange={(event) =>
                  setDocumentDiscountKind(event.target.value as DiscountKind)
                }
              >
                <option value="NONE">بدون تخفیف</option>
                <option value="RATE">درصدی</option>
                <option value="AMOUNT">مبلغ ثابت</option>
              </select>
            </label>
            {documentDiscountKind === 'RATE' ? (
              <label style={styles.label}>
                درصد تخفیف کل
                <input
                  style={styles.input}
                  value={documentDiscountPercentText}
                  onChange={(event) =>
                    setDocumentDiscountPercentText(event.target.value)
                  }
                />
              </label>
            ) : null}
            {documentDiscountKind === 'AMOUNT' ? (
              <label style={styles.label}>
                مبلغ تخفیف کل
                <input
                  style={styles.input}
                  value={documentDiscountAmountText}
                  onChange={(event) =>
                    setDocumentDiscountAmountText(event.target.value)
                  }
                />
              </label>
            ) : null}
          </div>
        </section>

        <section style={styles.totalsBox}>
          <h3 style={styles.sectionTitle}>خلاصه مالی</h3>
          {summaryPlan ? (
            <>
              <div style={styles.totalsRow}>
                <span>ناخالص</span>
                <strong>{summaryPlan.displayGross}</strong>
              </div>
              <div style={styles.totalsRow}>
                <span>تخفیف ردیف‌ها</span>
                <strong>{summaryPlan.displayLineDiscount}</strong>
              </div>
              <div style={styles.totalsRow}>
                <span>تخفیف کل</span>
                <strong>{summaryPlan.displayDocumentDiscount}</strong>
              </div>
              <div style={styles.totalsRow}>
                <span>{TAX_LABEL}</span>
                <strong>{summaryPlan.displayTax}</strong>
              </div>
              {summaryPlan.totalsExact.roundingExact !== '0.000000' ? (
                <div style={styles.totalsRow}>
                  <span>تعدیل گردکردن</span>
                  <strong>{summaryPlan.displayRounding}</strong>
                </div>
              ) : null}
              <div style={styles.payable}>
                <span>مبلغ نهایی قابل پرداخت</span>
                <strong>{summaryPlan.displayTotal}</strong>
              </div>
              {!preview.canSave ? (
                <p style={styles.meta}>
                  جمع بالا مربوط به ردیف‌های معتبر است. تا تکمیل همهٔ ردیف‌ها ذخیره
                  ممکن نیست.
                </p>
              ) : null}
            </>
          ) : (
            <p style={styles.meta}>
              {summaryRefusal ??
                'پس از انتخاب حداقل یک کالای معتبر، خلاصه مالی اینجا نمایش داده می‌شود.'}
            </p>
          )}
        </section>

        {error ? <p style={styles.error}>{error}</p> : null}
      </div>

      <div style={styles.actions}>
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={closeSidePanel}
        >
          بستن
        </button>
        <button
          type="button"
          style={{
            ...styles.primaryButton,
            opacity: preview.canSave && !saving ? 1 : 0.55,
          }}
          disabled={!preview.canSave || saving}
          onClick={() => void onSave()}
        >
          {saving ? 'در حال ذخیره…' : 'ذخیره پیش‌نویس'}
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    minHeight: 0,
    minWidth: 0,
    fontFamily: 'inherit',
    background: '#fff',
  },
  scrollBody: {
    flex: 1,
    minHeight: 0,
    overflowY: 'auto',
    overflowX: 'hidden',
    padding: 16,
    display: 'flex',
    flexDirection: 'column',
    gap: 14,
  },
  header: { display: 'flex', flexDirection: 'column', gap: 6 },
  title: { margin: 0, fontSize: 18, fontWeight: 700 },
  hint: { margin: 0, color: '#666', fontSize: 12, lineHeight: 1.7 },
  section: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    paddingTop: 4,
  },
  sectionTitle: { margin: 0, fontSize: 14, fontWeight: 650 },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    fontSize: 12,
    flex: 1,
    minWidth: 0,
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #d0d0d0',
    fontSize: 14,
    background: '#fff',
  },
  row: { display: 'flex', gap: 8, minWidth: 0 },
  meta: { margin: 0, fontSize: 11, color: '#777', lineHeight: 1.5 },
  lineCard: {
    border: '1px solid #e8e8e8',
    borderRadius: 10,
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    background: '#fafafa',
    minWidth: 0,
  },
  lineHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
  },
  badge: {
    fontSize: 11,
    color: '#555',
    background: '#eee',
    borderRadius: 999,
    padding: '2px 8px',
  },
  warning: { margin: 0, color: '#9a6700', fontSize: 12, lineHeight: 1.5 },
  lineError: { margin: 0, color: '#b42318', fontSize: 12 },
  totalsBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    border: '1px solid #e6e6e6',
    borderRadius: 12,
    padding: 12,
    background: '#fcfcfc',
  },
  totalsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    color: '#444',
    fontSize: 13,
  },
  payable: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: 12,
    marginTop: 4,
    paddingTop: 10,
    borderTop: '1px solid #e0e0e0',
    fontSize: 15,
    fontWeight: 700,
  },
  error: { color: '#b42318', margin: 0, fontSize: 13 },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    padding: 12,
    borderTop: '1px solid #eee',
    background: '#fff',
    flexShrink: 0,
  },
  primaryButton: {
    background: '#1a1a1a',
    color: '#fff',
    border: 0,
    borderRadius: 8,
    padding: '10px 14px',
    cursor: 'pointer',
    fontSize: 13,
  },
  secondaryButton: {
    background: '#f5f5f5',
    color: '#1a1a1a',
    border: '1px solid #ddd',
    borderRadius: 8,
    padding: '8px 12px',
    cursor: 'pointer',
    fontSize: 13,
  },
  linkButton: {
    alignSelf: 'flex-start',
    background: 'transparent',
    border: 0,
    color: '#b42318',
    cursor: 'pointer',
    padding: 0,
    fontSize: 12,
  },
};
