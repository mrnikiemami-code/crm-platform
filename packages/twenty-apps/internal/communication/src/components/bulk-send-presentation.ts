import {
  type BulkSendRecipientResult,
  type BulkSendRecipientResultKind,
  type BulkSendSummary,
} from 'src/components/bulk-send-coordinator';
import {
  BULK_EXCLUSION_REASON_KEYS,
  type BulkExcludedRecipient,
} from 'src/components/bulk-confirmation-plan';

// Presentation mapping for the bulk send results. Pure and deterministic, so
// the truthfulness rules are testable without the front-component sandbox. The
// component passes the labels through `t()`; the mapping itself never invents a
// success.

export type BulkRecipientVariant =
  | 'success'
  | 'error'
  | 'warning'
  | 'neutral';

export type BulkRecipientDisplay = {
  personId: string;
  displayName: string;
  recipient: string;
  /** Localizable status label (source string) — always app copy. */
  label: string;
  /**
   * Only ACCEPTED is a success; UNKNOWN/RECORDING_PROBLEM are warnings;
   * DEFINITE_FAILURE is an error; NOT_STARTED/SENDING are neutral.
   */
  variant: BulkRecipientVariant;
  /**
   * The detail line. `isProviderText` is true when this is the PROVIDER's own
   * wording (a definite failure reason): it is shown verbatim and must NOT be
   * passed through `t()`. When false it is app copy and IS translated.
   */
  detail: string | null;
  isProviderText: boolean;
};

// Localizable copy. Kept here so the mapping stays pure and the component
// localizes a precise message.
export const BULK_RESULT_LABELS: Record<BulkSendRecipientResultKind, string> = {
  ACCEPTED: 'Sent',
  DEFINITE_FAILURE: 'Failed',
  UNKNOWN: 'Outcome unknown',
  RECORDING_PROBLEM: 'Result not recorded',
  NOT_STARTED: 'Not started',
};

export const BULK_STATUS_DELIVERED = 'Delivered';
export const BULK_SENDING_LABEL = 'Sending…';

export const BULK_STOPPED_UNKNOWN_TITLE = 'The group was stopped.';
export const BULK_STOPPED_UNKNOWN_MESSAGE =
  'One result is unknown. Check the communication history before sending again.';
export const BULK_STOPPED_USER_TITLE = 'Sending was stopped.';
export const BULK_STOPPED_USER_MESSAGE =
  'Recipients that were not reached are marked as not started.';

const toVariant = (kind: BulkSendRecipientResultKind): BulkRecipientVariant => {
  switch (kind) {
    case 'ACCEPTED':
      return 'success';
    case 'DEFINITE_FAILURE':
      return 'error';
    case 'UNKNOWN':
    case 'RECORDING_PROBLEM':
      return 'warning';
    case 'NOT_STARTED':
      return 'neutral';
  }
};

// SENT is never labelled "delivered": only a real DELIVERED status gets that
// label, so the two outcomes stay visibly distinct.
const toLabel = (result: BulkSendRecipientResult): string => {
  if (result.kind === 'ACCEPTED' && result.status === 'DELIVERED') {
    return BULK_STATUS_DELIVERED;
  }

  return BULK_RESULT_LABELS[result.kind];
};

/**
 * Builds one row per confirmed recipient for the RUNNING or FINISHED view.
 *
 * The recipient whose request is in flight is shown as SENDING (never
 * NOT_STARTED), recipients not yet attempted stay NOT_STARTED, and every
 * completed result keeps its own truthful label and severity.
 */
export const buildBulkRecipientDisplay = ({
  results,
  currentPersonId,
}: {
  results: readonly BulkSendRecipientResult[];
  currentPersonId: string | null;
}): BulkRecipientDisplay[] =>
  results.map((result) => {
    if (result.personId === currentPersonId) {
      return {
        personId: result.personId,
        displayName: result.displayName,
        recipient: result.recipient,
        label: BULK_SENDING_LABEL,
        variant: 'neutral' as const,
        detail: null,
        isProviderText: false,
      };
    }

    // A definite failure carries the provider's OWN wording: show it verbatim
    // and never pretend it is translated application copy.
    const isProviderText = result.kind === 'DEFINITE_FAILURE';

    return {
      personId: result.personId,
      displayName: result.displayName,
      recipient: result.recipient,
      label: toLabel(result),
      variant: toVariant(result.kind),
      detail: result.message ?? null,
      isProviderText,
    };
  });

export type BulkSummaryPresentation = {
  acceptedCount: number;
  definiteFailureCount: number;
  unknownCount: number;
  notStartedCount: number;
  /** Title + message for a stopped group, or null when the run completed. */
  stopNotice: { title: string; message: string } | null;
};

export const buildBulkSummaryPresentation = (
  summary: BulkSendSummary,
): BulkSummaryPresentation => {
  const stopNotice =
    summary.isStopped === false
      ? null
      : summary.stopReason === 'USER'
        ? {
            title: BULK_STOPPED_USER_TITLE,
            message: BULK_STOPPED_USER_MESSAGE,
          }
        : {
            title: BULK_STOPPED_UNKNOWN_TITLE,
            message: BULK_STOPPED_UNKNOWN_MESSAGE,
          };

  return {
    acceptedCount: summary.acceptedCount,
    definiteFailureCount: summary.definiteFailureCount,
    unknownCount: summary.unknownCount,
    notStartedCount: summary.notStartedCount,
    stopNotice,
  };
};

export type BulkExcludedDisplay = {
  personId: string;
  displayName: string;
  /** The FIXED translation key for the reason. */
  reasonKey: string;
  /** Unresolved tokens, rendered separately as data (never translated). */
  tokens: string[];
};

export const buildBulkExcludedDisplay = (
  excluded: readonly BulkExcludedRecipient[],
): BulkExcludedDisplay[] =>
  excluded.map((entry) => ({
    personId: entry.personId,
    displayName: entry.displayName,
    reasonKey: BULK_EXCLUSION_REASON_KEYS[entry.reasonCode],
    tokens: entry.tokens,
  }));
