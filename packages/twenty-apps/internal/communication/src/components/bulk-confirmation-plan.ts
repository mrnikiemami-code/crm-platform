import {
  type BulkRecipient,
  type RecipientPreview,
} from 'src/components/bulk-composer-state';
import { type BulkSendRecipient } from 'src/components/bulk-send-coordinator';

// A recipient is sendable for the CONFIRMED group only when the server said the
// preview is ready: it has a phone AND no unresolved variable AND a non-empty
// body. Anything else is left out and counted explicitly.
export type BulkConfirmationPlan = {
  /** Recipients that will actually be sent to, in form order. */
  sendable: BulkSendRecipient[];
  /** Ready recipients that were set aside, with the reason. */
  excluded: { personId: string; displayName: string; reason: string }[];
  /** Numbers shared by two or more of the sendable recipients. */
  sharedNumbers: string[];
  totalRecipients: number;
};

const EXCLUSION_REASONS = {
  NOT_IN_PREVIEW: 'No valid preview for this recipient.',
  NOT_READY: 'The preview is not ready to send.',
  NO_PHONE: 'No phone number selected.',
  NO_BODY: 'The message text is empty for this recipient.',
} as const;

const buildReason = (preview: RecipientPreview): string => {
  if (preview.hasUnresolvedVariables) {
    return preview.issues.length > 0
      ? `${EXCLUSION_REASONS.NOT_READY} (${preview.issues
          .map((issue) => issue.token)
          .join(', ')})`
      : EXCLUSION_REASONS.NOT_READY;
  }

  if (preview.phone === null || preview.phone.length === 0) {
    return EXCLUSION_REASONS.NO_PHONE;
  }

  if (preview.previewText.trim().length === 0) {
    return EXCLUSION_REASONS.NO_BODY;
  }

  return EXCLUSION_REASONS.NOT_READY;
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
  const excluded: BulkConfirmationPlan['excluded'] = [];

  for (const recipient of recipients) {
    const preview = previewByPersonId.get(recipient.personId);

    if (preview === undefined) {
      excluded.push({
        personId: recipient.personId,
        displayName: recipient.displayName,
        reason: EXCLUSION_REASONS.NOT_IN_PREVIEW,
      });
      continue;
    }

    if (
      !preview.isReadyToSend ||
      preview.phone === null ||
      preview.previewText.trim().length === 0
    ) {
      excluded.push({
        personId: recipient.personId,
        displayName: recipient.displayName,
        reason: buildReason(preview),
      });
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
