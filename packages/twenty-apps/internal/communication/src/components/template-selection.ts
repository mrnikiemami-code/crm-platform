// The template-selector behavior shared by the single-person and bulk
// composers. It is pure and lives outside React so the EXACT semantics that
// ship can be unit-tested without the front-component sandbox.
//
// The rules (W17 §C):
//  - the first option is always «بدون الگو» ("No template"), id `''`;
//  - choosing a template copies its body into the editor and attaches the draft
//    to that template;
//  - choosing «بدون الگو» clears the body ONLY while it is still exactly what a
//    template inserted — a manually edited draft is left alone;
//  - a manual edit detaches the draft from its template (and never touches the
//    saved record).

export type TemplateOption = {
  id: string;
  title: string;
  body: string;
  channel: string;
};

/** The id of the «بدون الگو» option. */
export const NO_TEMPLATE_ID = '';

// What a template-selector change should do to the message body.
export type TemplateChoiceOutcome =
  | { kind: 'INSERT'; body: string }
  | { kind: 'CLEAR' }
  | { kind: 'NONE' };

/**
 * Resolves what choosing `templateId` does to the body.
 *
 * `attachedBody` is the exact text the current template inserted, or `null`
 * once the draft has been detached (edited, or never attached). It is what
 * distinguishes "the template's own body" — which «بدون الگو» may clear — from
 * "the user's typed text", which it must never discard.
 */
export const resolveTemplateChoice = ({
  templateId,
  templates,
  attachedBody,
}: {
  templateId: string;
  templates: readonly TemplateOption[];
  attachedBody: string | null;
}): TemplateChoiceOutcome => {
  if (templateId === NO_TEMPLATE_ID) {
    return attachedBody !== null ? { kind: 'CLEAR' } : { kind: 'NONE' };
  }

  const template = templates.find((candidate) => candidate.id === templateId);

  return template === undefined
    ? { kind: 'NONE' }
    : { kind: 'INSERT', body: template.body };
};

/**
 * Whether a manual body edit detaches the draft from its template. Editing the
 * text that a template inserted (to anything other than the inserted text
 * itself) detaches it; retyping the exact same text does not.
 */
export const doesBodyEditDetach = ({
  attachedBody,
  body,
}: {
  attachedBody: string | null;
  body: string;
}): boolean => attachedBody !== null && body !== attachedBody;

/**
 * The label to show for one template option. A template with a blank title
 * falls back to its id so the option is never blank.
 */
export const templateOptionLabel = (template: TemplateOption): string =>
  template.title.trim().length > 0 ? template.title : template.id;
