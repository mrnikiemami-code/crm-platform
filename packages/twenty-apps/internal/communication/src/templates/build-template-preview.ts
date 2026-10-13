import { type BulkRecipient } from 'src/bulk/resolve-bulk-recipients';
import {
  interpolateTemplate,
  type TemplateInterpolationIssue,
} from 'src/templates/interpolate-template';
import {
  type TemplateValueMap,
  type TemplateVariableCatalog,
} from 'src/templates/template-variable-catalog';

export type TemplateRecipientPreview = {
  personId: string;
  displayName: string;
  /** The number that would be used, or `null` when not sendable. */
  phone: string | null;
  /** The fully interpolated text for this recipient. */
  previewText: string;
  /** True when any placeholder was unknown or an empty field. */
  hasUnresolvedVariables: boolean;
  /** True when the body is empty or whitespace only. */
  isBodyEmpty: boolean;
  issues: TemplateInterpolationIssue[];
  /**
   * A recipient is ready only when it has a phone, the body is not blank, and
   * no variable is unresolved.
   */
  isReadyToSend: boolean;
};

export type TemplatePreview = {
  previews: TemplateRecipientPreview[];
  /** True when ANY recipient has an unresolved variable. */
  hasUnresolvedVariables: boolean;
  /** True when the body is empty or whitespace only. */
  isBodyEmpty: boolean;
  /** Number of recipients ready to send (phone + non-blank body + no issues). */
  readyCount: number;
};

/**
 * Builds a per-recipient preview. The values were resolved on the SERVER from
 * the authorized records (see `resolve-template-values.ts`) and the catalog is
 * the same server-authoritative one the picker shows; this function never reads
 * a record and never authorizes anything, so the frontend can render the result
 * but cannot be the authority for recipient access or template evaluation.
 */
export const buildTemplatePreview = ({
  body,
  recipients,
  valuesByPersonId,
  catalog,
}: {
  body: string;
  recipients: BulkRecipient[];
  valuesByPersonId: Map<string, TemplateValueMap>;
  catalog: TemplateVariableCatalog;
}): TemplatePreview => {
  // An empty (or whitespace-only) body is never a message: every recipient is
  // reported as not ready, regardless of phone or variables.
  const isBodyEmpty = body.trim().length === 0;

  const previews: TemplateRecipientPreview[] = recipients.map((recipient) => {
    const values = valuesByPersonId.get(recipient.personId) ?? new Map();

    const interpolated = interpolateTemplate({ body, values, catalog });
    const hasPhone = recipient.selectedPhone !== null;

    return {
      personId: recipient.personId,
      displayName: recipient.displayName,
      phone: recipient.selectedPhone,
      previewText: interpolated.text,
      hasUnresolvedVariables: interpolated.hasUnresolvedVariables,
      isBodyEmpty,
      issues: interpolated.issues,
      // An unresolved variable or a blank body must NEVER be ready to send.
      isReadyToSend:
        hasPhone && !interpolated.hasUnresolvedVariables && !isBodyEmpty,
    };
  });

  return {
    previews,
    hasUnresolvedVariables: previews.some(
      (preview) => preview.hasUnresolvedVariables,
    ),
    isBodyEmpty,
    readyCount: previews.filter((preview) => preview.isReadyToSend).length,
  };
};
