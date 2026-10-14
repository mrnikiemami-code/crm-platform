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
 */
export type TemplateRecordWithSource = StudioTemplate & {
  /** Stored `nameSingular`; empty when the row predates the source model. */
  sourceObjectName: string;
  /** Stored relation field name; empty for a Person source. */
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
      updatedAt: true,
    },
  });

  return toTemplateRecord(
    result.updateMessageTemplate as RawMutationNode | null | undefined,
  );
};

/**
 * Writes ONLY the body of one template.
 *
 * The update is scoped to `updatedAt` equality with what the caller loaded: if
 * another session changed the record meanwhile, the platform matches no row and
 * returns nothing, which the caller reports as a conflict instead of silently
 * overwriting the other change.
 */
export const saveMessageTemplateBody = async ({
  client,
  id,
  body,
  expectedUpdatedAt,
}: {
  client: MutationClient;
  id: string;
  body: string;
  expectedUpdatedAt: string | null;
}): Promise<TemplateRecordWithSource | null> => {
  const filter =
    expectedUpdatedAt !== null && expectedUpdatedAt.length > 0
      ? { id: { eq: id }, updatedAt: { eq: expectedUpdatedAt } }
      : { id: { eq: id } };

  const result = await client.mutation({
    updateMessageTemplate: {
      __args: { id, data: { body }, filter },
      id: true,
      title: true,
      body: true,
      targetObject: true,
      sourceObjectName: true,
      recipientRelation: true,
      updatedAt: true,
    },
  });

  return toTemplateRecord(
    result.updateMessageTemplate as RawMutationNode | null | undefined,
  );
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
