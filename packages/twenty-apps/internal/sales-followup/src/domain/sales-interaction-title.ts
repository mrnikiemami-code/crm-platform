import { isNonEmptyString } from '@sniptt/guards';

import { isTitleOwnedByApp } from 'src/domain/title-ownership';

// Titles for sales follow-ups ("پیگیری فروش").
//
// Format: "تماس {ordinal} با {customer}" — e.g. «تماس اول با سارا رضایی». Both
// facts are read from records, never from a request body: the ordinal from
// `callAttempt`, the customer from the linked Person through the interaction's
// eventLead.
//
// The ordinal labels mirror the `callAttempt` SELECT options declared in the
// workspace metadata (تماس اول … تماس پنجم). They are repeated here because a
// pure function cannot read metadata; a value with no ordinal here yields NO
// title rather than a title with a wrong or missing ordinal, so adding a sixth
// option fails visibly instead of silently writing «تماس  با …».
const CALL_ATTEMPT_ORDINALS: Record<string, string> = {
  CALL_1: 'اول',
  CALL_2: 'دوم',
  CALL_3: 'سوم',
  CALL_4: 'چهارم',
  CALL_5: 'پنجم',
};

export const UNNAMED_CUSTOMER = 'مشتری بدون نام';

// A trimmed value, or null when absent. Trim BEFORE the guard: a value of only
// spaces is non-empty as a string but carries no text. Kept local rather than
// imported from another app, because each app is packaged and installed on its
// own.
const clean = (value: string | null): string | null => {
  const trimmed = typeof value === 'string' ? value.trim() : '';

  return isNonEmptyString(trimmed) ? trimmed : null;
};

export type SalesInteractionTitleFacts = {
  callAttempt: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
};

/** "سارا رضایی" — trimmed, single-spaced, or null when the person has no name. */
export const composeCustomerName = (
  firstName: string | null,
  lastName: string | null,
): string | null => {
  const parts = [clean(firstName), clean(lastName)].filter(
    (part): part is string => part !== null,
  );

  return parts.length > 0 ? parts.join(' ') : null;
};

/**
 * The canonical title for one follow-up, or `null` when it cannot be built.
 *
 * `null` is returned — never a half-built title — when the attempt is missing or
 * is not one of the known ordinals. An unknown customer name is NOT null: it
 * becomes «مشتری بدون نام», because a readable title is required even when the
 * Person has no name recorded.
 */
export const buildSalesInteractionTitle = (
  facts: SalesInteractionTitleFacts,
): string | null => {
  const attempt = clean(facts.callAttempt);
  const ordinal = attempt === null ? null : CALL_ATTEMPT_ORDINALS[attempt];

  if (ordinal === undefined || ordinal === null) {
    return null;
  }

  const customer =
    composeCustomerName(facts.customerFirstName, facts.customerLastName) ??
    UNNAMED_CUSTOMER;

  return `تماس ${ordinal} با ${customer}`;
};

export type SalesInteractionTitleState = {
  callAttempt: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  /** The value stored in the interaction's `name` field. */
  title: string | null;
  /** The stored ownership flag; `null` for a row that predates the field. */
  titleIsAuto: boolean | null;
};

export type SalesInteractionTitleDecision =
  | { apply: true; title: string; titleIsAuto: true; because: 'TITLE_EMPTY' }
  | {
      apply: true;
      title: string;
      titleIsAuto: true;
      because: 'TITLE_WAS_AUTO';
    }
  | {
      apply: false;
      because:
        | 'TITLE_UNBUILDABLE'
        | 'TITLE_MANUAL'
        | 'TITLE_UNCHANGED'
        | 'OWNERSHIP_ABSENT';
      title: string | null;
    };

/**
 * Whether to (re)write the title, and why.
 *
 * The ownership flag is the ONLY thing that decides whether an existing title may
 * be replaced; the text is never inspected for a resemblance to the generated
 * wording. Two guards keep the app from destroying text it did not write:
 *
 *  - an EMPTY title is always safe to fill (nobody loses text), and filling it
 *    claims ownership so later edits can follow;
 *  - a non-empty title is replaced only when ownership is explicitly `true`.
 *
 * `OWNERSHIP_ABSENT` reports a non-empty title on a row whose flag is `null` —
 * a legacy row. Rewriting it is exactly the destructive case, so it is reported
 * (the backfill decides, once, under review) rather than acted on.
 *
 * `TITLE_UNCHANGED` is returned when the computed title already equals the stored
 * one, so a no-op never issues a write and cannot re-trigger its own event.
 */
export const decideSalesInteractionTitle = ({
  state,
}: {
  state: SalesInteractionTitleState;
}): SalesInteractionTitleDecision => {
  const nextTitle = buildSalesInteractionTitle(state);
  const currentTitle = clean(state.title);

  if (nextTitle === null) {
    return { apply: false, because: 'TITLE_UNBUILDABLE', title: currentTitle };
  }

  if (currentTitle === null) {
    return {
      apply: true,
      title: nextTitle,
      titleIsAuto: true,
      because: 'TITLE_EMPTY',
    };
  }

  if (currentTitle === nextTitle) {
    // Already correct. Re-asserting ownership here is deliberate: it heals a row
    // whose flag was lost, without changing the text.
    return { apply: false, because: 'TITLE_UNCHANGED', title: currentTitle };
  }

  if (!isTitleOwnedByApp(state.titleIsAuto)) {
    return {
      apply: false,
      because: state.titleIsAuto === null ? 'OWNERSHIP_ABSENT' : 'TITLE_MANUAL',
      title: currentTitle,
    };
  }

  return {
    apply: true,
    title: nextTitle,
    titleIsAuto: true,
    because: 'TITLE_WAS_AUTO',
  };
};
