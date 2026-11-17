import { clean } from 'src/domain/record-title';

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
};

export type SalesInteractionTitleDecision =
  | { apply: true; title: string; because: 'TITLE_EMPTY' | 'TITLE_WAS_AUTO' }
  | {
      apply: false;
      because: 'TITLE_UNBUILDABLE' | 'TITLE_MANUAL' | 'TITLE_UNCHANGED';
      title: string | null;
    };

/**
 * Whether to (re)write the title, and why.
 *
 * Automatic and hand-written titles are told apart WITHOUT a stored flag, by
 * recomputing what the title would have been from the PREVIOUS state, which the
 * database update event carries in `properties.before`. If the stored title
 * still equals that, the system wrote it and may replace it; if it differs, a
 * person typed it and it is never touched.
 *
 * This is exact comparison against a deterministically derived value, not a
 * pattern guess: a hand-written title that does not match the canonical wording
 * is always detected. The one boundary it cannot see is a person typing the
 * canonical wording verbatim, which is indistinguishable from an automatic
 * title without persisting a flag — see the report.
 *
 * `TITLE_UNCHANGED` is returned when the computed title already equals the
 * stored one, so a no-op never issues a write and cannot re-trigger the event.
 */
export const decideSalesInteractionTitle = ({
  previous,
  next,
}: {
  /** The record as it was; `null` on creation. */
  previous: SalesInteractionTitleState | null;
  next: SalesInteractionTitleState;
}): SalesInteractionTitleDecision => {
  const nextTitle = buildSalesInteractionTitle(next);
  const currentTitle = clean(next.title);

  if (nextTitle === null) {
    return { apply: false, because: 'TITLE_UNBUILDABLE', title: currentTitle };
  }

  if (currentTitle === null) {
    return { apply: true, title: nextTitle, because: 'TITLE_EMPTY' };
  }

  if (currentTitle === nextTitle) {
    return { apply: false, because: 'TITLE_UNCHANGED', title: currentTitle };
  }

  const previousTitle =
    previous === null ? null : buildSalesInteractionTitle(previous);

  if (previousTitle !== null && currentTitle === previousTitle) {
    return { apply: true, title: nextTitle, because: 'TITLE_WAS_AUTO' };
  }

  return { apply: false, because: 'TITLE_MANUAL', title: currentTitle };
};
