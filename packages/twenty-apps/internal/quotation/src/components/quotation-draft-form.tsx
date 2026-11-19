import { type CSSProperties, useMemo, useState } from 'react';
import {
  closeSidePanel,
  enqueueSnackbar,
  useFrontComponentExecutionContext,
} from 'twenty-sdk/front-component';

import {
  SAVE_DRAFT_ROUTE,
  callAppRoute,
} from 'src/components/quotation-api';
import { type CatalogItemKind } from 'src/domain/catalog/catalog-item';
import { type MoneyUnit } from 'src/domain/money/currency';
import { DEFAULT_TAX_POLICY_ID } from 'src/domain/money/tax-policy';
import {
  buildDraftQuotationPlan,
  type DraftDiscountInput,
  type DraftLineInput,
} from 'src/domain/quotation/draft-quotation';

type DiscountKind = 'NONE' | 'RATE' | 'AMOUNT';

type LineDraft = {
  clientLineId: string;
  kind: CatalogItemKind;
  name: string;
  unit: string;
  quantityText: string;
  unitPriceText: string;
  discountKind: DiscountKind;
  discountPercentText: string;
  discountAmountText: string;
};

const newLine = (): LineDraft => ({
  clientLineId: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  kind: 'PRODUCT',
  name: '',
  unit: 'عدد',
  quantityText: '۱',
  unitPriceText: '',
  discountKind: 'NONE',
  discountPercentText: '',
  discountAmountText: '',
});

