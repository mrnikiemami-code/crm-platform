import { useEffect, useRef, useState } from 'react';
import { ACCOUNTING_OUTBOUND_ROUTE, callAppRoute } from 'src/components/quotation-api';
import { InlineAlert, PrimaryButton } from 'src/components/accounting/accounting-business-ui';
import { asRecord, readString, sharedStyles as styles } from 'src/components/accounting/accounting-shared';
import { NativeSettingsTable, NativeSettingsHead, NativeSettingsBody, NativeSettingsRow, NativeSettingsHeader, NativeSettingsCell } from 'src/components/shared/native-settings-table';

type Report = 'SUMMARY' | 'CARDEX' | 'PROFORMAS';
const REPORTS: { id: Report; label: string }[] = [
  { id: 'SUMMARY', label: 'مانده و اعتبار' },
  { id: 'CARDEX', label: 'گردش حساب' },
  { id: 'PROFORMAS', label: 'پیش‌فاکتورهای حسابداری' },
];
const persianDigits = (s: string) => s.replace(/\d/g, d => '۰۱۲۳۴۵۶۷۸۹'[Number(d)]);
const shown = (v: unknown) => typeof v === 'string' && v !== '' ? persianDigits(v) : 'نامشخص';
const amount = (v: unknown) => {
  const row = asRecord(v);
  return shown(row?.reportedText);
};
const unitLabel = (unit: unknown) => unit === 'RIAL' ? 'ریال' : unit === 'TOMAN' ? 'تومان' : 'واحد پول تأیید نشده';
const rowsOf = (v: unknown) => Array.isArray(v) ? v.map(asRecord).filter((row): row is Record<string, unknown> => row !== null) : [];
const displayTime = (value: unknown) => {
  const time = new Date(readString(value));
  return Number.isFinite(time.getTime()) ? time.toLocaleString('fa-IR', { timeZone: 'Asia/Tehran' }) : 'نامشخص';
};

