import {
  type MessageTemplateRecord,
} from 'src/templates/data/find-message-templates';
import {
  type EligibleTemplateSource,
  PERSON_SOURCE_OBJECT_NAME,
} from 'src/templates/data/find-eligible-template-sources';

// Filters the template list down to the templates that can actually be used for
// ONE selected source. It is pure, so the exact rule that ships is unit-tested
// without a workspace.
//
// Why the server must do this: the composer previously received every template in
// the workspace and offered them all, so an Opportunity template could be picked
// while composing for a Person. That template's `@source.*` tokens cannot resolve
// against a Person, so the picker was advertising a choice that could only fail
// later. Filtering here means the UI cannot offer it in the first place.

/**
 * The templates usable for `sourceObjectUid`.
 *
 * The rule is an EQUALITY on the stored source identifier, with one deliberate
 * exception: a template whose stored source is EMPTY predates the source model
 * and means Person (the existing contract, see `resolveStoredTemplateSource`), so
 * it is offered for a Person source and only for a Person source.
 *
 * An unknown `sourceObjectUid` — one that is not in the eligible set — yields an
 * EMPTY list. It never falls back to the Person templates, because doing so would
 * offer exactly the mismatched templates this function exists to hide.
 */
export const filterTemplatesForSource = ({
  templates,
  sources,
  sourceObjectUid,
}: {
  templates: readonly MessageTemplateRecord[];
  sources: readonly EligibleTemplateSource[];
  sourceObjectUid: string;
}): MessageTemplateRecord[] => {
  const source = sources.find((entry) => entry.objectUid === sourceObjectUid);

  if (source === undefined) {
    return [];
  }

  const isPersonSource = source.objectName === PERSON_SOURCE_OBJECT_NAME;

  return templates.filter((template) =>
    template.sourceObjectUid.length > 0
      ? template.sourceObjectUid === source.objectUid
      : isPersonSource,
  );
};

/**
 * The `universalIdentifier` of the object a template's stored source names, or
 * `''` when the row has no stored source (the legacy Person meaning).
 *
 * Returned as-is rather than resolved: the caller already has the eligible set
 * and resolving a stale identifier is `resolveStoredTemplateSource`'s job.
 */
export const readStoredSourceUid = (
  template: MessageTemplateRecord,
): string => template.sourceObjectUid;
