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
  /** The stored ownership flag; `null` when it was never recorded. */
  titleIsAuto: boolean | null;
};

export type SalesInteractionTitleDecision =
  | {
      kind: 'WRITE_TITLE';
      title: string;
      titleIsAuto: true;
      because: 'TITLE_EMPTY' | 'FACTS_CHANGED';
    }
  /** The title was edited by a person: only ownership changes, the text never. */
  | { kind: 'RELEASE_OWNERSHIP'; titleIsAuto: false; because: 'TITLE_MANUAL_EDIT' }
  | {
      kind: 'NO_WRITE';
      because:
        | 'TITLE_UNBUILDABLE'
        | 'TITLE_ALREADY_CORRECT'
        | 'TITLE_MANUAL'
        | 'OWNERSHIP_ABSENT';
    };

/**
 * Whether to write the title, release ownership, or do nothing — and why.
 *
 * `titleEditedInThisEvent` is what makes the manual-edit contract work, and it is
 * the reason the caller must pass the event's `updatedFields` rather than guess
 * from the text. The order of the checks is the contract:
 *
 *  1. `TITLE_ALREADY_CORRECT` — the stored title equals what this app would
 *     generate. This is what the app's OWN write looks like on the way back, so
 *     it stops the re-entry loop and is never mistaken for a manual edit.
 *  2. `TITLE_MANUAL_EDIT` — the title changed in THIS event and does not match
 *     what the app would generate, so a person typed it. Ownership is released
 *     (`titleIsAuto=false`) so no later attempt or rename can overwrite it.
 *     The text is left exactly as typed.
 *  3. `FACTS_CHANGED` — the attempt or the customer changed but the title did
 *     not, and ownership is still ours, so the title follows.
 *  4. Otherwise the title is left alone: manual, legacy (`null` ownership, which
 *     is only ever resolved by the reviewed backfill), or unbuildable.
 */
export const decideSalesInteractionTitle = ({
  state,
  titleEditedInThisEvent,
}: {
  state: SalesInteractionTitleState;
  /** True when `name` is among the fields this event changed. */
  titleEditedInThisEvent: boolean;
}): SalesInteractionTitleDecision => {
  const expectedTitle = buildSalesInteractionTitle(state);
  const currentTitle = clean(state.title);

  if (expectedTitle === null) {
    return { kind: 'NO_WRITE', because: 'TITLE_UNBUILDABLE' };
  }

  if (currentTitle === null) {
    return {
      kind: 'WRITE_TITLE',
      title: expectedTitle,
      titleIsAuto: true,
      because: 'TITLE_EMPTY',
    };
  }

  if (currentTitle === expectedTitle) {
    return { kind: 'NO_WRITE', because: 'TITLE_ALREADY_CORRECT' };
  }

  if (titleEditedInThisEvent) {
    return {
      kind: 'RELEASE_OWNERSHIP',
      titleIsAuto: false,
      because: 'TITLE_MANUAL_EDIT',
    };
  }

  if (!isTitleOwnedByApp(state.titleIsAuto)) {
    return {
      kind: 'NO_WRITE',
      because:
        state.titleIsAuto === null ? 'OWNERSHIP_ABSENT' : 'TITLE_MANUAL',
    };
  }

  return {
    kind: 'WRITE_TITLE',
    title: expectedTitle,
    titleIsAuto: true,
    because: 'FACTS_CHANGED',
  };
};