const PROBLEM_FALLBACK = 'لطفاً ورودی‌ها را بررسی کنید.';

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

  const plan = useMemo(() => {
    const draftLines: DraftLineInput[] = lines.map((line) => ({
      clientLineId: line.clientLineId,
      catalogItemId: null,
      kind: line.kind,
      name: line.name,
      description: null,
      unit: line.unit,
      quantityText: line.quantityText,
      unitPriceText: line.unitPriceText,
      moneyUnit,
      discount: toDiscountInput(
        line.discountKind,
        line.discountPercentText,
        line.discountAmountText,
      ),
    }));

    return buildDraftQuotationPlan({
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

  const updateLine = (clientLineId: string, patch: Partial<LineDraft>) => {
    setLines((current) =>
      current.map((line) =>
        line.clientLineId === clientLineId ? { ...line, ...patch } : line,
      ),
    );
  };

  const onSave = async () => {
    if (!plan.ok) {
      setError(plan.refusal.detail || PROBLEM_FALLBACK);
      return;
    }

    setError(null);

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
          kind: line.kind,
          name: line.name,
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
    }
  };

  return (
    <div style={styles.root} dir="rtl">
      <h2 style={styles.title}>پیش‌فاکتور</h2>
      <p style={styles.hint}>
        مبالغ ورودی به {moneyUnit === 'TOMAN' ? 'تومان' : 'ریال'} هستند؛ ذخیره
        پایه همیشه ریال دقیق است و مبلغ نهایی به ریال صحیح گرد می‌شود. مالیات از
        سیاست {DEFAULT_TAX_POLICY_ID} خوانده می‌شود.
      </p>

      <label style={styles.label}>
        عنوان
        <input
          style={styles.input}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

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
          واحد نمایش
          <select
            style={styles.input}
            value={moneyUnit}
            onChange={(event) => setMoneyUnit(event.target.value as MoneyUnit)}
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

      <div style={styles.sectionHeader}>
        <strong>ردیف‌های کالا و خدمت</strong>
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={() => setLines((current) => [...current, newLine()])}
        >
          افزودن ردیف
        </button>
      </div>

      {lines.map((line) => (
        <div key={line.clientLineId} style={styles.lineCard}>
          <div style={styles.row}>
            <label style={styles.label}>
              نوع
              <select
                style={styles.input}
                value={line.kind}
                onChange={(event) =>
                  updateLine(line.clientLineId, {
                    kind: event.target.value as CatalogItemKind,
                    unit: event.target.value === 'SERVICE' ? 'ساعت' : 'عدد',
                  })
                }
              >
                <option value="PRODUCT">کالا</option>
                <option value="SERVICE">خدمت</option>
              </select>
            </label>
            <label style={styles.label}>
              نام
              <input
                style={styles.input}
                value={line.name}
                onChange={(event) =>
                  updateLine(line.clientLineId, { name: event.target.value })
                }
              />
            </label>
          </div>
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
              قیمت واحد
              <input
                style={styles.input}
                value={line.unitPriceText}
                onChange={(event) =>
                  updateLine(line.clientLineId, {
                    unitPriceText: event.target.value,
                  })
                }
              />
            </label>
          </div>
          <div style={styles.row}>
            <label style={styles.label}>
              نوع تخفیف ردیف
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
                تخفیف ردیف ٪
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
                تخفیف ردیف (مبلغ)
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
      ))}

      <div style={styles.sectionHeader}>
        <strong>تخفیف کل سند</strong>
      </div>
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
            تخفیف کل ٪
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
            تخفیف کل (مبلغ)
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

      <div style={styles.totalsBox}>
        <div style={styles.totalsRow}>
          <span>ناخالص</span>
          <strong>{plan.ok ? plan.value.displayGross : '—'}</strong>
        </div>
        <div style={styles.totalsRow}>
          <span>تخفیف ردیف‌ها</span>
          <strong>{plan.ok ? plan.value.displayLineDiscount : '—'}</strong>
        </div>
        <div style={styles.totalsRow}>
          <span>تخفیف کل</span>
          <strong>
            {plan.ok ? plan.value.displayDocumentDiscount : '—'}
          </strong>
        </div>
        <div style={styles.totalsRow}>
          <span>مالیات ({DEFAULT_TAX_POLICY_ID})</span>
          <strong>{plan.ok ? plan.value.displayTax : '—'}</strong>
        </div>
        {plan.ok && plan.value.totalsExact.roundingExact !== '0.000000' ? (
          <div style={styles.totalsRow}>
            <span>تعدیل گردکردن</span>
            <strong>{plan.value.displayRounding}</strong>
          </div>
        ) : null}
        <div style={styles.totals}>
          <span>مبلغ نهایی قابل پرداخت</span>
          <strong>{plan.ok ? plan.value.displayTotal : '—'}</strong>
        </div>
      </div>

      {error || (!plan.ok ? plan.refusal.detail : null) ? (
        <p style={styles.error}>
          {error ?? (!plan.ok ? plan.refusal.detail : null)}
        </p>
      ) : null}

      <div style={styles.actions}>
        <button
          type="button"
          style={styles.secondaryButton}
          onClick={closeSidePanel}
        >
          بستن
        </button>
        <button type="button" style={styles.primaryButton} onClick={onSave}>
          ذخیره پیش‌نویس
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    padding: 16,
    minWidth: 0,
    fontFamily: 'inherit',
  },
  title: { margin: 0, fontSize: 18 },
  hint: { margin: 0, color: '#666', fontSize: 12, lineHeight: 1.6 },
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
  },
  row: { display: 'flex', gap: 8 },
  sectionHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  lineCard: {
    border: '1px solid #e6e6e6',
    borderRadius: 10,
    padding: 10,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  totalsBox: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    borderTop: '1px solid #ddd',
    paddingTop: 10,
    fontSize: 13,
  },
  totalsRow: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#444',
  },
  totals: {
    display: 'flex',
    justifyContent: 'space-between',
    paddingTop: 6,
    borderTop: '1px dashed #ddd',
    fontSize: 14,
  },
  error: { color: '#b42318', margin: 0, fontSize: 13 },
  actions: { display: 'flex', justifyContent: 'flex-end', gap: 8 },
  primaryButton: {
    background: '#1a1a1a',
    color: '#fff',
    border: 0,
    borderRadius: 8,
    padding: '8px 14px',
    cursor: 'pointer',
  },
  secondaryButton: {
    background: '#f5f5f5',
    color: '#1a1a1a',
    border: '1px solid #ddd',
    borderRadius: 8,
    padding: '8px 14px',
    cursor: 'pointer',
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
