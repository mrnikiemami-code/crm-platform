import type { CSSProperties, ReactNode } from 'react';

import { sharedStyles as styles } from 'src/components/accounting/accounting-shared';

// The vocabulary and the furniture of the business screens.
//
// Every user-facing word here is the one an accountant uses: «نرم‌افزار حسابداری» not
// "adapter", «اتصال اطلاعات» not "mapping", «ارسال به حسابداری غیرفعال است» not
// OUTBOUND_DISABLED. The internal state names still exist in the data; they are translated
// once, here, so a new badge cannot invent a sixth phrasing for the same fact.
//
// This file also owns navigation: a section is always reachable from the rail, the current
// section is marked with `aria-current`, and an inner view (the connection form) carries a
// back control that returns to the list it came from. Nothing here depends on a vendor.

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'info';

// A tag is 11–12px, so its text needs the full 4.5:1, not the large-text 3:1. The tinted
// background makes the raw brand hue too light to read (measured 3.2:1 for warning and
// 3.9:1 for success on the panel's own surfaces), so the foreground is darkened against
// black while the hue stays the same. Same reason the active rail label is deepened below.
const TONE_STYLES: Record<Tone, CSSProperties> = {
  neutral: {
    background: 'var(--t-background-secondary)',
    color: 'var(--t-font-color-secondary)',
  },
  success: {
    background: 'color-mix(in srgb, var(--t-color-green) 14%, transparent)',
    color: 'color-mix(in srgb, var(--t-color-green) 55%, black)',
  },
  warning: {
    background: 'color-mix(in srgb, var(--t-color-orange) 16%, transparent)',
    color: 'color-mix(in srgb, var(--t-color-orange) 55%, black)',
  },
  danger: {
    background: 'color-mix(in srgb, var(--t-color-red) 14%, transparent)',
    color: 'color-mix(in srgb, var(--t-color-red) 58%, black)',
  },
  info: {
    background: 'color-mix(in srgb, var(--t-color-blue) 12%, transparent)',
    color: 'color-mix(in srgb, var(--t-color-blue) 62%, black)',
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
      // 12px rather than the 11px xs token: these words are the reason a row is blocked.
      fontSize: 'var(--t-font-size-sm)',
      fontWeight: 'var(--t-font-weight-medium)',
      whiteSpace: 'nowrap',
      display: 'inline-block',
    }}
  >
    {children}
  </span>
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
      background: 'var(--t-background-primary)',
    }}
  >
    {children}
  </div>
);

