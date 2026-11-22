import type { CSSProperties, ReactNode } from 'react';

import { sharedStyles as styles } from 'src/components/accounting/accounting-shared';

// The vocabulary and the furniture of the business screens.
//
// Every user-facing word here is the one an accountant uses: «نرم‌افزار حسابداری» not
// "adapter", «اتصال اطلاعات» not "mapping", «ارسال به حسابداری غیرفعال است» not
// OUTBOUND_DISABLED. The internal state names still exist in the data; they are translated
// once, here, so a new badge cannot invent a sixth phrasing for the same fact.

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

const TONE_STYLES: Record<Tone, CSSProperties> = {
  neutral: {
    background: 'var(--t-background-secondary)',
    color: 'var(--t-font-color-secondary)',
  },
  success: {
    background: 'color-mix(in srgb, var(--t-color-green) 16%, transparent)',
    color: 'var(--t-color-green)',
  },
  warning: {
    background: 'color-mix(in srgb, var(--t-color-orange) 18%, transparent)',
    color: 'var(--t-color-orange)',
  },
  danger: {
    background: 'color-mix(in srgb, var(--t-color-red) 16%, transparent)',
    color: 'var(--t-color-red)',
  },
  info: {
    background: 'color-mix(in srgb, var(--t-color-blue) 14%, transparent)',
    color: 'var(--t-color-blue)',
  },
};

export const Badge = ({
  tone = 'neutral',
  children,
}: {
  tone?: Tone;
  children: ReactNode;
}) => (
  <span
    style={{
      ...TONE_STYLES[tone],
      borderRadius: '999px',
      padding: '2px 10px',
      fontSize: 'var(--t-font-size-xs)',
      fontWeight: 'var(--t-font-weight-medium)',
      whiteSpace: 'nowrap',
      display: 'inline-block',
    }}
  >
    {children}
  </span>
);

export const SectionHeader = ({
  title,
  description,
  actions,
}: {
  title: string;
  description: string;
  actions?: ReactNode;
}) => (
  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 'var(--t-spacing-2)',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    }}
  >
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: '1 1 260px' }}>
      <h3 style={{ ...styles.title, fontSize: 'var(--t-font-size-sm)' }}>{title}</h3>
      <p style={styles.meta}>{description}</p>
    </div>
    {actions === undefined ? null : (
      <div style={{ display: 'flex', gap: 'var(--t-spacing-2)', flexWrap: 'wrap' }}>
        {actions}
      </div>
    )}
  </div>
);

export const Card = ({
  children,
  tone = 'neutral',
}: {
  children: ReactNode;
  tone?: Tone;
}) => (
  <div
    style={{
      border: '1px solid var(--t-border-color-medium)',
      borderTopWidth: tone === 'neutral' ? '1px' : '3px',
      ...(tone === 'neutral' ? {} : { borderTopColor: TONE_STYLES[tone].color }),
      borderRadius: 'var(--t-border-radius-sm)',
      padding: 'var(--t-spacing-3)',
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      minWidth: 0,
    }}
  >
    {children}
  </div>
);

export const StatCard = ({
  label,
  value,
  hint,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
}) => (
  <Card tone={tone}>
    <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>{label}</span>
    <span style={{ fontSize: 'var(--t-font-size-lg)', fontWeight: 'var(--t-font-weight-semi-bold)' }}>
      {value}
    </span>
    {hint === undefined ? null : (
      <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>{hint}</span>
    )}
  </Card>
);

export const StatGrid = ({ children }: { children: ReactNode }) => (
  <div
    style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))',
      gap: 'var(--t-spacing-2)',
    }}
  >
    {children}
  </div>
);

export type TabDescriptor = { id: string; label: string; count?: number };

// A horizontally scrollable segmented control instead of a wrapping row of chips: at 390px
// five buttons cannot share a line, and wrapping them made the page look broken rather
// than dense.
export const Tabs = ({
  tabs,
  activeId,
  onSelect,
}: {
  tabs: TabDescriptor[];
  activeId: string;
  onSelect: (id: string) => void;
}) => (
  <div
    role="tablist"
    aria-label="بخش‌های تنظیمات حسابداری"
    style={{
      display: 'flex',
      gap: '4px',
      overflowX: 'auto',
      paddingBottom: '2px',
      borderBottom: '1px solid var(--t-border-color-light)',
      WebkitOverflowScrolling: 'touch',
    }}
  >
    {tabs.map((tab) => {
      const active = tab.id === activeId;

      return (
        <button
          key={tab.id}
          type="button"
          role="tab"
          aria-selected={active}
          onClick={() => onSelect(tab.id)}
          style={{
            ...styles.button,
            border: 'none',
            borderBottom: active
              ? '2px solid var(--t-color-blue)'
              : '2px solid transparent',
            borderRadius: 0,
            background: 'transparent',
            color: active
              ? 'var(--t-color-blue)'
              : 'var(--t-font-color-secondary)',
            fontWeight: active
              ? 'var(--t-font-weight-semi-bold)'
              : 'var(--t-font-weight-regular)',
            whiteSpace: 'nowrap',
            padding: 'var(--t-spacing-2) var(--t-spacing-2)',
          }}
        >
          {tab.label}
          {tab.count === undefined ? null : ` (${tab.count})`}
        </button>
      );
    })}
  </div>
);

