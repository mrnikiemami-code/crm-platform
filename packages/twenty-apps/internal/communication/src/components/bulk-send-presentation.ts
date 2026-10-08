import {
  type BulkSendRecipientResult,
  type BulkSendRecipientResultKind,
  type BulkSendSummary,
} from 'src/components/bulk-send-coordinator';

// Presentation mapping for the bulk send results. Pure and deterministic, so
// the truthfulness rules are testable without the front-component sandbox. The
// component passes the labels through `t()`; the mapping itself never invents a
// success.

export type BulkRecipientResultPresentation = {
  personId: string;
  displayName: string;
  recipient: string;
  /** Localizable status label (source string). */
  label: string;
  /**
   * Only ACCEPTED is a success; UNKNOWN/RECORDING_PROBLEM are warnings;
   * DEFINITE_FAILURE is an error; NOT_STARTED is neutral.
   */
  variant: 'success' | 'error' | 'warning' | 'neutral';
  /** The server's own reason, verbatim, when one was reported. */
  detail: string | null;
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

export const BULK_STOPPED_UNKNOWN_TITLE = 'The group was stopped.';
export const BULK_STOPPED_UNKNOWN_MESSAGE =
  'One result is unknown. Check the communication history before sending again.';
export const BULK_STOPPED_USER_TITLE = 'Sending was stopped.';
export const BULK_STOPPED_USER_MESSAGE =
  'Recipients that were not reached are marked as not started.';

const toVariant = (
  kind: BulkSendRecipientResultKind,
): BulkRecipientResultPresentation['variant'] => {
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

export const buildBulkResultPresentation = (
  results: readonly BulkSendRecipientResult[],
): BulkRecipientResultPresentation[] =>
  results.map((result) => ({
    personId: result.personId,
    displayName: result.displayName,
    recipient: result.recipient,
    label: toLabel(result),
    variant: toVariant(result.kind),
    detail: result.message ?? null,
  }));

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