// Empty is not an error; it is a starting point, so it gets one sentence of what to do next
// instead of a table header over zero rows.
export const EmptyState = ({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) => (
  <div
    style={{
      border: '1px dashed var(--t-border-color-medium)',
      borderRadius: 'var(--t-border-radius-sm)',
      padding: 'var(--t-spacing-4)',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
      alignItems: 'flex-start',
      background: 'var(--t-background-secondary)',
    }}
  >
    <span style={{ fontSize: 'var(--t-font-size-md)', fontWeight: 'var(--t-font-weight-semi-bold)' }}>
      {title}
    </span>
    <span style={{ fontSize: 'var(--t-font-size-sm)', color: 'var(--t-font-color-secondary)' }}>
      {description}
    </span>
    {action}
  </div>
);

export const StatCard = ({
  label,
  value,
  hint,
  tone = 'neutral',
  onClick,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: Tone;
  onClick?: () => void;
}) => (
  <Card tone={tone}>
    {onClick === undefined ? (
      <>
        <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>{label}</span>
        <span style={{ fontSize: 'var(--t-font-size-lg)', fontWeight: 'var(--t-font-weight-semi-bold)' }}>
          {value}
        </span>
        {hint === undefined ? null : (
          <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>{hint}</span>
        )}
      </>
    ) : (
      <button
        type="button"
        onClick={onClick}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          width: '100%',
          textAlign: 'right',
          background: 'transparent',
          border: 0,
          padding: 0,
          cursor: 'pointer',
          font: 'inherit',
          color: 'inherit',
        }}
      >
        <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>{label}</span>
        <span style={{ fontSize: 'var(--t-font-size-lg)', fontWeight: 'var(--t-font-weight-semi-bold)' }}>
          {value}
        </span>
        {hint === undefined ? null : (
          <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>{hint}</span>
        )}
      </button>
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

export type SectionDescriptor = {
  id: string;
  label: string;
  // A short line under the page title. One sentence, no vocabulary from the adapter layer.
  description: string;
  count?: number;
  alertCount?: number;
};

// The five destinations, always visible. On a wide screen it is a rail beside the content;
// on a phone the same list becomes a bar at the bottom, inside the thumb zone, so changing
// section and going back never means scrolling to the top first.
export const SectionNav = ({
  sections,
  activeId,
  onSelect,
  className,
}: {
  sections: SectionDescriptor[];
  activeId: string;
  onSelect: (id: string) => void;
  className?: string;
}) => (
  <nav
    aria-label="بخش‌های حسابداری"
    className={className}
    style={{
      display: 'grid',
      gridTemplateColumns: '1fr',
      gap: '2px',
      alignContent: 'start',
    }}
  >
    {sections.map((section) => {
      const active = section.id === activeId;

      return (
        <button
          key={section.id}
          type="button"
          aria-current={active ? 'page' : undefined}
          onClick={() => onSelect(section.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 'var(--t-spacing-1)',
            textAlign: 'right',
            minHeight: '40px',
            padding: 'var(--t-spacing-2)',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: 'var(--t-font-size-sm)',
            color: active
              ? 'color-mix(in srgb, var(--t-color-blue) 80%, black)'
              : 'var(--t-font-color-primary)',
            background: active
              ? 'color-mix(in srgb, var(--t-color-blue) 10%, transparent)'
              : 'transparent',
            border: active
              ? '1px solid color-mix(in srgb, var(--t-color-blue) 35%, transparent)'
              : '1px solid transparent',
            // RTL: the marker sits on the inline-start edge, which is the right edge here.
            borderInlineStartWidth: active ? '3px' : '1px',
            borderInlineStartColor: active
              ? 'var(--t-color-blue)'
              : 'transparent',
            borderRadius: 'var(--t-border-radius-sm)',
            fontWeight: active
              ? 'var(--t-font-weight-semi-bold)'
              : 'var(--t-font-weight-regular)',
          }}
        >
          <span>{section.label}</span>
          {section.alertCount !== undefined && section.alertCount > 0 ? (
            <Badge tone="warning">{section.alertCount.toLocaleString('fa-IR')}</Badge>
          ) : section.count === undefined ? null : (
            <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>
              {section.count.toLocaleString('fa-IR')}
            </span>
          )}
        </button>
      );
    })}
  </nav>
);

// Where the person is, and the way back out of the panel. The last crumb is the section, so
// a screenshot of any state answers "which screen am I on".
export const Breadcrumbs = ({
  sectionLabel,
  onBackToCrm,
}: {
  sectionLabel: string;
  onBackToCrm?: () => void;
}) => (
  <nav
    aria-label="مسیر صفحه"
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: '4px',
      fontSize: 'var(--t-font-size-xs)',
      color: 'var(--t-font-color-secondary)',
    }}
  >
    <button
      type="button"
      className="acct-crumb"
      onClick={onBackToCrm}
      style={{
        border: 'none',
        background: 'transparent',
        color: 'var(--t-color-blue)',
        cursor: 'pointer',
        // A 15px-tall text link is not a way out of a page on a phone; the class carries the
        // target size so the panel's media query can grow it on small screens.
        padding: '4px 10px',
        borderRadius: 'var(--t-border-radius-sm)',
        fontFamily: 'inherit',
      }}
    >
      <span aria-hidden="true">← </span>
      CRM
    </button>
    <span aria-hidden="true">›</span>
    <span>تنظیمات</span>
    <span aria-hidden="true">›</span>
    <span>حسابداری</span>
    <span aria-hidden="true">›</span>
    <span aria-current="page" style={{ color: 'var(--t-font-color-primary)' }}>
      {sectionLabel}
    </span>
  </nav>
);

