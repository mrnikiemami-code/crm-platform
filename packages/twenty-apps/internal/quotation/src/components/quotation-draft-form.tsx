import { type CSSProperties, useMemo, useState } from 'react';
import {
  closeSidePanel,
  enqueueSnackbar,
  useFrontComponentExecutionContext,
} from 'twenty-sdk/front-component';

import { type CatalogItemKind } from 'src/domain/catalog/catalog-item';
import { type MoneyUnit } from 'src/domain/money/currency';
import {
  buildDraftQuotationPlan,
  type DraftLineInput,
} from 'src/domain/quotation/draft-quotation';

// Side-panel draft editor. Totals are computed locally with the same domain function
// the server will use on save, so the operator never sees a total that later changes.
// Persistence still needs an installed app + route; until then Save validates only.

type LineDraft = {
  clientLineId: string;
  kind: CatalogItemKind;
  name: string;
  unit: string;
  quantityText: string;
  unitPriceText: string;
  discountPercentText: string;
  taxRatePercentText: string;
};

const newLine = (): LineDraft => ({
  clientLineId: `line-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  kind: 'PRODUCT',
  name: '',
  unit: 'عدد',
  quantityText: '۱',
  unitPriceText: '',
  discountPercentText: '',
  taxRatePercentText: '۹',
});

const PROBLEM_FALLBACK = 'لطفاً ورودی‌ها را بررسی کنید.';

const selectObjectNameSingular = (
  context: { objectNameSingular?: string | null } | null | undefined,
): string => context?.objectNameSingular ?? '';

const selectSelectedRecordIds = (
  context: { selectedRecordIds?: string[] | null } | null | undefined,
): string[] => context?.selectedRecordIds ?? [];

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
      discount:
        line.discountPercentText.trim() === ''
          ? { kind: 'NONE' }
          : { kind: 'RATE', percentText: line.discountPercentText },
      taxRatePercentText: line.taxRatePercentText,
    }));

    return buildDraftQuotationPlan({
      quotationId: null,
      status: 'DRAFT',
      customerType,
      personId: customerType === 'PERSON' ? sourceRecordId || null : null,
      companyId: customerType === 'COMPANY' ? sourceRecordId || null : null,
      name,
      paymentTerms,
      taxPolicy: 'IR_VAT_9',
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
  ]);

  const updateLine = (clientLineId: string, patch: Partial<LineDraft>) => {
    setLines((current) =>
      current.map((line) =>
        line.clientLineId === clientLineId ? { ...line, ...patch } : line,
      ),
    );
  };

  const onSave = () => {
    if (!plan.ok) {
      setError(plan.refusal.detail || PROBLEM_FALLBACK);
      return;
    }

    setError(null);
    enqueueSnackbar({
      message:
        'پیش‌نویس از نظر محاسبات معتبر است. برای ذخیره در پایگاه، نصب اپ روی Dev لازم است.',
      variant: 'info',
    });
  };

  return (
    <div style={styles.root} dir="rtl">
      <h2 style={styles.title}>پیش‌فاکتور</h2>
      <p style={styles.hint}>
        مبالغ ورودی به {moneyUnit === 'TOMAN' ? 'تومان' : 'ریال'} هستند و ذخیرهٔ
        نهایی همیشه به ریال دقیق انجام می‌شود.
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
              مقدار
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
              تخفیف ٪
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
            <label style={styles.label}>
              مالیات ٪
              <input
                style={styles.input}
                value={line.taxRatePercentText}
                onChange={(event) =>
                  updateLine(line.clientLineId, {
                    taxRatePercentText: event.target.value,
                  })
                }
              />
            </label>
          </div>
          {lines.length > 1 ? (
            <button
              type="button"
              style={styles.linkButton}
              onClick={() =>
                setLines((current) =>
                  current.filter((entry) => entry.clientLineId !== line.clientLineId),
                )
              }
            >
              حذف ردیف
            </button>
          ) : null}
        </div>
      ))}

      <div style={styles.totals}>
        <span>جمع کل</span>
        <strong>
          {plan.ok ? plan.value.displayTotal : '—'}
        </strong>
      </div>

      {error || (!plan.ok ? plan.refusal.detail : null) ? (
        <p style={styles.error}>
          {error ?? (!plan.ok ? plan.refusal.detail : null)}
        </p>
      ) : null}

      <div style={styles.actions}>
        <button type="button" style={styles.secondaryButton} onClick={closeSidePanel}>
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
  totals: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '10px 0',
    borderTop: '1px solid #ddd',
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
