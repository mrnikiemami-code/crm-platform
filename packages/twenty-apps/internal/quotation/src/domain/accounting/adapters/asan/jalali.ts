import { accepted, refused, type Result } from 'src/domain/shared/result';

// Asan wants dates as an 8-digit Jalali integer (`14041001` for 1404-10-01), with `0`
// meaning "server today" and an acceptance of an 8-digit Gregorian date on some endpoints.
//
// The conversion uses the runtime's own Persian calendar through Intl rather than a
// hand-written leap-year table. That is a deliberate trade: a calendar algorithm copied
// from the internet is exactly the kind of code that is wrong for one year in 33 and only
// discovered on a leap-day invoice, whereas ICU's Persian calendar is the same data the
// browser and the operating system use, ships with Node, and is verifiable against the one
// worked example the API guide gives (14041001).
const JALALI_FORMATTER = new Intl.DateTimeFormat('en-u-ca-persian-nu-latn', {
  timeZone: 'UTC',
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});

export type JalaliDate = {
  year: number;
  month: number;
  day: number;
};

// `date` is a calendar date, not an instant. Accepting only YYYY-MM-DD removes the
// timezone question entirely: "2025-12-22" means that date in every workspace, whereas a
// Date object would shift across midnight depending on the server's zone.
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export const toJalali = (isoDate: string): Result<JalaliDate> => {
  const match = ISO_DATE.exec(isoDate.trim());

  if (match === null) {
    return refused(
      'DATE_NOT_ISO_CALENDAR_DAY',
      `expected YYYY-MM-DD, received "${isoDate}"`,
    );
  }

  const utc = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  );

  // A date like 2025-02-30 silently rolls forward in Date; comparing the parts back
  // detects it instead of shipping a document dated a day later than requested.
  if (
    utc.getUTCFullYear() !== Number(match[1]) ||
    utc.getUTCMonth() !== Number(match[2]) - 1 ||
    utc.getUTCDate() !== Number(match[3])
  ) {
    return refused(
      'DATE_NOT_A_CALENDAR_DAY',
      `"${isoDate}" is not a real date`,
    );
  }

  const parts = JALALI_FORMATTER.formatToParts(utc);
  const read = (type: 'year' | 'month' | 'day'): number =>
    Number(parts.find((part) => part.type === type)?.value ?? 'NaN');

  const year = read('year');
  const month = read('month');
  const day = read('day');

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return refused(
      'JALALI_CONVERSION_FAILED',
      'the runtime could not express this date in the Persian calendar',
    );
  }

  return accepted({ year, month, day });
};

// `14041001`. Zero-padded by construction, because `1404-1-1` would be 6 digits and Asan
// would read it as a different field shape.
export const formatJalaliCompact = (date: JalaliDate): string =>
  `${date.year}${String(date.month).padStart(2, '0')}${String(date.day).padStart(2, '0')}`;

export const toAsanFactorDate = (isoDate: string): Result<number> => {
  const jalali = toJalali(isoDate);

  if (!jalali.ok) {
    return jalali;
  }

  const compact = formatJalaliCompact(jalali.value);
  const asNumber = Number(compact);

  // Asan types this as a long; beyond 2^53 the digits would not survive the JSON number.
  if (!Number.isSafeInteger(asNumber)) {
    return refused(
      'DATE_OUT_OF_RANGE',
      'the compact Jalali date is not exactly representable as a JSON number',
    );
  }

  return accepted(asNumber);
};

// The "today" sentinel. Sent explicitly rather than relying on it, so a document is never
// silently dated by the accounting server's clock instead of the CRM's decision.
export const ASAN_TODAY_SENTINEL = 0;

// Reading back: Asan reports dates in `FactorServiceViewModel.FactorDate` as a ulong. The
// guide does not state whether a read returns Jalali or Gregorian, so the value is parsed
// structurally and BOTH readings are offered — the caller must not assume one.
export type AsanDateReading =
  | { kind: 'JALALI'; year: number; month: number; day: number }
  | { kind: 'GREGORIAN'; year: number; month: number; day: number }
  | { kind: 'UNRECOGNISED'; raw: number };

export const readAsanDate = (raw: number): AsanDateReading[] => {
  const digits = Math.trunc(raw).toString();

  if (!/^\d{8}$/.test(digits)) {
    return [{ kind: 'UNRECOGNISED', raw }];
  }

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const readings: AsanDateReading[] = [];

  if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
    readings.push({ kind: 'GREGORIAN', year, month, day });
  }

  if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
    readings.push({ kind: 'JALALI', year, month, day });
  }

  return readings.length > 0 ? readings : [{ kind: 'UNRECOGNISED', raw }];
};
