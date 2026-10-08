import { type BulkRecipient } from 'src/bulk/resolve-bulk-recipients';
import {
  interpolateTemplate,
  type TemplateInterpolationIssue,
} from 'src/templates/interpolate-template';
import { type TemplateRecipientData } from 'src/templates/template-variable-catalog';

export type TemplateRecipientPreview = {
  personId: string;
  displayName: string;
  /** The number that would be used, or `null` when not sendable. */
  phone: string | null;
  /** The fully interpolated text for this recipient. */
  previewText: string;
  /** True when any placeholder was unknown or an empty field. */
  hasUnresolvedVariables: boolean;
  issues: TemplateInterpolationIssue[];
  /** A recipient can only be ready when it has a phone AND no open issues. */
  isReadyToSend: boolean;
};

export type TemplatePreview = {
  previews: TemplateRecipientPreview[];
  /** True when ANY recipient has an unresolved variable. */
  hasUnresolvedVariables: boolean;
  /** Number of recipients ready to send (phone + no open issues). */
  readyCount: number;
};

/**
 * Builds a per-recipient preview. Recipient data is resolved on the server and
 * passed in; this function never reads a record and never authorizes anything,
 * so the frontend can render the result but cannot be the authority for
 * recipient access or template evaluation.
 */
export const buildTemplatePreview = ({
  body,
  recipients,
  recipientData,
}: {
  body: string;
  recipients: BulkRecipient[];
  recipientData: Map<string, TemplateRecipientData>;
}): TemplatePreview => {
  const previews: TemplateRecipientPreview[] = recipients.map((recipient) => {
    const data = recipientData.get(recipient.personId) ?? {
      firstName: null,
      lastName: null,
      fullName: null,
      companyName: null,
    };

    const interpolated = interpolateTemplate({ body, recipient: data });
    const hasPhone = recipient.selectedPhone !== null;

    return {
      personId: recipient.personId,
      displayName: recipient.displayName,
      phone: recipient.selectedPhone,
      previewText: interpolated.text,
      hasUnresolvedVariables: interpolated.hasUnresolvedVariables,
      issues: interpolated.issues,
      // An unresolved variable must NEVER be presented as ready to send.
      isReadyToSend: hasPhone && !interpolated.hasUnresolvedVariables,
    };
  });

  return {
    previews,
    hasUnresolvedVariables: previews.some(
      (preview) => preview.hasUnresolvedVariables,
    ),
    readyCount: previews.filter((preview) => preview.isReadyToSend).length,
  };
};