// The bar an inner view shows instead of a modal: the list stays one click away, and the
// click is a real button, so it works with a keyboard and a screen reader.
export const SubViewBar = ({
  label,
  backLabel,
  onBack,
}: {
  label: string;
  backLabel: string;
  onBack: () => void;
}) => (
  <div
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: 'var(--t-spacing-2)',
      flexWrap: 'wrap',
      border: '1px solid var(--t-border-color-light)',
      background: 'var(--t-background-secondary)',
      borderRadius: 'var(--t-border-radius-sm)',
      padding: 'var(--t-spacing-2)',
    }}
  >
    <button
      type="button"
      onClick={onBack}
      style={{
        border: '1px solid var(--t-border-color-medium)',
        background: 'var(--t-background-primary)',
        color: 'var(--t-font-color-primary)',
        borderRadius: 'var(--t-border-radius-sm)',
        padding: '4px 10px',
        // 44px is the smallest target a thumb hits reliably; the sub-view back is the one
        // control a phone user needs first, so it does not shrink below that.
        minHeight: '44px',
        cursor: 'pointer',
        fontFamily: 'inherit',
        fontSize: 'var(--t-font-size-sm)',
      }}
    >
      <span aria-hidden="true">→ </span>
      {backLabel}
    </button>
    <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>{label}</span>
  </div>
);

// Everything an accountant does not need on the first read, in a native <details>: no state,
// no dependency, and a keyboard user opens it with Enter.
export const Details = ({
  summary = 'جزئیات فنی',
  children,
}: {
  summary?: string;
  children: ReactNode;
}) => (
  <details
    style={{
      border: '1px solid var(--t-border-color-light)',
      borderRadius: 'var(--t-border-radius-sm)',
      padding: 'var(--t-spacing-2)',
      marginTop: 'var(--t-spacing-2)',
    }}
  >
    <summary
      style={{
        cursor: 'pointer',
        fontSize: 'var(--t-font-size-xs)',
        color: 'var(--t-font-color-secondary)',
      }}
    >
      {summary}
    </summary>
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--t-spacing-2)',
        marginTop: 'var(--t-spacing-2)',
        fontSize: 'var(--t-font-size-xs)',
        color: 'var(--t-font-color-secondary)',
      }}
    >
      {children}
    </div>
  </details>
);

// Loading, empty, error and success are four different sentences. A screen that says
// "موردی نیست" while it is still reading is lying; a screen that shows nothing after a
// failure leaves the person with no next step.
export const StateBlock = ({
  state,
  title,
  description,
  action,
}: {
  state: 'loading' | 'empty' | 'error' | 'success';
  title: string;
  description?: string;
  action?: ReactNode;
}) => {
  const tone: Tone =
    state === 'error' ? 'danger' : state === 'success' ? 'success' : 'neutral';

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '6px',
        alignItems: 'flex-start',
        border: '1px solid var(--t-border-color-light)',
        borderInlineStartWidth: '3px',
        borderInlineStartColor: TONE_STYLES[tone].color,
        background: 'var(--t-background-secondary)',
        borderRadius: 'var(--t-border-radius-sm)',
        padding: 'var(--t-spacing-3)',
      }}
    >
      <span style={{ fontSize: 'var(--t-font-size-sm)', fontWeight: 'var(--t-font-weight-semi-bold)' }}>
        {title}
      </span>
      {description === undefined ? null : (
        <span style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)' }}>{description}</span>
      )}
      {action}
    </div>
  );
};

export const InlineAlert = ({
  tone = 'warning',
  title,
  children,
  action,
}: {
  tone?: Tone;
  title?: string;
  children: ReactNode;
  action?: ReactNode;
}) => (
  <div
    style={{
      ...TONE_STYLES[tone],
      display: 'flex',
      flexDirection: 'column',
      gap: '4px',
      borderRadius: 'var(--t-border-radius-sm)',
      padding: 'var(--t-spacing-2)',
      fontSize: 'var(--t-font-size-sm)',
    }}
  >
    {title === undefined ? null : (
      <strong style={{ fontSize: 'var(--t-font-size-sm)' }}>{title}</strong>
    )}
    <span style={{ fontSize: 'var(--t-font-size-xs)' }}>{children}</span>
    {action}
  </div>
);