export const CustomerFinanceReport = ({ connectionId, selection, canManage }: {
  connectionId: string; selection: { id: string; type: 'PERSON' | 'COMPANY' }; canManage: boolean;
}) => {
  const [report, setReport] = useState<Report>('SUMMARY');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [count, setCount] = useState('20');
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const generation = useRef(0);
  useEffect(() => () => { generation.current += 1; }, []);
  const reset = () => { generation.current += 1; setData(null); setError(null); setBusy(false); };
  const start = Date.parse(from + 'T00:00:00.000Z');
  const end = Date.parse(to + 'T00:00:00.000Z');
  const validDates = Number.isFinite(start) && Number.isFinite(end) && start >= 0 && end >= start && end - start < 93 * 86400000;
  const validCount = /^\d+$/.test(count) && Number(count) >= 1 && Number(count) <= 100;
  const load = async () => {
    if (!canManage || busy || (report === 'CARDEX' && !validDates) || (report === 'PROFORMAS' && !validCount)) return;
    const current = ++generation.current;
    setBusy(true); setData(null); setError(null);
    try {
      const response = await callAppRoute(ACCOUNTING_OUTBOUND_ROUTE, {
        action: 'customer-finance', connectionId, internalPartyId: selection.id, partyType: selection.type, report,
        ...(report === 'CARDEX' ? { from, to } : {}), ...(report === 'PROFORMAS' ? { count: Number(count) } : {}),
      });
      if (current !== generation.current) return;
      const observation = asRecord(response.data.observation);
      if (!response.ok || response.data.success !== true || !observation || observation.report !== report ||
          observation.connectionId !== connectionId || observation.certified !== false) {
        setError('گزارش قابل دریافت نیست؛ اتصال، نگاشت مشتری و مجوز خواندن را بررسی کنید.');
        return;
      }
      setData(observation);
    } catch { if (current === generation.current) setError('ارتباط با سرور برقرار نشد.'); }
    finally { if (current === generation.current) setBusy(false); }
  };
  return <section dir="rtl" aria-label="گزارش مالی مشتری" style={{ display: 'flex', flexDirection: 'column', gap: 12, minWidth: 0 }}>
    <div role="group" aria-label="نوع گزارش" style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {REPORTS.map(item => <button type="button" key={item.id} aria-pressed={item.id === report} style={{ ...styles.input, cursor: 'pointer' }}
        onClick={() => { reset(); setReport(item.id); }}>{item.label}</button>)}
    </div>
    {report === 'CARDEX' && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      <label style={styles.label}>از تاریخ (میلادی)<input aria-label="از تاریخ میلادی" type="date" style={styles.input} value={from} onChange={event => { reset(); setFrom(event.target.value); }} /></label>
      <label style={styles.label}>تا تاریخ (میلادی)<input aria-label="تا تاریخ میلادی" type="date" style={styles.input} value={to} onChange={event => { reset(); setTo(event.target.value); }} /></label>
    </div>}
    {report === 'PROFORMAS' && <label style={styles.label}>تعداد (حداکثر ۱۰۰)<input type="number" min={1} max={100} step={1} style={styles.input} value={count} onChange={event => { reset(); setCount(event.target.value); }} /></label>}
    <PrimaryButton label={busy ? 'در حال دریافت…' : 'دریافت گزارش'} disabled={!canManage || busy || (report === 'CARDEX' && !validDates) || (report === 'PROFORMAS' && !validCount)} onClick={() => void load()} />
    {error && <InlineAlert tone="danger" title="دریافت گزارش">{error}</InlineAlert>}
    {data && <>
      <div style={styles.meta}>منبع: آسان · {unitLabel(data.moneyUnit)} · {displayTime(data.observedAt)}</div>
      <InlineAlert tone="warning" title="اطلاعات گزارش‌شده">مبالغ و تفسیر مالی هنوز با مقصد واقعی تأیید نشده‌اند؛ این گزارش سند مالی CRM نیست.</InlineAlert>
      {report === 'SUMMARY' && <NativeSettingsTable columns="minmax(140px, 1fr) minmax(100px, 1fr)">
        <NativeSettingsHead><NativeSettingsRow><NativeSettingsHeader>عنوان</NativeSettingsHeader><NativeSettingsHeader>مقدار</NativeSettingsHeader></NativeSettingsRow></NativeSettingsHead>
        <NativeSettingsBody>{[
          ['مانده گزارش‌شده', amount(data.remain)],
          ['اعتبار دفتری', amount(data.bookCredit)],
          ['اعتبار چک', amount(data.chequeCredit)],
          ['مهلت تسویه (روز)', typeof data.settlementDays === 'number' ? shown(String(data.settlementDays)) : 'نامشخص'],
        ].map(([label, value]) => <NativeSettingsRow key={label}><NativeSettingsCell>{label}</NativeSettingsCell><NativeSettingsCell>{value}</NativeSettingsCell></NativeSettingsRow>)}</NativeSettingsBody>
      </NativeSettingsTable>}
      {report === 'CARDEX' && <div style={{ overflowX: 'auto' }}>
        <div style={styles.meta}>بازه میلادی: {shown(data.from)} تا {shown(data.to)}؛ حدود زمانی مقصد تأیید نشده‌اند.</div>
        {rowsOf(data.rows).length === 0 ? <span>در بازه انتخاب‌شده ردیفی گزارش نشده است.</span> :
          <NativeSettingsTable columns="110px minmax(160px, 2fr) 120px 120px 120px 120px" style={{ minWidth: 750 }}>
            <NativeSettingsHead><NativeSettingsRow>{['تاریخ', 'شرح', 'نوع سند', 'بدهکار', 'بستانکار', 'مانده'].map(label => <NativeSettingsHeader key={label}>{label}</NativeSettingsHeader>)}</NativeSettingsRow></NativeSettingsHead>
            <NativeSettingsBody>{rowsOf(data.rows).map((row, i) => <NativeSettingsRow key={i}>{['shownDate', 'description', 'documentType', 'debitText', 'creditText', 'balanceText'].map(field => <NativeSettingsCell key={field}>{shown(row[field])}</NativeSettingsCell>)}</NativeSettingsRow>)}</NativeSettingsBody>
          </NativeSettingsTable>}
      </div>}
      {report === 'PROFORMAS' && <div>
        {rowsOf(data.rows).length === 0 ? <span>پیش‌فاکتوری در گزارش اخیر دیده نشد.</span> : rowsOf(data.rows).map(row => <details key={readString(row.externalDocumentId)} style={{ marginBlock: 8 }}>
          <summary>پیش‌فاکتور {shown(row.externalDocumentId)} — {shown(row.description)}</summary>
          <div style={{ overflowX: 'auto' }}><NativeSettingsTable columns="repeat(4, minmax(105px, 1fr))" style={{ minWidth: 440 }}>
            <NativeSettingsHead><NativeSettingsRow>{['کد کالا', 'تعداد', 'قیمت گزارش‌شده', 'کد انبار'].map(label => <NativeSettingsHeader key={label}>{label}</NativeSettingsHeader>)}</NativeSettingsRow></NativeSettingsHead>
            <NativeSettingsBody>{rowsOf(row.rows).map((detail, i) => <NativeSettingsRow key={i}>{['externalItemId', 'quantity', 'observedPrice', 'storageId'].map(field => <NativeSettingsCell key={field}>{shown(typeof detail[field] === 'number' ? String(detail[field]) : detail[field])}</NativeSettingsCell>)}</NativeSettingsRow>)}</NativeSettingsBody>
          </NativeSettingsTable></div>
        </details>)}
      </div>}
    </>}
  </section>;
};
