// Excerpt of packages/twenty-apps/internal/quotation/src/components/tax-policy-settings-panel.tsx
// The shipped (rejected) row markup and the action styles. This is what the operator saw.

// One row: identity + badges, four metrics, then the action area.
<li style={rowStyle}>
  <div style={styles.identity}>
    <h3 style={styles.rowName}>{row.name}</h3>
    <div style={styles.badges}>
      {row.isDefault ? <span style={styles.badgeDefault}>پیش‌فرض</span> : null}
      {row.isActive ? null : <span style={styles.badgeOff}>غیرفعال</span>}
    </div>
  </div>

  <div style={styles.metrics}>
    <div style={styles.metric}><span style={styles.metricLabel}>مالیات</span><span style={styles.metricValue}>{percentLabel(row.ratePercent)}</span></div>
    <div style={styles.metric}><span style={styles.metricLabel}>عوارض</span><span style={styles.metricValue}>{percentLabel(row.dutyRatePercent)}</span></div>
    <div style={styles.metric}><span style={styles.metricLabel}>جمع</span><span style={styles.metricValueTotal}>{percentLabel(row.totalRatePercent)}</span></div>
    <div style={styles.metric}><span style={styles.metricLabel}>اسناد</span><span style={styles.metricValue}>{toPersianDigits(String(row.quotationCount))}</span></div>
  </div>

  <div style={styles.rowActions}>
    {isConfirming ? (
      <>
        <span style={styles.confirmText}>«{row.name}» حذف شود؟</span>
        <button style={styles.dangerButton}>تأیید حذف</button>
        <button style={styles.ghostButton}>انصراف</button>
      </>
    ) : (
      <>
        <button style={styles.ghostButton}>ویرایش</button>
        {row.isActive && !row.isDefault ? <button style={styles.ghostButton}>انتخاب پیش‌فرض</button> : null}
        {row.isActive && !row.isDefault ? <button style={styles.ghostButton}>غیرفعال</button> : null}
        {!row.isActive ? <button style={styles.ghostButton}>فعال‌سازی</button> : null}
        {row.isActive && !row.isDefault && row.quotationCount === 0 ? <button style={styles.ghostDanger}>حذف</button> : null}
      </>
    )}
  </div>
  {hint === null ? null : <p style={styles.rowHint}>{hint}</p>}
</li>

// The action styles as shipped. These are the controls the operator could not see.
ghostButton: { height: 28, padding: '0 8px', borderRadius: 6, border: '1px solid transparent', background: 'transparent', color: '#4c4c4c', fontSize: 12, cursor: 'pointer' }
ghostDanger: { height: 28, padding: '0 8px', borderRadius: 6, border: '1px solid transparent', background: 'transparent', color: '#b42318', fontSize: 12, cursor: 'pointer' }
dangerButton: { height: 28, padding: '0 10px', borderRadius: 6, border: '1px solid transparent', background: '#b42318', color: '#ffffff', fontSize: 12, fontWeight: 500 }
primaryButton: { height: 32, padding: '0 14px', borderRadius: 8, border: '1px solid transparent', background: '#333333', color: '#ffffff', fontSize: 13 }
secondaryButton: { height: 32, padding: '0 12px', borderRadius: 8, border: '1px solid #d6d6d6', background: '#ffffff', color: '#333333', fontSize: 13 }
row: { display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px 16px', padding: '10px 14px', background: '#fcfcfc' }
rowInactive: { opacity: 0.72 }
metricLabel: { fontSize: 10, color: '#8a8a8a' }
metricValue: { fontSize: 13, fontWeight: 600, color: '#333333' }
metricValueTotal: { fontSize: 13, fontWeight: 700, color: '#3b5bdb' }
rowHint: { fontSize: 11, color: '#666666' }

// Header of the panel and the empty state, as shipped.
<header style={styles.header}>
  <div style={styles.headerText}>
    <h2 style={styles.title}>مالیات و عوارض</h2>
    <p style={styles.subtitle}>سیاست پیش‌فرض شروع هر پیش‌فاکتور جدید است؛ اسناد صادرشده نرخ خود را نگه می‌دارند.</p>
  </div>
  <button style={styles.primaryButton}>افزودن سیاست</button>
</header>

// The editor, as shipped: name, tax, duty, computed total, and save/cancel.
<section style={styles.editor}>
  <h3 style={styles.sectionTitle}>سیاست مالیات</h3>
  <div style={styles.fields}>
    <label style={styles.label}>نام سیاست<input style={styles.input} /></label>
    <label style={styles.label}>مالیات (٪)<input style={styles.input} /></label>
    <label style={styles.label}>عوارض (٪)<input style={styles.input} /></label>
  </div>
  <div style={styles.totalRow}><span style={styles.totalLabel}>جمع مالیات و عوارض</span><span style={styles.totalValue}>۷٫۶٪</span></div>
  <div style={styles.actions}><button style={styles.secondaryButton}>انصراف</button><button style={styles.primaryButton}>ذخیره</button></div>
</section>

// Business rules the design must not change:
// - one policy carries a tax rate and a duty rate; the total is computed, never typed
// - exactly one active default policy, enforced by the server
// - a policy used by any document cannot be deleted, only deactivated
// - deleting the default policy is refused; the last active policy cannot be deactivated
// - historical documents keep the rate they were priced with