export const PrimaryButton = ({
  label,
  onClick,
  disabled = false,
  type = 'button',
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
    style={{
      ...styles.button,
      ...styles.buttonPrimary,
      ...(disabled ? styles.buttonDisabled : {}),
    }}
  >
    {label}
  </button>
);

export const SecondaryButton = ({
  label,
  onClick,
  disabled = false,
  type = 'button',
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  type?: 'button' | 'submit';
}) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
    style={{
      ...styles.button,
      ...(disabled ? styles.buttonDisabled : {}),
    }}
  >
    {label}
  </button>
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
  pageSize,
  onPageChange,
  onPageSizeChange,
}: {
  pageNumber: number;
  totalKnown: number | null;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  onNext: () => void;
  onPrevious: () => void;
  busy: boolean;
  rowCount: number;
  pageSize?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}) => {
  // An unknown total is SAID, not estimated. "صفحه ۳" with no "از ۴۰" is the honest shape
  // when the destination cannot count.
  const numbered = totalKnown !== null && pageSize !== undefined && onPageChange !== undefined && onPageSizeChange !== undefined;
  const position =
    totalKnown === null
      ? `صفحهٔ ${pageNumber}`
      : `صفحهٔ ${pageNumber} — ${totalKnown.toLocaleString('fa-IR')} مورد`;

  return (
    <div
      className={numbered ? 'twenty-native-settings-pager' : undefined}
      title={numbered ? JSON.stringify({ page: pageNumber, total: totalKnown, size: pageSize, busy }) : undefined}
      onClick={numbered ? (event) => {
        // Host-native SettingsPaginationControls emits a bounded presentation
        // event over the existing remote HTML event serialization.
        const value = (event.target as { value?: unknown }).value;
        if (busy || typeof value !== 'string') return;
        const match = /^(page|size):(\d+)$/.exec(value);
        if (!match) return;
        const next = Number(match[2]);
        if (match[1] === 'page' && Number.isSafeInteger(next) && next >= 1 && next <= Math.max(1, Math.ceil(totalKnown! / pageSize!))) onPageChange?.(next);
        if (match[1] === 'size' && [25, 50, 100].includes(next)) onPageSizeChange?.(next);
      } : undefined}
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

// The limitation, stated where it applies, in a sentence an accountant can act on. The
// numbers live in the folded technical block; this line says what it means for the list in
// front of them.
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
  const degraded = degradedReason !== null || syncStatus === 'INCOMPLETE';

  if (degraded) {
    return (
      <InlineAlert
        tone="warning"
        title={
          degradedReason === null
            ? 'فهرست کامل نیست'
            : 'آخرین فهرست سالم نمایش داده می‌شود'
        }
      >
        {`آمار این صفحه فقط دربارهٔ ${taken.toLocaleString('fa-IR')} ردیف خوانده‌شده است، نه کل فهرست حسابداری. ${
          degradedReason === null
            ? ''
            : 'ارتباط با حسابداری در این لحظه برقرار نشد.'
        } برای تلاش دوباره، «خواندن دوباره از حسابداری» را بزنید.`}
      </InlineAlert>
    );
  }

  if (truncated) {
    return (
      <InlineAlert tone="warning" title="همهٔ فهرست نمایش داده نمی‌شود">
        {`${taken.toLocaleString('fa-IR')} ردیف اول${
          declaredTotal === null ? '' : ` از ${declaredTotal.toLocaleString('fa-IR')} ردیف`
        } خوانده شد. این نرم‌افزار فهرست را یک‌جا می‌فرستد و این نسخه تا ${limit.toLocaleString('fa-IR')} ردیف را نگه می‌دارد؛ بقیهٔ ردیف‌ها نمایش داده نمی‌شوند. برای پیدا کردن یک کالای خاص از جست‌وجو استفاده کنید.`}
      </InlineAlert>
    );
  }

  if (vendorCannotPage) {
    return (
      <p style={{ ...styles.meta, fontSize: 'var(--t-font-size-xs)', margin: 0 }}>
        این نرم‌افزار فهرست را یک‌بار و یک‌جا می‌فرستد؛ جابه‌جایی بین صفحه‌ها در همین برنامه
        انجام می‌شود.
      </p>
    );
  }

  return null;
};

export type SearchState = { term: string; submitted: string };
