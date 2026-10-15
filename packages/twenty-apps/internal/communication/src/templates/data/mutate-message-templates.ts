import { type CoreApiClient } from 'twenty-client-sdk/core';

import { readTemplateTargetObject } from 'src/studio/template-studio-contract';
import { type StudioTemplate } from 'src/studio/template-studio-logic';

// Writes this workspace's NATIVE `messageTemplate` records through the
// workspace-scoped `CoreApiClient`. There is no second table, no local storage
// and no duplicated model: create/update/delete all go through the same object
// the composers already read.
//
// The BODY is written verbatim — it is the canonical technical text with
// `@token` placeholders. Newlines are preserved exactly (the value is never
// trimmed or normalised), and a translated label is NEVER written as a
// substitution identifier.
type MutationClient = Pick<CoreApiClient, 'mutation'>;

type RawMutationNode = {
  id?: string | null;
  title?: string | null;
  body?: string | null;
  targetObject?: string | null;
  sourceObjectName?: string | null;
  recipientRelation?: string | null;
  sourceObjectUid?: string | null;
  recipientRelationUid?: string | null;
  updatedAt?: string | null;
};

const toStudioTemplate = (
  node: RawMutationNode | null | undefined,
): StudioTemplate | null => {
  if (node === null || node === undefined) {
    return null;
  }

  if (typeof node.id !== 'string' || node.id.length === 0) {
    return null;
  }

  return {
    id: node.id,
    title: typeof node.title === 'string' ? node.title : '',
    body: typeof node.body === 'string' ? node.body : '',
    targetObject: readTemplateTargetObject(node.targetObject),
    updatedAt: typeof node.updatedAt === 'string' ? node.updatedAt : '',
  };
};

export type TemplateWriteInput = {
  title: string;
  body: string;
  targetObject: string;
  /** The source object's `nameSingular`; absent means Person. */
  sourceObjectName?: string | null;
  /** The relation field on that object resolving to one Person; empty for Person. */
  recipientRelation?: string | null;
};

/**
 * A template record plus its SOURCE identifiers, as the record-page editor
 * needs them. Kept separate from `StudioTemplate` so the shared composer
 * contract is untouched.
 *
 * Both the stable identifiers and the readable names are returned: the
 * identifiers are what the editor WRITES, and the names are a diagnostic hint
 * only — never an identity.
 */
export type TemplateRecordWithSource = StudioTemplate & {
  /** Stable source-object identifier; empty when the row predates the model. */
  sourceObjectUid: string;
  /** Stable relation-field identifier; empty for a Person source. */
  recipientRelationUid: string;
  /** Readable hint: stored `nameSingular`, resolved from metadata for display. */
  sourceObjectName: string;
  /** Readable hint: stored relation field name. */
  recipientRelation: string;
};

const toTemplateRecord = (
  node: RawMutationNode | null | undefined,
): TemplateRecordWithSource | null => {
  const base = toStudioTemplate(node);

  if (base === null || node === null || node === undefined) {
    return null;
  }

  return {
    ...base,
    sourceObjectUid:
      typeof node.sourceObjectUid === 'string' ? node.sourceObjectUid : '',
    recipientRelationUid:
      typeof node.recipientRelationUid === 'string'
        ? node.recipientRelationUid
        : '',
    sourceObjectName:
      typeof node.sourceObjectName === 'string' ? node.sourceObjectName : '',
    recipientRelation:
      typeof node.recipientRelation === 'string' ? node.recipientRelation : '',
  };
};

/**
 * Reads ONE template by id, for the record-page editor.
 *
 * It returns only this single record's own fields — never a list — so the read
 * is bounded to the record the user is already viewing, and the caller cannot
 * enumerate anything through it.
 */
export const readMessageTemplate = async ({
  client,
  id,
}: {
  client: Pick<CoreApiClient, 'query'>;
  id: string;
}): Promise<TemplateRecordWithSource | null> => {
  const result = await client.query({
    messageTemplate: {
      __args: { filter: { id: { eq: id } } },
      id: true,
      title: true,
      body: true,
      targetObject: true,
      sourceObjectName: true,
      recipientRelation: true,
      sourceObjectUid: true,
      recipientRelationUid: true,
      updatedAt: true,
    },
  });

  return toTemplateRecord(
    result.messageTemplate as RawMutationNode | null | undefined,
  );
};

/**
 * Writes the source model of one template, leaving the body untouched.
 *
 * Separate from `updateMessageTemplate` on purpose: choosing a source must not
 * require rewriting the text, and a save of the source alone cannot clobber
 * text that another session changed meanwhile.
 */
