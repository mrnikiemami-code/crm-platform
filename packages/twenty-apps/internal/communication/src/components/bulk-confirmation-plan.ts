import {
  type BulkRecipient,
  type RecipientPreview,
} from 'src/components/bulk-composer-state';
import { type BulkSendRecipient } from 'src/components/bulk-send-coordinator';

// A stable reason code for a recipient that cannot be sent. The component maps
// it to a FIXED translation key; the code itself is never passed to `t()`.
export type BulkExclusionReasonCode =
  | 'NOT_IN_PREVIEW'
  | 'NOT_READY'
  | 'NO_PHONE'
  | 'NO_BODY';

// The source (English) translation key for each fixed reason. These are the
// ONLY strings handed to `t()`.
export const BULK_EXCLUSION_REASON_KEYS: Record<BulkExclusionReasonCode, string> =
  {
    NOT_IN_PREVIEW: 'No valid preview for this recipient.',
    NOT_READY: 'The preview is not ready to send.',
    NO_PHONE: 'No phone number selected.',
    NO_BODY: 'The message text is empty for this recipient.',
  };

export type BulkExcludedRecipient = {
  personId: string;
  displayName: string;
  reasonCode: BulkExclusionReasonCode;
  /**
   * Unresolved variable tokens, rendered SEPARATELY as data — never
   * concatenated into the translated reason string.
   */
  tokens: string[];
};

// A recipient is sendable for the CONFIRMED group only when the server said the
// preview is ready: it has a phone AND no unresolved variable AND a non-empty
// body. Anything else is left out and counted explicitly.
export type BulkConfirmationPlan = {
  /** Recipients that will actually be sent to, in form order. */
  sendable: BulkSendRecipient[];
  /** Ready recipients that were set aside, with a stable reason code. */
  excluded: BulkExcludedRecipient[];
  /** Numbers shared by two or more of the sendable recipients. */
  sharedNumbers: string[];
  totalRecipients: number;
};

const buildExclusion = (
  recipient: BulkRecipient,
  preview: RecipientPreview | undefined,
): BulkExcludedRecipient => {
  if (preview === undefined) {
    return {
      personId: recipient.personId,
      displayName: recipient.displayName,
      reasonCode: 'NOT_IN_PREVIEW',
      tokens: [],
    };
  }

  if (preview.hasUnresolvedVariables) {
    return {
      personId: recipient.personId,
      displayName: recipient.displayName,
      reasonCode: 'NOT_READY',
      tokens: preview.issues.map((issue) => issue.token),
    };
  }

  if (preview.phone === null || preview.phone.length === 0) {
    return {
      personId: recipient.personId,
      displayName: recipient.displayName,
      reasonCode: 'NO_PHONE',
      tokens: [],
    };
  }

  if (preview.previewText.trim().length === 0) {
    return {
      personId: recipient.personId,
      displayName: recipient.displayName,
      reasonCode: 'NO_BODY',
      tokens: [],
    };
  }

  return {
    personId: recipient.personId,
    displayName: recipient.displayName,
    reasonCode: 'NOT_READY',
    tokens: [],
  };
};

/**
 * Turns the CURRENT valid preview into the exact set of recipients that may be
 * sent, plus an explicit list of the ones set aside.
 *
 * Only recipients present in the preview can be sent: a person the preview did
 * not cover has no confirmed text and is therefore excluded, never guessed. The
 * caller must have a READY preview; an empty or invalid one yields nothing.
 */
export const buildBulkConfirmationPlan = ({
  recipients,
  previews,
}: {
  recipients: readonly BulkRecipient[];
  previews: readonly RecipientPreview[];
}): BulkConfirmationPlan => {
  const previewByPersonId = new Map(
    previews.map((preview) => [preview.personId, preview]),
  );

  const sendable: BulkSendRecipient[] = [];
  const excluded: BulkExcludedRecipient[] = [];

  for (const recipient of recipients) {
    const preview = previewByPersonId.get(recipient.personId);

    const isSendable =
      preview !== undefined &&
      preview.isReadyToSend &&
      preview.phone !== null &&
      preview.previewText.trim().length > 0;

    if (!isSendable) {
      excluded.push(buildExclusion(recipient, preview));
      continue;
    }

    // `isSendable` guarantees a non-null phone; narrow for the type checker.
    if (preview.phone === null) {
      excluded.push(buildExclusion(recipient, preview));
      continue;
    }

    sendable.push({
      personId: recipient.personId,
      displayName: recipient.displayName,
      recipient: preview.phone,
      body: preview.previewText,
    });
  }

  const phoneCounts = new Map<string, number>();

  for (const entry of sendable) {
    phoneCounts.set(entry.recipient, (phoneCounts.get(entry.recipient) ?? 0) + 1);
  }

  const sharedNumbers = [...phoneCounts.entries()]
    .filter(([, count]) => count > 1)
    .map(([phone]) => phone);

  return {
    sendable,
    excluded,
    sharedNumbers,
    totalRecipients: recipients.length,
  };
};
