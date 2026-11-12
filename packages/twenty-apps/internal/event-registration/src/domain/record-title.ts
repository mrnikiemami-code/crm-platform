import {
  formatAmountForDisplay,
  toPersianDigits,
} from 'src/components/money-amount';

// Record titles for the two objects this app writes.
//
// Both are Persian and read right-to-left, so the wording leads with the
// subject (ثبت‌نام / پرداخت) and appends the person and the event. A title is
// NEVER empty: every missing fact has its own fallback, and the last fallback is
// the object's own noun. The people and event names here always come from
// server records (`registration-target.ts`), never from the request body.
//
// Money is grouped with the Persian thousands separator through the same
// formatter the entry field uses, then rendered in Persian digits: a stored
// title is Persian text, so it should not mix Latin numerals into an RTL line.

const ZWNJ = '\u200c';
const REGISTRATION_WORD = `ثبت${ZWNJ}نام`;
const EVENT_FALLBACK = 'همایش';
const TOMAN_WORD = 'تومان';

const clean = (value: string | null): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
};

/** `۳٬۰۰۰٬۰۰۰` — the amount as a Persian title shows it. */
const formatToman = (amountToman: number): string =>
  toPersianDigits(formatAmountForDisplay(String(Math.trunc(amountToman))));

/**
 * "ثبت‌نام {person} در {event}"
 *
 * Fallbacks, in order: the person label, then the lead's own label, then no
 * person at all; and the event label, then the generic "همایش". The two
 * fallbacks combine, so a record with neither still gets "ثبت‌نام همایش".
 */
export const buildRegistrationTitle = (facts: {
  personName: string | null;
  eventName: string | null;
  leadName: string | null;
}): string => {
  const person = clean(facts.personName) ?? clean(facts.leadName);
  const event = clean(facts.eventName);

  if (person !== null && event !== null) {
    return `${REGISTRATION_WORD} ${person} در ${event}`;
  }

  if (person !== null) {
    return `${REGISTRATION_WORD} ${person}`;
  }

  if (event !== null) {
    return `${REGISTRATION_WORD} ${EVENT_FALLBACK} ${event}`;
  }

  return `${REGISTRATION_WORD} ${EVENT_FALLBACK}`;
};

/**
 * "پرداخت {amount} تومان — {person} — {event}"
 *
 * The amount is always known (a payment is only proposed for money actually
 * received), so it leads and carries the title on its own when both labels are
 * missing.
 */
export const buildPaymentTitle = (facts: {
  amountToman: number;
  personName: string | null;
  eventName: string | null;
  leadName: string | null;
}): string => {
  const person = clean(facts.personName) ?? clean(facts.leadName);
  const event = clean(facts.eventName);
  const money = `پرداخت ${formatToman(facts.amountToman)} ${TOMAN_WORD}`;

  if (person !== null && event !== null) {
    return `${money} — ${person} — ${event}`;
  }

  if (person !== null) {
    return `${money} — ${person}`;
  }

  if (event !== null) {
    return `${money} — ${event}`;
  }

  return money;
};
