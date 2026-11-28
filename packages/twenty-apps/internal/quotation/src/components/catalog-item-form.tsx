import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import {
  closeSidePanel,
  enqueueSnackbar,
} from 'twenty-sdk/front-component';

import {
  QUOTATION_UNITS_ROUTE,
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
  const [unit, setUnit] = useState('');
  const [unitRecordId, setUnitRecordId] = useState('');
  const [unitOptions, setUnitOptions] = useState<
    { recordId: string; name: string }[]
  >([]);
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
        unitRecordId: unitRecordId.trim() === '' ? null : unitRecordId,
        secondaryName: null,
        description: null,
        isActive,
        defaultUnitPriceText: priceText.trim() === '' ? null : priceText,
        moneyUnit,
      }),
    [kind, name, sku, unit, unitRecordId, isActive, priceText, moneyUnit],
  );

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const response = await callAppRoute(QUOTATION_UNITS_ROUTE, {
          action: 'list',
        });

        if (!response.ok || response.data.success !== true || cancelled) {
          return;
        }

        const units = Array.isArray(response.data.units)
          ? response.data.units
          : [];
        const options = units.flatMap((candidate) => {
          if (candidate === null || typeof candidate !== 'object') {
            return [];
          }

          const row = candidate as Record<string, unknown>;
          const recordId =
            typeof row.recordId === 'string' ? row.recordId.trim() : '';
          const label = typeof row.name === 'string' ? row.name.trim() : '';

          if (recordId === '' || label === '' || row.isActive === false) {
            return [];
          }

          return [{ recordId, name: label }];
        });

        setUnitOptions(options);
      } catch {
        // Units remain unavailable offline until settings load succeeds.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);


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
        unitRecordId: unitRecordId.trim() === '' ? null : unitRecordId,
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
            setKind(event.target.value as CatalogItemKind);
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
          واحد مرجع
          <select
            style={styles.input}
            value={unitRecordId}
            onChange={(event) => {
              const nextId = event.target.value;
              setUnitRecordId(nextId);
              const chosen = unitOptions.find(
                (option) => option.recordId === nextId,
              );
              if (chosen !== undefined) {
                setUnit(chosen.name);
              }
            }}
          >
            <option value="">انتخاب کنید…</option>
            {unitOptions.map((option) => (
              <option key={option.recordId} value={option.recordId}>
                {option.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label style={styles.label}>
        متن واحد (نمایشی / قدیمی)
        <input
          style={styles.input}
          value={unit}
          onChange={(event) => setUnit(event.target.value)}
        />
      </label>

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