export const SearchField = ({
  value,
  placeholder,
  onChange,
  label = 'جست‌وجو',
}: {
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
  label?: string;
}) => (
  <label style={{ ...styles.field, minWidth: '100%' }}>
    <span style={styles.label}>{label}</span>
    <input
      type="search"
      style={styles.input}
      value={value}
      placeholder={placeholder}
      onChange={(event) => onChange(event.target.value)}
    />
  </label>
);

export const Pager = ({
  pageNumber,
  totalKnown,
  hasNextPage,
  hasPreviousPage,
  onNext,
  onPrevious,
  busy,
  rowCount,
}: {
  pageNumber: number;
  totalKnown: number | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNext: () => void;
  onPrevious: () => void;
  busy: boolean;
  rowCount: number;
}) => {
  // An unknown total is SAID, not estimated. "صفحه ۳" with no "از ۴۰" is the honest shape
  // when the destination cannot count.
  const position =
    totalKnown === null
      ? `صفحهٔ ${pageNumber}`
      : `صفحهٔ ${pageNumber} — ${totalKnown.toLocaleString('fa-IR')} مورد`;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 'var(--t-spacing-2)',
        flexWrap: 'wrap',
      }}
    >
      <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
        {rowCount === 0 ? 'موردی برای نمایش نیست' : position}
      </span>
      <div style={{ display: 'flex', gap: 'var(--t-spacing-1)' }}>
        <button
          type="button"
          style={{
            ...styles.button,
            ...(busy || !hasPreviousPage ? styles.buttonDisabled : {}),
          }}
          disabled={busy || !hasPreviousPage}
          onClick={onPrevious}
        >
          قبلی
        </button>
        <button
          type="button"
          style={{
            ...styles.button,
            ...(busy || !hasNextPage ? styles.buttonDisabled : {}),
          }}
          disabled={busy || !hasNextPage}
          onClick={onNext}
        >
          بعدی
        </button>
      </div>
    </div>
  );
};

// The limitation, stated where it applies. This component exists so that "the first N rows"
// can never be rendered as if it were the whole list, and so a degraded read is visible
// rather than looking like fresh data.
export const LimitNotice = ({
  truncated,
  taken,
  limit,
  declaredTotal,
  vendorCannotPage,
  syncStatus,
  degradedReason,
}: {
  truncated: boolean;
  taken: number;
  limit: number;
  declaredTotal: number | null;
  vendorCannotPage: boolean;
  syncStatus: 'COMPLETE' | 'INCOMPLETE';
  degradedReason: string | null;
}) => {
  const notices: string[] = [];

  if (degradedReason !== null) {
    notices.push(
      'خواندن دوباره از نرم‌افزار حسابداری انجام نشد؛ آخرین فهرست سالم نمایش داده می‌شود و ممکن است به‌روز نباشد.',
    );
  }

  if (truncated) {
    notices.push(
      `نرم‌افزار حسابداری امکان صفحه‌بندی ندارد. ${taken.toLocaleString(
        'fa-IR',
      )} ردیف اول از ${
        declaredTotal === null
          ? 'فهرست مقصد'
          : `${declaredTotal.toLocaleString('fa-IR')} ردیف`
      } خوانده شد (سقف ${limit.toLocaleString(
        'fa-IR',
      )} ردیف). ردیف‌های بعدی در این نسخه قابل مشاهده نیستند.`,
    );
  }

  if (syncStatus === 'INCOMPLETE') {
    notices.push(
      'وضعیت همگام‌سازی ناقص است: آمارهای این صفحه فقط دربارهٔ ردیف‌های خوانده‌شده است و کل فهرست مقصد را توصیف نمی‌کند.',
    );
  }

  if (notices.length === 0 && vendorCannotPage) {
    notices.push(
      'نرم‌افزار حسابداری امکان صفحه‌بندی ندارد؛ کل فهرست مقصد یک‌بار خوانده و ذخیره می‌شود و جست‌وجو و صفحه‌بندی در همین برنامه انجام می‌شود.',
    );
  }

  if (notices.length === 0) {
    return null;
  }

  const degraded = degradedReason !== null || syncStatus === 'INCOMPLETE';

  return (
    <>
      {notices.map((notice, index) => (
        <p
          key={`${index}-${notice.slice(0, 12)}`}
          style={
            degraded
              ? styles.warning
              : { ...styles.meta, fontSize: 'var(--t-font-size-xs)' }
          }
        >
          {notice}
        </p>
      ))}
    </>
  );
};

export type SearchState = { term: string; submitted: string };
