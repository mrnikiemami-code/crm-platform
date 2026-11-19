import {
  type CSSProperties,
  type UIEvent,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import {
  SEARCH_CATALOG_ROUTE,
  callAppRoute,
} from 'src/components/quotation-api';
import { type CatalogItemKind } from 'src/domain/catalog/catalog-item';
import { type MoneyUnit } from 'src/domain/money/currency';
import { irrExactToInputText } from 'src/domain/money/input-amount';

export type CatalogComboboxSelection = {
  catalogItemId: string;
  kind: CatalogItemKind;
  name: string;
  sku: string | null;
  unit: string;
  description: string | null;
  unitPriceText: string;
  priceAvailable: boolean;
  priceMessage: string | null;
};

type PickerRow = {
  id: string;
  name: string;
  kind: CatalogItemKind;
  sku: string | null;
  unit: string;
  description: string | null;
  unitPriceExact: string | null;
  priceAvailable: boolean;
  priceMessage: string | null;
};

type CatalogItemComboboxProps = {
  moneyUnit: MoneyUnit;
  selectedLabel: string;
  onSelect: (selection: CatalogComboboxSelection) => void;
};

const DEBOUNCE_MS = 300;
const PAGE_SIZE = 100;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readPickerRows = (payload: Record<string, unknown>): PickerRow[] => {
  const items = payload.items;

  if (!Array.isArray(items)) {
    return [];
  }

  const rows: PickerRow[] = [];

  for (const item of items) {
    const record = asRecord(item);

    if (record === null) {
      continue;
    }

    const id = typeof record.id === 'string' ? record.id : '';

    if (id === '') {
      continue;
    }

    rows.push({
      id,
      name: typeof record.name === 'string' ? record.name : '',
      kind: record.kind === 'SERVICE' ? 'SERVICE' : 'PRODUCT',
      sku: typeof record.sku === 'string' && record.sku.trim() !== ''
        ? record.sku
        : null,
      unit: typeof record.unit === 'string' ? record.unit : 'عدد',
      description:
        typeof record.description === 'string' && record.description.trim() !== ''
          ? record.description
          : null,
      unitPriceExact:
        typeof record.unitPriceExact === 'string' ? record.unitPriceExact : null,
      priceAvailable: record.priceAvailable === true,
      priceMessage:
        typeof record.priceMessage === 'string' ? record.priceMessage : null,
    });
  }

  return rows;
};

const formatOptionSecondary = (row: PickerRow, moneyUnit: MoneyUnit): string => {
  const bits: string[] = [
    row.kind === 'SERVICE' ? 'خدمت' : 'کالا',
    row.unit,
  ];

  if (row.sku) {
    bits.push(`کد ${row.sku}`);
  }

  if (row.priceAvailable && row.unitPriceExact) {
    const input = irrExactToInputText(row.unitPriceExact, moneyUnit);

    if (input.ok) {
      bits.push(
        `${input.value} ${moneyUnit === 'TOMAN' ? 'تومان' : 'ریال'}`,
      );
    }
  } else {
    bits.push('بدون قیمت');
  }

  return bits.join(' · ');
};

export const CatalogItemCombobox = ({
  moneyUnit,
  selectedLabel,
  onSelect,
}: CatalogItemComboboxProps) => {
  const listboxId = useId();
  const requestSerial = useRef(0);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [items, setItems] = useState<PickerRow[]>([]);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [query]);

  const loadPage = async ({
    search,
    afterCursor,
    append,
  }: {
    search: string;
    afterCursor: string | null;
    append: boolean;
  }) => {
    const serial = ++requestSerial.current;

    if (append) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(null);
    }

    try {
      const response = await callAppRoute(SEARCH_CATALOG_ROUTE, {
        search,
        afterCursor,
        pageSize: PAGE_SIZE,
      });

      if (serial !== requestSerial.current) {
        return;
      }

      if (!response.ok || response.data.success === false) {
        setError(
          typeof response.data.message === 'string'
            ? response.data.message
            : 'بارگذاری کاتالوگ انجام نشد',
        );
        if (!append) {
          setItems([]);
          setHasNextPage(false);
          setEndCursor(null);
        }
        return;
      }

      const rows = readPickerRows(response.data);
      setItems((current) => {
        if (!append) {
          return rows;
        }

        const seen = new Set(current.map((row) => row.id));
        const merged = [...current];

        for (const row of rows) {
          if (!seen.has(row.id)) {
            merged.push(row);
            seen.add(row.id);
          }
        }

        return merged;
      });
      setHasNextPage(response.data.hasNextPage === true);
      setEndCursor(
        typeof response.data.endCursor === 'string'
          ? response.data.endCursor
          : null,
      );
      setError(null);
    } catch {
      if (serial !== requestSerial.current) {
        return;
      }

      setError('ارتباط با سرور برقرار نشد');
      if (!append) {
        setItems([]);
        setHasNextPage(false);
        setEndCursor(null);
      }
    } finally {
      if (serial === requestSerial.current) {
        setLoading(false);
        setLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadPage({
      search: debouncedQuery,
      afterCursor: null,
      append: false,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional reload on open/search
  }, [open, debouncedQuery]);

  const choose = (row: PickerRow) => {
    let unitPriceText = '';

    if (row.priceAvailable && row.unitPriceExact) {
      const converted = irrExactToInputText(row.unitPriceExact, moneyUnit);

      if (converted.ok) {
        unitPriceText = converted.value;
      }
    }

    onSelect({
      catalogItemId: row.id,
      kind: row.kind,
      name: row.name,
      sku: row.sku,
      unit: row.unit,
      description: row.description,
      unitPriceText,
      priceAvailable: row.priceAvailable,
      priceMessage: row.priceMessage,
    });
    setOpen(false);
    setQuery('');
  };

  const onListScroll = (event: UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;

    if (
      !hasNextPage ||
      loadingMore ||
      loading ||
      endCursor === null ||
      target.scrollTop + target.clientHeight < target.scrollHeight - 24
    ) {
      return;
    }

    void loadPage({
      search: debouncedQuery,
      afterCursor: endCursor,
      append: true,
    });
  };

  return (
    <div style={styles.root}>
      <button
        type="button"
        role="combobox"
        aria-expanded={open}
        aria-controls={listboxId}
        style={styles.trigger}
        onClick={() => setOpen((current) => !current)}
      >
        <span style={styles.triggerLabel}>
          {selectedLabel.trim() === '' ? 'جست‌وجو و انتخاب از کاتالوگ…' : selectedLabel}
        </span>
        <span style={styles.chevron}>{open ? '▴' : '▾'}</span>
      </button>

      {open ? (
        <div style={styles.panel}>
          <input
            style={styles.search}
            value={query}
            placeholder="نام، کد کالا یا خدمت…"
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
          />
          <div
            id={listboxId}
            role="listbox"
            style={styles.list}
            onScroll={onListScroll}
          >
            {loading ? (
              <div style={styles.state}>در حال بارگذاری…</div>
            ) : null}
            {!loading && error ? (
              <div style={styles.state}>
                <div style={styles.error}>{error}</div>
                <button
                  type="button"
                  style={styles.retry}
                  onClick={() =>
                    void loadPage({
                      search: debouncedQuery,
                      afterCursor: null,
                      append: false,
                    })
                  }
                >
                  تلاش دوباره
                </button>
              </div>
            ) : null}
            {!loading && !error && items.length === 0 ? (
              <div style={styles.state}>موردی یافت نشد</div>
            ) : null}
            {!loading &&
              !error &&
              items.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  role="option"
                  style={styles.option}
                  onClick={() => choose(row)}
                >
                  <strong style={styles.optionTitle}>{row.name}</strong>
                  <span style={styles.optionMeta}>
                    {formatOptionSecondary(row, moneyUnit)}
                  </span>
                </button>
              ))}
            {loadingMore ? (
              <div style={styles.state}>موارد بعدی…</div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  root: { position: 'relative', width: '100%', minWidth: 0 },
  trigger: {
    width: '100%',
    boxSizing: 'border-box',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #d0d0d0',
    background: '#fff',
    cursor: 'pointer',
    fontSize: 14,
    textAlign: 'right',
  },
  triggerLabel: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    color: '#1a1a1a',
  },
  chevron: { color: '#666', flexShrink: 0 },
  panel: {
    position: 'absolute',
    zIndex: 20,
    top: 'calc(100% + 4px)',
    right: 0,
    left: 0,
    background: '#fff',
    border: '1px solid #d8d8d8',
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 280,
    overflow: 'hidden',
  },
  search: {
    width: '100%',
    boxSizing: 'border-box',
    border: 0,
    borderBottom: '1px solid #eee',
    padding: '10px 12px',
    fontSize: 14,
    outline: 'none',
  },
  list: {
    overflowY: 'auto',
    maxHeight: 220,
    display: 'flex',
    flexDirection: 'column',
  },
  option: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'stretch',
    gap: 2,
    padding: '8px 12px',
    border: 0,
    borderBottom: '1px solid #f2f2f2',
    background: 'transparent',
    cursor: 'pointer',
    textAlign: 'right',
  },
  optionTitle: { fontSize: 13, fontWeight: 600, color: '#1a1a1a' },
  optionMeta: { fontSize: 11, color: '#666', lineHeight: 1.4 },
  state: {
    padding: '12px',
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
  error: { color: '#b42318', marginBottom: 8 },
  retry: {
    border: '1px solid #ddd',
    background: '#f7f7f7',
    borderRadius: 6,
    padding: '4px 10px',
    cursor: 'pointer',
    fontSize: 12,
  },
};
