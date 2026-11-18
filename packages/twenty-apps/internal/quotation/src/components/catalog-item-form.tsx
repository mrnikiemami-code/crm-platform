import { type CSSProperties, useMemo, useState } from 'react';
import {
  closeSidePanel,
  enqueueSnackbar,
} from 'twenty-sdk/front-component';

import {
  SAVE_CATALOG_ROUTE,
  callAppRoute,
} from 'src/components/quotation-api';
import { type CatalogItemKind } from 'src/domain/catalog/catalog-item';
import { type MoneyUnit } from 'src/domain/money/currency';
import { buildCatalogItemUpsertPlan } from 'src/domain/catalog/catalog-upsert';

export const CatalogItemForm = () => {
  const [kind, setKind] = useState<CatalogItemKind>('PRODUCT');
  const [name, setName] = useState('');
  const [sku, setSku] = useState('');
  const [unit, setUnit] = useState('عدد');
  const [isActive, setIsActive] = useState(true);
  const [priceText, setPriceText] = useState('');
  const [moneyUnit, setMoneyUnit] = useState<MoneyUnit>('TOMAN');
  const [error, setError] = useState<string | null>(null);

  const plan = useMemo(
    () =>
      buildCatalogItemUpsertPlan({
        id: null,
        kind,
        name,
        sku: sku.trim() === '' ? null : sku,
        unit,
        description: null,
        isActive,
        defaultUnitPriceText: priceText.trim() === '' ? null : priceText,
        moneyUnit,
      }),
    [kind, name, sku, unit, isActive, priceText, moneyUnit],
  );

  const onSave = async () => {
    if (!plan.ok) {
      setError(plan.refusal.detail);
      return;
    }

    setError(null);

    try {
      const response = await callAppRoute(SAVE_CATALOG_ROUTE, {
        kind,
        name,
        sku: sku.trim() === '' ? null : sku,
        unit,
        isActive,
        defaultUnitPriceText: priceText.trim() === '' ? null : priceText,
        moneyUnit,
      });

      if (!response.ok || response.data.success === false) {
        setError(
          typeof response.data.message === 'string'
            ? response.data.message
            : 'ذخیره کالا/خدمت انجام نشد',
        );
        return;
      }

      enqueueSnackbar({
        message:
          typeof response.data.message === 'string'
            ? response.data.message
            : 'کالا/خدمت ذخیره شد',
        variant: 'success',
      });
      closeSidePanel();
    } catch {
      setError('ارتباط با سرور برقرار نشد');
    }
  };

  return (
    <div style={styles.root} dir="rtl">
      <h2 style={styles.title}>کالا یا خدمت</h2>
      <p style={styles.hint}>
        قیمت اختیاری است و جدا از خود آیتم در فهرست قیمت ذخیره می‌شود. موجودی در
        CRM نگهداری نمی‌شود.
      </p>

      <label style={styles.label}>
        نوع
        <select
          style={styles.input}
          value={kind}
          onChange={(event) => {
            const next = event.target.value as CatalogItemKind;
            setKind(next);
            setUnit(next === 'SERVICE' ? 'ساعت' : 'عدد');
          }}
        >
          <option value="PRODUCT">کالا</option>
          <option value="SERVICE">خدمت</option>
        </select>
      </label>

      <label style={styles.label}>
        نام
        <input
          style={styles.input}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
      </label>

      <div style={styles.row}>
        <label style={styles.label}>
          کد کالا
          <input
            style={styles.input}
            value={sku}
            onChange={(event) => setSku(event.target.value)}
          />
        </label>
        <label style={styles.label}>
          واحد
          <input
            style={styles.input}
            value={unit}
            onChange={(event) => setUnit(event.target.value)}
          />
        </label>
      </div>

      <div style={styles.row}>
        <label style={styles.label}>
          قیمت پیش‌فرض ({moneyUnit === 'TOMAN' ? 'تومان' : 'ریال'})
          <input
            style={styles.input}
            value={priceText}
            onChange={(event) => setPriceText(event.target.value)}
          />
        </label>
        <label style={styles.label}>
          واحد پول
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

      <label style={styles.check}>
        <input
          type="checkbox"
          checked={isActive}
          onChange={(event) => setIsActive(event.target.checked)}
        />
        فعال
      </label>

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
          ذخیره
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
  check: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    fontSize: 13,
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
};
