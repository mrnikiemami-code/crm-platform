import {
  type CSSProperties,
  useEffect,
  useId,
  useRef,
  useState,
} from 'react';

import { SEARCH_CUSTOMERS_ROUTE, callAppRoute } from 'src/components/quotation-api';

// The customer of a quotation is a real CRM record, so the form asks the server
// for real records. Nothing here invents an id or a name: the operator picks a
// row, and the id it carries is the id the save posts.

export type CustomerSelection = {
  id: string;
  label: string;
};

type PickerRow = CustomerSelection & { detail: string | null };

type CustomerPickerProps = {
  customerType: 'PERSON' | 'COMPANY';
  selected: CustomerSelection | null;
  onSelect: (selection: CustomerSelection) => void;
  disabled?: boolean;
};

const DEBOUNCE_MS = 300;

const asRecord = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const readRows = (payload: Record<string, unknown>): PickerRow[] => {
  const rows = payload.rows;

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.flatMap((row) => {
    const record = asRecord(row);
    const id = typeof record?.id === 'string' ? record.id : '';
    const label = typeof record?.label === 'string' ? record.label : '';

    if (id === '' || label === '') {
      return [];
    }

    return [
      {
        id,
        label,
        detail:
          typeof record?.detail === 'string' && record.detail.trim() !== ''
            ? record.detail
            : null,
      },
    ];
  });
};

export const CustomerPicker = ({
  customerType,
  selected,
  onSelect,
  disabled = false,
}: CustomerPickerProps) => {
  const listboxId = useId();
  const requestSerial = useRef(0);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [rows, setRows] = useState<PickerRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [query]);

  // Switching the customer side throws away a search that belonged to the other
  // object type; the selection itself is the parent's, since only it can clear it.
  useEffect(() => {
    setQuery('');
    setDebouncedQuery('');
    setRows([]);
    setError(null);
  }, [customerType]);

  const load = async (search: string) => {
    const serial = ++requestSerial.current;

    setLoading(true);
    setError(null);

    try {
      const response = await callAppRoute(SEARCH_CUSTOMERS_ROUTE, {
        customerType,
        search,
      });

      if (serial !== requestSerial.current) {
        return;
      }

      if (!response.ok || response.data.success === false) {
        setError(
          typeof response.data.message === 'string'
            ? response.data.message
            : 'بارگذاری فهرست مشتریان انجام نشد',
        );
        setRows([]);
        return;
      }

      setRows(readRows(response.data));
    } catch {
      if (serial !== requestSerial.current) {
        return;
      }

      setError('ارتباط با سرور برقرار نشد');
      setRows([]);
    } finally {
      if (serial === requestSerial.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (!open) {
      return;
    }

    void load(debouncedQuery);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reload on open/search/type
  }, [open, debouncedQuery, customerType]);

  const choose = (row: PickerRow) => {
    onSelect({ id: row.id, label: row.label });
    setOpen(false);
    setQuery('');
  };

  const placeholder =
    customerType === 'PERSON'
      ? 'جست‌وجوی نام یا ایمیل شخص…'
      : 'جست‌وجوی نام شرکت…';

  return (
    <div style={styles.root}>
      <div style={styles.selectionRow}>
        <span style={styles.selectionLabel}>
          {selected === null ? 'هنوز مشتری انتخاب نشده است' : selected.label}
        </span>
        <button
          type="button"
          style={{
            ...styles.changeButton,
            opacity: disabled ? 0.55 : 1,
            cursor: disabled ? 'not-allowed' : 'pointer',
          }}
          disabled={disabled}
          onClick={() => setOpen((current) => !current)}
          aria-expanded={open}
          aria-controls={listboxId}
        >
          {selected === null ? 'انتخاب مشتری' : 'تغییر مشتری'}
        </button>
      </div>

      {open ? (
        <div style={styles.panel}>
          <input
            style={styles.search}
            value={query}
            placeholder={placeholder}
            autoFocus
            onChange={(event) => setQuery(event.target.value)}
          />
          <div id={listboxId} role="listbox" style={styles.list}>
            {loading ? <div style={styles.state}>در حال جست‌وجو…</div> : null}
            {!loading && error !== null ? (
              <div style={styles.state}>
                <div style={styles.error}>{error}</div>
                <button
                  type="button"
                  style={styles.retry}
                  onClick={() => void load(debouncedQuery)}
                >
                  تلاش دوباره
                </button>
              </div>
            ) : null}
            {!loading && error === null && rows.length === 0 ? (
              <div style={styles.state}>
                {query.trim() === ''
                  ? 'برای دیدن گزینه‌ها نام را جست‌وجو کنید'
                  : 'موردی یافت نشد'}
              </div>
            ) : null}
            {!loading &&
              error === null &&
              rows.map((row) => (
                <button
                  key={row.id}
                  type="button"
                  role="option"
                  aria-selected={selected?.id === row.id}
                  style={{
                    ...styles.option,
                    background:
                      selected?.id === row.id ? '#eef4ff' : 'transparent',
                  }}
                  onClick={() => choose(row)}
                >
                  <strong style={styles.optionTitle}>{row.label}</strong>
                  {row.detail === null ? null : (
                    <span style={styles.optionMeta}>{row.detail}</span>
                  )}
                </button>
              ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};

const styles: Record<string, CSSProperties> = {
  root: { display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 },
  selectionRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 8,
    border: '1px solid #d0d0d0',
    background: '#fff',
  },
  selectionLabel: {
    fontSize: 14,
    color: '#1a1a1a',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  changeButton: {
    flexShrink: 0,
    border: '1px solid #c5cdd8',
    background: '#f7f9fc',
    borderRadius: 6,
    padding: '5px 10px',
    fontSize: 12,
    fontWeight: 600,
  },
  panel: {
    border: '1px solid #d8d8d8',
    borderRadius: 10,
    boxShadow: '0 8px 24px rgba(0,0,0,0.08)',
    display: 'flex',
    flexDirection: 'column',
    maxHeight: 260,
    overflow: 'hidden',
    background: '#fff',
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
    maxHeight: 200,
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
    cursor: 'pointer',
    textAlign: 'right',
  },
  optionTitle: { fontSize: 13, fontWeight: 600, color: '#1a1a1a' },
  optionMeta: { fontSize: 11, color: '#666' },
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