export const updateMessageTemplateSource = async ({
  client,
  id,
  sourceObjectName,
  recipientRelation,
  targetObject,
}: {
  client: MutationClient;
  id: string;
  sourceObjectName: string;
  recipientRelation: string;
  targetObject: string;
}): Promise<TemplateRecordWithSource | null> => {
  const result = await client.mutation({
    updateMessageTemplate: {
      __args: {
        id,
        data: {
          sourceObjectName,
          recipientRelation,
          targetObject,
        },
      },
      id: true,
      title: true,
      body: true,
      targetObject: true,
      sourceObjectName: true,
      recipientRelation: true,
      sourceObjectUid: true,
      recipientRelationUid: true,
      updatedAt: true,
    },
  });

  return toTemplateRecord(
    result.updateMessageTemplate as RawMutationNode | null | undefined,
  );
};

/**
 * Writes the whole conditional save in ONE request: the body AND the source
 * identifiers, guarded by a real compare-and-set.
 *
 * The platform's batch `updateMessageTemplates(data, filter)` accepts a filter on
 * `id` + `updatedAt` (verified against the live schema) and returns the updated
 * records as a LIST. An EMPTY list therefore means the filter matched nothing —
 * i.e. another session changed the record after the caller loaded it — which is
 * reported as `CONFLICT`. That is a genuine compare-and-set, not a check-then-write:
 * the decision and the write are the same statement.
 *
 * `updatedAt` is optional because a caller may legitimately save without having
 * loaded a version (a freshly created record); when it is absent the write is
 * unconditional and no conflict can be reported.
 */
export const saveMessageTemplateConditionally = async ({
  client,
  id,
  body,
  sourceObjectUid,
  recipientRelationUid,
  targetObject,
  expectedUpdatedAt,
}: {
  client: MutationClient;
  id: string;
  body: string;
  sourceObjectUid: string;
  recipientRelationUid: string;
  targetObject: string;
  expectedUpdatedAt: string | null;
}): Promise<
  | { kind: 'SAVED'; template: TemplateRecordWithSource }
  | { kind: 'CONFLICT' }
> => {
  const filter =
    expectedUpdatedAt !== null && expectedUpdatedAt.length > 0
      ? { id: { eq: id }, updatedAt: { eq: expectedUpdatedAt } }
      : { id: { eq: id } };

  const result = await client.mutation({
    updateMessageTemplates: {
      __args: {
        data: {
          body,
          sourceObjectUid,
          recipientRelationUid,
          targetObject,
        },
        filter,
      },
      id: true,
      title: true,
      body: true,
      targetObject: true,
      sourceObjectName: true,
      recipientRelation: true,
      sourceObjectUid: true,
      recipientRelationUid: true,
      updatedAt: true,
    },
  });

  const updated = Array.isArray(result.updateMessageTemplates)
    ? (result.updateMessageTemplates as (RawMutationNode | null)[])
    : [];

  const first = updated.find(
    (node): node is RawMutationNode => node !== null && node !== undefined,
  );

  return first === undefined
    ? { kind: 'CONFLICT' }
    : { kind: 'SAVED', template: toTemplateRecord(first)! };
};

export const createMessageTemplate = async ({
  client,
  input,
}: {
  client: MutationClient;
  input: TemplateWriteInput;
}): Promise<StudioTemplate | null> => {
  const result = await client.mutation({
    createMessageTemplate: {
      __args: {
        data: {
          title: input.title,
          body: input.body,
          targetObject: input.targetObject,
        },
      },
      id: true,
      title: true,
      body: true,
      targetObject: true,
      updatedAt: true,
    },
  });

  return toStudioTemplate(
    result.createMessageTemplate as RawMutationNode | null | undefined,
  );
};

export const updateMessageTemplate = async ({
  client,
  id,
  input,
}: {
  client: MutationClient;
  id: string;
  input: TemplateWriteInput;
}): Promise<StudioTemplate | null> => {
  const result = await client.mutation({
    updateMessageTemplate: {
      __args: {
        id,
        data: {
          title: input.title,
          body: input.body,
          targetObject: input.targetObject,
        },
      },
      id: true,
      title: true,
      body: true,
      targetObject: true,
      updatedAt: true,
    },
  });

  return toStudioTemplate(
    result.updateMessageTemplate as RawMutationNode | null | undefined,
  );
};

/**
 * Deletes one template. This is a SOFT delete (`deleteMessageTemplate`), the
 * platform's normal delete: it removes the template from the studio and the
 * composers while keeping the row recoverable, and it is the operation the app's
 * role is authorized for — hard destroy stays denied on purpose.
 *
 * Returns the deleted id, or `null` when the platform did not return one (which
 * the caller reports as NOT_FOUND rather than success).
 */
export const deleteMessageTemplate = async ({
  client,
  id,
}: {
  client: MutationClient;
  id: string;
}): Promise<string | null> => {
  const result = await client.mutation({
    deleteMessageTemplate: {
      __args: { id },
      id: true,
    },
  });

  const deletedId = (
    result.deleteMessageTemplate as RawMutationNode | null | undefined
  )?.id;

  return typeof deletedId === 'string' && deletedId.length > 0
    ? deletedId
    : null;
};
